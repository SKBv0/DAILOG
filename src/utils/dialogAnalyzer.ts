import { DialogNodeType, Tag } from "../types/dialog";

export interface DialogAnalysisData {
  totalPaths: number;
  totalNodes: number;
  nodeCounts: Record<string, number>;
  avgPathLength: number;
  longestPathLength: number;
  consistentPaths: number;
  consistencyPercentage: number;
  totalBranchPoints: number;
  totalMergePoints: number;
  deadEndCount?: number;
}

export interface DialogNodeBase {
  id: string;
  type: DialogNodeType;
  data: {
    text: string;
    type: DialogNodeType;
    metadata?: {
      dimensions?: {
        width: number;
        height: number;
      };
      nodeData?: {
        tags?: Tag[];
      };
      [key: string]: any;
    };
  };
  position?: { x: number; y: number };
}

export interface DialogContext {
  id: string;
  type: DialogNodeType;
  text: string;
  tags: Tag[];
}

export interface DialogChain {
  previous: DialogContext[];
  current: DialogContext;
  next: DialogContext[];
}

export function findDialogPaths(
  nodeId: string,
  nodes: DialogNodeBase[],
  connections: Array<{ source: string; target: string }>,
  maxDepth: number = 3,
  bulkRegenerationNodes?: string[]
): DialogChain {
  const convertToDialogContext = (node: DialogNodeBase): DialogContext => {
    const isBeingRegenerated = bulkRegenerationNodes && bulkRegenerationNodes.includes(node.id);

    return {
      id: node.id,
      type: node.type,
      text: isBeingRegenerated ? `[${node.type} - will be regenerated]` : node.data.text,
      tags: node.data.metadata?.nodeData?.tags || [],
    };
  };

  const currentNode = nodes.find((n) => n.id === nodeId);
  if (!currentNode) {
    throw new Error(`Node with id ${nodeId} not found`);
  }

  const result: DialogChain = {
    previous: [],
    current: convertToDialogContext(currentNode),
    next: [],
  };

  let currentId = nodeId;
  let depth = 0;
  while (depth < maxDepth) {
    const prevConn = connections.find((conn) => conn.target === currentId);
    if (!prevConn) break;

    const prevNode = nodes.find((n) => n.id === prevConn.source);
    if (!prevNode) break;

    result.previous.unshift(convertToDialogContext(prevNode));
    currentId = prevConn.source;
    depth++;
  }

  const findNextNodes = (id: string, depth: number) => {
    if (depth >= maxDepth) return;

    const nextConns = connections.filter((conn) => conn.source === id);
    for (const conn of nextConns) {
      const nextNode = nodes.find((n) => n.id === conn.target);
      if (nextNode) {
        result.next.push(convertToDialogContext(nextNode));
        findNextNodes(nextNode.id, depth + 1);
      }
    }
  };

  findNextNodes(nodeId, 0);
  return result;
}

function getTagsFromNode(node: any): Tag[] {
  if (!node) return [];

  if (node.tags && Array.isArray(node.tags)) {
    return node.tags;
  }

  if (node.data?.metadata?.nodeData?.tags && Array.isArray(node.data.metadata.nodeData.tags)) {
    return node.data.metadata.nodeData.tags;
  }

  if (node.data?.metadata?.tags && Array.isArray(node.data.metadata.tags)) {
    return node.data.metadata.tags;
  }

  return [];
}

