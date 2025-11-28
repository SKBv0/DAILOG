import { DialogNode as EditorDialogNode, Connection as EditorConnection } from "../types/editor";
import { DialogNode as ComponentDialogNode, Connection as ComponentConnection } from "../types/dialog";

type GenericDialogNode = (EditorDialogNode | ComponentDialogNode) & {
  id: string;
  type: string;
  data: { text?: string; [key: string]: unknown };
};

type GenericConnection = (EditorConnection | ComponentConnection) & {
  source: string;
  target: string;
};

export interface DialogLine {
  id: string;
  nodeId: string;
  speaker: string;
  text: string;
  choices: { label: string; targetId: string }[];
  choiceContinuations?: Record<string, DialogLine[]>;
}

export function findRootNodes<N extends GenericDialogNode, C extends GenericConnection>(
  nodes: N[],
  connections: C[]
): N[] {
  const targets = new Set(connections.map((conn) => conn.target));
  return nodes.filter((node) => !targets.has(node.id) && node.type !== "subgraphNode");
}

export function buildDialogPaths<N extends GenericDialogNode, C extends GenericConnection>(
  nodes: N[],
  connections: C[],
  maxDepth: number = 500
): N[][] {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const outgoingMap = new Map<string, string[]>();

  connections.forEach((conn) => {
    if (!outgoingMap.has(conn.source)) {
      outgoingMap.set(conn.source, []);
    }
    outgoingMap.get(conn.source)!.push(conn.target);
  });

  const rootNodes = findRootNodes(nodes, connections);
  const startNodes = rootNodes.length > 0 ? rootNodes : nodes;
  const visitedPaths = new Set<string>();
  const paths: N[][] = [];

  const safeMaxDepth = Math.max(maxDepth, nodes.length * 3 || maxDepth);

  const traverse = (nodeId: string, path: N[], stack: Set<string>) => {
    const node = nodeMap.get(nodeId);
    if (!node) {
      if (path.length) paths.push(path);
      return;
    }

    const nextPath = [...path, node as N];
    const serialized = nextPath.map((n) => n.id).join(">");
    if (visitedPaths.has(serialized)) {
      return;
    }
    visitedPaths.add(serialized);

    const outgoing = outgoingMap.get(nodeId) || [];
    const nextStack = new Set(stack);

    // Cycle detected or depth guard: stop traversal but keep the partial path
    if (stack.has(nodeId) || nextPath.length >= safeMaxDepth) {
      paths.push(nextPath);
      return;
    }

    nextStack.add(nodeId);

    if (outgoing.length === 0) {
      paths.push(nextPath);
      return;
    }

    outgoing.forEach((targetId) => {
      const targetNode = nodeMap.get(targetId);

      // If the target is already in the current stack, record the cycle endpoint and stop
      if (nextStack.has(targetId)) {
        if (targetNode) {
          paths.push([...nextPath, targetNode as N]);
        } else {
          paths.push(nextPath);
        }
        return;
      }

      traverse(targetId, nextPath, nextStack);
    });
  };

  startNodes.forEach((node) => traverse(node.id, [], new Set()));

  return paths.filter((p) => p.length > 0);
}

interface CollectDialogLinesParams<N extends GenericDialogNode, C extends GenericConnection> {
  nodes: N[];
  connections: C[];
  startId: string;
  startingNodes: N[];
  maxDepth?: number;
}

export function collectDialogLines<N extends GenericDialogNode, C extends GenericConnection>({
  nodes,
  connections,
  startId,
  startingNodes,
  maxDepth = 100,
}: CollectDialogLinesParams<N, C>): DialogLine[] {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const outgoingMap = new Map<string, string[]>();

  connections.forEach((conn) => {
    if (!outgoingMap.has(conn.source)) {
      outgoingMap.set(conn.source, []);
    }
    outgoingMap.get(conn.source)!.push(conn.target);
  });

  const safeMaxDepth = Math.max(maxDepth, nodes.length * 3 || maxDepth);

  const speakerOf = (type: string) => {
    if (type.includes("player") || type.includes("choice")) return "PLAYER";
    if (type.includes("npc") || type.includes("character")) return "NPC";
    if (type.includes("narrator")) return "NARRATOR";
    if (type.includes("scene")) return "SCENE";
    if (type.includes("enemy")) return "ENEMY";
    return "";
  };

  const visited = new Set<string>();
  const lines: DialogLine[] = [];

  const visit = (id: string, depth: number = 0) => {
    if (depth >= safeMaxDepth || visited.has(id)) return;

    const node = nodeMap.get(id);
    if (!node || node.type === "subgraphNode") return;

    visited.add(id);

    const outgoing = outgoingMap.get(id) || [];

    const choices = outgoing.map((targetId) => {
      const target = nodeMap.get(targetId);
      const label = (target?.data?.text as string) || "Option";
      return { label, targetId };
    });

    const line: DialogLine = {
      id: `line-${id}`,
      nodeId: node.id,
      speaker: speakerOf(node.type),
      text: (node.data.text as string) || "",
      choices,
    };

    lines.push(line);

    outgoing.forEach((targetId) => visit(targetId, depth + 1));
  };

  visit(startId, 0);

  startingNodes
    .filter((n) => !visited.has(n.id))
    .forEach((rootNode) => visit(rootNode.id, 0));

  return lines;
}

