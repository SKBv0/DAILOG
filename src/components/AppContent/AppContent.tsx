import React, { useState, useEffect, useRef, useCallback, useMemo, startTransition } from "react";
import type { DialogNodeType } from "../../types/dialog";
import { Tag } from "../../types/dialog";
import { DialogNode, Connection } from "../../types/editor";
import { initializeNodes } from "../nodes";
import ToolbarSection from "./ToolbarSection";
import EditorContent from "./EditorContent";
import { LeftPanel } from "../LeftPanel";
import { RightPanel } from "../RightPanel/index";
import BottomPanel from "../BottomPanel";
import { SettingsModal } from "../SettingsModal";
import { NodeSelector } from "../NodeSelector";
import ConnectionMenu from "../ConnectionMenu";
import { EdgeChange, Connection as ReactFlowConnectionType } from "reactflow";
import { GlobalToaster } from "../ui/GlobalToaster";
import {
  useConnectionManager,
  useNodeManager,
  useNodeAI,
  useAutoLayout,
  useDialogPaths,
  useLayout,
  useViewport,
  useEditorInteractions,
  useToolbarActions,
  useKeyboardShortcuts,
} from "../../hooks";
import { loadDefaultDialogFlow } from "../../utils/dialogLoader";
import { loadDialogFlow, saveDialogFlow } from "../../utils/localStorageUtils";
import { toast } from "react-hot-toast";
import { GenerateMode } from "../../hooks/useNodeAI";
import { useDevTools } from "../../hooks/useDevTools";
import EdgePerformanceDashboard from "../EdgePerformanceDashboard";
import useSubgraphNavigationStore from "../../store/subgraphNavigationStore";
import logger from "../../utils/logger";
import { useRegenerationStore } from "../../store/regenerationStore";
import type { ReactFlowApi } from "../../types/reactflow";

