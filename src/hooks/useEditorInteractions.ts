import { useCallback, useState } from "react";
import { Node as ReactFlowNode } from "reactflow";
import { DialogNode } from "../types/editor";
import { DialogNodeType } from "../types/dialog";
import logger from "../utils/logger";
import type { ReactFlowApi } from "../types/reactflow";

interface UseEditorInteractionsProps {
  nodes: DialogNode[];
  selectedNodes: string[];
  setSelectedNodes: ((nodeIds: string[]) => void) | React.Dispatch<React.SetStateAction<string[]>>;
  connectionHandlerConnectingNode: {
    id: string;
    type: "input" | "output";
  } | null;
  connectionHandlerEnd: () => void;
  setIsDrawingMode?: (isDrawing: boolean) => void;
  showRightPanel: boolean;
  setShowRightPanel: (show: boolean) => void;
  editorRef: React.RefObject<HTMLDivElement>;
  updateHighlightedConnections?: (nodeIds: string[]) => void;
  setHighlightedConnections?: (connectionIds: string[]) => void;
  onAddNode: (node: {
    sourceNodeId: string;
    position: { x: number; y: number };
    nodeType: string;
    initialText?: string;
  }) => void;
  reactFlowApi?: ReactFlowApi;
}

export function useEditorInteractions({
  nodes,
  selectedNodes,
  setSelectedNodes,
  connectionHandlerConnectingNode,
  connectionHandlerEnd,
  setIsDrawingMode,
  showRightPanel,
  setShowRightPanel,
  editorRef,
  updateHighlightedConnections,
  setHighlightedConnections,
  onAddNode,
  reactFlowApi,
}: UseEditorInteractionsProps) {
  const [showNodeSelector, setShowNodeSelector] = useState<{
    position: { x: number; y: number };
    compatibleNodes: DialogNode[];
    sourceNodeId: string;
    connectionType: "input" | "output";
  } | null>(null);
  
  const [showConnectionMenu, setShowConnectionMenu] = useState<{
    position: { x: number; y: number };
    sourceNodeId: string;
    connectionType: "input" | "output";
  } | null>(null);
  const handleBackgroundClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;

      const isSvgElement =
        target.tagName === "svg" ||
        target.tagName === "path" ||
        target.tagName === "circle" ||
        target.tagName === "g";

      const isConnectionLine =
        target.closest(".connection-line-svg") !== null ||
        target.classList.contains("connection-line-svg");

      const isDirectBackgroundClick =
        (e.target === e.currentTarget ||
          target.id === "editor-content" ||
          target.classList.contains("min-w-editor")) &&
        !isSvgElement &&
        !isConnectionLine;

      if (!isDirectBackgroundClick) return;

      e.preventDefault();
      e.stopPropagation();

      if (connectionHandlerConnectingNode) {
        connectionHandlerEnd();
        effectiveSetIsDrawingMode(false);

        if (editorRef.current) {
          editorRef.current.style.cursor = "default";
        }
      }

      setSelectedNodes([]);

      if (showNodeSelector) {
        setShowNodeSelector(null);
      }

      if (showConnectionMenu) {
        setShowConnectionMenu(null);
      }
    },
    [
      connectionHandlerConnectingNode,
      connectionHandlerEnd,
      setIsDrawingMode,
      selectedNodes,
      showNodeSelector,
      setSelectedNodes,
      setShowNodeSelector,
      editorRef,
    ]
  );

  const handleBackgroundConnectionDrop = useCallback(
    (e: React.MouseEvent | MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;

      if (target.closest(".dialog-node-selector")) {
        logger.debug("Click inside NodeSelector, operation blocked");
        e.preventDefault();
        e.stopPropagation();

        if (e instanceof MouseEvent && "stopImmediatePropagation" in e) {
          (e as any).stopImmediatePropagation();
        }
        return;
      }

      const eventWithConnectionInfo = e as any;
      const connectionInfo = eventWithConnectionInfo.connectionInfo;

      logger.debug("handleBackgroundConnectionDrop called", {
        connectionHandlerConnectingNode,
        connectionInfo,
        target: target.tagName,
        targetId: target.id,
        targetClassName: target.className,
        isNodeSelector: !!target.closest(".dialog-node-selector"),
      });

      const isSvgElement =
        target.tagName === "svg" ||
        target.tagName === "path" ||
        target.tagName === "circle" ||
        target.tagName === "g";

      const isConnectionLine =
        target.closest(".connection-line-svg") !== null ||
        target.classList.contains("connection-line-svg");

      const isBackgroundClick =
        (e.target === e.currentTarget ||
          target.id === "editor-content" ||
          target.classList.contains("min-w-editor") ||
          target.classList.contains("react-flow__pane")) &&
        !isSvgElement &&
        !isConnectionLine;

      logger.debug("Click conditions:", {
        isSvgElement,
        isConnectionLine,
        isBackgroundClick,
        hasConnectionInfo: !!connectionInfo,
      });

      const shouldShowConnectionMenu =
        (isBackgroundClick || target.classList.contains("react-flow__pane")) &&
        (connectionInfo || connectionHandlerConnectingNode);

      if (!shouldShowConnectionMenu) {
        logger.debug("Early return: not a valid background connection drop");
        return;
      }

      if (e instanceof MouseEvent) {
        e.preventDefault();
        e.stopPropagation();

        if ("stopImmediatePropagation" in e) {
          (e as any).stopImmediatePropagation();
        }
      }

      const sourceNodeId = connectionInfo
        ? connectionInfo.id
        : connectionHandlerConnectingNode
          ? connectionHandlerConnectingNode.id
          : null;
      const connectionType = connectionInfo
        ? connectionInfo.type
        : connectionHandlerConnectingNode
          ? connectionHandlerConnectingNode.type
          : null;

      if (!sourceNodeId || !connectionType) {
        logger.debug("No source node ID or connection type");
        return;
      }

      let clientX = 0,
        clientY = 0;

      if ("clientX" in e && "clientY" in e) {
        clientX = e.clientX;
        clientY = e.clientY;
      } else if (e instanceof TouchEvent && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }

      logger.debug("Showing ConnectionMenu for new node creation", {
        sourceNodeId,
        connectionType,
        position: { x: clientX, y: clientY },
      });

      setShowConnectionMenu({
        position: { x: clientX, y: clientY },
        sourceNodeId: sourceNodeId,
        connectionType: connectionType as "input" | "output",
      });
    },
    [connectionHandlerConnectingNode, connectionHandlerEnd, setShowConnectionMenu, setIsDrawingMode]
  );

  const handleCreateNodeFromConnection = useCallback(
    (nodeType: DialogNodeType, position: { x: number; y: number }, sourceNodeId: string) => {
      logger.debug("Creating new node from connection", {
        nodeType,
        position,
        sourceNodeId,
      });

      onAddNode({
        sourceNodeId,
        position,
        nodeType,
      });

      connectionHandlerEnd();
      setIsDrawingMode?.(false);
      setShowConnectionMenu(null);
    },
    [onAddNode, connectionHandlerEnd, setIsDrawingMode, setShowConnectionMenu]
  );

  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: ReactFlowNode) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.shiftKey || event.ctrlKey || event.metaKey) {
        logger.debug("Multi-selection mode with shift/ctrl/meta - letting ReactFlow handle it");
        return;
      }

      setSelectedNodes([node.id]);
      updateHighlightedConnections?.([node.id]);

      if (!showRightPanel) {
        setShowRightPanel(true);
      }
    },
    [setSelectedNodes, updateHighlightedConnections, showRightPanel, setShowRightPanel]
  );

    const handlePaneClick = useCallback(() => {
      setSelectedNodes([]);
      setHighlightedConnections?.([]);

      if (reactFlowApi) {
        reactFlowApi.clearSelection();
      }
    }, [reactFlowApi, setHighlightedConnections, setSelectedNodes]);

  const handleScrollToNode = useCallback(
      (id: string): void => {
        setSelectedNodes([id]);
        updateHighlightedConnections?.([id]);

        const node = nodes.find((n) => n.id === id);
        if (node && reactFlowApi) {
          reactFlowApi.fitToNode(node.id, {
            padding: 0.3,
            minZoom: 0.5,
            maxZoom: 1.5,
            duration: 400,
          });
        }
      },
      [nodes, reactFlowApi, setSelectedNodes, updateHighlightedConnections]
    );

  const handleNodeSelectorSelect = useCallback(
    (targetNodeId: string) => {
      logger.debug("handleNodeSelectorSelect called, targetNodeId:", targetNodeId);

      if (!showNodeSelector) {
        logger.debug("showNodeSelector is null, no action taken");
        return;
      }

      const { sourceNodeId, connectionType } = showNodeSelector;
      logger.debug("sourceNodeId:", sourceNodeId, "connectionType:", connectionType);

      const sourceNode = nodes.find((node) => node.id === sourceNodeId);
      if (!sourceNode) {
        logger.debug("Source node not found");
        return;
      }

      if (targetNodeId.startsWith("create_")) {
        const position = showNodeSelector.position;

        const newNodeType = targetNodeId.replace("create_", "");

        logger.debug("Node type selected:", newNodeType, "Creating new node...");

        if (onAddNode) {
          onAddNode({
            sourceNodeId: sourceNodeId,
            position: { x: position.x, y: position.y },
            nodeType: newNodeType,
            initialText: "",
          });
        }
      } else {
        const selectedNode = showNodeSelector.compatibleNodes.find(
          (node) => node.id === targetNodeId
        );

        if (selectedNode) {
          if (selectedNode.data?.metadata?.nodeData?.isTemplate) {
            const position = showNodeSelector.position;
            const nodeType = selectedNode.type;
            const initialText = selectedNode.data.text || "";

            logger.debug("Template node selected:", { nodeType, initialText });

            if (onAddNode) {
              onAddNode({
                sourceNodeId: sourceNodeId,
                position: { x: position.x, y: position.y },
                nodeType: nodeType,
                initialText: initialText,
              });
            }
          } else {
            logger.debug("Normal node selected, creating connection:", targetNodeId);

            try {
              const newConnection = {
                id: `conn-${Date.now()}`,
                source: connectionType === "output" ? sourceNodeId : targetNodeId,
                target: connectionType === "output" ? targetNodeId : sourceNodeId,
                sourceHandle: "right",
                targetHandle: "left",
              };

              logger.debug("Created connection:", newConnection);

              const connectionEvent = new CustomEvent("editor:connection:add", {
                detail: { connection: newConnection },
              });
              document.dispatchEvent(connectionEvent);

              logger.debug("Connection creation event triggered");
            } catch (error) {
              logger.error("Connection creation error:", error);
            }
          }
        }
      }

      setShowNodeSelector(null);
      connectionHandlerEnd();
      setIsDrawingMode?.(false);
    },
    [
      showNodeSelector,
      setShowNodeSelector,
      setIsDrawingMode,
      onAddNode,
      nodes,
      connectionHandlerEnd,
    ]
  );

  const [, setLocalIsDrawingMode] = useState(false);
  const effectiveSetIsDrawingMode = setIsDrawingMode || setLocalIsDrawingMode;

  return {
    handleBackgroundClick,
    handleBackgroundConnectionDrop,
    handleNodeClick,
    handlePaneClick,
    handleScrollToNode,
    handleNodeSelectorSelect,
    handleCreateNodeFromConnection,
    showNodeSelector,
    setShowNodeSelector,
    showConnectionMenu,
    setShowConnectionMenu,
    setIsDrawingMode: effectiveSetIsDrawingMode,
  };
}
