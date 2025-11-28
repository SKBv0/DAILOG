import React, { useEffect, useCallback, useState } from "react";
import { applyNodeChanges, applyEdgeChanges } from "reactflow";
import ViewportManager from "../ViewportManager";
import DialogTreeView from "../DialogTreeView";
import ReadMode from "../ReadMode";
import { EdgeActionProvider } from "../viewport/EdgeActionHandler";
import { DialogNode, Connection } from "../../types/editor";
import { GenerateMode } from "../../hooks/useNodeAI";
import logger from "../../utils/logger";
import SubgraphBreadcrumb from "../SubgraphBreadcrumb";
import useSubgraphNavigationStore from "../../store/subgraphNavigationStore";
import { useRegenerationStore } from "../../store/regenerationStore";
import type { ReactFlowApi } from "../../types/reactflow";

interface EditorContentProps {
  editorRef: React.RefObject<HTMLDivElement>;
  editorContentRef: React.RefObject<HTMLDivElement>;
  viewportOffset: { x: number; y: number };
  nodes: DialogNode[];
  connections: Connection[];
  activeMode: string;
  showRightPanel: boolean;
  showLeftPanel: boolean;
  handleNodesChange: (_changes: any) => void;
  handleEdgesChange: (_changes: any) => void;
  handleConnect: (_connection: any) => void;
  handleNodeClick: (_event: React.MouseEvent, _node: any) => void;
  handlePaneClick: () => void;
  handleBackgroundClick: (_event: React.MouseEvent) => void;
  handleBackgroundConnectionDrop: (_event: React.MouseEvent | MouseEvent | TouchEvent) => void;
  generateNodeContent: (
    _nodeId: string,
    _mode: GenerateMode,
    _options?: {
      ignoreConnections?: boolean;
      customPrompt?: string;
      systemPrompt?: string;
    }
  ) => Promise<void>;
  handleDeleteEdge: (_edgeId: string) => void;
  handleAddNodeFromEdge: ({
    sourceNodeId,
    position,
    nodeType,
    initialText,
  }: {
    sourceNodeId: string;
    position: { x: number; y: number };
    nodeType?: string;
    initialText?: string;
  }) => string | undefined;
  onSelectionChange?: (_params: { nodes: any[] }) => void;
  onRegisterReactFlowApi?: (_api: ReactFlowApi) => void;
}

// PERFORMANCE: Shallow compare function for EditorContent
const areEditorContentPropsEqual = (
  prevProps: EditorContentProps,
  nextProps: EditorContentProps
): boolean => {
  if (
    prevProps.activeMode !== nextProps.activeMode ||
    prevProps.showRightPanel !== nextProps.showRightPanel ||
    prevProps.showLeftPanel !== nextProps.showLeftPanel ||
    prevProps.viewportOffset.x !== nextProps.viewportOffset.x ||
    prevProps.viewportOffset.y !== nextProps.viewportOffset.y
  ) {
    return false;
  }

  if (
    prevProps.nodes.length !== nextProps.nodes.length ||
    prevProps.connections.length !== nextProps.connections.length
  ) {
    return false;
  }

  for (let i = 0; i < prevProps.nodes.length; i++) {
    const prevNode = prevProps.nodes[i];
    const nextNode = nextProps.nodes[i];
    if (
      prevNode.id !== nextNode.id ||
      prevNode.data !== nextNode.data ||
      prevNode.position.x !== nextNode.position.x ||
      prevNode.position.y !== nextNode.position.y
    ) {
      return false;
    }
  }

  for (let i = 0; i < prevProps.connections.length; i++) {
    if (prevProps.connections[i].id !== nextProps.connections[i].id) {
      return false;
    }
  }

  return true;
};

