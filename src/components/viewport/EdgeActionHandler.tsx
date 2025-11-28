import React from "react";
import { useReactFlow, Edge } from "reactflow";
import { DialogNode } from "../../types/dialog";

interface EdgeActionHandlerProps {
  onAddNode?: (params: {
    sourceNodeId: string;
    position: { x: number; y: number };
    nodeType?: string;
  }) => void;
  onDeleteEdge?: (edgeId: string) => void;
  onInsertCondition?: (params: {
    sourceNodeId: string;
    position: { x: number; y: number };
  }) => void;
}

export const EdgeActionContext = React.createContext<EdgeActionHandlerProps>({});

export const EdgeActionProvider: React.FC<
  EdgeActionHandlerProps & { children: React.ReactNode }
> = ({ children, onAddNode, onDeleteEdge, onInsertCondition }) => {
  const value = React.useMemo(
    () => ({
      onAddNode,
      onDeleteEdge,
      onInsertCondition,
    }),
    [onAddNode, onDeleteEdge, onInsertCondition]
  );

  return <EdgeActionContext.Provider value={value}>{children}</EdgeActionContext.Provider>;
};

export const useEdgeActions = () => {
  const { getEdge, setEdges } = useReactFlow<DialogNode, Edge>();
  const { onAddNode, onDeleteEdge, onInsertCondition } = React.useContext(EdgeActionContext);

  const handleAddNode = React.useCallback(
    (edgeId: string, position: { x: number; y: number }, nodeType?: string) => {
      if (!onAddNode) return;

      const edge = getEdge(edgeId);
      if (!edge) return;

      onAddNode({
        sourceNodeId: edge.source,
        position,
        nodeType,
      });
    },
    [getEdge, onAddNode]
  );

  const handleDeleteEdge = React.useCallback(
    (edgeId: string) => {
      const edge = getEdge(edgeId);
      if (!edge) return;

      try {
        if (onDeleteEdge) {
          onDeleteEdge(edgeId);

          setTimeout(() => {
            const stillExists = getEdge(edgeId);
            if (stillExists) {
              setEdges((edges) => edges.filter((e) => e.id !== edgeId));
            }
          }, 100);
        } else {
          setEdges((edges) => edges.filter((e) => e.id !== edgeId));
        }
      } catch (error) {
        try {
          setEdges((edges) => edges.filter((e) => e.id !== edgeId));
        } catch (fallbackError) {
          // Fallback delete failed, edge may already be removed
        }
      }
    },
    [getEdge, onDeleteEdge, setEdges]
  );

  const handleInsertCondition = React.useCallback(
    (edgeId: string, position: { x: number; y: number }) => {
      if (!onInsertCondition) return;

      const edge = getEdge(edgeId);
      if (!edge) return;

      onInsertCondition({
        sourceNodeId: edge.source,
        position,
      });
    },
    [getEdge, onInsertCondition]
  );

  return {
    handleAddNode,
    handleDeleteEdge,
    handleInsertCondition,
  };
};

export default EdgeActionProvider;
