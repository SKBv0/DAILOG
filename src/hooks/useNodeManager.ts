import { useCallback } from "react";
import { flushSync } from "react-dom";
import { NodeChange, applyNodeChanges } from "reactflow";
import { createNode, NodeType } from "../types/nodes";
import { DialogNode, DialogNodeData, DialogNodeType, Tag } from "../types/dialog";
import { Connection } from "../types/editor";
import { saveDialogFlow } from "../utils/localStorageUtils";
import { generatePersistentNodeId, generateConnectionId } from "../utils/nodeIdUtils";
import logger from "../utils/logger";

interface UseNodeManagerProps {
  nodes: DialogNode[];
  setNodes: React.Dispatch<React.SetStateAction<DialogNode[]>>;
  connections: Connection[];
  setConnections: React.Dispatch<React.SetStateAction<Connection[]>>;
  selectedNodes: string[];
  setSelectedNodes: React.Dispatch<React.SetStateAction<string[]>>;
  updateHighlightedConnections?: (nodeIds: string[]) => void;
  editorRef: React.RefObject<HTMLDivElement>;
}

const useNodeManager = (props: UseNodeManagerProps) => {
  const {
    nodes,
    setNodes,

    connections,
    setConnections,
    selectedNodes,
    setSelectedNodes,
    updateHighlightedConnections,
    editorRef,
  } = props;

  const deleteSelectedNodes = useCallback(() => {
    setNodes((prevNodes: DialogNode[]) =>
      prevNodes.filter((node) => !selectedNodes.includes(node.id))
    );

    setConnections((prevConnections: Connection[]) =>
      prevConnections.filter(
        (conn) => !selectedNodes.includes(conn.source) && !selectedNodes.includes(conn.target)
      )
    );

    setSelectedNodes([]);
    updateHighlightedConnections?.([]);
  }, [selectedNodes, setNodes, setConnections, setSelectedNodes, updateHighlightedConnections]);

  const handleEditNode = useCallback(
    (idOrNode: string | DialogNode, newData?: Partial<DialogNodeData>, text?: string) => {
      if (typeof idOrNode === "object") {
        const node = idOrNode as DialogNode;
        setNodes((prev) => {
          const updatedNodes = prev.map((n) => (n.id === node.id ? node : n));

          saveDialogFlow(updatedNodes, connections, "game");
          return updatedNodes;
        });
        return;
      }

      const nodeId = idOrNode as string;

      setNodes((prev) => {
        const updatedNodes = prev.map((node) => {
          if (node.id === nodeId) {
            const currentMetadata = node.data.metadata || {};
            const currentCustomSettings = currentMetadata.customSettings || {
              systemPrompt: "",
              userPrompt: "",
              ignoreConnections: false,
            };

            const updatedData = {
              ...node.data,
              ...newData,
              metadata: {
                ...currentMetadata,
                ...(newData?.metadata || {}),
                customSettings: {
                  ...currentCustomSettings,
                  ...(newData?.metadata?.customSettings || {}),
                },
              },
            };

            if (text !== undefined) {
              updatedData.text = typeof text === "string"
                ? text
                : typeof text === "object"
                  ? "[Invalid text content]"
                  : String(text);
            }

            if (updatedData.isProcessing != null) {
              updatedData.isProcessing = typeof updatedData.isProcessing === "boolean"
                ? updatedData.isProcessing
                : typeof updatedData.isProcessing === "object" && updatedData.isProcessing !== null
                  ? false
                  : Boolean(updatedData.isProcessing);
            }
            if (updatedData.text != null && typeof updatedData.text !== "string") {
              updatedData.text = typeof updatedData.text === "object"
                ? "[Invalid text content]"
                : String(updatedData.text);
            }

            logger.debug("[NodeManager] Updating node data:", {
              nodeId,
              oldData: node.data,
              newData: updatedData,
              currentCustomSettings,
              newCustomSettings: updatedData.metadata.customSettings,
            });

            return {
              ...node,
              data: updatedData,
            };
          }
          return node;
        });

        saveDialogFlow(updatedNodes, connections, "game");

        return updatedNodes;
      });
    },
    [setNodes, connections]
  );

  const handleDeleteNode = useCallback(
    (id: string) => {
      setNodes((prevNodes: DialogNode[]) => {
        const updatedNodes = prevNodes.filter((node) => node.id !== id);

        const updatedConnections = connections.filter(
          (conn) => conn.source !== id && conn.target !== id
        );

        saveDialogFlow(updatedNodes, updatedConnections, "game");

        return updatedNodes;
      });

      setConnections((prevConnections: Connection[]) =>
        prevConnections.filter((conn) => conn.source !== id && conn.target !== id)
      );

      setSelectedNodes((prev: string[]) => prev.filter((nodeId: string) => nodeId !== id));
    },
    [setNodes, setConnections, setSelectedNodes, connections]
  );

  const handleAddStandaloneNode = useCallback(
    (type: DialogNodeType, text: string = "") => {
      if (!editorRef.current) return;

      // Use clientWidth/clientHeight to avoid forced reflow
      const viewportCenterX = editorRef.current.clientWidth / 2;
      const viewportCenterY = editorRef.current.clientHeight / 2;

      const snappedX = Math.round(viewportCenterX / 20) * 20;
      const snappedY = Math.round(viewportCenterY / 20) * 20;

      const nodeId = generatePersistentNodeId(type);

      const newNode: DialogNode = {
        id: nodeId,
        type,
        position: { x: snappedX, y: snappedY },
        data: {
          text,
          type,
          metadata: {
            tags: [],
            customSettings: {
              systemPrompt: "",
              userPrompt: "",
              ignoreConnections: false,
            },
          },
        },
      };

      logger.debug("[NodeManager] Creating new standalone node:", newNode);
      setNodes((prev) => {
        const updatedNodes = [...prev, newNode];

        saveDialogFlow(updatedNodes, connections, "game");
        return updatedNodes;
      });
      return newNode.id;
    },
    [editorRef, setNodes, connections]
  );

  const handleAddNodes = useCallback(
    (newNodes: DialogNode[]) => {
      if (!newNodes || newNodes.length === 0) {
        logger.warn("[NodeManager] handleAddNodes called with empty payload");
        return;
      }

      logger.debug("[NodeManager] handleAddNodes received batch", {
        batchSize: newNodes.length,
        nodeIds: newNodes.map((node) => node.id),
      });

      flushSync(() => {
        setNodes((prev) => {
          const existingIds = new Set(prev.map((n) => n.id));
          const uniqueNewNodes = newNodes.filter((node) => !existingIds.has(node.id));
          
          if (uniqueNewNodes.length !== newNodes.length) {
            logger.warn("[NodeManager] Duplicate nodes detected and filtered", {
              total: newNodes.length,
              unique: uniqueNewNodes.length,
              duplicates: newNodes.length - uniqueNewNodes.length,
            });
          }
          
          const updatedNodes = [...prev, ...uniqueNewNodes];
          saveDialogFlow(updatedNodes, connections, "game");
          return updatedNodes;
        });
      });
    },
    [setNodes, connections]
  );

  const handleAddConnections = useCallback(
    (newConnections: Connection[]) => {
      if (!newConnections || newConnections.length === 0) {
        logger.warn("[NodeManager] handleAddConnections called with empty payload");
        return;
      }

      logger.debug("[NodeManager] handleAddConnections received batch", {
        batchSize: newConnections.length,
        connectionIds: newConnections.map((connection) => connection.id),
      });

      setConnections((prev) => {
        const updatedConnections = [...prev, ...newConnections];

        logger.debug("[NodeManager] handleAddConnections applied", {
          prevCount: prev.length,
          added: newConnections.length,
          nextCount: updatedConnections.length,
        });

        saveDialogFlow(nodes, updatedConnections, "game");

        return updatedConnections;
      });
    },
    [setConnections, nodes]
  );

  const handleAddNode = useCallback(
    (
      sourceNodeIdOrParams:
        | string
        | {
            sourceNodeId?: string;
            position: { x: number; y: number };
            nodeType: string;
          },
      nodeTypeParam?: string,
      textParam?: string
    ) => {
      let sourceNodeId: string | undefined;
      let position: { x: number; y: number };
      let nodeType: string;
      let text: string;

      if (typeof sourceNodeIdOrParams === "object") {
        sourceNodeId = sourceNodeIdOrParams.sourceNodeId;
        position = sourceNodeIdOrParams.position;
        nodeType = sourceNodeIdOrParams.nodeType;
        text = nodeType === "npcDialog" ? "New NPC dialog..." : "New player response...";
      } else {
        sourceNodeId = sourceNodeIdOrParams || "";
        nodeType = nodeTypeParam || "npcDialog";
        text =
          textParam || (nodeType === "npcDialog" ? "New NPC dialog..." : "New player response...");

        if (editorRef.current) {
          // Use clientWidth/clientHeight to avoid forced reflow
          position = {
            x: editorRef.current.clientWidth / 2,
            y: editorRef.current.clientHeight / 2,
          };
        } else {
          position = {
            x: 200,
            y: 200,
          };
        }
      }

      const offsetPosition = {
        x: position.x + 30,
        y: position.y - 35,
      };

      const persistentNodeId = generatePersistentNodeId(nodeType);

      const newNode = createNode(nodeType as NodeType, offsetPosition, text, {
        id: persistentNodeId,
        data: {
          text,
          type: nodeType,
          metadata: {
            tags: [],
            customSettings: {
              systemPrompt: "",
              userPrompt: "",
              ignoreConnections: false,
            },
          },
        },
      }) as DialogNode;

      logger.debug("[NodeManager] Creating new node:", newNode);

      if (sourceNodeId) {
        const connectionId = generateConnectionId(sourceNodeId, newNode.id);

        const newConnection: Connection = {
          id: connectionId,
          source: sourceNodeId,
          target: newNode.id,
          sourceHandle: "right",
          targetHandle: "left",
        };

        setNodes((prev) => {
          const updatedNodes = [...prev, newNode];

          saveDialogFlow(updatedNodes, [...connections, newConnection], "game");
          return updatedNodes;
        });
        setConnections((prev) => [...prev, newConnection]);
      } else {
        setNodes((prev) => {
          const updatedNodes = [...prev, newNode];

          saveDialogFlow(updatedNodes, connections, "game");
          return updatedNodes;
        });
      }

      return newNode.id;
    },
    [editorRef, setNodes, setConnections, connections]
  );

  const handleAddNodeFromEdge = useCallback(
    ({
      sourceNodeId,
      position,
      nodeType,
    }: {
      sourceNodeId: string;
      position: { x: number; y: number };
      nodeType?: string;
    }) => {
      const sourceNode = nodes.find((n) => n.id === sourceNodeId);
      if (!sourceNode) return;

      const newNodeType =
        (nodeType as DialogNodeType) ||
        (sourceNode.type === "npcDialog" ? "playerResponse" : "npcDialog");

      const nodeId = generatePersistentNodeId(newNodeType);

      const newNode: DialogNode = {
        id: nodeId,
        type: newNodeType,
        position,
        data: {
          text: "",
          type: newNodeType,
          metadata: {
            tags: [],
            customSettings: {
              systemPrompt: "",
              userPrompt: "",
              ignoreConnections: false,
            },
          },
        },
      };

      logger.debug("[NodeManager] Creating new node from edge:", newNode);

      const connectionId = generateConnectionId(sourceNodeId, newNode.id);

      const newConnection = {
        id: connectionId,
        source: sourceNodeId,
        target: newNode.id,
        sourceHandle: "right",
        targetHandle: "left",
      };

      setNodes((prev) => {
        const updatedNodes = [...prev, newNode];

        saveDialogFlow(updatedNodes, [...connections, newConnection], "game");
        return updatedNodes;
      });
      setConnections((prev) => [...prev, newConnection]);

      return newNode.id;
    },
    [nodes, setNodes, setConnections, connections]
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds: DialogNode[]) => {
        const updatedNodesUntyped = applyNodeChanges(changes, nds);

        const updatedNodes = updatedNodesUntyped.filter(
          (node): node is DialogNode => typeof node.type === "string"
        );

        saveDialogFlow(updatedNodes, connections, "game");
        return updatedNodes;
      });
    },
    [setNodes, connections]
  );

  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      setConnections((prev) => {
        const updatedConnections = prev.filter((conn) => conn.id !== edgeId);

        saveDialogFlow(nodes, updatedConnections, "game");
        return updatedConnections;
      });
    },
    [setConnections, nodes]
  );

  const handleUpdateNodeTags = useCallback(
    (id: string, tags: Tag[]) => {
      const tagIds = tags.map((tag) => tag.id);

      setNodes((prevNodes: DialogNode[]) => {
        const updatedNodes = prevNodes.map((node) => {
          if (node.id !== id) return node;

          const existingMetadata = node.data?.metadata || {};

          const updatedNode: DialogNode = {
            ...node,
            data: {
              ...(node.data || { text: "", type: node.type }),
              metadata: {
                ...existingMetadata,

                nodeData: {
                  ...(existingMetadata.nodeData || {}),
                  tags,
                },
                tags: tagIds,
              },
            },
          };

          return updatedNode;
        });

        saveDialogFlow(updatedNodes, connections, "game");
        return updatedNodes;
      });
    },
    [setNodes, connections]
  );

  const handleNodeSelect = useCallback(
    (id: string) => {
      setSelectedNodes([id]);
      updateHighlightedConnections?.([id]);
    },
    [setSelectedNodes, updateHighlightedConnections]
  );

  const handleNodeSelectSimple = useCallback(
    (id: string) => {
      const nodeElement = document.getElementById(id);
      if (nodeElement) {
        const event = new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        nodeElement.dispatchEvent(event);
      } else {
        setSelectedNodes([id]);
        updateHighlightedConnections?.([id]);
      }
    },
    [setSelectedNodes, updateHighlightedConnections]
  );

  const createSubgraphFromSelection = useCallback(() => {
    if (selectedNodes.length < 2) {
      logger.warn("At least 2 nodes must be selected to create a subgraph");
      return;
    }

    const selectedNodeObjects = nodes.filter((node) => selectedNodes.includes(node.id));
    const selectedNodeIds = new Set(selectedNodes);

    const internalConnections = connections.filter(
      (conn) => selectedNodeIds.has(conn.source) && selectedNodeIds.has(conn.target)
    );

    const externalIncoming = connections.filter(
      (conn) => !selectedNodeIds.has(conn.source) && selectedNodeIds.has(conn.target)
    );

    const externalOutgoing = connections.filter(
      (conn) => selectedNodeIds.has(conn.source) && !selectedNodeIds.has(conn.target)
    );

    const positions = selectedNodeObjects.map((node) => node.position);
    const minX = Math.min(...positions.map((p) => p.x));
    const maxX = Math.max(...positions.map((p) => p.x));
    const minY = Math.min(...positions.map((p) => p.y));
    const maxY = Math.max(...positions.map((p) => p.y));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const uniqueInputs = new Map<string, { nodeId: string; handle: string; connections: any[] }>();
    const uniqueOutputs = new Map<string, { nodeId: string; handle: string; connections: any[] }>();

    externalIncoming.forEach((conn) => {
      const key = `${conn.target}-${conn.targetHandle || "default"}`;
      if (!uniqueInputs.has(key)) {
        uniqueInputs.set(key, {
          nodeId: conn.target,
          handle: conn.targetHandle || "left",
          connections: [],
        });
      }
      uniqueInputs.get(key)!.connections.push(conn);
    });

    externalOutgoing.forEach((conn) => {
      const key = `${conn.source}-${conn.sourceHandle || "default"}`;
      if (!uniqueOutputs.has(key)) {
        uniqueOutputs.set(key, {
          nodeId: conn.source,
          handle: conn.sourceHandle || "right",
          connections: [],
        });
      }
      uniqueOutputs.get(key)!.connections.push(conn);
    });

    selectedNodeObjects.forEach((node) => {
      const nodeOutgoing = connections.filter((conn) => conn.source === node.id);
      const nodeIncoming = connections.filter((conn) => conn.target === node.id);

      const hasExternalOutgoing = externalOutgoing.some((conn) => conn.source === node.id);
      const hasExternalIncoming = externalIncoming.some((conn) => conn.target === node.id);

      if (nodeOutgoing.length === 0 && !hasExternalOutgoing) {
        const key = `${node.id}-right`;
        if (!uniqueOutputs.has(key)) {
          uniqueOutputs.set(key, {
            nodeId: node.id,
            handle: "right",
            connections: [],
          });
        }
      }

      if (nodeIncoming.length === 0 && !hasExternalIncoming) {
        const key = `${node.id}-left`;
        if (!uniqueInputs.has(key)) {
          uniqueInputs.set(key, {
            nodeId: node.id,
            handle: "left",
            connections: [],
          });
        }
      }
    });

    const inputs = Array.from(uniqueInputs.values()).map((input, index) => ({
      id: `input_${index}`,
      label: `Input ${index + 1}`,
      dataType: "any",
      targetNode: input.nodeId,
      targetHandle: input.handle,
    }));

    const outputs = Array.from(uniqueOutputs.values()).map((output, index) => ({
      id: `output_${index}`,
      label: `Output ${index + 1}`,
      dataType: "any",
      sourceNode: output.nodeId,
      sourceHandle: output.handle,
    }));

    const subgraphId = `subgraphNode_${Date.now()}`;
    const subgraphNode: DialogNode = {
      id: subgraphId,
      type: "subgraphNode",
      position: { x: centerX, y: centerY },
      data: {
        text: `Subgraph (${selectedNodes.length} nodes)`,
        type: "subgraphNode",
        metadata: {
          tags: [],
          subgraph: {
            nodes: selectedNodeObjects,
            edges: internalConnections,
            // persist mapping for proper ungroup reconnection
            inputs: inputs.map((i) => ({
              id: i.id,
              label: i.label,
              dataType: i.dataType,
              targetNode: i.targetNode,
              targetHandle: i.targetHandle,
            })),
            outputs: outputs.map((o) => ({
              id: o.id,
              label: o.label,
              dataType: o.dataType,
              sourceNode: o.sourceNode,
              sourceHandle: o.sourceHandle,
            })),
          },
        } as any,
      },
    };

    const newConnections = [
      ...externalIncoming.map((conn) => {
        const idx = inputs.findIndex(
          (i) =>
            i.targetNode === conn.target &&
            (i.targetHandle || "left") === (conn.targetHandle || "left")
        );
        const handleId = idx >= 0 ? inputs[idx].id : `input_0`;
        return {
          ...conn,
          target: subgraphId,
          targetHandle: handleId,
          id: `${conn.source}-${subgraphId}-${handleId}`,
        };
      }),
      ...externalOutgoing.map((conn) => {
        const idx = outputs.findIndex(
          (o) =>
            o.sourceNode === conn.source &&
            (o.sourceHandle || "right") === (conn.sourceHandle || "right")
        );
        const handleId = idx >= 0 ? outputs[idx].id : `output_0`;
        return {
          ...conn,
          source: subgraphId,
          sourceHandle: handleId,
          id: `${subgraphId}-${conn.target}-${handleId}`,
        };
      }),
    ];

    setNodes((prevNodes) => {
      const filteredNodes = prevNodes.filter((node) => !selectedNodeIds.has(node.id));
      const updatedNodes = [...filteredNodes, subgraphNode];
      saveDialogFlow(
        updatedNodes,
        [
          ...connections.filter(
            (conn) =>
              !selectedNodeIds.has(conn.source) &&
              !selectedNodeIds.has(conn.target) &&
              !externalIncoming.includes(conn) &&
              !externalOutgoing.includes(conn)
          ),
          ...newConnections,
        ],
        "game"
      );
      return updatedNodes;
    });

    setConnections((prevConnections) => {
      const filteredConnections = prevConnections.filter(
        (conn) =>
          !selectedNodeIds.has(conn.source) &&
          !selectedNodeIds.has(conn.target) &&
          !externalIncoming.includes(conn) &&
          !externalOutgoing.includes(conn)
      );
      return [...filteredConnections, ...newConnections];
    });

    setSelectedNodes([subgraphId]);
    updateHighlightedConnections?.([subgraphId]);

    logger.debug(
      `Created subgraph with ${selectedNodes.length} nodes, ${inputs.length} inputs, ${outputs.length} outputs`
    );
  }, [
    selectedNodes,
    nodes,
    connections,
    setNodes,
    setConnections,
    setSelectedNodes,
    updateHighlightedConnections,
  ]);

  const ungroupSubgraph = useCallback(
    (subgraphId: string) => {
      const subgraphNode = nodes.find((n) => n.id === subgraphId && n.type === "subgraphNode");
      if (!subgraphNode) return;
      const subgraph: any = subgraphNode.data?.metadata?.subgraph;
      if (!subgraph) return;

      const nodesWithoutSubgraph = nodes.filter((n) => n.id !== subgraphId);
      const existingIds = new Set(nodesWithoutSubgraph.map((n) => n.id));
      const restoredNodes = (subgraph.nodes || []).filter((n: any) => !existingIds.has(n.id));
      const nextNodes = [...nodesWithoutSubgraph, ...restoredNodes];

      const preserved = connections.filter(
        (e) => e.source !== subgraphId && e.target !== subgraphId
      );

      const incomingToSub = connections.filter((e) => e.target === subgraphId);
      const outgoingFromSub = connections.filter((e) => e.source === subgraphId);

      const rewiredIncoming = incomingToSub
        .map((e) => {
          const match = (subgraph.inputs || []).find((inp: any) => e.targetHandle === inp.id);
          if (!match) return null;
          return {
            ...e,
            target: match.targetNode,
            targetHandle: match.targetHandle || "left",
          };
        })
        .filter(Boolean) as any[];

      const rewiredOutgoing = outgoingFromSub
        .map((e) => {
          const match = (subgraph.outputs || []).find((out: any) => e.sourceHandle === out.id);
          if (!match) return null;
          return {
            ...e,
            source: match.sourceNode,
            sourceHandle: match.sourceHandle || "right",
          };
        })
        .filter(Boolean) as any[];

      const internalEdges = (subgraph.edges || []).map((e: any) => ({ ...e }));
      const nextConnections = [
        ...preserved,
        ...internalEdges,
        ...rewiredIncoming,
        ...rewiredOutgoing,
      ];

      setNodes(nextNodes);
      setConnections(nextConnections);
      saveDialogFlow(nextNodes, nextConnections, "game");

      setSelectedNodes((subgraph.nodes || []).map((n: any) => n.id));
      updateHighlightedConnections?.((subgraph.nodes || []).map((n: any) => n.id));
    },
    [nodes, connections, setNodes, setConnections, setSelectedNodes, updateHighlightedConnections]
  );

  return {
    deleteSelectedNodes,
    handleEditNode,
    handleDeleteNode,
    handleAddNode,
    handleAddStandaloneNode,
    handleAddNodeFromEdge,
    handleAddNodes,
    handleAddConnections,
    handleUpdateNodeTags,

    handleNodeSelect,
    handleNodeSelectSimple,

    handleNodesChange,

    handleDeleteEdge,
    createSubgraphFromSelection,
    ungroupSubgraph,
  };
};

export default useNodeManager;