const EditorContent: React.FC<EditorContentProps> = React.memo(
  ({
    editorRef,
    editorContentRef,
    viewportOffset,
    nodes,
    connections,
    activeMode,
    showRightPanel,
    showLeftPanel,
    handleNodesChange,
    handleEdgesChange,
    handleConnect,
    handleNodeClick,
    handlePaneClick,
    handleBackgroundClick,
    handleBackgroundConnectionDrop,
    generateNodeContent,
    handleAddNodeFromEdge,
    handleDeleteEdge,
    onSelectionChange,
    onRegisterReactFlowApi,
  }) => {
    const { currentContext, updateCurrentContext } = useSubgraphNavigationStore();
    
    const [highlightedConnections, setHighlightedConnections] = useState<string[]>([]);
    
    const updateHighlightedConnections = useCallback(
      (nodeIds: string[]) => {
        if (nodeIds.length === 0) {
          setHighlightedConnections([]);
          return;
        }

        const currentConnections = currentContext ? currentContext.edges : connections;
        const connectedIds = currentConnections
          .filter((conn) => nodeIds.includes(conn.source) || nodeIds.includes(conn.target))
          .map((conn) => conn.id);

        setHighlightedConnections(connectedIds);
      },
      [connections, currentContext]
    );

    useEffect(() => {
      if (import.meta.env.DEV) {
        const displayedNodes = currentContext ? currentContext.nodes : nodes;
        logger.throttledLog(
          "editor_content_display",
          `[EditorContent] Displaying ${displayedNodes.length} nodes, currentContext: ${currentContext?.id || 'null (main)'}`,
          5000 // Log max once per 5 seconds
        );
      }
    }, [nodes, currentContext]);

    const wrappedHandleNodesChange = useCallback(
      (changes: any) => {
        const isRegenerating = useRegenerationStore.getState().isRegeneratingNodes;
        if (isRegenerating) {
          logger.debug("[EditorContent] Skipping node changes during regeneration");
          return;
        }

        if (currentContext) {
          logger.debug(
            `[EditorContent] Node changes in subgraph ${currentContext.id}, updating context`
          );
          const updatedNodes = applyNodeChanges(changes, currentContext.nodes) as DialogNode[];
          updateCurrentContext(updatedNodes, currentContext.edges);
        } else {
          handleNodesChange(changes);
        }
      },
      [currentContext, handleNodesChange, updateCurrentContext]
    );

    const wrappedHandleEdgesChange = useCallback((changes: any) => {
      if (currentContext) {
        logger.debug(`[EditorContent] Edge changes in subgraph ${currentContext.id}, updating context`);
        const updatedEdges = applyEdgeChanges(changes, currentContext.edges) as Connection[];
        updateCurrentContext(currentContext.nodes, updatedEdges);
      } else {
        handleEdgesChange(changes);
      }
    }, [currentContext, handleEdgesChange, updateCurrentContext]);

    useEffect(() => {
      const triggerResize = () => {
        window.dispatchEvent(new Event("resize"));
      };

      triggerResize();

      const timerId = setTimeout(triggerResize, 50);

      return () => clearTimeout(timerId);
    }, [showLeftPanel, showRightPanel]);

    return (
      <div
        ref={editorRef}
        className="relative react-flow-container h-full w-full overflow-hidden"
        style={{
          backgroundColor: "#0A0A0B",
          backgroundImage:
            "linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          backgroundPosition: `${viewportOffset.x % 40}px ${viewportOffset.y % 40}px`,
          overscrollBehavior: "none",
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <SubgraphBreadcrumb />

        <EdgeActionProvider onAddNode={handleAddNodeFromEdge} onDeleteEdge={handleDeleteEdge}>
          <div
            id="editor-content"
            ref={editorContentRef}
            className="w-full h-full gpu-accelerated"
            style={{
              willChange: "transform",
              zIndex: 1,
              userSelect: "auto",
              flexGrow: 1,
              position: "relative",
            }}
            onClick={handleBackgroundClick}
          >
            {activeMode === "flow" ? (
            <ViewportManager
              key={`viewport-manager-${currentContext?.id || "main"}`}
                nodes={currentContext ? currentContext.nodes : nodes}
                connections={currentContext ? currentContext.edges : connections}
                highlightedConnections={highlightedConnections}
                onNodesChange={wrappedHandleNodesChange}
                onEdgesChange={wrappedHandleEdgesChange}
                onConnect={handleConnect}
                onNodeClick={handleNodeClick}
                onPaneClick={handlePaneClick}
                onInit={() => {
                  if (import.meta.env.DEV) {
                    logger.debug("ReactFlow initialized");
                  }
                }}
                onGenerateDialog={generateNodeContent}
                onConnectEnd={handleBackgroundConnectionDrop}
                onAddNode={handleAddNodeFromEdge}
                onSelectionChange={(params) => {
                  if (params.nodes && params.nodes.length > 0) {
                    const nodeIds = params.nodes.map((n) => n.id);
                    updateHighlightedConnections(nodeIds);
                  } else {
                    updateHighlightedConnections([]);
                  }
                  if (onSelectionChange) {
                    onSelectionChange(params);
                  }
                }}
                onRegisterReactFlowApi={onRegisterReactFlowApi}
              />
            ) : activeMode === "tree" ? (
              <DialogTreeView
                nodes={currentContext ? currentContext.nodes : nodes}
                connections={currentContext ? currentContext.edges : connections}
                onNodeSelect={(nodeId) => {
                  if (import.meta.env.DEV) {
                    logger.debug("Node selected:", nodeId);
                  }
                }}
              />
            ) : activeMode === "read" ? (
              <ReadMode
                nodes={currentContext ? currentContext.nodes : nodes}
                connections={currentContext ? currentContext.edges : connections}
                onSelectNode={(nodeId) => {
                  if (onSelectionChange) {
                    onSelectionChange({ nodes: [{ id: nodeId }] });
                  }
                }}
                onScrollToNode={(nodeId) => {
                  if (import.meta.env.DEV) {
                    logger.debug("Scroll to node:", nodeId);
                  }
                }}
              />
            ) : null}
          </div>
        </EdgeActionProvider>
      </div>
    );
  },
  areEditorContentPropsEqual
);

EditorContent.displayName = "EditorContent";

export default EditorContent;
