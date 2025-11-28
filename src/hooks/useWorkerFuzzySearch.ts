import { useEffect, useRef, useState, useCallback } from 'react';
import * as Comlink from 'comlink';
import { DialogNode } from '../types/dialog';
import { Connection } from '../types/nodes';
import { isFeatureEnabled } from '../config/features';
import logger from '../utils/logger';

type WorkerType = typeof import('../workers/fuzzySearchWorker').default;

export interface SearchResult {
  item: {
    id: string;
    type: 'node' | 'connection' | 'tag' | 'path';
    title: string;
    content: string;
    metadata?: any;
  };
  score: number;
  matches?: any;
  highlights: string[];
}

export interface SearchOptions {
  threshold?: number;
  limit?: number;
  includeMatches?: boolean;
}

export interface WorkerSearchStats {
  totalItems: number;
  lastUpdated: number;
  indexingInProgress: boolean;
  version: number;
}

export function useWorkerFuzzySearch() {
  const workerRef = useRef<Comlink.Remote<WorkerType> | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [stats, setStats] = useState<WorkerSearchStats>({
    totalItems: 0,
    lastUpdated: Date.now(),
    indexingInProgress: false,
    version: 0,
  });

  useEffect(() => {
    if (!isFeatureEnabled('FUZZY_SEARCH')) {
      logger.debug('[WorkerFuzzySearch] Feature disabled, skipping worker initialization');
      return;
    }

    let cleanup: (() => void) | null = null;

    const initWorker = async () => {
      try {
        const worker = new Worker(
          new URL('../workers/fuzzySearchWorker.ts', import.meta.url),
          { type: 'module' }
        );

        const wrappedWorker = Comlink.wrap<WorkerType>(worker);
        workerRef.current = wrappedWorker;

        cleanup = () => {
          worker.terminate();
          workerRef.current = null;
        };

        setIsInitialized(true);
        logger.debug('[WorkerFuzzySearch] Worker initialized successfully');

      } catch (error) {
        logger.error('[WorkerFuzzySearch] Failed to initialize worker:', error);
      }
    };

    initWorker();

    return () => {
      cleanup?.();
    };
  }, []);

  const indexNodes = useCallback(async (nodes: DialogNode[]): Promise<void> => {
    if (!workerRef.current || !isInitialized) {
      logger.warn('[WorkerFuzzySearch] Worker not initialized, cannot index nodes');
      return;
    }

    setIsIndexing(true);
    
    try {
      await workerRef.current.indexNodes(nodes);
      
      const newStats = await workerRef.current.getStats();
      setStats(newStats);
      
      logger.debug('[WorkerFuzzySearch] Nodes indexed successfully', { 
        count: nodes.length,
        stats: newStats 
      });
    } catch (error) {
      logger.error('[WorkerFuzzySearch] Error indexing nodes:', error);
    } finally {
      setIsIndexing(false);
    }
  }, [isInitialized]);

  const indexConnections = useCallback(async (
    connections: Connection[], 
    nodes: DialogNode[]
  ): Promise<void> => {
    if (!workerRef.current || !isInitialized) {
      logger.warn('[WorkerFuzzySearch] Worker not initialized, cannot index connections');
      return;
    }

    setIsIndexing(true);
    
    try {
      await workerRef.current.indexConnections(connections, nodes);
      
      const newStats = await workerRef.current.getStats();
      setStats(newStats);
      
      logger.debug('[WorkerFuzzySearch] Connections indexed successfully', { 
        count: connections.length,
        stats: newStats 
      });
    } catch (error) {
      logger.error('[WorkerFuzzySearch] Error indexing connections:', error);
    } finally {
      setIsIndexing(false);
    }
  }, [isInitialized]);

  const createGlobalIndex = useCallback(async (
    nodes: DialogNode[], 
    connections: Connection[]
  ): Promise<void> => {
    if (!workerRef.current || !isInitialized) {
      logger.warn('[WorkerFuzzySearch] Worker not initialized, cannot create global index');
      return;
    }

    setIsIndexing(true);
    
    try {
      await workerRef.current.createGlobalIndex(nodes, connections);
      
      const newStats = await workerRef.current.getStats();
      setStats(newStats);
      
      logger.debug('[WorkerFuzzySearch] Global index created successfully', { 
        nodes: nodes.length,
        connections: connections.length,
        stats: newStats 
      });
    } catch (error) {
      logger.error('[WorkerFuzzySearch] Error creating global index:', error);
    } finally {
      setIsIndexing(false);
    }
  }, [isInitialized]);

  const searchNodes = useCallback(async (
    query: string,
    additionalOptions: SearchOptions = {}
  ): Promise<SearchResult[]> => {
    if (!workerRef.current || !isInitialized || !query.trim()) {
      return [];
    }

    try {
      const results = await workerRef.current.searchNodes(query, additionalOptions);
      
      logger.debug('[WorkerFuzzySearch] Node search completed', { 
        query, 
        resultsCount: results.length 
      });
      
      return results;
    } catch (error) {
      logger.error('[WorkerFuzzySearch] Error searching nodes:', error);
      return [];
    }
  }, [isInitialized]);

  const searchConnections = useCallback(async (query: string): Promise<SearchResult[]> => {
    if (!workerRef.current || !isInitialized || !query.trim()) {
      return [];
    }

    try {
      const results = await workerRef.current.searchConnections(query);
      
      logger.debug('[WorkerFuzzySearch] Connection search completed', { 
        query, 
        resultsCount: results.length 
      });
      
      return results;
    } catch (error) {
      logger.error('[WorkerFuzzySearch] Error searching connections:', error);
      return [];
    }
  }, [isInitialized]);

  const smartSearch = useCallback(async (query: string): Promise<{
    primary: SearchResult[];
    suggestions: SearchResult[];
    contextual: SearchResult[];
  }> => {
    if (!workerRef.current || !isInitialized || !query.trim()) {
      return { primary: [], suggestions: [], contextual: [] };
    }

    try {
      const results = await workerRef.current.smartSearch(query);
      
      logger.debug('[WorkerFuzzySearch] Smart search completed', { 
        query,
        primary: results.primary.length,
        suggestions: results.suggestions.length,
        contextual: results.contextual.length
      });
      
      return results;
    } catch (error) {
      logger.error('[WorkerFuzzySearch] Error in smart search:', error);
      return { primary: [], suggestions: [], contextual: [] };
    }
  }, [isInitialized]);

  const getSuggestions = useCallback(async (query: string, limit: number = 5): Promise<string[]> => {
    if (!workerRef.current || !isInitialized || !query.trim()) {
      return [];
    }

    try {
      const suggestions = await workerRef.current.getSuggestions(query, limit);
      
      logger.debug('[WorkerFuzzySearch] Suggestions retrieved', { 
        query, 
        count: suggestions.length 
      });
      
      return suggestions;
    } catch (error) {
      logger.error('[WorkerFuzzySearch] Error getting suggestions:', error);
      return [];
    }
  }, [isInitialized]);

  const updateNode = useCallback(async (node: DialogNode): Promise<void> => {
    if (!workerRef.current || !isInitialized) {
      return;
    }

    try {
      await workerRef.current.updateNode(node);
      
      const newStats = await workerRef.current.getStats();
      setStats(newStats);
      
      logger.debug('[WorkerFuzzySearch] Node updated in index', { nodeId: node.id });
    } catch (error) {
      logger.error('[WorkerFuzzySearch] Error updating node:', error);
    }
  }, [isInitialized]);

  const removeNode = useCallback(async (nodeId: string): Promise<void> => {
    if (!workerRef.current || !isInitialized) {
      return;
    }

    try {
      await workerRef.current.removeNode(nodeId);
      
      const newStats = await workerRef.current.getStats();
      setStats(newStats);
      
      logger.debug('[WorkerFuzzySearch] Node removed from index', { nodeId });
    } catch (error) {
      logger.error('[WorkerFuzzySearch] Error removing node:', error);
    }
  }, [isInitialized]);

  const clearIndexes = useCallback(async (): Promise<void> => {
    if (!workerRef.current || !isInitialized) {
      return;
    }

    try {
      await workerRef.current.clearIndexes();
      
      setStats({
        totalItems: 0,
        lastUpdated: Date.now(),
        indexingInProgress: false,
        version: 0,
      });
      
      logger.debug('[WorkerFuzzySearch] All indexes cleared');
    } catch (error) {
      logger.error('[WorkerFuzzySearch] Error clearing indexes:', error);
    }
  }, [isInitialized]);

  return {
    isInitialized,
    isIndexing,
    stats,
    indexNodes,
    indexConnections,
    createGlobalIndex,
    searchNodes,
    searchConnections,
    smartSearch,
    getSuggestions,
    updateNode,
    removeNode,
    clearIndexes,
  };
}