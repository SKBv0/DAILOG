import * as React from "react";
import Fuse, { type FuseResult } from "fuse.js";
import { DialogNode, Tag } from "../types/dialog";
import { Connection } from "../types/nodes";
import { isFeatureEnabled } from "../config/features";
import { performanceProfiler } from "./performanceProfiler";
import logger from "./logger";

export interface SearchableItem {
  id: string;
  type: "node" | "connection" | "tag" | "path";
  title: string;
  content: string;
  metadata?: {
    nodeType?: string;
    tags?: string[];
    position?: { x: number; y: number };
    connections?: string[];
    importance?: number;
  };
  originalData?: string | string[];
}

export interface SearchResult<T = SearchableItem> {
  item: T;
  score: number;
  matches?: any;
  highlights: string[];
}

export interface SearchOptions {
  threshold?: number;
  includeScore?: boolean;
  includeMatches?: boolean;
  ignoreLocation?: boolean;
  findAllMatches?: boolean;
  minMatchCharLength?: number;
  keys?: string[];
  shouldSort?: boolean;
  sortFn?: (a: any, b: any) => number;
}

export interface SearchFilters {
  nodeTypes?: string[];
  hasConnections?: boolean;
  hasTags?: boolean;
  minImportance?: number;
  createdAfter?: Date;
  createdBefore?: Date;
}

class FuzzySearchEngine {
  private nodeIndex: Fuse<SearchableItem> | null = null;
  private connectionIndex: Fuse<SearchableItem> | null = null;
  private globalIndex: Fuse<SearchableItem> | null = null;

  private searchCache = new Map<string, SearchResult[]>();
  private lastIndexUpdate = 0;
  private indexingInProgress = false;

  private readonly cacheSize = 50;
  private readonly cacheExpiry = 180000; // 3 minutes
  private cacheTimestamps = new Map<string, number>();

  // Optimized Fuse.js configurations
  private readonly configs = {
    nodes: {
      threshold: 0.4,
      includeScore: true,
      includeMatches: true,
      ignoreLocation: true,
      findAllMatches: true,
      minMatchCharLength: 2,
      keys: [
        { name: "title", weight: 3 },
        { name: "content", weight: 2 },
        { name: "metadata.nodeType", weight: 1.5 },
        { name: "metadata.tags", weight: 1 },
      ],
    },
    connections: {
      threshold: 0.5,
      includeScore: true,
      includeMatches: true,
      ignoreLocation: true,
      keys: [
        { name: "title", weight: 2 },
        { name: "content", weight: 1 },
      ],
    },
    tags: {
      threshold: 0.3,
      includeScore: true,
      includeMatches: true,
      ignoreLocation: true,
      keys: [
        { name: "title", weight: 3 },
        { name: "content", weight: 2 },
      ],
    },
    global: {
      threshold: 0.4,
      includeScore: true,
      includeMatches: true,
      ignoreLocation: true,
      findAllMatches: true,
      minMatchCharLength: 1,
      keys: [
        { name: "title", weight: 3 },
        { name: "content", weight: 2 },
        { name: "metadata.nodeType", weight: 1.5 },
        { name: "metadata.tags", weight: 1 },
        { name: "type", weight: 0.5 },
      ],
    },
  };

  /**
   * Index nodes for search
   */
  async indexNodes(nodes: DialogNode[]): Promise<void> {
    if (!isFeatureEnabled("FUZZY_SEARCH") || this.indexingInProgress) return;

    this.indexingInProgress = true;
    const startTime = performance.now();

    try {
      const searchableNodes: SearchableItem[] = nodes.slice(0, 5000).map((node) => ({
        id: node.id,
        type: "node" as const,
        title: this.extractTitle(node.data.text),
        content: node.data.text,
        metadata: {
          nodeType: node.type,
          tags:
            node.data.metadata?.nodeData?.tags?.map((tag: Tag | string) =>
              typeof tag === "string" ? tag : tag.label || tag.id
            ) || [],
          position: node.position,
          importance: this.calculateNodeImportance(node),
        },
        // Avoid holding full node objects
      }));

      // Lazy create index with chunking to avoid long main-thread locks
      this.nodeIndex = new Fuse(searchableNodes, this.configs.nodes);
      this.lastIndexUpdate = Date.now();

      // Clear cache when index is updated
      this.searchCache.clear();

      const duration = performance.now() - startTime;
      performanceProfiler.recordCustomMetric("fuzzy-search-index-nodes", duration);

      logger.debug(`[FuzzySearch] Indexed ${nodes.length} nodes in ${duration.toFixed(2)}ms`);
    } finally {
      this.indexingInProgress = false;
    }
  }

