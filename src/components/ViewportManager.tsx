import React, {
  useCallback,
  useEffect,
  useRef,
  memo,
  useMemo,
  useState,
  useContext,
  Suspense,
  lazy,
} from "react";
import ReactDOM from "react-dom";
import {
  ReactFlow,
  MiniMap,
  Background,
  Node,
  NodeChange,
  OnConnect,
  OnNodesChange,
  OnEdgesChange,
  NodeTypes,
  useReactFlow,
  OnConnectEnd,
  HandleType,
  useStore,
  OnConnectStart,
  ConnectionMode,
  DefaultEdgeOptions,
  useKeyPress,
  SelectionMode,
  Controls,
  OnInit,
} from "reactflow";
import "reactflow/dist/style.css";

import { useCopyPaste } from "./viewport/CopyPasteHandler";
import { useEdgePreloader } from "../utils/edgePreloader";
import OutlineNode from "./nodes/OutlineNode";

import { DialogNode, Connection as CustomConnection } from "../types/dialog";
import { getLatestNodeTypes } from "./nodes/registry";
import { edgeTypes } from "./viewport/registry";
import { EdgeActionContext } from "./viewport/EdgeActionHandler";
import { GenerateMode } from "../hooks/useNodeAI";
import { ProjectType } from "../types/project";
import logger from "../utils/logger";
import type { ReactFlowApi } from "../types/reactflow";
import { useRegenerationStore } from "../store/regenerationStore";

interface ViewportManagerProps {
  nodes: DialogNode[];
  connections: CustomConnection[];
  highlightedConnections: string[];
  onNodesChange?: OnNodesChange;
  onEdgesChange?: OnEdgesChange;
  onConnect?: OnConnect;
  onNodeClick?: (_event: React.MouseEvent, _node: Node) => void;
  onPaneClick?: (_event: React.MouseEvent) => void;
  onSelectionChange?: (_params: { nodes: Node[] }) => void;
  onInit?: OnInit<Node, CustomConnection>;
  onGenerateDialog?: (
    _nodeId: string,
    _mode: GenerateMode,
    _options?: {
      ignoreConnections?: boolean;
      customPrompt?: string;
      systemPrompt?: string;
    }
  ) => Promise<void>;
  onAddNode?: (_params: {
    sourceNodeId: string;
    position: { x: number; y: number };
    nodeType: string;
  }) => void;
  children?: React.ReactNode;
  nodeTypes?: NodeTypes;
  projectType?: ProjectType;
  onConnectEnd?: OnConnectEnd;
  onRegisterReactFlowApi?: (api: ReactFlowApi) => void;
}

interface ConnectionMenu {
  visible: boolean;
  position: { x: number; y: number };
  sourceNodeId?: string;
  sourceHandle?: string;
  handleType?: HandleType;
}

