import * as Comlink from "comlink";
import Fuse from "fuse.js";
import type { IFuseOptions, FuseResult } from "fuse.js";

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
  limit?: number;
  includeMatches?: boolean;
}

export interface IndexStats {
  totalItems: number;
  lastUpdated: number;
  indexingInProgress: boolean;
  version: number;
}

class FuzzySearchWorker {
  private nodeIndex: Fuse<SearchableItem> | null = null;
  private connectionIndex: Fuse<SearchableItem> | null = null;
  private globalIndex: Fuse<SearchableItem> | null = null;

  private nodeItems: SearchableItem[] = [];
  private connectionItems: SearchableItem[] = [];
  private globalItems: SearchableItem[] = [];

  private indexStats: IndexStats = {
    totalItems: 0,
    lastUpdated: Date.now(),
    indexingInProgress: false,
    version: 1,
  };

  private defaultFuseOptions: IFuseOptions<SearchableItem> = {
    includeScore: true,
    includeMatches: true,
    threshold: 0.3, // Lower threshold = more matches (0.0 = exact match, 1.0 = no match)
    location: 0,
    distance: 100,
    minMatchCharLength: 1, // Allow single character searches
    keys: [
      { name: "title", weight: 0.5 }, // Increased weight for title
      { name: "content", weight: 0.4 }, // Increased weight for content
      { name: "metadata.nodeType", weight: 0.1 },
      { name: "metadata.tags", weight: 0.1 },
    ],
  };

  async indexNodes(nodes: any[]): Promise<void> {
    this.indexStats.indexingInProgress = true;

    try {
      this.nodeItems = nodes.map((node) => this.convertNodeToSearchable(node));
      this.nodeIndex = new Fuse(this.nodeItems, this.defaultFuseOptions);

      console.log('[FuzzySearchWorker] indexNodes completed', {
        nodesCount: nodes.length,
        nodeItemsCount: this.nodeItems.length,
        hasNodeIndex: !!this.nodeIndex,
        sampleItem: this.nodeItems[0]?.title || 'none'
      });

      this.updateIndexStats();
    } catch (error) {
      console.error('[FuzzySearchWorker] Error indexing nodes:', error);
    } finally {
      this.indexStats.indexingInProgress = false;
    }
  }

  async indexConnections(connections: any[], nodes: any[]): Promise<void> {
    this.indexStats.indexingInProgress = true;

    try {
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));
      this.connectionItems = connections.map((conn) =>
        this.convertConnectionToSearchable(conn, nodeMap)
      );
      this.connectionIndex = new Fuse(this.connectionItems, this.defaultFuseOptions);

      console.log('[FuzzySearchWorker] indexConnections completed', {
        connectionsCount: connections.length,
        connectionItemsCount: this.connectionItems.length,
        hasConnectionIndex: !!this.connectionIndex
      });