  /**
   * Index connections for search
   */
  async indexConnections(connections: Connection[], nodes: DialogNode[]): Promise<void> {
    if (!isFeatureEnabled("FUZZY_SEARCH")) return;

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    const searchableConnections: SearchableItem[] = connections.map((conn) => {
      const sourceNode = nodeMap.get(conn.source);
      const targetNode = nodeMap.get(conn.target);

      return {
        id: conn.id || `${conn.source}-${conn.target}`,
        type: "connection" as const,
        title: `${sourceNode?.data.text.substring(0, 30) || conn.source} → ${targetNode?.data.text.substring(0, 30) || conn.target}`,
        content: `Connection from "${sourceNode?.data.text || conn.source}" to "${targetNode?.data.text || conn.target}"`,
        metadata: {
          connections: [conn.source, conn.target],
          importance: 1,
        },
        // Store only id to reconstruct later
        originalData: conn.id || `${conn.source}-${conn.target}`,
      };
    });

    this.connectionIndex = new Fuse(searchableConnections, this.configs.connections);
  }

  /**
   * Create global search index for all items
   */
  async createGlobalIndex(nodes: DialogNode[], connections: Connection[]): Promise<void> {
    if (!isFeatureEnabled("FUZZY_SEARCH")) return;

    const allItems: SearchableItem[] = [];

    // Add nodes (copy only minimal fields)
    if (this.nodeIndex) {
      const docs = (this.nodeIndex as any)._docs as SearchableItem[];
      docs.forEach((d) => {
        allItems.push({
          id: d.id,
          type: d.type,
          title: d.title,
          content: d.content,
          metadata: d.metadata,
        });
      });
    }

    // Add connections (copy only minimal fields)
    if (this.connectionIndex) {
      const docs = (this.connectionIndex as any)._docs as SearchableItem[];
      docs.forEach((d) => {
        allItems.push({
          id: d.id,
          type: d.type,
          title: d.title,
          content: d.content,
          metadata: d.metadata,
          originalData: d.originalData, // id string
        });
      });
    }

    // Add dialog paths (derived from connections)
    const pathItems = this.createPathItems(nodes, connections);
    allItems.push(...pathItems);

    this.globalIndex = new Fuse(allItems, this.configs.global);
  }

  /**
   * Search nodes with advanced options
   */
  searchNodes(query: string, options?: SearchOptions, filters?: SearchFilters): SearchResult[] {
    if (!this.nodeIndex || !isFeatureEnabled("FUZZY_SEARCH") || !query.trim()) {
      return [];
    }

    const cacheKey = `nodes:${query}:${JSON.stringify(options)}:${JSON.stringify(filters)}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const startTime = performance.now();
    const fuseOptions: any = { limit: 50, ...this.configs.nodes, ...options };
    let results = this.nodeIndex
      .search(query, fuseOptions as any)
      .map((result) => this.transformResult(result));

    // Apply filters
    if (filters) {
      results = this.applyFilters(results, filters);
    }

    // Sort by relevance and importance
    results = this.sortResults(results);

    const duration = performance.now() - startTime;
    performanceProfiler.recordCustomMetric("fuzzy-search-nodes", duration);

    this.setCache(cacheKey, results);
    return results;
  }

  /**
   * Search connections
   */
  searchConnections(query: string, options?: SearchOptions): SearchResult[] {
    if (!this.connectionIndex || !isFeatureEnabled("FUZZY_SEARCH") || !query.trim()) {
      return [];
    }

    const cacheKey = `connections:${query}:${JSON.stringify(options)}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const fuseOptions: any = { limit: 50, ...this.configs.connections, ...options };
    const results = this.connectionIndex
      .search(query, fuseOptions as any)
      .map((result) => this.transformResult(result));

    this.setCache(cacheKey, results);
    return results;
  }

