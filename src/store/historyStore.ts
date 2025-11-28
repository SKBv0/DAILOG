import { create } from "zustand";
import { DialogNode } from "../types/dialog";
import logger from "../utils/logger";
import { safeStorage } from "../utils/safeStorage";

export interface NodeHistoryItem {
  nodeId: string;
  action: string;
  timestamp: number;
  previousState: DialogNode | null;
  newState: DialogNode | null;
}

export interface AIHistoryItem {
  id: string;
  nodeId: string;
  prompt: string;
  timestamp: number;
  result: string;
  success: boolean;
  type: "improve" | "recreate" | "custom";
  metadata?: {
    executionTime?: number;
    tokensUsed?: number;
    rating?: number;
  };
}

interface HistoryStore {
  nodeHistory: NodeHistoryItem[];
  aiHistory: AIHistoryItem[];

  addNodeHistory: (
    nodeId: string,
    action: string,
    previousState: DialogNode | null,
    newState: DialogNode | null
  ) => void;
  restoreNodeState: (item: NodeHistoryItem) => void;
  clearNodeHistory: (nodeId: string) => void;

  addAIHistory: (item: AIHistoryItem) => void;
  clearAIHistory: () => void;

  historyListeners: Array<(aiHistory: AIHistoryItem[]) => void>;
  subscribeToAIHistory: (callback: (aiHistory: AIHistoryItem[]) => void) => () => void;

  onRestoreNodeState: ((node: DialogNode) => void) | null;
  setRestoreCallback: (callback: (node: DialogNode) => void) => void;

  saveToLocalStorage: () => void;
  loadFromLocalStorage: () => void;

  clearNodeAIHistory: (nodeId: string) => void;
}

const HISTORY_STORAGE_KEY = "dialog-editor-history";

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  nodeHistory: [],
  aiHistory: [],
  historyListeners: [],

  addNodeHistory: (nodeId, action, previousState, newState) => {
    set((state) => ({
      nodeHistory: [
        ...state.nodeHistory,
        {
          nodeId,
          action,
          timestamp: Date.now(),
          previousState,
          newState,
        },
      ],
    }));

    get().saveToLocalStorage();
  },

  restoreNodeState: (item) => {
    if (item.previousState) {
      const restoreCallback = get().onRestoreNodeState;
      if (restoreCallback) {
        try {
          restoreCallback(item.previousState);
        } catch (error) {
          logger.error("[historyStore] Error restoring node state:", error);
        }
      }
    }
  },

  clearNodeHistory: (nodeId) => {
    set((state) => {
      const newHistory = state.nodeHistory.filter((item) => item.nodeId !== nodeId);
      return { nodeHistory: newHistory };
    });

    get().saveToLocalStorage();
  },

  addAIHistory: (item) => {
    set((state) => {
      const newAIHistory = [item, ...state.aiHistory];

      // Limit history size to prevent memory leaks (keep last 1000 items)
      const limitedHistory = newAIHistory.slice(0, 1000);

      state.historyListeners.forEach((listener) => {
        try {
          listener(limitedHistory);
        } catch (error) {
          logger.error("[historyStore] Error in history listener:", error);
        }
      });

      return { aiHistory: limitedHistory };
    });

    get().saveToLocalStorage();
  },

  clearAIHistory: () => {
    set((state) => {
      state.historyListeners.forEach((listener) => {
        try {
          listener([]);
        } catch (error) {
          logger.error("[historyStore] Error in history listener:", error);
        }
      });

      return { aiHistory: [] };
    });

    get().saveToLocalStorage();
  },

  clearNodeAIHistory: (nodeId) => {
    set((state) => {
      const newAIHistory = state.aiHistory.filter((item) => item.nodeId !== nodeId);

      state.historyListeners.forEach((listener) => {
        try {
          listener(newAIHistory);
        } catch (error) {
          logger.error("[historyStore] Error in history listener:", error);
        }
      });

      return { aiHistory: newAIHistory };
    });

    get().saveToLocalStorage();
  },

  subscribeToAIHistory: (callback) => {
    set((state) => ({
      historyListeners: [...state.historyListeners, callback],
    }));

    callback([...get().aiHistory]);

    return () => {
      set((state) => ({
        historyListeners: state.historyListeners.filter((cb) => cb !== callback),
      }));
    };
  },

  onRestoreNodeState: null,
  setRestoreCallback: (callback) => {
    set({ onRestoreNodeState: callback });
  },

  saveToLocalStorage: () => {
    try {
      const { nodeHistory, aiHistory } = get();
      const data = JSON.stringify({ nodeHistory, aiHistory });
      const ok = safeStorage.set(HISTORY_STORAGE_KEY, data);
      if (!ok) {
        logger.error("[historyStore] Error saving history to localStorage: storage unavailable");
      }
    } catch (error) {
      logger.error("[historyStore] Error saving history to localStorage:", error);
    }
  },

  loadFromLocalStorage: () => {
    try {
      const data = safeStorage.get(HISTORY_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        set({
          nodeHistory: parsed.nodeHistory || [],
          aiHistory: parsed.aiHistory || [],
        });
      }
    } catch (error) {
      logger.error("[historyStore] Error loading history from localStorage:", error);
    }
  },
}));