      this.updateIndexStats();
    } catch (error) {
      console.error('[FuzzySearchWorker] Error indexing connections:', error);
    } finally {
      this.indexStats.indexingInProgress = false;
    }
  }

  async createGlobalIndex(nodes: any[], connections: any[]): Promise<void> {
    this.indexStats.indexingInProgress = true;

    try {
      await this.indexNodes(nodes);
      await this.indexConnections(connections, nodes);

      this.globalItems = [...this.nodeItems, ...this.connectionItems];
      this.globalIndex = new Fuse(this.globalItems, this.defaultFuseOptions);

      console.log('[FuzzySearchWorker] Global index created', {
        nodeItems: this.nodeItems.length,
        connectionItems: this.connectionItems.length,
        globalItems: this.globalItems.length,
        hasGlobalIndex: !!this.globalIndex,
        sampleItem: this.globalItems[0]?.title || 'none'
      });

      this.updateIndexStats();
    } catch (error) {
      console.error('[FuzzySearchWorker] Error creating global index:', error);
    } finally {
      this.indexStats.indexingInProgress = false;
    }
  }

  async updateNode(node: any): Promise<void> {
    if (!this.nodeIndex) return;

    const searchableItem = this.convertNodeToSearchable(node);
    const existingIndex = this.nodeItems.findIndex((item) => item.id === node.id);

    if (existingIndex >= 0) {
      this.nodeItems[existingIndex] = searchableItem;
    } else {
      this.nodeItems.push(searchableItem);
    }

    this.nodeIndex = new Fuse(this.nodeItems, this.defaultFuseOptions);
    this.updateGlobalIndex();
  }

  async removeNode(nodeId: string): Promise<void> {
    if (!this.nodeIndex) return;

    this.nodeItems = this.nodeItems.filter((item) => item.id !== nodeId);
    this.nodeIndex = new Fuse(this.nodeItems, this.defaultFuseOptions);
    this.updateGlobalIndex();
  }

  async searchNodes(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!this.nodeIndex || !query.trim()) return [];

    const results = this.nodeIndex.search(query, {
      limit: options.limit ?? 50,
    });

    return this.processFuseResults(results);
  }

  async searchConnections(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!this.connectionIndex || !query.trim()) return [];

    const results = this.connectionIndex.search(query, {
      limit: options.limit ?? 50,
    });

    return this.processFuseResults(results);
  }

  async smartSearch(
    query: string,
    options: SearchOptions = {}
  ): Promise<{
    primary: SearchResult[];
    suggestions: SearchResult[];
    contextual: SearchResult[];
  }> {
    if (!this.globalIndex || !query.trim()) {
      console.log('[FuzzySearchWorker] smartSearch: no globalIndex or empty query', {
        hasGlobalIndex: !!this.globalIndex,
        query: query.trim(),
        globalItemsCount: this.globalItems.length
      });
      return { primary: [], suggestions: [], contextual: [] };
    }

    const results = this.globalIndex.search(query, {
      limit: options.limit ?? 100,
    });

    console.log('[FuzzySearchWorker] smartSearch results', {
      query,
      rawResultsCount: results.length,
      globalItemsCount: this.globalItems.length,
      sampleResults: results.slice(0, 3).map(r => ({
        title: r.item.title,
        score: r.score,
        content: r.item.content?.substring(0, 50)
      }))
    });

    const processedResults = this.processFuseResults(results);

    const primary = processedResults.filter((result) => result.score < 0.5).slice(0, 20);

    const suggestions = processedResults
      .filter((result) => result.score >= 0.5 && result.score < 0.7)
      .slice(0, 10);

    const contextual = processedResults.filter((result) => result.score >= 0.7).slice(0, 5);

    console.log('[FuzzySearchWorker] smartSearch filtered', {
      query,
      processedCount: processedResults.length,
      primary: primary.length,
      suggestions: suggestions.length,
      contextual: contextual.length
    });

    return { primary, suggestions, contextual };
  }

  async getSuggestions(query: string, limit: number = 5): Promise<string[]> {
    if (!this.globalIndex || !query.trim()) return [];

    const results = this.globalIndex.search(query, { limit: limit * 2 });

    const suggestions = new Set<string>();

    results.forEach((result) => {
      const item = result.item;
      const titleStr = typeof item.title === 'string' 
        ? item.title 
        : (typeof item.title === 'object' && item.title !== null 
            ? JSON.stringify(item.title) 
            : String(item.title || ''));
      
      const words = titleStr.split(" ");
      const queryLower = query.toLowerCase();

      words.forEach((word) => {
        if (word.toLowerCase().startsWith(queryLower) && word.length > query.length) {
          suggestions.add(word);
        }
      });

      if (result.score && result.score < 0.4 && titleStr.length > query.length) {
        suggestions.add(titleStr);
      }
    });

    return Array.from(suggestions).slice(0, limit);
  }

  getStats(): IndexStats {
    return { ...this.indexStats };
  }

  clearIndexes(): void {
    this.nodeIndex = null;
    this.connectionIndex = null;
    this.globalIndex = null;
    this.nodeItems = [];
    this.connectionItems = [];
    this.globalItems = [];

    this.indexStats = {
      totalItems: 0,
      lastUpdated: Date.now(),
      indexingInProgress: false,
      version: this.indexStats.version + 1,
    };
  }

  private convertNodeToSearchable(node: any): SearchableItem {
    const textValue = node.data?.text;
    const title = typeof textValue === 'string' 
      ? textValue 
      : (typeof textValue === 'object' && textValue !== null 
          ? JSON.stringify(textValue) 
          : `${node.type} Node`);
    const content = typeof textValue === 'string' 
      ? textValue 
      : (typeof textValue === 'object' && textValue !== null 
          ? JSON.stringify(textValue) 
          : "");
    
    if (!node.data?.text) {
      console.log('[FuzzySearchWorker] Node without text:', {
        id: node.id,
        type: node.type,
        hasData: !!node.data,
        dataKeys: node.data ? Object.keys(node.data) : []
      });
    }
    
    return {
      id: node.id,
      type: "node",
      title: title,
      content: content,
      metadata: {
        nodeType: node.type,
        tags: node.data?.metadata?.nodeData?.tags || [],
        position: node.position,
        importance: node.data?.importance || 0,
      },
    };
  }

  private convertConnectionToSearchable(
    connection: any,
    nodeMap: Map<string, any>
  ): SearchableItem {
    const sourceNode = nodeMap.get(connection.source);
    const targetNode = nodeMap.get(connection.target);

    const sourceText = sourceNode?.data?.text;
    const targetText = targetNode?.data?.text;
    const sourceTextStr = typeof sourceText === 'string' 
      ? sourceText 
      : (typeof sourceText === 'object' && sourceText !== null 
          ? JSON.stringify(sourceText) 
          : "Unknown");
    const targetTextStr = typeof targetText === 'string' 
      ? targetText 
      : (typeof targetText === 'object' && targetText !== null 
          ? JSON.stringify(targetText) 
          : "Unknown");

    return {
      id: connection.id || `${connection.source}-${connection.target}`,
      type: "connection",
      title: `${sourceTextStr} → ${targetTextStr}`,
      content: `Connection from ${connection.source} to ${connection.target}`,
      metadata: {
        connections: [connection.source, connection.target],
      },
      originalData: connection.id || `${connection.source}-${connection.target}`,
    };
  }

  private processFuseResults(results: FuseResult<SearchableItem>[]): SearchResult[] {
    return results.map((result) => ({
      item: result.item,
      score: result.score || 0,
      matches: result.matches,
      highlights: this.extractHighlights(result.matches || []),
    }));
  }

  private extractHighlights(matches: ReadonlyArray<any>): string[] {
    const highlights = new Set<string>();

    matches.forEach((match) => {
      if (match.indices) {
        match.indices.forEach((index: number[]) => {
          const highlight = match.value.substring(index[0], index[1] + 1);
          highlights.add(highlight);
        });
      }
    });

    return Array.from(highlights);
  }

  private updateGlobalIndex(): void {
    if (this.nodeItems.length > 0 || this.connectionItems.length > 0) {
      this.globalItems = [...this.nodeItems, ...this.connectionItems];
      this.globalIndex = new Fuse(this.globalItems, this.defaultFuseOptions);
    }
  }

  private updateIndexStats(): void {
    this.indexStats = {
      totalItems: this.globalItems.length,
      lastUpdated: Date.now(),
      indexingInProgress: false,
      version: this.indexStats.version + 1,
    };
  }
}

const fuzzySearchWorker = new FuzzySearchWorker();
export default fuzzySearchWorker;

Comlink.expose(fuzzySearchWorker);
