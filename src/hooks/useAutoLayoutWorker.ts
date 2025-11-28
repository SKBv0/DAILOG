import { useEffect, useRef, useState, useCallback } from "react";
import * as Comlink from "comlink";
import { DialogNode, Connection } from "../types/editor";
import { isFeatureEnabled } from "../config/features";
import logger from "../utils/logger";

type WorkerType = typeof import("../workers/autoLayoutWorker").default;

export interface LayoutOptions {
  nodeWidth?: number;
  rankdir?: "TB" | "LR";
  ranksep?: number;
  nodesep?: number;
  edgesep?: number;
  heightBuffer?: number;
}

export interface LayoutStats {
  lastCalculationTime: number;
  calculationCount: number;
  averageCalculationTime: number;
  lastError: string | null;
}

export function useAutoLayoutWorker() {
  const workerRef = useRef<Comlink.Remote<WorkerType> | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [stats, setStats] = useState<LayoutStats>({
    lastCalculationTime: 0,
    calculationCount: 0,
    averageCalculationTime: 0,
    lastError: null,
  });

  useEffect(() => {
    if (!isFeatureEnabled('WORKER_LAYOUT')) {
      logger.debug('[AutoLayoutWorker] Feature disabled, skipping worker initialization');
      return;
    }

    let cleanup: (() => void) | null = null;

    const initWorker = async () => {
      try {
        const worker = new Worker(
          new URL('../workers/autoLayoutWorker.ts', import.meta.url),
          { type: 'module' }
        );

        const wrappedWorker = Comlink.wrap<WorkerType>(worker);
        workerRef.current = wrappedWorker;

        cleanup = () => {
          worker.terminate();
          workerRef.current = null;
        };

        setIsInitialized(true);
        logger.debug('[AutoLayoutWorker] Worker initialized successfully');

      } catch (error) {
        logger.error('[AutoLayoutWorker] Failed to initialize worker:', error);
      }
    };

    initWorker();

    return () => {
      cleanup?.();
    };
  }, []);

  const calculateLayout = useCallback(async (
    nodes: DialogNode[],
    connections: Connection[],
    options: LayoutOptions = {}
  ): Promise<DialogNode[] | null> => {
    if (!workerRef.current || !isInitialized) {
      logger.warn('[AutoLayoutWorker] Worker not initialized, cannot calculate layout');
      return null;
    }

    setIsCalculating(true);
    
    try {
      const result = await workerRef.current.calculateLayout({
        nodes,
        connections,
        options
      });
      
      const newStats = await workerRef.current.getLayoutStats();
      setStats(newStats);
      
      logger.debug('[AutoLayoutWorker] Layout calculated successfully', { 
        nodes: nodes.length,
        connections: connections.length,
        duration: `${newStats.lastCalculationTime.toFixed(2)}ms`
      });
      
      return result;
    } catch (error) {
      logger.error('[AutoLayoutWorker] Error calculating layout:', error);
      return null;
    } finally {
      setIsCalculating(false);
    }
  }, [isInitialized]);

  const calculateLayoutBatched = useCallback(async (
    nodes: DialogNode[],
    connections: Connection[],
    options: LayoutOptions = {},
    batchSize: number = 200
  ): Promise<DialogNode[] | null> => {
    if (!workerRef.current || !isInitialized) {
      logger.warn('[AutoLayoutWorker] Worker not initialized, cannot calculate layout');
      return null;
    }

    setIsCalculating(true);
    
    try {
      const result = await workerRef.current.calculateLayoutBatched({
        nodes,
        connections,
        options,
        batchSize
      });
      
      const newStats = await workerRef.current.getLayoutStats();
      setStats(newStats);
      
      logger.debug('[AutoLayoutWorker] Batched layout calculated successfully', { 
        nodes: nodes.length,
        connections: connections.length,
        batchSize,
        duration: `${newStats.lastCalculationTime.toFixed(2)}ms`
      });
      
      return result;
    } catch (error) {
      logger.error('[AutoLayoutWorker] Error in batched layout calculation:', error);
      return null;
    } finally {
      setIsCalculating(false);
    }
  }, [isInitialized]);

  const calculateOptimalOptions = useCallback(async (
    nodes: DialogNode[],
    connections: Connection[]
  ): Promise<LayoutOptions | null> => {
    if (!workerRef.current || !isInitialized) {
      logger.warn('[AutoLayoutWorker] Worker not initialized, cannot calculate optimal options');
      return null;
    }

    try {
      const options = await workerRef.current.calculateOptimalOptions(nodes, connections);
      
      logger.debug('[AutoLayoutWorker] Optimal options calculated', { 
        nodes: nodes.length,
        connections: connections.length,
        options
      });
      
      return options;
    } catch (error) {
      logger.error('[AutoLayoutWorker] Error calculating optimal options:', error);
      return null;
    }
  }, [isInitialized]);

  const autoLayout = useCallback(async (
    nodes: DialogNode[],
    connections: Connection[],
    customOptions?: Partial<LayoutOptions>
  ): Promise<DialogNode[] | null> => {
    if (!workerRef.current || !isInitialized) {
      return null;
    }

    try {
      const optimalOptions = await calculateOptimalOptions(nodes, connections);
      if (!optimalOptions) {
        return null;
      }

      const finalOptions = { ...optimalOptions, ...customOptions };

      if (nodes.length > 100) {
        return await calculateLayoutBatched(nodes, connections, finalOptions, 150);
      } else {
        return await calculateLayout(nodes, connections, finalOptions);
      }
    } catch (error) {
      logger.error('[AutoLayoutWorker] Error in auto layout:', error);
      return null;
    }
  }, [isInitialized, calculateOptimalOptions, calculateLayout, calculateLayoutBatched]);

  const clearStats = useCallback(async (): Promise<void> => {
    if (!workerRef.current || !isInitialized) {
      return;
    }

    try {
      await workerRef.current.clearStats();
      
      setStats({
        lastCalculationTime: 0,
        calculationCount: 0,
        averageCalculationTime: 0,
        lastError: null,
      });
      
      logger.debug('[AutoLayoutWorker] Statistics cleared');
    } catch (error) {
      logger.error('[AutoLayoutWorker] Error clearing stats:', error);
    }
  }, [isInitialized]);

  return {
    isInitialized,
    isCalculating,
    stats,
    calculateLayout,
    calculateLayoutBatched,
    calculateOptimalOptions,
    autoLayout,
    clearStats,
  };
}