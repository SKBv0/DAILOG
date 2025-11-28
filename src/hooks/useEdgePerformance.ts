import { useEffect, useRef, useCallback } from "react";
import { useEdgePathCache } from "../utils/edgePathCache";
import { isFeatureEnabled } from "../config/features";
import logger from "../utils/logger";

export interface EdgePerformanceMetrics {
  renderCount: number;
  totalRenderTime: number;
  averageRenderTime: number;
  cacheHitRate: number;
  lastRenderTime: number;
}

export function useEdgePerformance(edgeId: string) {
  const metricsRef = useRef<EdgePerformanceMetrics>({
    renderCount: 0,
    totalRenderTime: 0,
    averageRenderTime: 0,
    cacheHitRate: 0,
    lastRenderTime: 0,
  });

  const cache = useEdgePathCache();
  const renderStartRef = useRef<number>(0);

  const startRender = useCallback(() => {
    if (!isFeatureEnabled("PERFORMANCE_PROFILING")) return;

    renderStartRef.current = performance.now();
  }, []);

  const endRender = useCallback(() => {
    if (!isFeatureEnabled("PERFORMANCE_PROFILING") || renderStartRef.current === 0) return;

    const renderTime = performance.now() - renderStartRef.current;
    const metrics = metricsRef.current;

    metrics.renderCount++;
    metrics.totalRenderTime += renderTime;
    metrics.averageRenderTime = metrics.totalRenderTime / metrics.renderCount;
    metrics.lastRenderTime = renderTime;

    const cacheStats = cache.getStats();
    metrics.cacheHitRate = cacheStats.hitRate;

    renderStartRef.current = 0;

    if (import.meta.env.DEV && renderTime > 5) {
      logger.warn(
        `[EdgePerformance] Slow edge render detected for ${edgeId}: ${renderTime.toFixed(2)}ms`
      );
    }
  }, [edgeId, cache]);

  const getMetrics = useCallback((): EdgePerformanceMetrics => {
    return { ...metricsRef.current };
  }, []);

  const reset = useCallback(() => {
    metricsRef.current = {
      renderCount: 0,
      totalRenderTime: 0,
      averageRenderTime: 0,
      cacheHitRate: 0,
      lastRenderTime: 0,
    };
  }, []);

  useEffect(() => {
    return () => {
      if (renderStartRef.current !== 0) {
        endRender();
      }
    };
  }, [endRender]);

  return {
    startRender,
    endRender,
    getMetrics,
    reset,
  };
}

// Global edge performance tracker
class EdgePerformanceTracker {
  private edgeMetrics = new Map<string, EdgePerformanceMetrics>();
  private globalStats = {
    totalEdges: 0,
    totalRenders: 0,
    totalRenderTime: 0,
    maxRenderTime: 0,
    minRenderTime: Infinity,
  };

  recordEdgeRender(edgeId: string, renderTime: number, _cacheHit: boolean) {
    if (!isFeatureEnabled("PERFORMANCE_PROFILING")) return;

    const edgeMetrics = this.edgeMetrics.get(edgeId) || {
      renderCount: 0,
      totalRenderTime: 0,
      averageRenderTime: 0,
      cacheHitRate: 0,
      lastRenderTime: 0,
    };

    edgeMetrics.renderCount++;
    edgeMetrics.totalRenderTime += renderTime;
    edgeMetrics.averageRenderTime = edgeMetrics.totalRenderTime / edgeMetrics.renderCount;
    edgeMetrics.lastRenderTime = renderTime;

    this.edgeMetrics.set(edgeId, edgeMetrics);

    this.globalStats.totalRenders++;
    this.globalStats.totalRenderTime += renderTime;
    this.globalStats.maxRenderTime = Math.max(this.globalStats.maxRenderTime, renderTime);
    this.globalStats.minRenderTime = Math.min(this.globalStats.minRenderTime, renderTime);
    this.globalStats.totalEdges = this.edgeMetrics.size;
  }

  getEdgeMetrics(edgeId: string): EdgePerformanceMetrics | undefined {
    return this.edgeMetrics.get(edgeId);
  }

  getGlobalStats() {
    const avgRenderTime =
      this.globalStats.totalRenders > 0
        ? this.globalStats.totalRenderTime / this.globalStats.totalRenders
        : 0;

    return {
      ...this.globalStats,
      averageRenderTime: avgRenderTime,
      performanceScore: this.calculatePerformanceScore(),
    };
  }

  private calculatePerformanceScore(): number {
    // Performance score based on average render time (lower is better)
    // 100 = excellent (<1ms), 80 = good (<2ms), 60 = ok (<5ms), 40 = poor (<10ms), 20 = very poor (>=10ms)
    const avgTime =
      this.globalStats.totalRenders > 0
        ? this.globalStats.totalRenderTime / this.globalStats.totalRenders
        : 0;

    if (avgTime < 1) return 100;
    if (avgTime < 2) return 80;
    if (avgTime < 5) return 60;
    if (avgTime < 10) return 40;
    return 20;
  }

  getSlowestEdges(count: number = 5): Array<{ edgeId: string; metrics: EdgePerformanceMetrics }> {
    return Array.from(this.edgeMetrics.entries())
      .map(([edgeId, metrics]) => ({ edgeId, metrics }))
      .sort((a, b) => b.metrics.averageRenderTime - a.metrics.averageRenderTime)
      .slice(0, count);
  }

  clear() {
    this.edgeMetrics.clear();
    this.globalStats = {
      totalEdges: 0,
      totalRenders: 0,
      totalRenderTime: 0,
      maxRenderTime: 0,
      minRenderTime: Infinity,
    };
  }

  generateReport(): string {
    const globalStats = this.getGlobalStats();
    const slowestEdges = this.getSlowestEdges();

    return `
📊 Edge Performance Report
=========================
Total Edges: ${globalStats.totalEdges}
Total Renders: ${globalStats.totalRenders}
Average Render Time: ${globalStats.averageRenderTime.toFixed(2)}ms
Max Render Time: ${globalStats.maxRenderTime.toFixed(2)}ms
Min Render Time: ${globalStats.minRenderTime === Infinity ? "N/A" : globalStats.minRenderTime.toFixed(2) + "ms"}
Performance Score: ${globalStats.performanceScore}/100

🐌 Slowest Edges:
${slowestEdges
  .map(
    (edge, i) =>
      `${i + 1}. ${edge.edgeId}: ${edge.metrics.averageRenderTime.toFixed(2)}ms (${edge.metrics.renderCount} renders)`
  )
  .join("\n")}
    `.trim();
  }
  }

  const edgePerformanceTracker = new EdgePerformanceTracker();

  export { edgePerformanceTracker };

  if (import.meta.env.DEV) {
    const globalWindow = window as unknown as Record<string, unknown>;
    (globalWindow as Record<string, unknown> & {
      __edgePerformanceTracker?: EdgePerformanceTracker;
    }).__edgePerformanceTracker = edgePerformanceTracker;
  }
