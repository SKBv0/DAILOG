import { useEffect, useState, useCallback } from "react";
import { DialogNode, Connection } from "../types/editor";
import type { ReactFlowApi } from "../types/reactflow";
import { v4 as uuidv4 } from "uuid";

interface KeyboardShortcutsProps {
  nodes: DialogNode[];
  connections: Connection[];
  selectedNodes: string[];
  setSelectedNodes: (nodes: string[]) => void;
  updateHighlightedConnections?: (nodeIds: string[]) => void;
  deleteSelectedNodes: () => void;
  connectingNode: { id: string; type: "input" | "output" } | null;
  handleConnectionEnd: () => void;
  setIsDrawingMode: (value: boolean) => void;
  showNodeSelector: any | null;
  setShowNodeSelector: (value: any | null) => void;
  setHighlightedConnections?: (connections: string[]) => void;
  showRightPanel: boolean;
  setShowRightPanel: (value: boolean) => void;
  reactFlowApi?: ReactFlowApi;
  setNodes?: (updater: (nodes: DialogNode[]) => DialogNode[]) => void;
  setConnections?: (updater: (connections: Connection[]) => Connection[]) => void;
}

export const useKeyboardShortcuts = ({
  nodes,
  connections,
  selectedNodes,
  updateHighlightedConnections,
  deleteSelectedNodes,
  connectingNode,
  handleConnectionEnd,
  setIsDrawingMode,
  showNodeSelector,
  setShowNodeSelector,
  setSelectedNodes,
  setHighlightedConnections,
  showRightPanel,
  setShowRightPanel,
  reactFlowApi,
  setNodes,
  setConnections,
}: KeyboardShortcutsProps) => {
  const [copiedNodes, setCopiedNodes] = useState<DialogNode[]>([]);
  const [copiedEdges, setCopiedEdges] = useState<Connection[]>([]);

  const handleCopy = useCallback(() => {
    if (selectedNodes.length === 0) return;

    const nodesToCopy = nodes.filter((node) => selectedNodes.includes(node.id));
    setCopiedNodes([...nodesToCopy]);

    const relevantEdges = connections.filter(
      (edge) => selectedNodes.includes(edge.source) && selectedNodes.includes(edge.target)
    );
    setCopiedEdges([...relevantEdges]);
  }, [selectedNodes, nodes, connections]);

  const handlePaste = useCallback(() => {
    if (copiedNodes.length === 0 || !setNodes || !setConnections) return;

    const idMap = new Map<string, string>();
    const newNodeIds: string[] = [];

    const newNodes = copiedNodes.map((node) => {
      const newId = `node-${uuidv4()}`;
      idMap.set(node.id, newId);
      newNodeIds.push(newId);

      return {
        ...node,
        id: newId,
        position: {
          x: node.position.x + 20,
          y: node.position.y + 20,
        },
        selected: true,
        data: { ...node.data },
      };
    });

    const newEdges = copiedEdges.map((edge) => ({
      ...edge,
      id: `edge-${uuidv4()}`,
      source: idMap.get(edge.source) || edge.source,
      target: idMap.get(edge.target) || edge.target,
      selected: true,
    }));

    setNodes((nodes) => [
      ...nodes.map((n) => ({ ...n, selected: false })),
      ...newNodes,
    ]);
    setConnections((edges) => [...edges, ...newEdges]);

    setTimeout(() => {
      setSelectedNodes(newNodeIds);
      updateHighlightedConnections?.(newNodeIds);
      reactFlowApi?.selectNodesById(newNodeIds);
    }, 0);
  }, [copiedNodes, copiedEdges, setNodes, setConnections, setSelectedNodes, updateHighlightedConnections, reactFlowApi]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      if (e.key === "Delete" && selectedNodes.length > 0) {
        deleteSelectedNodes();
      }

      if (e.key === "Escape") {
        if (connectingNode) {
          handleConnectionEnd();
          setIsDrawingMode(false);
        } else if (showNodeSelector) {
          setShowNodeSelector(null);
        } else if (selectedNodes.length > 0) {
          setSelectedNodes([]);
          setHighlightedConnections?.([]);
        }
      }

      if ((e.key === "a" || e.key === "A") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();

        const allNodeIds = nodes.map((node) => node.id);
        setSelectedNodes(allNodeIds);
        updateHighlightedConnections?.(allNodeIds);

        if (!showRightPanel) {
          setShowRightPanel(true);
        }

        reactFlowApi?.selectNodesById(allNodeIds);
      }

      if ((e.key === "c" || e.key === "C") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();
        handleCopy();
      }

      if ((e.key === "v" || e.key === "V") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();
        handlePaste();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [
    selectedNodes,
    updateHighlightedConnections,
    connectingNode,
    handleConnectionEnd,
    setIsDrawingMode,
    showNodeSelector,
    setShowNodeSelector,
    setSelectedNodes,
    setHighlightedConnections,
    deleteSelectedNodes,
    nodes,
    connections,
    showRightPanel,
    setShowRightPanel,
    reactFlowApi,
    handleCopy,
    handlePaste,
  ]);
};
