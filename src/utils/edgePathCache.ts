import * as React from "react";
import { getBezierPath, Position } from "reactflow";
import { isFeatureEnabled } from "../config/features";
import logger from "./logger";

export interface EdgePathData {
  path: string;
  labelX: number;
  labelY: number;
  offsetX: number;
  offsetY: number;
  timestamp: number;
  accessCount: number;
}

export interface EdgeCacheKey {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  curvature?: number;
}

class LRUCache<K, V> {
  private maxSize: number;
  private cache = new Map<string, V>();
  private accessOrder = new Map<string, number>();
  private accessCounter = 0;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  private createKey(key: K): string {
    return JSON.stringify(key);
  }

  get(key: K): V | undefined {
    const keyStr = this.createKey(key);
    const value = this.cache.get(keyStr);

    if (value !== undefined) {
      this.accessOrder.set(keyStr, ++this.accessCounter);

      if (typeof value === "object" && value !== null && "accessCount" in value) {
        const edgeData = value as unknown as EdgePathData;
        edgeData.accessCount++;
      }
    }

    return value;
  }

  set(key: K, value: V): void {
    const keyStr = this.createKey(key);

    if (this.cache.size >= this.maxSize && !this.cache.has(keyStr)) {
      this.evictLRU();
    }

    this.cache.set(keyStr, value);
    this.accessOrder.set(keyStr, ++this.accessCounter);
  }

  private evictLRU(): void {
    let lruKey: string | undefined;
    let lruAccess = Number.MAX_SAFE_INTEGER;

    for (const [key, accessTime] of this.accessOrder) {
      if (accessTime < lruAccess) {
        lruAccess = accessTime;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.accessOrder.delete(lruKey);
    }
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
    this.accessCounter = 0;
  }

  size(): number {
    return this.cache.size;
  }

  getStats() {
    const entries = Array.from(this.cache.entries());
    const totalAccess = entries.reduce((sum, [_key, value]) => {
      return (
        sum +
        (typeof value === "object" && value !== null && "accessCount" in value
          ? (value as unknown as EdgePathData).accessCount
          : 0)
      );
    }, 0);

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      totalAccess,
      averageAccess: entries.length > 0 ? totalAccess / entries.length : 0,
      memoryUsage: this.estimateMemoryUsage(),
    };
  }

  private estimateMemoryUsage(): number {
    let totalSize = 0;

    for (const [key, _value] of this.cache) {
      totalSize += key.length * 2;
      totalSize += JSON.stringify(_value).length * 2;
    }

    return totalSize;
  }
}

class EdgePathCache {
  private cache: LRUCache<EdgeCacheKey, EdgePathData>;
  private enabled: boolean = false;
  private hitCount: number = 0;
  private missCount: number = 0;

  constructor(maxSize: number = 1000) {
    this.cache = new LRUCache(maxSize);
    this.updateEnabled();
  }

  private updateEnabled(): void {
    this.enabled = isFeatureEnabled("EDGE_PATH_CACHE");
  }

  /**
   * Get cached edge path or compute and cache new one
   */
  getOrComputePath(props: {
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
    sourcePosition: Position;
    targetPosition: Position;
    curvature?: number;
  }): EdgePathData {
    this.updateEnabled();

    if (!this.enabled) {
      return this.computePath(props);
    }

    const cacheKey: EdgeCacheKey = {
      sourceX: Math.round(props.sourceX * 100) / 100,
      sourceY: Math.round(props.sourceY * 100) / 100,
      targetX: Math.round(props.targetX * 100) / 100,
      targetY: Math.round(props.targetY * 100) / 100,
      sourcePosition: props.sourcePosition,
      targetPosition: props.targetPosition,
      curvature: props.curvature || 0.25,
    };

    const cached = this.cache.get(cacheKey);

    if (cached) {
      this.hitCount++;
      return cached;
    }

    this.missCount++;
    const computed = this.computePath(props);
    this.cache.set(cacheKey, computed);

    return computed;
  }

  private computePath(props: {
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
    sourcePosition: Position;
    targetPosition: Position;
    curvature?: number;
  }): EdgePathData {
    const [path, labelX, labelY, offsetX, offsetY] = getBezierPath({
      sourceX: props.sourceX,
      sourceY: props.sourceY,
      sourcePosition: props.sourcePosition,
      targetX: props.targetX,
      targetY: props.targetY,
      targetPosition: props.targetPosition,
      curvature: props.curvature || 0.25,
    });

    return {
      path,
      labelX,
      labelY,
      offsetX,
      offsetY,
      timestamp: Date.now(),
      accessCount: 1,
    };
  }

  /**
   * Clear all cached paths
   */
  clear(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * Get cache performance statistics
   */
  getStats() {
    const cacheStats = this.cache.getStats();
    const totalRequests = this.hitCount + this.missCount;

    return {
      enabled: this.enabled,
      hitCount: this.hitCount,
      missCount: this.missCount,
      totalRequests,
      hitRate: totalRequests > 0 ? (this.hitCount / totalRequests) * 100 : 0,
      cache: cacheStats,
      performance: {
        computationsSaved: this.hitCount,
        memoryEfficiency: cacheStats.size > 0 ? cacheStats.totalAccess / cacheStats.size : 0,
      },
    };
  }

  /**
   * Preload paths for a set of edges (useful for large graphs)
   */
  preloadPaths(
    edges: Array<{
      sourceX: number;
      sourceY: number;
      targetX: number;
      targetY: number;
      sourcePosition: Position;
      targetPosition: Position;
      curvature?: number;
    }>
  ): void {
    if (!this.enabled) return;

    logger.debug(`[EdgePathCache] Preloading ${edges.length} edge paths`);

    edges.forEach((edge) => {
      this.getOrComputePath(edge);
    });

    logger.debug(`[EdgePathCache] Preloading completed. Cache size: ${this.cache.size()}`);
  }

  getMemoryUsage(): string {
    const stats = this.cache.getStats();
    const bytes = stats.memoryUsage;

    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}

const edgePathCache = new EdgePathCache(2000);

export { edgePathCache, EdgePathCache };

export function useEdgePathCache() {
  const api = React.useMemo(
    () => ({
      getOrComputePath: edgePathCache.getOrComputePath.bind(edgePathCache),
      getStats: edgePathCache.getStats.bind(edgePathCache),
      clear: edgePathCache.clear.bind(edgePathCache),
      getMemoryUsage: edgePathCache.getMemoryUsage.bind(edgePathCache),
    }),
    []
  );

  return api;
}

if (import.meta.env.DEV) {
  window.__edgePathCache = edgePathCache;
}
