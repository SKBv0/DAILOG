import type { Viewport } from "reactflow";

export interface ReactFlowViewport extends Viewport {}

export interface ReactFlowApi {
  getViewport: () => ReactFlowViewport;
  zoomIn: () => void;
  zoomOut: () => void;
  fitView: (options?: {
    padding?: number;
    includeHiddenNodes?: boolean;
    minZoom?: number;
    maxZoom?: number;
    duration?: number;
    nodes?: { id: string }[];
  }) => void;
  clearSelection: () => void;
  selectNodesById: (ids: string[]) => void;
  fitToNode: (id: string, options?: { padding?: number; minZoom?: number; maxZoom?: number; duration?: number }) => void;
}

