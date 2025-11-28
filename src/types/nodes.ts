import { Node as ReactFlowNode, Edge as ReactFlowEdge, Position } from "reactflow";
import { DialogNode, DialogNodeData } from "./dialog";
import { ProjectType } from "./project";

export type NodeType = string;

export const CONNECTION_POINT_SIZE = 12;

export interface NodeDimensions {
  width: number;
  height: number;
}

export interface NodeStyle {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  accentColor: string;
}

export interface HandleConfig {
  id: string;
  type: "source" | "target";
  position: Position;
  allowedTypes?: NodeType[];
  isValidConnection?: (connection: { source: string; target: string }) => boolean;
}

export interface NodeData {
  text: string;
  metadata?: {
    isCollapsed?: boolean;
    isSubgraph?: boolean;
    childNodes?: string[];
    conditions?: any;
    actions?: any;
    dimensions?: NodeDimensions;
    subgraph?: {
      nodes: any[];
      edges: any[];
      inputs: Array<{
        id: string;
        label: string;
        dataType?: string;
      }>;
      outputs: Array<{
        id: string;
        label: string;
        dataType?: string;
      }>;
    };
  };
  handles?: HandleConfig[];
  style?: NodeStyle;
  onGenerateDialog?: (node: DialogNode) => void;
}

export interface Node extends Omit<ReactFlowNode, "data"> {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: NodeData;
  style?: React.CSSProperties;
  selected?: boolean;
  dragging?: boolean;
  dragHandle?: string;
  sourcePosition?: Position;
  targetPosition?: Position;
}

export interface ConnectionCondition {
  type: "hasItem" | "hasQuest" | "hasReputation" | "hasGold" | "custom";
  value: string | number;
  operator?: "==" | "!=" | ">" | "<" | ">=" | "<=";
  customExpression?: string;
}

export interface ConnectionStyle {
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  animated?: boolean;
}

export interface ConnectionData {
  style?: ConnectionStyle;
  conditions?: ConnectionCondition[];
  label?: string;
  labelStyle?: React.CSSProperties;
  [key: string]: unknown;
}

export interface Connection extends Omit<ReactFlowEdge, "data"> {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: string;
  data?: ConnectionData;
  style?: React.CSSProperties;
  animated?: boolean;
  hidden?: boolean;
  deletable?: boolean;
  selected?: boolean;
  sourcePosition?: Position;
  targetPosition?: Position;
}

const generateSimpleUUID = (): string => {
  const timestamp = Date.now().toString(36);

  const random = Math.random().toString(36).substring(2, 10);

  return `${timestamp}-${random}`;
};

export const DEFAULT_NODE_DIMENSIONS = {
  width: 256,
  height: 80,
  minWidth: 200,
  minHeight: 60,
  maxWidth: 480,
  maxHeight: 400,
} as const;

export interface NodeConfig {
  id: string;
  displayNames: {
    short: string;
    full: string;
  };
  style?: {
    primaryColor: string;
    bgBase: string;
    bgSelected: string;
    borderBase: string;
    borderSelected: string;
  };
  projectTypes: ProjectType[];
  defaultText: string;
  buttonConfig: {
    icon: string;
    background: string;
    hoverBackground: string;
  };

  allowedConnections?: {
    inputs?: string[];
    outputs?: string[];
  };
  validation?: {
    validateData?: (data: NodeData) => boolean;
    validateConnection?: (connection: Connection) => boolean;
  };
  behavior?: {
    onAddToGraph?: (node: DialogNode) => DialogNode;
    onRemoveFromGraph?: (nodeId: string) => void;
    onDataChange?: (nodeId: string, data: Partial<NodeData>) => void;
  };

  ui?: {
    renderCustomHandle?: (position: Position, type: "source" | "target") => React.ReactNode;
    renderCustomControls?: (node: DialogNode) => React.ReactNode;
    contextMenuItems?: Array<{
      label: string;
      action: (nodeId: string) => void;
      icon?: React.ReactNode;
    }>;
  };
}

export const createNode = (
  type: NodeType,
  position: { x: number; y: number },
  text: string,
  options: Partial<DialogNode> = {}
): Node | DialogNode => {
  const id = `node-${generateSimpleUUID()}`;

  const width = Math.max(280, Math.min(text.length * 8, 480));
  const height = Math.max(120, Math.min(80 + Math.ceil(text.length / 35) * 24, 400));

  const dimensions = {
    width: width || DEFAULT_NODE_DIMENSIONS.width,
    height: height || DEFAULT_NODE_DIMENSIONS.height,
  };

  const onGenerateDialog = options.data?.onGenerateDialog;

  return {
    id,
    type,
    position,
    data: {
      text,
      type,
      metadata: {
        ...options.data?.metadata,
        dimensions,
      },
      onGenerateDialog,
    } as DialogNodeData,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    ...options,
  } as DialogNode;
};

export const NODE_CONFIGS: Record<string, NodeConfig> = {};

export function registerNodeConfig(config: NodeConfig): void {
  NODE_CONFIGS[config.id] = config;
}

export function getNodeConfigsByProjectType(projectType: ProjectType): NodeConfig[] {
  return Object.values(NODE_CONFIGS).filter((config) => config.projectTypes.includes(projectType));
}

export function getAllNodeTypes(): string[] {
  return Object.keys(NODE_CONFIGS);
}

export interface DialogEdgeData {
  probability?: number;
  conditions?: string[];
}

export interface DialogEdge extends Omit<ReactFlowEdge, "data"> {
  data?: DialogEdgeData;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface DialogFlow {
  id: string;
  name: string;
  nodes: DialogNode[];
  edges: DialogEdge[];
  tags?: Tag[];
  metadata?: {
    [key: string]: any;
  };
}