  /**
   * Global search across all indexed items
   */
  globalSearch(query: string, options?: SearchOptions): SearchResult[] {
    if (!this.globalIndex || !isFeatureEnabled("FUZZY_SEARCH") || !query.trim()) {
      return [];
    }

    const cacheKey = `global:${query}:${JSON.stringify(options)}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const startTime = performance.now();
    const fuseOptions: any = { limit: 100, ...this.configs.global, ...options };
    const results = this.globalIndex
      .search(query, fuseOptions as any)
      .map((result) => this.transformResult(result))
      .slice(0, 50); // Limit global results

    const duration = performance.now() - startTime;
    performanceProfiler.recordCustomMetric("fuzzy-search-global", duration);

    this.setCache(cacheKey, results);
    return results;
  }

  /**
   * Smart search with context-aware suggestions
   */
  smartSearch(
    query: string,
    context?: {
      currentNode?: string;
      recentNodes?: string[];
      preferredTypes?: string[];
    }
  ): {
    primary: SearchResult[];
    suggestions: SearchResult[];
    contextual: SearchResult[];
  } {
    if (!isFeatureEnabled("FUZZY_SEARCH")) {
      return { primary: [], suggestions: [], contextual: [] };
    }

    const primary = this.globalSearch(query, { threshold: 0.3 });

    // Generate smart suggestions based on partial matches
    const suggestions = query.length >= 2 ? this.generateSuggestions(query) : [];

    // Contextual results based on current position
    const contextual = context ? this.getContextualResults(query, context) : [];

    return { primary, suggestions, contextual };
  }

  /**
   * Get search suggestions for autocomplete
   */
  getSuggestions(partialQuery: string, limit: number = 5): string[] {
    if (!isFeatureEnabled("FUZZY_SEARCH") || partialQuery.length < 2) {
      return [];
    }

    const results = this.globalSearch(partialQuery, { threshold: 0.6 });
    const suggestions = new Set<string>();

    for (const result of results) {
      if (suggestions.size >= limit) break;

      // Extract meaningful phrases from titles and content
      const phrases = this.extractPhrases(result.item.title, partialQuery);
      phrases.forEach((phrase) => suggestions.add(phrase));
    }

    return Array.from(suggestions).slice(0, limit);
  }

  // Private helper methods
  private extractTitle(text: string): string {
    return text.length > 50 ? text.substring(0, 47) + "..." : text;
  }

  private calculateNodeImportance(node: DialogNode): number {
    let importance = 1;

    // Boost importance based on content length
    if (node.data.text.length > 100) importance += 0.5;

    // Boost importance based on tags
    const tagCount = node.data.metadata?.nodeData?.tags?.length || 0;
    importance += tagCount * 0.2;

    // Boost certain node types
    if (["npcDialog", "playerResponse"].includes(node.type)) {
      importance += 0.3;
    }

    return Math.min(importance, 3); // Cap at 3
  }

  private createPathItems(nodes: DialogNode[], connections: Connection[]): SearchableItem[] {
    const pathItems: SearchableItem[] = [];
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    // Create path items for connected sequences
    const visitedNodes = new Set<string>();

    nodes.forEach((startNode) => {
      if (visitedNodes.has(startNode.id)) return;

      const path = this.findPath(startNode, connections, nodeMap, 3);
      if (path.length >= 2) {
        const pathText = path.map((n) => n.data.text).join(" → ");
        pathItems.push({
          id: `path-${path[0].id}-${path[path.length - 1].id}`,
          type: "path",
          title: `Path: ${this.extractTitle(pathText)}`,
          content: pathText,
          metadata: {
            connections: path.map((n) => n.id),
            importance: path.length * 0.5,
          },
          // Store only first node id for selection; avoid full node arrays
          originalData: path[0]?.id,
        });

        path.forEach((n) => visitedNodes.add(n.id));
      }
    });

    return pathItems;
  }

  private findPath(
    startNode: DialogNode,
    connections: Connection[],
    nodeMap: Map<string, DialogNode>,
    maxDepth: number
  ): DialogNode[] {
    const path = [startNode];
    let currentNode = startNode;

    for (let i = 0; i < maxDepth; i++) {
      const nextConnection = connections.find((c) => c.source === currentNode.id);
      if (!nextConnection) break;

      const nextNode = nodeMap.get(nextConnection.target);
      if (!nextNode || path.includes(nextNode)) break;

      path.push(nextNode);
      currentNode = nextNode;
    }

    return path;
  }

  private transformResult(fuseResult: FuseResult<SearchableItem>): SearchResult {
    const highlights = this.extractHighlights(fuseResult);

    return {
      item: fuseResult.item,
      score: fuseResult.score || 0,
      matches: fuseResult.matches,
      highlights,
    };
  }

  private extractHighlights(fuseResult: FuseResult<SearchableItem>): string[] {
    const highlights: string[] = [];

    if (fuseResult.matches) {
      fuseResult.matches.forEach((match) => {
        if (match.indices) {
          match.indices.forEach(([start, end]) => {
            const highlight = match.value?.substring(start, end + 1);
            if (highlight && !highlights.includes(highlight)) {
              highlights.push(highlight);
            }
          });
        }
      });
    }

    return highlights;
  }

  private applyFilters(results: SearchResult[], filters: SearchFilters): SearchResult[] {
    return results.filter((result) => {
      const { item } = result;

      if (filters.nodeTypes && !filters.nodeTypes.includes(item.metadata?.nodeType || "")) {
        return false;
      }

      if (
        filters.hasConnections !== undefined &&
        Boolean(item.metadata?.connections?.length) !== filters.hasConnections
      ) {
        return false;
      }

      if (
        filters.hasTags !== undefined &&
        Boolean(item.metadata?.tags?.length) !== filters.hasTags
      ) {
        return false;
      }

      if (
        filters.minImportance !== undefined &&
        (item.metadata?.importance || 0) < filters.minImportance
      ) {
        return false;
      }

      return true;
    });
  }

  private sortResults(results: SearchResult[]): SearchResult[] {
    return results.sort((a, b) => {
      // First sort by score (lower is better for Fuse.js)
      const scoreDiff = a.score - b.score;
      if (Math.abs(scoreDiff) > 0.1) return scoreDiff;

      // Then by importance
      const importanceA = a.item.metadata?.importance || 0;
      const importanceB = b.item.metadata?.importance || 0;
      return importanceB - importanceA;
    });
  }

  private generateSuggestions(query: string): SearchResult[] {
    // Generate variations of the query for better suggestions
    const variations = [
      query.toLowerCase(),
      query.charAt(0).toUpperCase() + query.slice(1),
      ...this.getTypoVariations(query),
    ];

    const allSuggestions: SearchResult[] = [];

    variations.forEach((variation) => {
      const results = this.globalSearch(variation, { threshold: 0.7 });
      allSuggestions.push(...results);
    });

    // Remove duplicates and return top suggestions
    const unique = allSuggestions.filter(
      (result, index, arr) => arr.findIndex((r) => r.item.id === result.item.id) === index
    );

    return unique.slice(0, 3);
  }

  private getTypoVariations(query: string): string[] {
    // Simple typo variations (more sophisticated algorithms could be added)
    const variations: string[] = [];

    if (query.length > 3) {
      // Character transpositions
      for (let i = 0; i < query.length - 1; i++) {
        const chars = query.split("");
        [chars[i], chars[i + 1]] = [chars[i + 1], chars[i]];
        variations.push(chars.join(""));
      }
    }

    return variations;
  }

  private getContextualResults(
    query: string,
    context: NonNullable<Parameters<typeof this.smartSearch>[1]>
  ): SearchResult[] {
    // Implementation for contextual search based on current node, recent nodes, etc.
    const contextual: SearchResult[] = [];

    if (context.currentNode && this.nodeIndex) {
      // Find related nodes
      const currentResults = this.searchNodes(`${query} related:${context.currentNode}`);
      contextual.push(...currentResults.slice(0, 2));
    }

    return contextual;
  }

  private extractPhrases(text: string, query: string): string[] {
    const words = text.toLowerCase().split(/\s+/);
    const queryWords = query.toLowerCase().split(/\s+/);
    const phrases: string[] = [];

    // Extract phrases that contain query words
    for (let i = 0; i < words.length; i++) {
      for (let j = i + 1; j <= Math.min(i + 3, words.length); j++) {
        const phrase = words.slice(i, j).join(" ");
        if (queryWords.some((qWord) => phrase.includes(qWord))) {
          phrases.push(phrase);
        }
      }
    }

    return phrases;
  }

  private getFromCache(key: string): SearchResult[] | null {
    const cached = this.searchCache.get(key);
    if (!cached) return null;
    const ts = this.cacheTimestamps.get(key) || 0;
    if (Date.now() - ts > this.cacheExpiry) {
      this.searchCache.delete(key);
      this.cacheTimestamps.delete(key);
      return null;
    }
    return cached;
  }

  private setCache(key: string, results: SearchResult[]): void {
    // Evict expired entries
    for (const [k, ts] of this.cacheTimestamps.entries()) {
      if (Date.now() - ts > this.cacheExpiry) {
        this.cacheTimestamps.delete(k);
        this.searchCache.delete(k);
      }
    }

    if (this.searchCache.size >= this.cacheSize) {
      const firstKey = this.searchCache.keys().next().value;
      if (firstKey !== undefined) {
        this.searchCache.delete(firstKey);
        this.cacheTimestamps.delete(firstKey);
      }
    }

    this.searchCache.set(key, results);
    this.cacheTimestamps.set(key, Date.now());
  }

  /**
   * Clear all caches and indexes
   */
  clear(): void {
    this.nodeIndex = null;
    this.connectionIndex = null;
    this.globalIndex = null;
    this.searchCache.clear();
  }

  /**
   * Get search engine statistics
   */
  getStats() {
    return {
      enabled: isFeatureEnabled("FUZZY_SEARCH"),
      indexes: {
        nodes: this.nodeIndex ? (this.nodeIndex as any)._docs?.length || 0 : 0,
        connections: this.connectionIndex ? (this.connectionIndex as any)._docs?.length || 0 : 0,
        global: this.globalIndex ? (this.globalIndex as any)._docs?.length || 0 : 0,
      },
      cache: {
        size: this.searchCache.size,
        maxSize: this.cacheSize,
      },
      lastIndexUpdate: this.lastIndexUpdate,
      indexingInProgress: this.indexingInProgress,
    };
  }
}

// Global search engine instance
export const fuzzySearchEngine = new FuzzySearchEngine();

// React hook for fuzzy search
export function useFuzzySearch() {
  const api = React.useMemo(
    () => ({
      searchNodes: fuzzySearchEngine.searchNodes.bind(fuzzySearchEngine),
      searchConnections: fuzzySearchEngine.searchConnections.bind(fuzzySearchEngine),
      globalSearch: fuzzySearchEngine.globalSearch.bind(fuzzySearchEngine),
      smartSearch: fuzzySearchEngine.smartSearch.bind(fuzzySearchEngine),
      getSuggestions: fuzzySearchEngine.getSuggestions.bind(fuzzySearchEngine),
      indexNodes: fuzzySearchEngine.indexNodes.bind(fuzzySearchEngine),
      indexConnections: fuzzySearchEngine.indexConnections.bind(fuzzySearchEngine),
      createGlobalIndex: fuzzySearchEngine.createGlobalIndex.bind(fuzzySearchEngine),
      getStats: fuzzySearchEngine.getStats.bind(fuzzySearchEngine),
      clear: fuzzySearchEngine.clear.bind(fuzzySearchEngine),
    }),
    []
  );

  return api;
}

// Development utilities
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__fuzzySearchEngine = fuzzySearchEngine;
}
