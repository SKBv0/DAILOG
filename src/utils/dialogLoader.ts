import { DialogNode, Tag, DialogNodeType } from "../types/dialog";
import { Connection } from "../types/nodes";
import defaultDialogFlow from "../data/defaultDialogFlow.json";

interface RawConnection {
  id: string;
  sourceId: string;
  targetId: string;
}

export interface DialogFlow {
  nodes: DialogNode[];
  connections: Connection[];
}

interface JsonNode {
  id: string;
  type: string;
  text: string;
  position: { x: number; y: number };
  tags?: Tag[];
}

const createNode = (node: JsonNode, gridSize: number = 20): DialogNode => {
  const nodeType =
    node.type === "npc"
      ? "npcDialog"
      : node.type === "player"
        ? "playerResponse"
        : node.type;

  const tagStrings = node.tags ? node.tags.map((tag) => tag.content) : [];

  return {
    id: node.id,
    type: nodeType as DialogNodeType,
    position: {
      x: Math.round(node.position.x / gridSize) * gridSize,
      y: Math.round(node.position.y / gridSize) * gridSize,
    },
    data: {
      text: node.text,
      type: nodeType as DialogNodeType,
      metadata: {
        dimensions: { width: 256, height: 80 },
        nodeData: {
          tags: node.tags || [],
        },
        tags: tagStrings,
      },
    },
  };
};

const createConnection = (conn: RawConnection): Connection => ({
  id: conn.id,
  source: conn.sourceId,
  target: conn.targetId,
  sourceHandle: "right",
  targetHandle: "left",
});

export const loadDefaultDialogFlow = (): DialogFlow => {
  try {
    const { nodes: jsonNodes, connections } = defaultDialogFlow;
    const nodes = (jsonNodes as JsonNode[]).map((node: JsonNode) =>
      createNode(node),
    );
    const formattedConnections = (connections as RawConnection[]).map(
      (conn: RawConnection) => createConnection(conn),
    );
    return { nodes, connections: formattedConnections };
  } catch (error) {
    return { nodes: [], connections: [] };
  }
};

export const loadDialogFlowFromJson = (jsonData: string): DialogFlow => {
  try {
    const data = JSON.parse(jsonData);

    if (!data.nodes || !data.connections) {
      throw new Error(
        "Invalid dialog flow format, must contain 'nodes' and 'connections'",
      );
    }

    const nodes = data.nodes.map((node: JsonNode) => createNode(node));
    const formattedConnections = data.connections.map((conn: RawConnection) =>
      createConnection(conn),
    );
    return { nodes, connections: formattedConnections };
  } catch (error) {
    return { nodes: [], connections: [] };
  }
};

export const exportDialogFlowToJson = (dialogFlow: DialogFlow): string => {
  const cleanedFlow = {
    nodes: dialogFlow.nodes.map((node) => ({
      id: node.id,
      type: node.type === "npcDialog" ? "npc" : "player",
      position: node.position,
      text: node.data.text,
      tags: node.data.metadata?.nodeData?.tags || [],
    })),
    connections: dialogFlow.connections.map((conn) => ({
      id: conn.id,
      sourceId: conn.source,
      targetId: conn.target,
    })),
  };

  return JSON.stringify(cleanedFlow, null, 2);
};