export function getCharacterContext(dialogChain: DialogChain): string {
  const allNodes = [...dialogChain.previous, dialogChain.current, ...dialogChain.next];

  const characterTypes = new Set(allNodes.map((n) => n.type));
  const isConsistent = dialogChain.previous.every(
    (n, i) => i === 0 || n.type !== dialogChain.previous[i - 1].type
  );

  const allTags = allNodes.flatMap(getTagsFromNode);

  const characterTags = allTags.filter((tag) => tag.label === "character");
  const emotionTags = allTags.filter((tag) => tag.label === "emotion");
  const locationTags = allTags.filter((tag) => tag.label === "location");
  const traitTags = allTags.filter((tag) => tag.label === "trait");

  let context = "CHARACTER CONTEXT:\n";

  if (characterTags.length > 0) {
    context += "Character traits: " + characterTags.map((tag) => tag.label).join(", ") + "\n";
  }

  if (emotionTags.length > 0) {
    context += "Emotional state: " + emotionTags.map((tag) => tag.label).join(", ") + "\n";
  }

  if (traitTags.length > 0) {
    context += "Speaking style: " + traitTags.map((tag) => tag.label).join(", ") + "\n";
  }

  if (locationTags.length > 0) {
    context += "Location: " + locationTags.map((tag) => tag.label).join(", ") + "\n";
  }

  context += "\nDIALOG ANALYSIS:\n";
  context += `Dialog pattern: ${isConsistent ? "Consistent turn-taking" : "Mixed conversation flow"}\n`;
  context += `Character roles: ${Array.from(characterTypes).join(", ")}\n`;
  context += `Dialog depth: ${dialogChain.previous.length} previous, ${dialogChain.next.length} next\n`;

  return context;
}

export function analyzeDialogFlow<T extends DialogNodeBase>(
  dialogFlow: T[][]
): DialogAnalysisData | null {
  if (!dialogFlow || dialogFlow.length === 0) return null;

  const uniqueNodes = Array.from(new Set(dialogFlow.flat().map((node) => node.id)));
  const totalNodes = uniqueNodes.length;

  const nodeCounts = dialogFlow.flat().reduce(
    (counts, node) => {
      const nodeType =
        node.type === "npcDialog" ? "npc" : node.type === "playerResponse" ? "player" : node.type;
      counts[nodeType] = (counts[nodeType] || 0) + 1;
      return counts;
    },
    {} as Record<string, number>
  );

  const avgPathLength = dialogFlow.reduce((sum, path) => sum + path.length, 0) / dialogFlow.length;

  const longestPathLength = Math.max(...dialogFlow.map((path) => path.length));

  const consistencyAnalysis = dialogFlow.map((path) => {
    const isConsistent = path.every((node, i) => {
      if (i === 0) return true;
      const currentType =
        node.type === "npcDialog" ? "npc" : node.type === "playerResponse" ? "player" : node.type;
      const prevType =
        path[i - 1].type === "npcDialog"
          ? "npc"
          : path[i - 1].type === "playerResponse"
            ? "player"
            : path[i - 1].type;
      return currentType !== prevType;
    });

    return {
      pathLength: path.length,
      isConsistent,
    };
  });

  const consistentPaths = consistencyAnalysis.filter((a) => a.isConsistent).length;

  const nodeConnections = uniqueNodes.reduce(
    (acc, nodeId) => {
      acc[nodeId] = {
        inbound: 0,
        outbound: 0,
      };
      return acc;
    },
    {} as Record<string, { inbound: number; outbound: number }>
  );

  dialogFlow.forEach((path) => {
    path.forEach((node, index) => {
      if (index < path.length - 1) {
        nodeConnections[node.id].outbound++;
        nodeConnections[path[index + 1].id].inbound++;
      }
    });
  });

  const { branchPoints, mergePoints } = Object.values(nodeConnections).reduce(
    (acc, { inbound, outbound }) => {
      if (outbound > 1) acc.branchPoints++;
      if (inbound > 1) acc.mergePoints++;
      return acc;
    },
    { branchPoints: 0, mergePoints: 0 }
  );

  return {
    totalPaths: dialogFlow.length,
    totalNodes,
    nodeCounts,
    avgPathLength,
    longestPathLength,
    consistentPaths,
    consistencyPercentage: (consistentPaths / dialogFlow.length) * 100,
    totalBranchPoints: branchPoints,
    totalMergePoints: mergePoints,
  };
}

export function getDialogPathTitle<T extends DialogNodeBase>(
  path: T[],
  maxLength: number = 20
): string {
  if (path.length === 0) return "Empty Path";
  const start = truncateText(path[0].data.text, maxLength);
  const end = truncateText(path[path.length - 1].data.text, maxLength);
  return `${start} → ${end}`;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}
