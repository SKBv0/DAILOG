import { useHistoryStore } from "./historyStore";
import { isFeatureEnabled } from "../config/features";
import logger from "../utils/logger";

function shallow<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;

  if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) {
    return false;
  }

  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);

  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!Object.is((a as any)[key], (b as any)[key])) return false;
  }

  return true;
}

export type HistorySelector<T> = (state: ReturnType<typeof useHistoryStore.getState>) => T;

export function useOptimizedHistorySelector<T>(
  selector: HistorySelector<T>,
  equalityFn?: (a: T, b: T) => boolean
) {
  const shouldUseOptimization = isFeatureEnabled("ZUSTAND_MEMOIZATION");

  if (shouldUseOptimization && equalityFn) {
    const result = useHistoryStore(selector);
    return result;
  } else {
    return useHistoryStore(selector);
  }
}

export const historySelectors = {
  aiHistory: (state: ReturnType<typeof useHistoryStore.getState>) => state.aiHistory,
  aiHistoryCount: (state: ReturnType<typeof useHistoryStore.getState>) => state.aiHistory.length,
  recentAIHistory:
    (limit = 10) =>
    (state: ReturnType<typeof useHistoryStore.getState>) =>
      state.aiHistory.slice(0, limit),

  nodeHistory: (state: ReturnType<typeof useHistoryStore.getState>) => state.nodeHistory,
  nodeHistoryCount: (state: ReturnType<typeof useHistoryStore.getState>) =>
    state.nodeHistory.length,
  nodeHistoryByNodeId: (nodeId: string) => (state: ReturnType<typeof useHistoryStore.getState>) =>
    state.nodeHistory.filter((item) => item.nodeId === nodeId),

  actions: (state: ReturnType<typeof useHistoryStore.getState>) => ({
    addNodeHistory: state.addNodeHistory,
    addAIHistory: state.addAIHistory,
    clearNodeHistory: state.clearNodeHistory,
    clearAIHistory: state.clearAIHistory,
    clearNodeAIHistory: state.clearNodeAIHistory,
    restoreNodeState: state.restoreNodeState,
    subscribeToAIHistory: state.subscribeToAIHistory,
    setRestoreCallback: state.setRestoreCallback,
  }),

  historyListeners: (state: ReturnType<typeof useHistoryStore.getState>) => state.historyListeners,
  onRestoreNodeState: (state: ReturnType<typeof useHistoryStore.getState>) =>
    state.onRestoreNodeState,
};

export function useAIHistory() {
  return useOptimizedHistorySelector(historySelectors.aiHistory);
}

export function useAIHistoryCount() {
  return useOptimizedHistorySelector(historySelectors.aiHistoryCount);
}

export function useRecentAIHistory(limit = 10) {
  return useOptimizedHistorySelector(historySelectors.recentAIHistory(limit));
}

export function useNodeHistory() {
  return useOptimizedHistorySelector(historySelectors.nodeHistory);
}

export function useNodeHistoryCount() {
  return useOptimizedHistorySelector(historySelectors.nodeHistoryCount);
}

export function useNodeHistoryByNodeId(nodeId: string) {
  return useOptimizedHistorySelector(historySelectors.nodeHistoryByNodeId(nodeId));
}

export function useHistoryActions() {
    return useOptimizedHistorySelector(historySelectors.actions, shallow);
  }

export function useAIHistoryForNode(nodeId: string) {
  return useOptimizedHistorySelector((state) =>
    state.aiHistory.filter((item) => item.nodeId === nodeId)
  );
}

export function useSuccessfulAIHistory() {
  return useOptimizedHistorySelector((state) => state.aiHistory.filter((item) => item.success));
}

export function useAIHistoryStats() {
  return useOptimizedHistorySelector(
    (state) => {
      const aiHistory = state.aiHistory;
      const total = aiHistory.length;
      const successful = aiHistory.filter((item) => item.success).length;
      const failed = total - successful;
      const avgExecutionTime =
        aiHistory
          .filter((item) => item.metadata?.executionTime)
          .reduce((sum, item) => sum + (item.metadata?.executionTime || 0), 0) / total || 0;

      return {
        total,
        successful,
        failed,
        successRate: total > 0 ? (successful / total) * 100 : 0,
        avgExecutionTime: avgExecutionTime.toFixed(2),
      };
    },
    (prev, next) =>
      prev.total === next.total &&
      prev.successful === next.successful &&
      prev.avgExecutionTime === next.avgExecutionTime
  );
}

export function useHistoryPerformanceMetrics() {
  return useOptimizedHistorySelector((state) => ({
    nodeHistorySize: state.nodeHistory.length,
    aiHistorySize: state.aiHistory.length,
    listenerCount: state.historyListeners.length,
    memoryEstimate: (state.nodeHistory.length + state.aiHistory.length) * 1024,
  }));
}

export function useHistoryDebugInfo() {
  return useOptimizedHistorySelector((state) => {
    if (typeof import.meta !== "undefined" && (import.meta as any).env?.MODE !== "development") {
      return null;
    }

    return {
      storeKeys: Object.keys(state),
      nodeHistoryKeys: state.nodeHistory.length > 0 ? Object.keys(state.nodeHistory[0]) : [],
      aiHistoryKeys: state.aiHistory.length > 0 ? Object.keys(state.aiHistory[0]) : [],
      optimizationEnabled: isFeatureEnabled("ZUSTAND_MEMOIZATION"),
    };
  });
}

export function createCustomHistorySelector<T>(
  selector: HistorySelector<T>,
  options?: {
    equalityFn?: (a: T, b: T) => boolean;
    debugName?: string;
  }
) {
  return function useCustomHistorySelector() {
    if (options?.debugName && typeof import.meta !== "undefined" && (import.meta as any).env?.MODE === "development") {
      logger.debug(`Using custom selector: ${options.debugName}`);
    }

    return useOptimizedHistorySelector(selector, options?.equalityFn);
  };
}

export { shallow };
