import type { MouseEvent } from "react";
import { DialogNodeType, DialogNodeData, Tag } from "./dialog";

export interface Connection {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface MinimapNode {
  id: string;
  type: DialogNodeType;
  text: string;
  position: { x: number; y: number };
  isHighlighted?: boolean;
  tags?: Tag[];
}

export interface RightPanelNode {
  id: string;
  type: string;
  data: any;
  position: { x: number; y: number };
}

export interface AppState {
  showLeftPanel: boolean;
  showRightPanel: boolean;
  zoom: number;
  nodes: DialogNode[];
  connections: Connection[];
  selectedNodes: string[];
  connectingNode: { id: string; type: "input" | "output" } | null;
  mousePosition: { x: number; y: number };
  viewportScroll: { x: number; y: number };
  viewportSize: { width: number; height: number };
  showNodeSelector: {
    position: { x: number; y: number };
    compatibleNodes: DialogNode[];
    sourceNodeId: string;
    connectionType: "input" | "output";
  } | null;
  isDraggingCanvas: boolean;
  isDrawingMode: boolean;
  viewportOffset: { x: number; y: number };
  highlightedConnections: string[];
  selectedConnection: Connection | null;
}

export type ConnectionPoints = Record<
  string,
  {
    input: { x: number; y: number };
    output: { x: number; y: number };
  }
>;

export interface ConnectionPoint {
  id: string;
  type: "input" | "output";
  position: Point;
}

export interface DialogNode {
  id: string;
  type: DialogNodeType;
  position: { x: number; y: number };
  data: DialogNodeData;
  shape?: {
    width: number;
    height: number;
  };
  connectionPoints?: {
    inputs: Array<{ id: string; position: { x: number; y: number } }>;
    outputs: Array<{ id: string; position: { x: number; y: number } }>;
  };
}

export interface ExtendedConnection extends Connection {
  sourcePoint?: Point;
  targetPoint?: Point;
}

export interface Point {
  x: number;
  y: number;
}

export interface ExtendedDialogNodeData extends DialogNodeData {
  onSelect?: (id: string) => void;
  onDragStop?: (e: MouseEvent, node: DialogNode) => void;
  connections?: Connection[];
  nodes?: DialogNode[];
  size?: { width: number; height: number };
  isCollapsed?: boolean;
}
