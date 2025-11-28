import { useState, useCallback } from "react";
import { DialogNode, DialogNodeData } from "../types/dialog";
import { Connection } from "../types/nodes";
import { ollamaService, findDialogPaths, GenerateContext } from "../services/ollamaService";
import { toast } from "react-hot-toast";
import { DialogContext } from "../types/ollama";
import useSubgraphNavigationStore from "../store/subgraphNavigationStore";
import { useRegenerationStore } from "../store/regenerationStore";
import logger from "../utils/logger";

interface UseNodeAIProps {
  nodes: DialogNode[];
  connections: Connection[];
  handleEditNode: (nodeId: string, data: DialogNodeData) => void;
  setNodes: React.Dispatch<React.SetStateAction<DialogNode[]>>;
  reactFlowApi?: import("../types/reactflow").ReactFlowApi;
}

export type GenerateMode = "recreate" | "improve" | "custom" | "regenerateFromHere";

interface DialogContextWithId extends Omit<DialogContext, "tags"> {
  id: string;
  nodeId: string;
  text: string;
  type: string;
  tags: string[];
}

export const useNodeAI = ({
  nodes,
  connections,
  handleEditNode,
  setNodes,
  reactFlowApi,
}: UseNodeAIProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const {
    setIsRegeneratingNodes,
    setCurrentBulkRegenerationNodes,
    setProcessingNodeId,
  } = useRegenerationStore();

  const updateProgress = useCallback((current: number, total: number) => {
    const progressPercentage = Math.round((current / total) * 100);
    setGenerationProgress(progressPercentage);

    toast.loading(`Regenerating... ${progressPercentage}%`, {
      id: "regenerate-progress",
      duration: Infinity,
      position: "bottom-center",
      style: {
        backgroundColor: "#0f172a",
        color: "#e2e8f0",
        fontWeight: "500",
        fontSize: "0.875rem",
        padding: "8px 16px",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "8px",
        boxShadow: "0 4px 8px rgba(0,0,0,0.15)",
      },
    });
  }, []);

  const convertToDialogContext = useCallback((node: DialogNode): DialogContextWithId => ({
    id: node.id,
    nodeId: node.id,
    text: node.data.text,
    type: node.type,
    tags: node.data.metadata?.nodeData?.tags || node.data.metadata?.tags || [],
  }), []);

  const setNodeProcessingState = useCallback(
    (nodeId: string, isProcessing: boolean, aiStatus?: "idle" | "generating" | "error" | "timeout", aiError?: string) => {
      const effectiveAiStatus = aiStatus || (isProcessing ? ("generating" as const) : ("idle" as const));

      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  isProcessing,
                  aiStatus: effectiveAiStatus,
                  ...(aiError && { aiError }),
                },
              }
            : n
        )
      );

      const { currentContext } = useSubgraphNavigationStore.getState();
      if (currentContext) {
        const contextNode = currentContext.nodes.find((n) => n.id === nodeId);
        if (contextNode) {
          const updatedNodes = currentContext.nodes.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    isProcessing,
                    aiStatus: effectiveAiStatus,
                    ...(aiError && { aiError }),
                  },
                }
              : n
          );

          useSubgraphNavigationStore.setState({
            currentContext: {
              ...currentContext,
              nodes: updatedNodes,
            },
          });
        }
      }
    },
    [setNodes]
  );

  const updateNodeWithText = useCallback(
    (nodeId: string, generatedText: string) => {
      const { currentContext } = useSubgraphNavigationStore.getState();
      const contextNodes = currentContext ? currentContext.nodes : nodes;

      const node = contextNodes.find((n) => n.id === nodeId);
      if (node) {
        handleEditNode(nodeId, {
          ...node.data,
          text: generatedText,
          isProcessing: false,
          aiStatus: "idle",
        });

        if (currentContext) {
          const updatedNodes = contextNodes.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: { ...n.data, text: generatedText, isProcessing: false, aiStatus: "idle" as const },
                }
              : n
          );

          useSubgraphNavigationStore.setState({
            currentContext: {
              ...currentContext,
              nodes: updatedNodes,
            },
          });
        }
      } else {
        setNodes((prev) =>
          prev.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: { ...n.data, text: generatedText, isProcessing: false, aiStatus: "idle" as const },
                }
              : n
          )
        );
      }
    },
    [handleEditNode, setNodes]
  );

  const createDialogContext = useCallback(
    (
      nodeId: string,
      ignoreConnections?: boolean,
      customNextNodes: DialogNode[] = []
    ) => {
      const { currentContext } = useSubgraphNavigationStore.getState();
      const contextNodes = currentContext ? currentContext.nodes : nodes;
      const contextConnections = currentContext ? currentContext.edges : connections;

      const currentNode = contextNodes.find((node) => node.id === nodeId);
      if (!currentNode) return null;

      const dialogPath = ignoreConnections
        ? {
            previous: [],
            current: currentNode,
            next: [],
          }
        : findDialogPaths(
            nodeId,
            contextNodes,
            contextConnections.map((conn) => ({
              sourceId: conn.source,
              targetId: conn.target,
            }))
          );

      const effectiveNext = customNextNodes.length > 0 ? customNextNodes : dialogPath.next;

      const dialogContext = {
        previous: dialogPath.previous.map(convertToDialogContext),
        current: convertToDialogContext(currentNode),
        next: effectiveNext.map(convertToDialogContext),
      };

      const characterInfoRaw = JSON.stringify(dialogContext);
      const MAX_CHARACTER_INFO_LENGTH = 2000;
      const characterInfoTrimmed =
        characterInfoRaw.length > MAX_CHARACTER_INFO_LENGTH
          ? characterInfoRaw.slice(0, MAX_CHARACTER_INFO_LENGTH)
          : characterInfoRaw;

      const context: GenerateContext = {
        dialogChain: {
          previous: dialogPath.previous.map((n) => ({
            ...n,
            position: { x: 0, y: 0 },
            data: {
              text: n.data.text,
              type: n.type,
              metadata: { tags: n.data.metadata?.tags || [] },
            },
          })),
          current: {
            ...dialogPath.current,
            position: { x: 0, y: 0 },
            data: {
              text: dialogPath.current.data.text,
              type: dialogPath.current.type,
              metadata: { tags: dialogPath.current.data.metadata?.tags || [] },
            },
          },
          next: effectiveNext.map((n) => ({
            ...n,
            position: { x: 0, y: 0 },
            data: {
              text: n.data.text,
              type: n.type,
              metadata: { tags: n.data.metadata?.tags || [] },
            },
          })),
        },
        current: convertToDialogContext(currentNode),
        previous: dialogPath.previous.map(convertToDialogContext),
        next: effectiveNext.map(convertToDialogContext),
        characterInfo: characterInfoTrimmed,
        ignoreConnections: ignoreConnections || false,
      };

      return { context, currentNode };
    },
    [nodes, connections, convertToDialogContext]
  );

  const generateNodeContent = useCallback(
    async (
      nodeId: string,
      mode: GenerateMode = "recreate",
      options?: {
        ignoreConnections?: boolean;
        customPrompt?: string;
        systemPrompt?: string;
      }
    ) => {
      const { currentContext } = useSubgraphNavigationStore.getState();
      const contextNodes = currentContext ? currentContext.nodes : nodes;

      const currentNode = contextNodes.find((node) => node.id === nodeId);
      if (!currentNode) {
        toast.error(`Node ID ${nodeId} not found.`);
        return;
      }

      setIsGenerating(true);
      setProcessingNodeId(nodeId);

      if (reactFlowApi) {
          setTimeout(() => {
            try {
              reactFlowApi.fitToNode(nodeId, {
                padding: 0.3,
                minZoom: 0.5,
                maxZoom: 1.5,
                duration: 300,
              });
            } catch (error) {
              logger.debug("Error focusing on node:", error);
            }
          }, 100);
        }

      try {
        logger.info(
          "[AI] Generation requested",
          `node=${nodeId}`,
          `type=${currentNode.type}`,
          `mode=${mode}`,
          `ignoreConnections=${options?.ignoreConnections ?? false}`
        );

        setNodeProcessingState(nodeId, true);

        let generatedText = "";

        const contextData = createDialogContext(
          nodeId,
          options?.ignoreConnections,
        []
        );
        if (!contextData) {
          logger.error(`[AI] Context could not be created for node ${nodeId}`);
          setNodeProcessingState(nodeId, false);
          setProcessingNodeId(null);
          setIsGenerating(false);
          toast.error("Failed to build context for generation");
          return;
        }

        const { context, currentNode: contextCurrentNode } = contextData;

        switch (mode) {
          case "regenerateFromHere":
            const startNodeId = nodeId;

            toast.loading("Analyzing...", {
              duration: 1200,
              position: "bottom-center",
              style: {
                background: "#0f172a",
                color: "#e2e8f0",
                fontWeight: "500",
                fontSize: "0.875rem",
                padding: "8px 16px",
                borderRadius: "8px",
              },
            });

            const processOrder: string[] = [];
            const visited = new Set<string>();

            const dfs = (nodeId: string) => {
              if (visited.has(nodeId)) return;
              visited.add(nodeId);

              const contextConnections = currentContext ? currentContext.edges : connections;
              const outgoingConnections = contextConnections.filter(
                (conn) => conn.source === nodeId
              );

              for (const conn of outgoingConnections) {
                dfs(conn.target);
              }

              processOrder.unshift(nodeId);
            };

            dfs(startNodeId);

            processOrder.sort((a, b) => {
              if (a === startNodeId) return -1;
              if (b === startNodeId) return 1;
              return 0;
            });

            const nodesToRegenerate = processOrder;
            const uniqueNodeList = Array.from(new Set(nodesToRegenerate));

            toast.loading(`Preparing ${uniqueNodeList.length} nodes...`, {
              id: "regenerate-progress",
              duration: Infinity,
              position: "bottom-center",
            });

            const processedNodes = new Map<string, DialogNode>();
            const pendingUpdates = new Map<string, string>();

            setIsRegeneratingNodes(true);
            setCurrentBulkRegenerationNodes(uniqueNodeList);

            logger.debug("[useNodeAI] Dispatching regeneration start event");
            window.dispatchEvent(new CustomEvent("regeneration:start"));

            const BATCH_FLUSH_INTERVAL = 3;
            const flushPendingUpdates = () => {
              if (pendingUpdates.size === 0) return;
              
              const updates = new Map(pendingUpdates);
              pendingUpdates.clear();
              
              setNodes((prevNodes) => {
                const nodeMap = new Map(prevNodes.map(n => [n.id, n]));
                updates.forEach((text, nodeId) => {
                  const node = nodeMap.get(nodeId);
                  if (node) {
                    nodeMap.set(nodeId, {
                      ...node,
                      data: { ...node.data, text, isProcessing: false, aiStatus: "idle" as const },
                    });
                  }
                });
                return Array.from(nodeMap.values());
              });
              
              logger.debug(`[REGENERATE:BATCH] Flushed ${updates.size} node updates`);
            };

            let missingCount = 0;

            for (const [index, currentNodeId] of uniqueNodeList.entries()) {
              try {
                logger.debug(
                  `[REGENERATE:DEBUG] Processing node ${index + 1}/${uniqueNodeList.length}: ${currentNodeId}`
                );

                const { currentContext: freshContext } = useSubgraphNavigationStore.getState();
                const freshContextNodes = freshContext ? freshContext.nodes : nodes;

                const node = freshContextNodes.find((n) => n.id === currentNodeId);
                if (!node) {
                  missingCount += 1;
                  continue;
                }

                logger.debug(
                  `[REGENERATE:DEBUG] Node ${currentNodeId} current text: "${node.data.text.substring(0, 100)}..."`
                );

                setProcessingNodeId(currentNodeId);
                
                if (reactFlowApi) {
                    setTimeout(() => {
                      try {
                        reactFlowApi.fitToNode(currentNodeId, {
                          padding: 0.3,
                          minZoom: 0.5,
                          maxZoom: 1.5,
                          duration: 300,
                        });
                      } catch (error) {
                        logger.debug("Error focusing on regenerated node:", error);
                      }
                    }, 100);
                  }
                
                setNodeProcessingState(currentNodeId, true);

                let currentNodes = [...freshContextNodes];

                processedNodes.forEach((processedNode, id) => {
                  const index = currentNodes.findIndex((n) => n.id === id);
                  if (index !== -1) {
                    currentNodes[index] = processedNode;
                  }
                });

                const contextConnections = currentContext ? currentContext.edges : connections;

                const dialogPath = findDialogPaths(
                  currentNodeId,
                  currentNodes,
                  contextConnections.map((conn) => ({
                    sourceId: conn.source,
                    targetId: conn.target,
                  }))
                );

                const parentConnections = contextConnections.filter(conn => conn.target === currentNodeId);
                const siblingNodes: DialogNode[] = [];

                if (parentConnections.length > 0) {
                  const parentId = parentConnections[0].source;
                  const siblingConnections = contextConnections.filter(
                    conn => conn.source === parentId && conn.target !== currentNodeId
                  );

                  siblingConnections.forEach(conn => {
                    const siblingNode = currentNodes.find(n => n.id === conn.target);
                    if (siblingNode && siblingNode.type === node.type && siblingNode.data?.text) {
                      siblingNodes.push(siblingNode);
                    }
                  });
                }

                const dialogContext = {
                  previous: dialogPath.previous.map(convertToDialogContext),
                  current: convertToDialogContext(node),
                  next: dialogPath.next.map(convertToDialogContext),
                };

                const effectiveIgnoreConnections = options?.ignoreConnections ?? false;
                
                logger.debug(
                  `[REGENERATE:PARAMS] Node ${currentNodeId} - ignoreConnections=${effectiveIgnoreConnections} (from options: ${options?.ignoreConnections ?? 'not provided'})`
                );

                const context: GenerateContext = {
                  dialogChain: {
                    previous: effectiveIgnoreConnections ? [] : dialogPath.previous.map((n) => ({
                      ...n,
                      position: { x: 0, y: 0 },
                      data: {
                        text: n.data.text,
                        type: n.type,
                        metadata: { tags: n.data.metadata?.tags || [] },
                      },
                    })),
                    current: {
                      ...dialogPath.current,
                      position: { x: 0, y: 0 },
                      data: {
                        text: dialogPath.current.data.text,
                        type: dialogPath.current.type,
                        metadata: {
                          tags: dialogPath.current.data.metadata?.tags || [],
                        },
                      },
                    },
                    next: effectiveIgnoreConnections ? [] : dialogPath.next.map((n) => ({
                      ...n,
                      position: { x: 0, y: 0 },
                      data: {
                        text: n.data.text,
                        type: n.type,
                        metadata: { tags: n.data.metadata?.tags || [] },
                      },
                    })),
                  },
                  current: convertToDialogContext(node),
                  previous: effectiveIgnoreConnections ? [] : dialogPath.previous.map(convertToDialogContext),
                  next: effectiveIgnoreConnections ? [] : dialogPath.next.map(convertToDialogContext),
                  siblingNodes: effectiveIgnoreConnections ? [] : siblingNodes.map(convertToDialogContext),
                  characterInfo: effectiveIgnoreConnections ? "" : JSON.stringify(dialogContext),
                  ignoreConnections: effectiveIgnoreConnections,
                };

                const progressPercent = Math.round(((index + 1) / uniqueNodeList.length) * 100);
                toast.loading(
                  `Regenerating... ${progressPercent}% (${index + 1}/${uniqueNodeList.length})`,
                  {
                    id: "regenerate-progress",
                    duration: Infinity,
                    position: "bottom-center",
                    style: {
                      backgroundColor: "#0f172a",
                      color: "#e2e8f0",
                      fontWeight: "500",
                      fontSize: "0.875rem",
                      padding: "8px 16px",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                      boxShadow: "0 4px 8px rgba(0,0,0,0.15)",
                    },
                  }
                );

                if (node.type === "subgraphNode") {
                  logger.debug(
                    `[REGENERATE:SUBGRAPH] Skipping AI generation for subgraph node ${currentNodeId}, will process internal nodes separately`
                  );

                  setNodeProcessingState(currentNodeId, false);
                } else {
                  const generatedText = await ollamaService.generateDialog(
                    node.type,
                    context,
                    false,
                    undefined,
                    effectiveIgnoreConnections
                  );
                  
                  logger.debug(
                    `[REGENERATE:DIALOG] generateDialog called for ${currentNodeId} with ignoreConnections=${effectiveIgnoreConnections}`
                  );

                  if (generatedText) {
                    logger.debug(
                      `[REGENERATE:SUCCESS] Generated text for node ${currentNodeId}: "${generatedText.substring(0, 100)}..."`
                    );

                    const updatedNode = {
                      ...node,
                      data: {
                        ...node.data,
                        text: generatedText,
                        isProcessing: false,
                        aiStatus: "idle" as const,
                      },
                    };

                    pendingUpdates.set(currentNodeId, generatedText);
                    processedNodes.set(currentNodeId, updatedNode);
                    setNodeProcessingState(currentNodeId, false, "idle");

                    logger.debug(
                      `[REGENERATE:DEBUG] Queued node ${currentNodeId} for batch update`
                    );

                    if (pendingUpdates.size >= BATCH_FLUSH_INTERVAL) {
                      flushPendingUpdates();
                    }
                  } else {
                    logger.warn(`[REGENERATE:ERROR] No text generated for node ${currentNodeId}`);
                  }
                }

                updateProgress(index + 1, uniqueNodeList.length);
              } catch (error: any) {
                const message = error?.message || String(error);
                const isTimeout = message.includes("timeout") || message.includes("timed out");

                logger.error(
                  `[REGENERATE:${isTimeout ? "TIMEOUT" : "ERROR"}] Failed for node ${currentNodeId}:`,
                  error
                );

                if (isTimeout) {
                  setNodeProcessingState(currentNodeId, false, "timeout", message);
                } else {
                  setNodeProcessingState(currentNodeId, false, "error", message);
                }

                toast.error(
                  `${isTimeout ? "Timeout" : "Error"} generating node ${currentNodeId}`,
                  { duration: 3000 }
                );
              } finally {
                setProcessingNodeId(null);
              }

              await new Promise((resolve) => setTimeout(resolve, 50));
            }

            flushPendingUpdates();
            
            logger.debug(`[useNodeAI] Regeneration complete - ${processedNodes.size} nodes processed in batches`);
            if (missingCount > 0) {
              logger.debug(`[REGENERATE:DEBUG] ${missingCount} node(s) were not in the current context and were skipped`);
            }

            const uniqueNodeSet = new Set(uniqueNodeList);
            if (uniqueNodeSet.size > 0) {
              setNodes((prevNodes) =>
                prevNodes.map((n) => {
                  if (!uniqueNodeSet.has(n.id)) return n;
                  const updated = processedNodes.get(n.id);
                  if (updated) {
                    return {
                      ...n,
                      data: { ...n.data, text: updated.data.text, isProcessing: false, aiStatus: "idle" as const },
                    };
                  }
                  return {
                    ...n,
                    data: { ...n.data, isProcessing: false, aiStatus: "idle" as const },
                  };
                })
              );
            }

            setProcessingNodeId(null);

            setTimeout(() => {
                logger.debug(
                  "[REGENERATE:DEBUG] Regeneration complete, clearing flag for validation to resume"
                );
              setIsRegeneratingNodes(false);
                logger.debug("[NODEAI:CLEANUP] Global regeneration flag cleared");
                setCurrentBulkRegenerationNodes(undefined);

              window.dispatchEvent(new Event("regeneration:complete"));

              if (uniqueNodeList.length > 0) {
                const firstGeneratedNodeId = uniqueNodeList[0];
                logger.debug(`[REGENERATE:FOCUS] Auto-focusing on first generated node: ${firstGeneratedNodeId}`);

                window.dispatchEvent(new CustomEvent("node:focus", {
                  detail: { nodeId: firstGeneratedNodeId }
                }));
              }
            }, 200);

            toast.dismiss("regenerate-progress");
            toast.success(`All ${uniqueNodeList.length} nodes regenerated successfully!`, {
              duration: 4000,
              position: "bottom-center",
            });

            break;

          case "improve":
            generatedText = await toast.promise(
              ollamaService.improveDialog(
                currentNode.type,
                context,
                currentNode.data.text,
                options?.ignoreConnections
              ),
              {
                loading: "Improving dialog...",
                success: "Dialog improved successfully!",
                error: "Failed to improve dialog",
              }
            );
            break;

          case "custom":
            const effectiveCustomPrompt = options?.customPrompt || "";
            const effectiveSystemPrompt = options?.systemPrompt;
            const effectiveIgnoreConnections = options?.ignoreConnections;

            generatedText = await toast.promise(
              ollamaService.generateWithCustomPrompt(
                currentNode.type,
                context,
                effectiveCustomPrompt,
                effectiveSystemPrompt,
                effectiveIgnoreConnections
              ),
              {
                loading: "Generating custom dialog...",
                success: "Custom dialog generated successfully!",
                error: "Failed to generate custom dialog",
              }
            );
            break;

          case "recreate":
          default:
            generatedText = await ollamaService.generateDialog(
              currentNode.type,
              context,
              false,
              undefined,
              options?.ignoreConnections
            );
            toast.success("Dialog generated successfully!");
            break;
        }

        if (generatedText) {
          logger.info(
            "[AI] Generation completed",
            `node=${nodeId}`,
            `type=${contextCurrentNode.type}`,
            `mode=${mode}`,
            `preview="${generatedText.substring(0, 160).replace(/\\s+/g, " ")}${generatedText.length > 160 ? "..." : ""}"`
          );

          updateNodeWithText(nodeId, generatedText);

          setGenerationProgress(100);
          setProcessingNodeId(null);
        }
      } catch (error: any) {
        const message = error?.message || String(error);
        const isTimeout = message.includes("timeout") || message.includes("timed out");

        logger.error(`[AI] Generation ${isTimeout ? "timeout" : "failed"} for node ${nodeId}: ${message}`, error);

        if (isTimeout) {
          toast.error(`Generation timeout for node - try again or use a smaller model`, {
            duration: 5000,
          });
          setNodeProcessingState(nodeId, false, "timeout", message);
        } else {
          toast.error(`Failed to generate content: ${message}`);
          setNodeProcessingState(nodeId, false, "error", message);
        }

        setProcessingNodeId(null);
      } finally {
        setIsGenerating(false);
        setProcessingNodeId(null);
      }
    },
    [nodes, connections, setNodeProcessingState, updateNodeWithText, createDialogContext, convertToDialogContext, updateProgress]
  );

  const generateAllNodeContent = useCallback(async () => {
    setIsGenerating(true);
    try {
      const nodesToGenerate = nodes.filter(
        (node) => !node.data.text || node.data.text.trim() === ""
      );

      if (nodesToGenerate.length === 0) {
        toast("No empty nodes found");
        setIsGenerating(false);
        return;
      }

      toast(`Generating content for ${nodesToGenerate.length} nodes. This may take a while.`);
      setGenerationProgress(0);

      for (let i = 0; i < nodesToGenerate.length; i++) {
        const node = nodesToGenerate[i];
        await generateNodeContent(node.id, "recreate");

        setGenerationProgress(Math.round(((i + 1) / nodesToGenerate.length) * 100));

        await new Promise((resolve) => setTimeout(resolve, 200)); // Reduced delay for batch generation
      }

      toast.success("All content generated successfully");
    } catch (error) {
      toast.error("Failed to generate all content");
    } finally {
      setIsGenerating(false);
    }
  }, [nodes, generateNodeContent]);

  return {
    isGenerating,
    generationProgress,
    generateNodeContent,
    generateAllNodeContent,
  };
};

export default useNodeAI;
