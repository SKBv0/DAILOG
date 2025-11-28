import dagre from "dagre";
import { DialogNode, DialogNodeData } from "../types/dialog";
import { Connection } from "../types/nodes";

const AVG_CHAR_WIDTH = 7;
const LINE_HEIGHT = 20;
const VERTICAL_PADDING = 30;
const HEADER_HEIGHT = 25;
const MIN_NODE_HEIGHT = 100;

interface LayoutOptions {
  nodeWidth?: number;
  rankdir?: "TB" | "LR";
  ranksep?: number;
  nodesep?: number;
  edgesep?: number;
  heightBuffer?: number;
}

const estimateNodeHeight = (
  data: DialogNodeData | undefined,
  width: number,
  buffer: number,
): number => {
  const text = data?.text || "";
  const horizontalPadding = 20;
  const effectiveWidth = width - horizontalPadding;
  const charsPerLine = Math.max(1, Math.floor(effectiveWidth / AVG_CHAR_WIDTH));
  const numLines = Math.ceil(text.length / charsPerLine) || 1;
  const textHeight = numLines * LINE_HEIGHT;
  const calculatedHeight = HEADER_HEIGHT + VERTICAL_PADDING + textHeight + buffer;

  return Math.max(MIN_NODE_HEIGHT, calculatedHeight);
};

export const autoLayout = (
  nodes: DialogNode[],
  connections: Connection[],
  options: LayoutOptions = {},
): DialogNode[] => {
  const {
    nodeWidth = 340,
    rankdir = "TB",
    ranksep = 240,
    nodesep = 180,
    edgesep = 60,
    heightBuffer = 20,
  } = options;

  const g = new dagre.graphlib.Graph();

  g.setGraph({
    rankdir,
    ranksep,
    nodesep,
    edgesep,
    marginx: 50,
    marginy: 50,
  });

  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((node) => {
    const estimatedHeight = estimateNodeHeight(node.data, nodeWidth, heightBuffer);
    g.setNode(node.id, {
      width: nodeWidth,
      height: estimatedHeight,
      x: node.position.x,
      y: node.position.y,
    });
  });

  connections.forEach((conn) => {
    g.setEdge(conn.source, conn.target);
  });

  dagre.layout(g);

  const positionedNodes = nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x,
        y: nodeWithPosition.y,
      },
    };
  });

  return positionedNodes;
};

export const findRootNodes = (
  nodes: DialogNode[],
  connections: Connection[],
): DialogNode[] => {
  const nodeWithIncomingConnections = new Set(
    connections.map((conn) => conn.target),
  );

  return nodes.filter((node) => !nodeWithIncomingConnections.has(node.id));
};

export const getNodeDepth = (
  nodeId: string,
  connections: Connection[],
  depth: number = 0,
  visited: Set<string> = new Set(),
): number => {
  if (visited.has(nodeId)) {
    return depth;
  }

  visited.add(nodeId);
  const outgoingConnections = connections.filter(
    (conn) => conn.source === nodeId,
  );

  if (outgoingConnections.length === 0) {
    return depth;
  }

  const childDepths = outgoingConnections.map((conn) =>
    getNodeDepth(conn.target, connections, depth + 1, visited),
  );

  return Math.max(...childDepths);
};
