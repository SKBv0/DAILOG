import * as React from "react";
import { Position } from "reactflow";
import { edgePathCache } from "./edgePathCache";
import { DialogNode } from "../types/dialog";
import { Connection } from "../types/nodes";
import { isFeatureEnabled } from "../config/features";
import { performanceProfiler } from "./performanceProfiler";
import logger from "./logger";

export interface PreloadableEdge {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  curvature?: number;
}

export class EdgePreloader {
  private isPreloading = false;
  private preloadedEdgeIds = new Set<string>();

  async preloadEdgePaths(
    nodes: DialogNode[],
    connections: Connection[],
    options: {
      batchSize?: number;
      delayBetweenBatches?: number;
      onProgress?: (_current: number, _total: number) => void;
    } = {}
  ): Promise<void> {
    if (!isFeatureEnabled("EDGE_PATH_CACHE") || this.isPreloading) {
      return;
    }

    const { batchSize = 50, delayBetweenBatches = 0, onProgress } = options;

    // Safeguard: Skip preloading for very large edge counts to avoid blocking
    const MAX_EDGES_FOR_PRELOAD = 500;
    if (connections.length > MAX_EDGES_FOR_PRELOAD) {
      if (import.meta.env.DEV) {
        logger.debug(`[EdgePreloader] Skipping preload for ${connections.length} edges (exceeds ${MAX_EDGES_FOR_PRELOAD} limit)`);
      }
      return;
    }

    this.isPreloading = true;
    const startTime = performance.now();

    try {
      const nodePositions = new Map<string, { x: number; y: number }>();
      nodes.forEach((node) => {
        nodePositions.set(node.id, node.position);
      });

      const preloadableEdges = this.generatePreloadableEdges(connections, nodePositions);

      if (preloadableEdges.length === 0) {
        return;
      }

      if (import.meta.env.DEV) {
        logger.debug(`[EdgePreloader] Preloading ${preloadableEdges.length} edge paths`);
      }

      for (let i = 0; i < preloadableEdges.length; i += batchSize) {
        const batch = preloadableEdges.slice(i, i + batchSize);

        batch.forEach((edge) => {
          edgePathCache.getOrComputePath({
            sourceX: edge.sourceX,
            sourceY: edge.sourceY,
            targetX: edge.targetX,
            targetY: edge.targetY,
            sourcePosition: edge.sourcePosition,
            targetPosition: edge.targetPosition,
            curvature: edge.curvature || 0.25,
          });

          this.preloadedEdgeIds.add(edge.id);
        });

        if (onProgress) {
          onProgress(Math.min(i + batchSize, preloadableEdges.length), preloadableEdges.length);
        }

        if (delayBetweenBatches > 0 && i + batchSize < preloadableEdges.length) {
          await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
        }
      }

      const duration = performance.now() - startTime;
      if (import.meta.env.DEV) {
        logger.debug(`[EdgePreloader] Completed preloading in ${duration.toFixed(2)}ms`);
      }

      performanceProfiler.recordCustomMetric("edge-preload-time", duration);
      performanceProfiler.recordCustomMetric("edge-preload-count", preloadableEdges.length);
    } finally {
      this.isPreloading = false;
    }
  }

  private generatePreloadableEdges(
    connections: Connection[],
    nodePositions: Map<string, { x: number; y: number }>
  ): PreloadableEdge[] {
    const preloadableEdges: PreloadableEdge[] = [];

    connections.forEach((connection) => {
      const sourcePos = nodePositions.get(connection.source);
      const targetPos = nodePositions.get(connection.target);

      if (!sourcePos || !targetPos) {
        return;
      }

      const sourceX = sourcePos.x + 150;
      const sourceY = sourcePos.y + 50;
      const targetX = targetPos.x;
      const targetY = targetPos.y + 50;

      preloadableEdges.push({
        id: connection.id || `${connection.source}-${connection.target}`,
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        curvature: 0.4,
      });
    });

    return preloadableEdges;
  }

  isEdgePreloaded(edgeId: string): boolean {
    return this.preloadedEdgeIds.has(edgeId);
  }

  getStats() {
    return {
      isPreloading: this.isPreloading,
      preloadedCount: this.preloadedEdgeIds.size,
      cacheStats: edgePathCache.getStats(),
    };
  }

  clear(): void {
    this.preloadedEdgeIds.clear();
  }

  invalidateForNodes(nodeIds: string[]): void {
    for (const edgeId of this.preloadedEdgeIds) {
      if (nodeIds.some((nodeId) => edgeId.includes(nodeId))) {
        this.preloadedEdgeIds.delete(edgeId);
      }
    }
  }
}

export const edgePreloader = new EdgePreloader();

export function useEdgePreloader() {
  return React.useMemo(
    () => ({
      preloadEdgePaths: edgePreloader.preloadEdgePaths.bind(edgePreloader),
      isEdgePreloaded: edgePreloader.isEdgePreloaded.bind(edgePreloader),
      getStats: edgePreloader.getStats.bind(edgePreloader),
      clear: edgePreloader.clear.bind(edgePreloader),
      invalidateForNodes: edgePreloader.invalidateForNodes.bind(edgePreloader),
    }),
    []
  );
}

if (import.meta.env.DEV) {
  window.__edgePreloader = edgePreloader;
}
