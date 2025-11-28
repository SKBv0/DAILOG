import { useCallback, useMemo } from "react";
import { DialogNode, Connection } from "../types/editor";
import { analyzeDialogFlow, DialogNodeBase } from "../utils/dialogAnalyzer";
import { buildDialogPaths, findRootNodes } from "../utils/dialogTraversal";
import logger from "../utils/logger";

interface UseDialogPathsProps {
  nodes: DialogNode[];
  connections: Connection[];
}

export function useDialogPaths({ nodes, connections }: UseDialogPathsProps) {
  const dialogPaths = useCallback(() => buildDialogPaths(nodes, connections), [nodes, connections]);

  const dialogAnalysis = useMemo(() => {
    const startNodes = findRootNodes(nodes, connections);

    if (startNodes.length === 0) {
      logger.debug("[useDialogPaths] No root nodes detected");
      return null;
    }

    const normalizeType = (nodeType: string): string => {
      if (nodeType === "npcDialog") return "npc";
      if (nodeType === "playerResponse") return "player";
      return nodeType;
    };

    const buildDialogPath = (
      currentNode: DialogNode,
      visited: Set<string> = new Set(),
    ): DialogNodeBase[][] => {
      if (visited.has(currentNode.id)) {
        return [];
      }

      const newVisited = new Set(visited).add(currentNode.id);

      const formattedNode: DialogNodeBase = {
        id: currentNode.id,
        type: normalizeType(currentNode.type),
        data: {
          text: currentNode.data.text || "",
          type: normalizeType(currentNode.type),
          metadata: {
            description: "",
            isCollapsed: false,
            dimensions: currentNode.data.metadata?.dimensions || {
              width: 256,
              height: 80,
            },
            nodeData: {
              tags: currentNode.data.metadata?.nodeData?.tags || [],
            },
          },
        },
      };

      const outgoingConnections = connections.filter((conn) => conn.source === currentNode.id);

      if (outgoingConnections.length === 0) {
        return [[formattedNode]];
      }

      return outgoingConnections.flatMap((conn) => {
        const targetNode = nodes.find((n) => n.id === conn.target);
        if (!targetNode) return [[formattedNode]];

        const subPaths = buildDialogPath(targetNode, newVisited);

        return subPaths.map((path) => [formattedNode, ...path]);
      });
    };

    const dialogPaths = startNodes.flatMap((node) => buildDialogPath(node));

    if (dialogPaths.length === 0) {
      logger.debug("[useDialogPaths] No traversable paths found");
      return null;
    }

    return analyzeDialogFlow(dialogPaths);
  }, [nodes, connections]);

  return {
    dialogPaths,
    dialogAnalysis,
  };
}
