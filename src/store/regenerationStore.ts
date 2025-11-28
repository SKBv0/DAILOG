import { create } from "zustand";

interface RegenerationState {
  isRegeneratingNodes: boolean;
  currentBulkRegenerationNodes: string[] | undefined;
  processingNodeId: string | null;
  setIsRegeneratingNodes: (isRegenerating: boolean) => void;
  setCurrentBulkRegenerationNodes: (nodes: string[] | undefined) => void;
  setProcessingNodeId: (nodeId: string | null) => void;
}

export const useRegenerationStore = create<RegenerationState>((set) => ({
  isRegeneratingNodes: false,
  currentBulkRegenerationNodes: undefined,
  processingNodeId: null,
  setIsRegeneratingNodes: (isRegenerating: boolean) =>
    set({ isRegeneratingNodes: isRegenerating }),
  setCurrentBulkRegenerationNodes: (nodes: string[] | undefined) =>
    set({ currentBulkRegenerationNodes: nodes }),
  setProcessingNodeId: (nodeId: string | null) =>
    set({ processingNodeId: nodeId }),
}));