const AppContent = React.memo(function AppContent(): JSX.Element {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const devTools = useDevTools();

  const {
    showLeftPanel,
    setShowLeftPanel,
    showRightPanel,
    setShowRightPanel,
    isSettingsOpen,
    setIsSettingsOpen,
    activeMode,
    setActiveMode,
    viewMode,
    setViewMode,
    projectType,
    detectTestContent,
    setDetectTestContent,
    handleProjectTypeChange,
  } = useLayout();

  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [reactFlowApi, setReactFlowApi] = useState<ReactFlowApi | null>(null);

  (window as any).currentProjectType = projectType;

  const defaultDialogFlow = useMemo(() => {
    const savedFlow = loadDialogFlow();
    if (savedFlow) {
      if (savedFlow.projectType) {
        handleProjectTypeChange(savedFlow.projectType);
      }
      return savedFlow;
    }

    return loadDefaultDialogFlow();
  }, [handleProjectTypeChange]);

  const [nodes, setNodes] = useState<DialogNode[]>(defaultDialogFlow.nodes);
  const [connections, setConnections] = useState<Connection[]>(defaultDialogFlow.connections);

  const { currentContext } = useSubgraphNavigationStore();

  const editorRef = useRef<HTMLDivElement>(null);
  const editorContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initializeNodes();

    const handleSubgraphSave = (event: CustomEvent) => {
      const { subgraphNodeId, nodes: subgraphNodes, edges: subgraphEdges } = event.detail;

      logger.debug(`[AppContent] Received subgraph:save event for ${subgraphNodeId} with ${subgraphNodes.length} nodes`);

      setNodes((prevNodes) => {
        logger.debug(`[AppContent:Save] prevNodes.length = ${prevNodes.length}, looking for ${subgraphNodeId}`);

        let found = false;
        const updated = prevNodes.map((node) => {
          if (node.id === subgraphNodeId && node.type === "subgraphNode") {
            found = true;
            logger.debug(`[AppContent:Save] Found and updating subgraph node ${subgraphNodeId}`);
            return {
              ...node,
              data: {
                ...node.data,
                metadata: {
                  ...node.data.metadata,
                  subgraph: {
                    ...(node.data.metadata?.subgraph || {}),
                    nodes: subgraphNodes,
                    edges: subgraphEdges,
                  }
                }
              }
            } as DialogNode;
          }
          return node;
        });

        if (!found) {
          logger.warn(`[AppContent:Save] WARNING: Subgraph node ${subgraphNodeId} not found in prevNodes!`);
          logger.debug(`[AppContent:Save] Available node IDs: ${prevNodes.map(n => n.id).join(', ')}`);
        }

        logger.debug(`[AppContent:Save] Returning ${updated.length} nodes`);
        return updated;
      });
    };

    window.addEventListener("subgraph:save", handleSubgraphSave as EventListener);

    return () => {
      window.removeEventListener("subgraph:save", handleSubgraphSave as EventListener);
    };
  }, []);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    setConnections((eds: Connection[]) =>
      changes.reduce((acc, change) => {
        if (change.type === "remove") {
          return acc.filter((e) => e.id !== change.id);
        }
        return acc;
      }, eds)
    );
  }, []);

  const {
    offset: viewportOffset,
    size: viewportSize,
    zoom,
    handleZoomIn,
    handleZoomOut,
    handleCenterViewport,
  } = useViewport(editorRef, reactFlowApi || undefined);

  const { handleAutoLayout } = useAutoLayout({ nodes, connections, setNodes });

  const { dialogPaths: _dialogPaths, dialogAnalysis: _dialogAnalysis } = useDialogPaths({
    nodes,
    connections,
  });

  const memoizedDialogPaths = useMemo(() => _dialogPaths ? _dialogPaths() : [], [_dialogPaths]);

  const { handleConnectionEnd } = useConnectionManager({
    nodes,
    connections,
    setConnections,
    selectedNodes,
  });

  // PERFORMANCE FIX: Stabilize callbacks to prevent useNodeAI re-initialization
  // Batch update queue for regeneration performance optimization
  const batchUpdateQueueRef = useRef<Map<string, Partial<DialogNode["data"]>>>(new Map());
  const batchUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // PERFORMANCE FIX: Adaptive batching based on regeneration state
  const BATCH_UPDATE_DELAY_NORMAL = 150;
  const BATCH_UPDATE_DELAY_REGEN = 50;
  const BATCH_SIZE_THRESHOLD_NORMAL = 3;
  const BATCH_SIZE_THRESHOLD_REGEN = 15;

  const flushBatchUpdates = useCallback(() => {
    if (batchUpdateQueueRef.current.size === 0) return;

    const updates = new Map(batchUpdateQueueRef.current);
    batchUpdateQueueRef.current.clear();

    if (batchUpdateTimeoutRef.current) {
      clearTimeout(batchUpdateTimeoutRef.current);
      batchUpdateTimeoutRef.current = null;
    }

    const { currentContext } = useSubgraphNavigationStore.getState();

    startTransition(() => {
      if (currentContext) {
        const updatedNodes = currentContext.nodes.map((node) => {
          const update = updates.get(node.id);
          if (update) {
            const mergedData = { ...node.data, ...update };
            // Normalize isProcessing and text values
            if (mergedData.isProcessing != null) {
              mergedData.isProcessing = typeof mergedData.isProcessing === "boolean"
                ? mergedData.isProcessing
                : typeof mergedData.isProcessing === "object" && mergedData.isProcessing !== null
                  ? false
                  : Boolean(mergedData.isProcessing);
            }
            if (mergedData.text != null && typeof mergedData.text !== "string") {
              mergedData.text = typeof mergedData.text === "object"
                ? "[Invalid text content]"
                : String(mergedData.text);
            }
            return { ...node, data: mergedData };
          }
          return node;
        });

        useSubgraphNavigationStore.setState({
          currentContext: {
            ...currentContext,
            nodes: updatedNodes,
          },
        });
      }

      setNodes((prevNodes) =>
        prevNodes.map((node) => {
          const update = updates.get(node.id);
          if (update) {
            const mergedData = { ...node.data, ...update };
            if (mergedData.isProcessing != null) {
              mergedData.isProcessing = typeof mergedData.isProcessing === "boolean"
                ? mergedData.isProcessing
                : typeof mergedData.isProcessing === "object" && mergedData.isProcessing !== null
                  ? false
                  : Boolean(mergedData.isProcessing);
            }
            if (mergedData.text != null && typeof mergedData.text !== "string") {
              mergedData.text = typeof mergedData.text === "object"
                ? "[Invalid text content]"
                : String(mergedData.text);
            }
            return { ...node, data: mergedData };
          }
          return node;
        })
      );
    });

    logger.debug(`[BATCH_UPDATE] Flushed ${updates.size} node updates`);
  }, [setNodes]);

    const stableHandleEditNode = useCallback(
    (nodeId: string, newData: Partial<DialogNode["data"]>) => {
      const isRegenerating = useRegenerationStore.getState().isRegeneratingNodes;

      // Normalize isProcessing and text values
      const normalizedData = { ...newData };
      if ("isProcessing" in normalizedData) {
        normalizedData.isProcessing = typeof normalizedData.isProcessing === "boolean"
          ? normalizedData.isProcessing
          : typeof normalizedData.isProcessing === "object" && normalizedData.isProcessing !== null
            ? false
            : Boolean(normalizedData.isProcessing);
      }
      if ("text" in normalizedData && normalizedData.text != null) {
        normalizedData.text = typeof normalizedData.text === "string"
          ? normalizedData.text
          : typeof normalizedData.text === "object"
            ? "[Invalid text content]"
            : String(normalizedData.text);
      }

      if (isRegenerating) {
        const existingUpdate = batchUpdateQueueRef.current.get(nodeId);
        batchUpdateQueueRef.current.set(nodeId, {
          ...existingUpdate,
          ...normalizedData,
        });

        if (batchUpdateTimeoutRef.current) {
          clearTimeout(batchUpdateTimeoutRef.current);
          batchUpdateTimeoutRef.current = null;
        }

        // PERFORMANCE FIX: Use adaptive thresholds
        const threshold = isRegenerating ? BATCH_SIZE_THRESHOLD_REGEN : BATCH_SIZE_THRESHOLD_NORMAL;
        const delay = isRegenerating ? BATCH_UPDATE_DELAY_REGEN : BATCH_UPDATE_DELAY_NORMAL;

        if (batchUpdateQueueRef.current.size >= threshold) {
          flushBatchUpdates();
        } else {
          batchUpdateTimeoutRef.current = setTimeout(() => {
            flushBatchUpdates();
          }, delay);
        }
        return;
      }

      const { currentContext } = useSubgraphNavigationStore.getState();

      if (currentContext) {
        const updatedNodes = currentContext.nodes.map((node) => {
          if (node.id === nodeId) {
            const mergedData = { ...node.data, ...normalizedData };
            // Normalize existing isProcessing and text values
            if (mergedData.isProcessing != null) {
              mergedData.isProcessing = typeof mergedData.isProcessing === "boolean"
                ? mergedData.isProcessing
                : typeof mergedData.isProcessing === "object" && mergedData.isProcessing !== null
                  ? false
                  : Boolean(mergedData.isProcessing);
            }
            if (mergedData.text != null && typeof mergedData.text !== "string") {
              mergedData.text = typeof mergedData.text === "object"
                ? "[Invalid text content]"
                : String(mergedData.text);
            }
            return { ...node, data: mergedData };
          }
          return node;
        });

        useSubgraphNavigationStore.setState({
          currentContext: {
            ...currentContext,
            nodes: updatedNodes,
          },
        });

        startTransition(() => {
          setNodes((prevNodes) =>
            prevNodes.map((node) => {
              if (node.id === nodeId) {
                const mergedData = { ...node.data, ...normalizedData };
                if (mergedData.isProcessing != null) {
                  mergedData.isProcessing = typeof mergedData.isProcessing === "boolean"
                    ? mergedData.isProcessing
                    : typeof mergedData.isProcessing === "object" && mergedData.isProcessing !== null
                      ? false
                      : Boolean(mergedData.isProcessing);
                }
                if (mergedData.text != null && typeof mergedData.text !== "string") {
                  mergedData.text = typeof mergedData.text === "object"
                    ? "[Invalid text content]"
                    : String(mergedData.text);
                }
                return { ...node, data: mergedData };
              }
              return node;
            })
          );
        });
      } else {
        startTransition(() => {
          setNodes((prevNodes) =>
            prevNodes.map((node) => {
              if (node.id === nodeId) {
                const mergedData = { ...node.data, ...normalizedData };
                if (mergedData.isProcessing != null) {
                  mergedData.isProcessing = typeof mergedData.isProcessing === "boolean"
                    ? mergedData.isProcessing
                    : typeof mergedData.isProcessing === "object" && mergedData.isProcessing !== null
                      ? false
                      : Boolean(mergedData.isProcessing);
                }
                if (mergedData.text != null && typeof mergedData.text !== "string") {
                  mergedData.text = typeof mergedData.text === "object"
                    ? "[Invalid text content]"
                    : String(mergedData.text);
                }
                return { ...node, data: mergedData };
              }
              return node;
            })
          );
        });
      }
    },
    [flushBatchUpdates, setNodes]
  );

  // PERFORMANCE: Optimize stableSetNodes with reference stability
  const stableSetNodes = useCallback((updateFn: any) => {
    const { currentContext } = useSubgraphNavigationStore.getState();

    if (Math.random() < 0.01) {
      logger.debug("[AppContent] stableSetNodes called", {
        hasCurrentContext: !!currentContext,
        updateFnType: typeof updateFn,
        isArray: Array.isArray(updateFn),
      });
    }

    if (currentContext) {
      if (typeof updateFn === "function") {
        const updatedNodes = updateFn(currentContext.nodes);
        // PERFORMANCE: Preserve reference stability - only update if nodes actually changed
        if (updatedNodes === currentContext.nodes) {
          return;
        }
        // PERFORMANCE: Shallow compare to avoid unnecessary updates
        const hasChanges = updatedNodes.length !== currentContext.nodes.length ||
          updatedNodes.some((node: DialogNode, idx: number) => {
            const prevNode = currentContext.nodes[idx];
            return !prevNode || node.id !== prevNode.id || node.data !== prevNode.data;
          });
        
        if (!hasChanges) {
          return;
        }

        useSubgraphNavigationStore.setState({
          currentContext: {
            ...currentContext,
            nodes: updatedNodes,
          },
        });
      } else if (Array.isArray(updateFn)) {
        // PERFORMANCE: Only update if array reference changed
        if (updateFn === currentContext.nodes) {
          return;
        }
        useSubgraphNavigationStore.setState({
          currentContext: {
            ...currentContext,
            nodes: updateFn,
          },
        });
      }
    } else {
      if (typeof updateFn === "function") {
        // Use startTransition for non-urgent updates
        startTransition(() => {
          setNodes(updateFn);
        });
      } else if (Array.isArray(updateFn)) {
        startTransition(() => {
          setNodes(updateFn);
        });
      }
    }
  }, [setNodes]);

  const {
    deleteSelectedNodes,
    handleDeleteNode,
    handleAddNode,
    handleAddNodes,
    handleAddConnections,
    handleNodesChange,
    handleDeleteEdge,
    handleUpdateNodeTags,
    createSubgraphFromSelection,
    ungroupSubgraph,
  } = useNodeManager({
    nodes,
    setNodes: stableSetNodes,
    connections,
    setConnections,
    selectedNodes,
    setSelectedNodes,
    editorRef,
  });

  const { generateNodeContent, generateAllNodeContent } = useNodeAI({
    nodes: currentContext ? currentContext.nodes : nodes,
    connections: currentContext ? currentContext.edges : connections,
    handleEditNode: stableHandleEditNode,
    setNodes: stableSetNodes,
    reactFlowApi: reactFlowApi || undefined,
  });

  // Listen for regeneration start/complete to reset validation state and manage batch updates
  useEffect(() => {
    const handleRegenerationStart = () => {
      logger.debug("[AppContent] Regeneration started - clearing batch queue");
      batchUpdateQueueRef.current.clear();
      if (batchUpdateTimeoutRef.current) {
        clearTimeout(batchUpdateTimeoutRef.current);
        batchUpdateTimeoutRef.current = null;
      }
    };

    const handleRegenerationComplete = () => {
      logger.debug("[AppContent] Regeneration complete - flushing remaining batch updates");
      flushBatchUpdates();
    };

    window.addEventListener("regeneration:start", handleRegenerationStart);
    window.addEventListener("regeneration:complete", handleRegenerationComplete);

    return () => {
      window.removeEventListener("regeneration:start", handleRegenerationStart);
      window.removeEventListener("regeneration:complete", handleRegenerationComplete);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (batchUpdateTimeoutRef.current) {
        clearTimeout(batchUpdateTimeoutRef.current);
        batchUpdateTimeoutRef.current = null;
      }
      flushBatchUpdates();
    };
    }, [flushBatchUpdates]);

  // PERFORMANCE: Memoize nodesWithIssues with reference stability
  // Use ref to track previous value and only update when nodes actually change
  const nodesWithIssuesRef = useRef<DialogNode[]>([]);
  const nodesWithIssues = useMemo(() => {
    const activeNodes = currentContext ? currentContext.nodes : nodes;
    
    // PERFORMANCE: Only create new array if nodes actually changed
    const prevNodes = nodesWithIssuesRef.current;
    if (
      prevNodes.length === activeNodes.length &&
      prevNodes.every((node, idx) => {
        const newNode = activeNodes[idx];
        if (!newNode) return false;

        const sameId = node.id === newNode.id;
        const sameData = node.data === newNode.data;
        const samePosition =
          node.position?.x === newNode.position?.x &&
          node.position?.y === newNode.position?.y;

        return sameId && sameData && samePosition;
      })
    ) {
      return prevNodes;
    }
    
    if (Math.random() < 0.1) {
      logger.debug(
        `[nodesWithIssues] Using ${activeNodes.length} nodes from ${
          currentContext ? "subgraph " + currentContext.id : "main workflow"
        }`
      );
    }
    
    nodesWithIssuesRef.current = activeNodes;
    return activeNodes;
  }, [nodes, currentContext?.nodes, currentContext?.id]);

  const simpleEditNode = useCallback(
    (id: string, text: string) => {
      stableHandleEditNode(id, { text });
    },
    [stableHandleEditNode]
  );

  const {
    handleBackgroundClick,
    handleBackgroundConnectionDrop,
    handleNodeClick: originalHandleNodeClick,
    handlePaneClick,
    handleScrollToNode,
    handleNodeSelectorSelect,
    handleCreateNodeFromConnection,
    showNodeSelector,
    setShowNodeSelector,
    showConnectionMenu,
    setShowConnectionMenu,
    setIsDrawingMode,
  } = useEditorInteractions({
    nodes,
    selectedNodes,
    setSelectedNodes,
    connectionHandlerConnectingNode: null,
    connectionHandlerEnd: () => handleConnectionEnd("", "", "input"),
    showRightPanel,
    setShowRightPanel,
    editorRef,
    onAddNode: handleAddNode,
    reactFlowApi: reactFlowApi || undefined,
  });

  const {
    handleExportDialog,
    handleExportDialogScript,
    handleCopyToClipboard,
    handleImportDialog,
    handleOpenSettings,
  } = useToolbarActions({
    nodes,
    setNodes,
    connections,
    setConnections,
    setIsSettingsOpen,
    projectType,
  });

  useEffect(() => {
    if (connections.length === 0 && nodes.length >= 11) {
      logger.debug("Nodes array ready but no connections, creating default connections");

      const initialConnections: Connection[] = [
        {
          id: "conn-1",
          source: nodes[0].id,
          target: nodes[1].id,
          sourceHandle: "right",
          targetHandle: "left",
        },
        {
          id: "conn-2",
          source: nodes[0].id,
          target: nodes[2].id,
          sourceHandle: "right",
          targetHandle: "left",
        },
        {
          id: "conn-3",
          source: nodes[1].id,
          target: nodes[3].id,
          sourceHandle: "right",
          targetHandle: "left",
        },
        {
          id: "conn-4",
          source: nodes[2].id,
          target: nodes[4].id,
          sourceHandle: "right",
          targetHandle: "left",
        },
        {
          id: "conn-5",
          source: nodes[3].id,
          target: nodes[5].id,
          sourceHandle: "right",
          targetHandle: "left",
        },
        {
          id: "conn-6",
          source: nodes[3].id,
          target: nodes[6].id,
          sourceHandle: "right",
          targetHandle: "left",
        },
        {
          id: "conn-7",
          source: nodes[4].id,
          target: nodes[7].id,
          sourceHandle: "right",
          targetHandle: "left",
        },
        {
          id: "conn-8",
          source: nodes[4].id,
          target: nodes[8].id,
          sourceHandle: "right",
          targetHandle: "left",
        },
        {
          id: "conn-9",
          source: nodes[5].id,
          target: nodes[9].id,
          sourceHandle: "right",
          targetHandle: "left",
        },
        {
          id: "conn-10",
          source: nodes[7].id,
          target: nodes[10].id,
          sourceHandle: "right",
          targetHandle: "left",
        },
        {
          id: "conn-11",
          source: nodes[8].id,
          target: nodes[10].id,
          sourceHandle: "right",
          targetHandle: "left",
        },
      ];
      setConnections(initialConnections);
    }
  }, [nodes, connections]);

  useKeyboardShortcuts({
    nodes,
    connections,
    selectedNodes,
    setSelectedNodes,
    deleteSelectedNodes,
    connectingNode: null,
    handleConnectionEnd: () => handleConnectionEnd("", "", "input"),
    setIsDrawingMode,
    showNodeSelector,
    setShowNodeSelector,
    showRightPanel,
    setShowRightPanel,
    reactFlowApi: reactFlowApi || undefined,
    setNodes,
    setConnections,
  });

  const handleConnect = useCallback(
    (connection: ReactFlowConnectionType) => {
      const newConnection: Connection = {
        id: `conn-${Date.now()}`,
        source: connection.source as string,
        target: connection.target as string,
        sourceHandle: connection.sourceHandle as string,
        targetHandle: connection.targetHandle as string,
      };
      setConnections((prev) => [...prev, newConnection]);
    },
    [setConnections]
  );

  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: any[] }) => {
      requestAnimationFrame(() => {
        const selectedIds = selectedNodes.map((node) => node.id);
        setSelectedNodes(selectedIds);
        if (selectedIds.length === 1) {
          setShowRightPanel(true);
        }
      });
    },
    [setSelectedNodes, setShowRightPanel]
  );

  const selectedNodeForPreview = useMemo(() => {
    return selectedNodes.length === 1 ? nodes.find((n) => n.id === selectedNodes[0]) : undefined;
  }, [selectedNodes, nodes]);

  const nodeSelectorNodes = useMemo(() => {
    if (!showNodeSelector) return [];
    return showNodeSelector.compatibleNodes.map((node) => {
      let nodeType: "npc" | "player" | "enemy" | "custom" = "npc";
      if (node.type === "npcDialog" || node.type === "playerResponse") {
        nodeType = node.type === "npcDialog" ? "npc" : "player";
      } else if (node.type === "enemy" || node.type === "enemyDialog") {
        nodeType = "enemy";
      } else if (node.type === "custom" || node.type === "customNode") {
        nodeType = "custom";
      }
      return {
        id:
          typeof node.id === "string"
            ? node.id
            : `node-${Math.random().toString(36).substr(2, 9)}`,
        type: nodeType,
        text: node.data?.text || "",
        position: node.position || { x: 0, y: 0 },
      };
    });
  }, [showNodeSelector]);

  const handleConnectionMenuNodeTypeSelect = useCallback(
    (nodeType: string) => {
      if (showConnectionMenu) {
        handleCreateNodeFromConnection(
          nodeType,
          showConnectionMenu.position,
          showConnectionMenu.sourceNodeId
        );
      }
    },
    [handleCreateNodeFromConnection, showConnectionMenu]
  );

  const handleConnectionMenuCancel = useCallback(() => {
    setShowConnectionMenu(null);
  }, [setShowConnectionMenu]);

  const handleToggleLeftPanel = useCallback(() => {
    setShowLeftPanel((prev) => !prev);
  }, [setShowLeftPanel]);

  const handleToggleRightPanel = useCallback(() => {
    setShowRightPanel((prev) => !prev);
  }, [setShowRightPanel]);

  const handleApplyTagsToMultiple = useCallback(
    (nodeIds: string[], tags: Tag[]) => {
      if (nodeIds.length === 0) return;

      const tagIds = tags.map((tag) => tag.id);

      stableSetNodes((prevNodes: DialogNode[]) => {
        const updatedNodes = prevNodes.map((node: DialogNode) => {
          if (!nodeIds.includes(node.id)) return node;

          const existingMetadata = node.data?.metadata || {};

          const updatedNode: DialogNode = {
            ...node,
            data: {
              ...(node.data || { text: "", type: node.type }),
              metadata: {
                ...existingMetadata,
                nodeData: {
                  ...(existingMetadata.nodeData || {}),
                  tags: tags,
                },
                tags: tagIds,
              },
            },
          };

          return updatedNode;
        });

        const currentConnections = connections;
        saveDialogFlow(updatedNodes, currentConnections, projectType);

        return updatedNodes;
      });

      toast.success(`Tags applied to ${nodeIds.length} node${nodeIds.length > 1 ? "s" : ""}`);
    },
    [stableSetNodes, connections, projectType]
  );

  useEffect(() => {
    if (selectedNodes.length === 0 && selectedNodeForPreview !== undefined) {
      logger.debug("Fixing inconsistency in node selection state");

      const rightPanel = document.querySelector(".w-72.border-l");
      if (rightPanel) {
        const header = rightPanel.querySelector("h2");
        if (header && header.textContent !== "Dialog Flow") {
          setTimeout(() => setSelectedNodes([]), 0);
        }
      }
    }
  }, [selectedNodes.length, selectedNodeForPreview]);

  const handleNodeClick = useCallback(
    (e: React.MouseEvent, node: any) => {
      originalHandleNodeClick(e, node);
    },
    [originalHandleNodeClick]
  );

  const handleNodeSelectorCancel = useCallback(() => {
    setShowNodeSelector(null);
    handleConnectionEnd("", "", "input");
    setIsDrawingMode(false);
  }, [handleConnectionEnd, setShowNodeSelector, setIsDrawingMode]);

  const handleNodeSelect = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (node) {
        setSelectedNodes([nodeId]);
        logger.debug(`[AppContent] Selected node: ${nodeId}`);
      }
    },
    [nodes, setSelectedNodes]
  );

  useEffect(() => {
    const handleConnectionAdd = (event: CustomEvent) => {
      const { connection } = event.detail;
      logger.debug("Connection add event received:", connection);

      if (connection) {
        setConnections((prev) => [...prev, connection]);
      }
    };

    document.addEventListener("editor:connection:add", handleConnectionAdd as EventListener);

    return () => {
      document.removeEventListener("editor:connection:add", handleConnectionAdd as EventListener);
    };
  }, [setConnections]);

  useEffect(() => {
    const handleNodeContentUpdate = (event: CustomEvent) => {
      const { nodeId, text } = event.detail;
      logger.debug("Node content update event received:", { nodeId, text });

      setNodes((prevNodes) =>
        prevNodes.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, text } } : node
        )
      );
    };

    document.addEventListener("node:content:updated", handleNodeContentUpdate as EventListener);

    return () => {
      document.removeEventListener(
        "node:content:updated",
        handleNodeContentUpdate as EventListener
      );
    };
  }, [setNodes]);

  const handleMultiDeleteNodes = (nodeIds: string[]) => {
    nodeIds.forEach((id) => {
      handleDeleteNode(id);
    });
    setSelectedNodes([]);
  };

  const handleGenerateDialog = async (
    nodeId: string,
    mode: GenerateMode = "recreate",
    options?: {
      ignoreConnections?: boolean;
      customPrompt?: string;
      systemPrompt?: string;
    }
  ) => {
    logger.debug("[handleGenerateDialog] Called:", { nodeId, mode, options });

    const { currentContext } = useSubgraphNavigationStore.getState();
    const contextNodes = currentContext ? currentContext.nodes : nodes;

    const node = contextNodes.find((n) => n.id === nodeId);
    if (!node) {
      toast.error("Node not found");
      return;
    }

    try {
      if (mode === "regenerateFromHere") {
        logger.debug("[handleGenerateDialog] regenerateFromHere mode detected");
        logger.debug("[handleGenerateDialog] calling generateNodeContent:", {
          nodeId,
          mode,
          options,
        });
      }

      await generateNodeContent(nodeId, mode, options);
    } catch (error) {
      logger.error("Error generating dialog:", error);
      toast.error("Failed to generate dialog");
    }
  };


  const getNodeColor = (nodeType: string): string => {
    switch (nodeType) {
      case "npc":
      case "npcDialog":
        return "#3B82F6";
      case "player":
      case "playerResponse":
        return "#10B981";
      case "enemy":
      case "enemyDialog":
        return "#EF4444";
      case "custom":
      case "customNode":
        return "#60A5FA";
      default:
        return "#6B7280";
    }
  };

  const handleAddNodeFromEdge = useCallback(
    ({
      sourceNodeId,
      position,
      nodeType,
      initialText,
    }: {
      sourceNodeId: string;
      position: { x: number; y: number };
      nodeType?: string;
      initialText?: string;
    }) => {
      logger.debug("handleAddNodeFromEdge called:", {
        sourceNodeId,
        position,
        nodeType,
        initialText,
      });
      const sourceNode = nodes.find((n) => n.id === sourceNodeId);
      if (!sourceNode) {
        logger.error("Source node not found:", sourceNodeId);
        return;
      }

      let actualNodeType = nodeType;
      if (!actualNodeType) {
        actualNodeType = sourceNode.type === "npcDialog" ? "playerResponse" : "npcDialog";
      }

      const nodeColor = getNodeColor(actualNodeType);

      const newNode: DialogNode = {
        id: `node-${Date.now()}`,
        type: actualNodeType as DialogNodeType,
        position,
        data: {
          text: initialText || "",
          metadata: {
            nodeData: {
              color: nodeColor,
            },
          },
        },
      };

      setNodes((prev) => [...prev, newNode]);

      const newConnection = {
        id: `conn-${Date.now()}`,
        source: sourceNodeId,
        target: newNode.id,
        sourceHandle: "right",
        targetHandle: "left",
      };

      setConnections((prev) => [...prev, newConnection]);

      setSelectedNodes([newNode.id]);

      return newNode.id;
    },
    [nodes, setNodes, setConnections, setSelectedNodes]
  );

  return (
    <div className="flex flex-col h-screen bg-[#0A0A0B] text-white overflow-hidden">
        <GlobalToaster />

        {showNodeSelector && (
          <NodeSelector
            position={showNodeSelector.position}
            nodes={nodeSelectorNodes}
            onSelect={handleNodeSelectorSelect}
            onCancel={handleNodeSelectorCancel}
          />
        )}

        {showConnectionMenu && (
          <ConnectionMenu
            position={showConnectionMenu.position}
            sourceNodeId={showConnectionMenu.sourceNodeId}
            projectType={projectType}
            onNodeTypeSelect={handleConnectionMenuNodeTypeSelect}
            onCancel={handleConnectionMenuCancel}
          />
        )}

        <ToolbarSection
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onToggleLeftPanel={handleToggleLeftPanel}
          onToggleRightPanel={handleToggleRightPanel}
          onCenterViewport={handleCenterViewport}
          onAutoLayout={handleAutoLayout}
          selectedNodes={selectedNodes}
          nodes={nodesWithIssues}
          connections={connections}
          onEditNode={simpleEditNode}
          onUpdateNode={(id, data) => stableHandleEditNode(id, data)}
          setIsSettingsOpen={setIsSettingsOpen}
          onGenerateDialog={handleGenerateDialog}
          onClearDialog={generateAllNodeContent}
          onDeleteSelected={deleteSelectedNodes}
          onNodeSelect={handleNodeSelect}
          viewportOffset={viewportOffset}
          viewportSize={viewportSize}
          zoom={zoom}
          onAddNodes={handleAddNodes}
          onAddConnections={handleAddConnections}
          viewMode={activeMode === "tree" ? viewMode : undefined}
          onViewModeChange={activeMode === "tree" ? setViewMode : undefined}
          projectType={projectType}
          detectTestContent={detectTestContent}
          onDetectTestContentChange={(value: boolean) => setDetectTestContent(value)}
          onCreateSubgraph={createSubgraphFromSelection}
        />

        <div
          className="grid grid-rows-[1fr,auto] flex-1 min-h-0 overflow-hidden"
          style={{ height: "calc(100vh - 64px)" }}
        >
          <div
            className="grid grid-cols-[auto,1fr,auto] min-h-0 overflow-hidden"
            style={{ minHeight: 0, flex: 1, display: "flex" }}
          >
            {showLeftPanel && (
              <div className="h-full overflow-y-auto flex-shrink-0">
                <LeftPanel
                  onExport={handleExportDialog}
                  onExportScript={handleExportDialogScript}
                  onImport={handleImportDialog}
                  onCopyToClipboard={handleCopyToClipboard}
                  onAddNode={handleAddNode}
                  onOpenSettings={handleOpenSettings}
                  activeMode={activeMode}
                  setActiveMode={setActiveMode}
                  projectType={projectType}
                  onProjectTypeChange={handleProjectTypeChange}
                  setNodes={setNodes}
                  setConnections={setConnections}
                />
              </div>
            )}

            <EditorContent
              editorRef={editorRef}
              editorContentRef={editorContentRef}
              viewportOffset={viewportOffset}
              nodes={nodesWithIssues}
              connections={connections}
              activeMode={activeMode}
              showRightPanel={showRightPanel}
              showLeftPanel={showLeftPanel}
              handleNodesChange={handleNodesChange}
              handleEdgesChange={handleEdgesChange}
              handleConnect={handleConnect}
              handleNodeClick={handleNodeClick}
              handlePaneClick={handlePaneClick}
              handleBackgroundClick={handleBackgroundClick}
              handleBackgroundConnectionDrop={handleBackgroundConnectionDrop}
              generateNodeContent={generateNodeContent}
              handleDeleteEdge={handleDeleteEdge}
              handleAddNodeFromEdge={handleAddNodeFromEdge}
              onSelectionChange={handleSelectionChange}
              onRegisterReactFlowApi={setReactFlowApi}
            />

            {showRightPanel && (
              <div className="h-full bg-[#0D0D0F] border-l border-gray-800/50 overflow-y-auto flex-shrink-0">
                <RightPanel
                  key={`panel-${selectedNodes.length}-${selectedNodes.join("-")}`}
                  onClose={() => setShowRightPanel(false)}
                  selectedNode={
                    selectedNodes.length === 1
                      ? nodes.find((n) => n.id === selectedNodes[0]) || null
                      : null
                  }
                  selectedNodes={
                    selectedNodes.length > 0
                      ? (selectedNodes
                          .map((id) => nodes.find((n) => n.id === id))
                          .filter(Boolean) as DialogNode[])
                      : []
                  }
                  nodes={nodes}
                  connections={connections}
                  onEdit={(id, newText) => {
                    simpleEditNode(id, newText);
                  }}
                  onDelete={handleDeleteNode}
                  onMultiDelete={handleMultiDeleteNodes}
                  onSelectNode={(id) => setSelectedNodes([id])}
                  onScrollToNode={handleScrollToNode}
                  onUpdateNodeTags={handleUpdateNodeTags}
                  onApplyTagsToMultiple={handleApplyTagsToMultiple}
                  onAddNode={handleAddNode}
                  paths={memoizedDialogPaths}
                  projectType={projectType}
                  onUngroupSubgraph={ungroupSubgraph}
                />
              </div>
            )}
          </div>

          <div className="w-full flex-shrink-0">
            <BottomPanel
              dialogAnalysis={_dialogAnalysis || null}
              nodes={nodes}
            />
          </div>
        </div>

        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

        <EdgePerformanceDashboard
          isVisible={devTools.state.isEdgePerformanceVisible}
          onToggle={devTools.toggleEdgePerformance}
        />
      </div>
  );
});

export default AppContent;