const ViewportManager: React.FC<ViewportManagerProps> = ({
  nodes,
  connections,
  highlightedConnections,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onPaneClick,
  onSelectionChange,
  onInit,
  onGenerateDialog,
  onAddNode,
  children,
  nodeTypes: propNodeTypes,
  projectType = "game",
  onConnectEnd,
  onRegisterReactFlowApi,
}) => {
  const processingNodeId = useRegenerationStore((state) => state.processingNodeId);
  const edgeActionContext = useContext(EdgeActionContext);
  const contextAddNode = edgeActionContext.onAddNode;

  const reactFlowInstance = useReactFlow<Node, CustomConnection>();

  const effectiveAddNode = onAddNode || contextAddNode;

  const { getNodes, setNodes, getEdges, setEdges, getViewport, zoomIn, zoomOut, fitView } =
    useReactFlow();
  const edgePreloader = useEdgePreloader();

  const effectiveNodeTypes = useMemo(() => {
    if (propNodeTypes) {
      return propNodeTypes;
    }
    const types = getLatestNodeTypes();
    if (import.meta.env.DEV) {
      logger.info(`[ViewportManager] Using nodeTypes: ${Object.keys(types).length} types`);
    }
    return types;
  }, [propNodeTypes]);

  useEffect(() => {
    logger.throttledLog(
      "viewport_node_types",
      `ViewportManager using nodeTypes: ${Object.keys(effectiveNodeTypes).length} types`
    );
    logger.throttledLog(
      "viewport_available_types",
      `Available node types: ${Object.keys(effectiveNodeTypes).join(", ")}`
    );
  }, [effectiveNodeTypes]);

  const zoom = useStore((state) => state.transform[2]);

  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);

  const handleSelectionChange = useCallback(({ nodes }: { nodes: Node[] }) => {
    setSelectedNodes(nodes);
  }, []);

  const [connectionMenu, setConnectionMenu] = useState<ConnectionMenu>({
    visible: false,
    position: { x: 0, y: 0 },
  });

  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingNodeId, setConnectingNodeId] = useState<string | null>(null);

  const defaultEdgeOptions: DefaultEdgeOptions = useMemo(
    () => ({
      style: {
        strokeWidth: 2.5,
        stroke: "#6b7280",
        cursor: "pointer",
      },
      type: "default",
      animated: false,
      zIndex: 10,
    }),
    []
  );

  const isAltPressed = useKeyPress("Alt");

  useEffect(() => {
    if (isAltPressed) {
      document.body.style.cursor = "copy";
    } else {
      document.body.style.cursor = "";
    }

    return () => {
      document.body.style.cursor = "";
    };
  }, [isAltPressed]);

  useEffect(() => {
    if (!onRegisterReactFlowApi || !reactFlowInstance) return;

    const api: ReactFlowApi = {
      getViewport: () => {
        try {
          return getViewport();
        } catch {
          return { x: 0, y: 0, zoom: 1 };
        }
      },
      zoomIn: () => {
        try {
          zoomIn();
        } catch (error) {
          logger.warn("[ViewportManager] zoomIn failed", error);
        }
      },
      zoomOut: () => {
        try {
          zoomOut();
        } catch (error) {
          logger.warn("[ViewportManager] zoomOut failed", error);
        }
      },
      fitView: (options) => {
        try {
          fitView(options ?? {});
        } catch (error) {
          logger.warn("[ViewportManager] fitView failed", error);
        }
      },
      clearSelection: () => {
        try {
          const nodes = reactFlowInstance.getNodes();
          if (!nodes || nodes.length === 0) return;
          reactFlowInstance.setNodes(nodes.map((n) => ({ ...n, selected: false })));
        } catch (error) {
          logger.warn("[ViewportManager] clearSelection failed", error);
        }
      },
      selectNodesById: (ids) => {
        try {
          const idSet = new Set(ids);
          const nodes = reactFlowInstance.getNodes();
          if (!nodes || nodes.length === 0) return;
          reactFlowInstance.setNodes(
            nodes.map((n) => ({
              ...n,
              selected: idSet.has(n.id),
            }))
          );
        } catch (error) {
          logger.warn("[ViewportManager] selectNodesById failed", error);
        }
      },
      fitToNode: (id, options) => {
        try {
          fitView({
            padding: options?.padding ?? 0.3,
            includeHiddenNodes: false,
            minZoom: options?.minZoom ?? 0.5,
            maxZoom: options?.maxZoom ?? 1.5,
            duration: options?.duration ?? 400,
            nodes: [{ id }],
          });
        } catch (error) {
          logger.warn("[ViewportManager] fitToNode failed", error);
        }
      },
    };

    onRegisterReactFlowApi(api);
  }, [fitView, getViewport, onRegisterReactFlowApi, reactFlowInstance, zoomIn, zoomOut]);

  useEffect(() => {
    const handleNodeFocus = (event: CustomEvent) => {
      const { nodeId } = event.detail;
      if (!nodeId) return;

      logger.debug(`[ViewportManager] Received node:focus event for ${nodeId}`);

      const node = nodes.find((n) => n.id === nodeId);
      if (!node) {
        logger.warn(`[ViewportManager] Node ${nodeId} not found for focusing`);
        return;
      }

      setTimeout(() => {
        try {
          reactFlowInstance?.setCenter(node.position.x + 150, node.position.y + 75, {
            zoom: 1.0,
            duration: 800,
          });
          logger.debug(`[ViewportManager] Focused on node ${nodeId} at position`, node.position);
        } catch (error) {
          logger.error(`[ViewportManager] Failed to focus on node ${nodeId}:`, error);
        }
      }, 300);
    };

    window.addEventListener("node:focus", handleNodeFocus as EventListener);
    return () => {
      window.removeEventListener("node:focus", handleNodeFocus as EventListener);
    };
  }, [nodes, reactFlowInstance]);

  const {
    onNodeDragStart,
    onNodeDrag,
    onNodeDragStop,
    isAltCopying,
    getLockedNodeIds,
  } = useCopyPaste({
    selectedNodes,
    getEdges,
    setNodes: setNodes as React.Dispatch<React.SetStateAction<Node[]>>,
    setEdges,
    zoom,
  });

  const handleNodesChangeWithCopyGuard: OnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (!onNodesChange) {
        return;
      }

      if (isAltCopying) {
        const lockedIds = getLockedNodeIds();
        const filtered = changes.filter(
          (change) => !(change.type === "position" && lockedIds.includes(change.id))
        );
        if (filtered.length === 0) {
          return;
        }
        onNodesChange(filtered);
        return;
      }

      onNodesChange(changes);
    },
    [onNodesChange, isAltCopying, getLockedNodeIds]
  );

  const enhancedNodeTypes = useMemo(() => {
    return {
      ...effectiveNodeTypes,
      outlineNode: OutlineNode,
    };
  }, [effectiveNodeTypes]);

  const memoizedOnGenerateDialog = useCallback(
    (
      nodeId: string,
      mode: GenerateMode,
      options?: {
        ignoreConnections?: boolean;
        customPrompt?: string;
        systemPrompt?: string;
      }
    ) => {
      if (onGenerateDialog) {
        onGenerateDialog(nodeId, mode, options);
      }
    },
    [onGenerateDialog]
  );

  const nodesRef = useRef(nodes);
  const prevProcessingNodeIdRef = useRef(processingNodeId);
  const prevMemoizedOnGenerateDialogRef = useRef(memoizedOnGenerateDialog);
  
  const nodesChanged = nodesRef.current !== nodes;
  const processingChanged = prevProcessingNodeIdRef.current !== processingNodeId;
  const handlerChanged = prevMemoizedOnGenerateDialogRef.current !== memoizedOnGenerateDialog;
  
  if (nodesChanged) {
    nodesRef.current = nodes;
  }
  if (processingChanged) {
    prevProcessingNodeIdRef.current = processingNodeId;
  }
  if (handlerChanged) {
    prevMemoizedOnGenerateDialogRef.current = memoizedOnGenerateDialog;
  }
  
  const processedNodes = useMemo(() => {
    return nodes.map((node) => {
      const nodeIsProcessing = typeof node.data.isProcessing === "boolean" 
        ? node.data.isProcessing === true
        : typeof node.data.isProcessing === "object" && node.data.isProcessing !== null
          ? false
          : Boolean(node.data.isProcessing);
      const isProcessing = nodeIsProcessing || node.id === processingNodeId;
      const data: any = {
        ...node.data,
        onGenerateDialog: memoizedOnGenerateDialog,
        isProcessing: Boolean(isProcessing),
        isVisible: true,
      };
      return { ...node, data };
    });
  }, [nodes, processingNodeId, memoizedOnGenerateDialog]);


  const processedEdges = useMemo(() => {
    return connections.map((edge) => ({
      ...edge,
      style: {
        ...edge.style,
        stroke: highlightedConnections.includes(edge.id) ? "#3b82f6" : "#4b5563",
        strokeWidth: highlightedConnections.includes(edge.id) ? 3.5 : 2.5,
      },
    }));
  }, [connections, highlightedConnections]);

  const prevNodesLengthRef = useRef(nodes.length);
  const prevConnectionsLengthRef = useRef(connections.length);
  
  useEffect(() => {
    if (nodes.length > 0 && connections.length > 0) {
      if (document.body.classList.contains("dragging-active")) {
        return;
      }

      const nodesChanged = nodes.length !== prevNodesLengthRef.current;
      const connectionsChanged = connections.length !== prevConnectionsLengthRef.current;
      
      if (!nodesChanged && !connectionsChanged) {
        return;
      }

      prevNodesLengthRef.current = nodes.length;
      prevConnectionsLengthRef.current = connections.length;

      const timeoutId = setTimeout(() => {
        if (document.body.classList.contains("dragging-active")) {
          return;
        }

        edgePreloader.preloadEdgePaths(nodes, connections, {
          batchSize: 50,
          delayBetweenBatches: 0,
        });
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [nodes, connections, edgePreloader]);


  const rafRef = useRef<number>();
  const lastEventRef = useRef<{ [key: string]: number }>({});
  const EVENT_THROTTLE = 16;

  const handleMouseEvent = useCallback((eventName: string, handler: Function, event: any) => {
    const now = performance.now();

    if (
      !lastEventRef.current[eventName] ||
      now - lastEventRef.current[eventName] > EVENT_THROTTLE
    ) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      Promise.resolve().then(() => {
        lastEventRef.current[eventName] = now;
        handler(event);
      });
    }
  }, []);

  const optimizedNodeDrag = useCallback(
    (event: any, node: Node) => {
      if (!onNodeDrag) return;

      if (!document.body.classList.contains("dragging-active")) {
        document.body.classList.add("dragging-active");
      }

      handleMouseEvent("nodeDrag", () => onNodeDrag(event, node), event);
    },
    [onNodeDrag, handleMouseEvent]
  );

  const optimizedNodeDragStop = useCallback(
    (event: any, node: Node) => {
      document.body.classList.remove("dragging-active");

      if (onNodeDragStop) {
        onNodeDragStop(event, node);
      }

      if (nodes && connections) {
        requestAnimationFrame(() => {
          logger.debug("[ViewportManager] Drag ended, saving current state");

          const currentNodes = nodes;
          const currentEdges = connections.map((conn) => ({
            id: conn.id,
            source: conn.source,
            target: conn.target,
            sourceHandle: conn.sourceHandle,
            targetHandle: conn.targetHandle,
          })) as CustomConnection[];

          import("../utils/localStorageUtils").then((module) => {
            module.saveDialogFlow(currentNodes, currentEdges, projectType || "game");
          });
        });
      }
    },
    [onNodeDragStop, nodes, connections, getNodes, getEdges, projectType]
  );

  const wheelTimeoutRef = useRef<number>();
  const lastWheelTime = useRef(0);
  const WHEEL_THROTTLE = 16;

  const handleWheel = useCallback(
    (event: Event) => {
      if (!(event instanceof WheelEvent)) return;

      const now = performance.now();
      if (now - lastWheelTime.current < WHEEL_THROTTLE) {
        return;
      }

      lastWheelTime.current = now;

      if (wheelTimeoutRef.current) {
        window.clearTimeout(wheelTimeoutRef.current);
      }

      wheelTimeoutRef.current = window.setTimeout(() => {
        requestAnimationFrame(() => {
          if (!reactFlowInstance) return;
          const { viewport } = reactFlowInstance.toObject();
          reactFlowInstance.setViewport(viewport);
        });
      }, 0);
    },
    [reactFlowInstance]
  );

  useEffect(() => {
    const pane = document.querySelector(".react-flow__pane");
    if (pane) {
      pane.addEventListener("wheel", handleWheel, { passive: true });

      const handleMouseMove = (e: Event) => {
        if (e instanceof MouseEvent) {
          handleMouseEvent(
            "mouseMove",
            () => {
              if ("requestIdleCallback" in window) {
                window.requestIdleCallback(() => {});
              }
            },
            e
          );
        }
      };

      pane.addEventListener("mousemove", handleMouseMove, { passive: true });

      return () => {
        pane.removeEventListener("wheel", handleWheel);
        pane.removeEventListener("mousemove", handleMouseMove);
      };
    }
  }, [handleWheel, handleMouseEvent]);

  const handleConnectStart: OnConnectStart = useCallback((_, { nodeId }) => {
    setIsConnecting(true);
    setConnectingNodeId(nodeId);
  }, []);

  const handleConnectionEnd: OnConnectEnd = useCallback(
    (event) => {
      const target = event?.target as HTMLElement;

      if (
        target?.closest(".dialog-node-selector") ||
        document.querySelector(".node-selector-overlay")
      ) {
        logger.debug("Click detected inside NodeSelector or overlay, operation blocked");

        event?.preventDefault();
        event?.stopPropagation();
        if (event && "stopImmediatePropagation" in event) {
          (event as any).stopImmediatePropagation();
        }

        return;
      }

      const connectionInfo = connectingNodeId;

      if (!connectionInfo) {
        logger.debug("No connection info, no operation performed");
        return;
      }

      const enrichedEvent = event as any;
      if (enrichedEvent) {
        enrichedEvent.connectionInfo = {
          id: connectionInfo,
          type: "output",
        };
      }

      if (onConnectEnd) {
        logger.debug("Calling onConnectEnd from ViewportManager:", {
          connectionInfo,
          target: target?.tagName,
          className: target?.className,
          isNodeSelector: !!target?.closest(".dialog-node-selector"),
        });
        onConnectEnd(enrichedEvent);
      }

      setIsConnecting(false);
      setConnectingNodeId(null);
    },
    [onConnectEnd, connectingNodeId]
  );

  const MemoizedControls = useMemo(
    () => <Controls position="bottom-right" showInteractive={true} style={{ bottom: 60 }} />,
    []
  );

  const MemoizedMiniMap = useMemo(
    () => (
      <MiniMap
        nodeStrokeWidth={3}
        zoomable
        pannable
        position="bottom-left"
        nodeColor={(node: Node) => {
          const hasIssue = (node as any)?.data?.hasIssue;
          if (hasIssue) return "#EF4444";
          return node.type?.includes("player") ? "#10B981" : "#3B82F6";
        }}
        maskColor="rgba(0, 0, 0, 0.1)"
        className="bg-[#0F0F11] border border-gray-800/50"
      />
    ),
    []
  );

  const MemoizedBackground = useMemo(
    () => <Background color="rgba(255, 255, 255, 0.05)" gap={20} size={1} />,
    []
  );

  const handleViewportChange = useCallback(() => {
  }, []);

  return (
    <div className="w-full h-full" style={{ width: "100%", height: "100%", position: "relative" }}>
      <ReactFlow
        nodes={processedNodes}
        edges={processedEdges}
        nodeTypes={enhancedNodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
          onNodesChange={handleNodesChangeWithCopyGuard}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onInit={onInit}
        onSelectionChange={onSelectionChange || handleSelectionChange}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={optimizedNodeDrag}
        onNodeDragStop={optimizedNodeDragStop}
        onConnectStart={handleConnectStart}
        onConnectEnd={handleConnectionEnd}
        onMove={handleViewportChange}
        fitView
        minZoom={0.1}
        maxZoom={2}
        panOnDrag={!isConnecting}
        selectionMode={SelectionMode.Partial}
        multiSelectionKeyCode="Control"
        selectionKeyCode="Shift"
        selectNodesOnDrag={true}
        connectionMode={ConnectionMode.Loose}
        snapGrid={[20, 20]}
        snapToGrid={false}
        proOptions={{
          hideAttribution: true,
          account: "paid-pro",
        }}
        style={{ width: "100%", height: "100%" }}
      >
        {MemoizedControls}
        {MemoizedMiniMap}
        {MemoizedBackground}
        {children}
      </ReactFlow>

      {connectionMenu.visible &&
        connectionMenu.sourceNodeId &&
        ReactDOM.createPortal(
          <div
            style={{
              position: "absolute",
              left: connectionMenu.position.x,
              top: connectionMenu.position.y,
              zIndex: 1000,
            }}
          >
            <div className="bg-gray-900/90 p-4 rounded-lg backdrop-blur-sm border border-gray-800/50 shadow-lg">
              <button
                className="mb-2 p-2 w-full rounded-md hover:bg-blue-600/20 text-blue-400 text-sm text-left"
                onClick={() => {
                  if (effectiveAddNode && connectionMenu.sourceNodeId) {
                    effectiveAddNode({
                      sourceNodeId: connectionMenu.sourceNodeId,
                      position: connectionMenu.position,
                      nodeType: "npcDialog",
                    });
                    setConnectionMenu({ ...connectionMenu, visible: false });
                  }
                }}
              >
                Add NPC Dialog
              </button>
              <button
                className="p-2 w-full rounded-md hover:bg-green-600/20 text-green-400 text-sm text-left"
                onClick={() => {
                  if (effectiveAddNode && connectionMenu.sourceNodeId) {
                    effectiveAddNode({
                      sourceNodeId: connectionMenu.sourceNodeId,
                      position: connectionMenu.position,
                      nodeType: "playerResponse",
                    });
                    setConnectionMenu({ ...connectionMenu, visible: false });
                  }
                }}
              >
                Add Player Response
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

const propsAreEqual = (
  prevProps: ViewportManagerProps,
  nextProps: ViewportManagerProps
): boolean => {
  const nodesEqual = prevProps.nodes === nextProps.nodes;
  const connectionsEqual = prevProps.connections === nextProps.connections;
  const projectTypeEqual = prevProps.projectType === nextProps.projectType;

  const nodeCountEqual = prevProps.nodes.length === nextProps.nodes.length;

  return nodesEqual && connectionsEqual && projectTypeEqual && nodeCountEqual;
};

const ViewportLoader: React.FC = () => (
  <div className="h-full w-full flex items-center justify-center bg-slate-900">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
      <div className="text-base text-slate-300 font-medium">Loading Dialog Editor...</div>
      <div className="text-sm text-slate-500 mt-2">Preparing the visual interface</div>
    </div>
  </div>
);

const MemoizedViewportManager = memo(ViewportManager, propsAreEqual);

const LazyViewportManager = lazy(() => Promise.resolve({ default: MemoizedViewportManager }));

const ViewportManagerWithLazyLoading: React.FC<ViewportManagerProps> = (props) => (
  <Suspense fallback={<ViewportLoader />}>
    <LazyViewportManager {...props} />
  </Suspense>
);

export default ViewportManagerWithLazyLoading;
