import React, { useState, useEffect } from "react";
import { DialogNode, Tag, DialogNodeType, DialogNodeData } from "../../types/dialog";
import { Connection, createNode } from "../../types/nodes";
import { ollamaService } from "../../services/ollamaService";
import { DialogContext, GenerateContext } from "../../types/ollama";
import TagSection from "../Tag/TagSection";
import { Loader2 } from "lucide-react";
import { ProjectType } from "../../types/project";
import logger from "../../utils/logger";
import { toast } from "react-hot-toast";

interface FlowGeneratorProps {
  show: boolean;
  onClose: () => void;
  onAddNodes: (nodes: DialogNode[]) => void;
  onAddConnections?: (connections: Connection[]) => void;
  onEditNode: (id: string, text: string) => void;
  onUpdateNode?: (id: string, data: Partial<DialogNodeData>) => void;
  projectType?: ProjectType;
}

interface GeneratorOptions {
  npcCount: number;
  responsesPerNpc: number;
  topic: string;
  // Global tags applied to all nodes unless overridden by per-type tags
  tags: Tag[];
  // Per-node-type tags (keyed by node type) for character-specific context
  perTypeTags?: Record<string, Tag[]>;
  showTagManager: boolean;
  selectedNodeType: DialogNodeType;
  secondaryNodeType: DialogNodeType;
  tertiaryNodeType: DialogNodeType;
  useTertiaryNode: boolean;
  tertiaryFrequency: number;
  afterTertiaryNodeType: DialogNodeType;
  sequentialProcessing: boolean;
}

interface GenerationProgress {
  current: number;
  total: number;
}

const normalizeGeneratedTopic = (raw: string): string => {
  let finalTopic = (raw || "").trim();

  const firstSentenceMatch = finalTopic.match(/^[^.!?]+[.!?]?/);
  if (firstSentenceMatch) {
    finalTopic = firstSentenceMatch[0];
  }

  if (!finalTopic.match(/[.!?]$/)) {
    finalTopic += ".";
  }

  if (finalTopic.length > 60) {
    finalTopic = finalTopic.substring(0, 57) + "...";
  }

  return finalTopic;
};

const calculateNpcNodes = (npcCount: number, responsesPerNpc: number): number => {
  if (npcCount <= 0) return 0;

  let totalNpcs = 1;

  for (let i = 1; i < npcCount; i++) {
    totalNpcs += Math.pow(responsesPerNpc, i);
  }

  return totalNpcs;
};

const calculateResponseNodes = (npcCount: number, responsesPerNpc: number): number => {
  if (npcCount <= 0) return 0;

  let totalResponses = 0;

  for (let i = 0; i < npcCount - 1; i++) {
    const npcsInLevel = i === 0 ? 1 : Math.pow(responsesPerNpc, i);
    totalResponses += npcsInLevel * responsesPerNpc;
  }

  return totalResponses;
};

const calculateTotalNodes = (npcCount: number, responsesPerNpc: number): number => {
  return (
    calculateNpcNodes(npcCount, responsesPerNpc) + calculateResponseNodes(npcCount, responsesPerNpc)
  );
};

const calculateTotalPaths = (npcCount: number, responsesPerNpc: number): number => {
  if (npcCount <= 0) return 0;
  if (npcCount === 1) return 0;

  return Math.pow(responsesPerNpc, npcCount - 1);
};

const calculateComplexityLevel = (npcCount: number, responsesPerNpc: number): string => {
  const totalNodes = calculateTotalNodes(npcCount, responsesPerNpc);
  if (totalNodes <= 10) return "Low";
  if (totalNodes <= 50) return "Medium";
  if (totalNodes <= 100) return "High";
  return "Very High";
};

const generateTopicFromProjectType = (type: ProjectType): string => {
  switch (type) {
    case "game":
      return "Fantasy RPG quest about a lost artifact";
    case "interactive_story":
      return "Branching story with multiple endings";
    case "novel":
      return "Dramatic scene between two characters";
    default:
      return "Dialog about an interesting topic";
  }
};

const convertTagsForOllama = (context: GenerateContext): any => {
  const newContext = JSON.parse(JSON.stringify(context));

  if (newContext.current && newContext.current.tags) {
    newContext.current.tags = newContext.current.tags.map((tag: Tag) => tag.id);
  }

  if (newContext.previous) {
    newContext.previous = newContext.previous.map((node: any) => {
      if (node.tags) {
        return {
          ...node,
          tags: node.tags.map((tag: Tag) => tag.id),
        };
      }
      return node;
    });
  }

  if (newContext.next) {
    newContext.next = newContext.next.map((node: any) => {
      if (node.tags) {
        return {
          ...node,
          tags: node.tags.map((tag: Tag) => tag.id),
        };
      }
      return node;
    });
  }

  return newContext;
};

export function FlowGenerator({
  show,
  onClose,
  onAddNodes,
  onAddConnections,
  onEditNode,
  onUpdateNode,
  projectType = "game",
}: FlowGeneratorProps) {
  const currentProjectTypeRef = React.useRef<ProjectType>(projectType);
  const handleOverlayMouseDown = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  const getInitialNodeTypes = (type: ProjectType) => {
    switch (type) {
      case "game":
        return {
          selectedNodeType: "npcDialog",
          secondaryNodeType: "playerResponse",
          tertiaryNodeType: "enemyDialog",
          afterTertiaryNodeType: "npcDialog",
        };
      case "interactive_story":
        return {
          selectedNodeType: "narratorNode",
          secondaryNodeType: "choiceNode",
          tertiaryNodeType: "branchingNode",
          afterTertiaryNodeType: "narratorNode",
        };
      case "novel":
        return {
          selectedNodeType: "characterDialogNode",
          secondaryNodeType: "sceneDescriptionNode",
          tertiaryNodeType: "sceneNode",
          afterTertiaryNodeType: "characterDialogNode",
        };
      default:
        return {
          selectedNodeType: "npcDialog",
          secondaryNodeType: "playerResponse",
          tertiaryNodeType: "enemyDialog",
          afterTertiaryNodeType: "npcDialog",
        };
    }
  };

  useEffect(() => {
    currentProjectTypeRef.current = projectType;
  }, [projectType]);

  const [options, setOptions] = useState<GeneratorOptions>({
    npcCount: 2,
    responsesPerNpc: 3,
    topic: "",
    tags: [],
    perTypeTags: {},
    showTagManager: false,
    ...getInitialNodeTypes(projectType),
    useTertiaryNode: false,
    tertiaryFrequency: 3,
    sequentialProcessing: false,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [ollamaAvailable, setOllamaAvailable] = useState<boolean | null>(null);
  const [showOllamaWarning, setShowOllamaWarning] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress>({
    current: 0,
    total: 0,
  });

  const generateSimpleId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  };

  const connectionIdCache = React.useRef<Record<string, string>>({});

  const generateConnectionId = (source: string, target: string) => {
    const connectionKey = `${source}:${target}`;

    if (connectionIdCache.current[connectionKey]) {
      return connectionIdCache.current[connectionKey];
    }

    const newId = `conn-${generateSimpleId()}`;

    connectionIdCache.current[connectionKey] = newId;

    return newId;
  };

  useEffect(() => {
    const nodeTypes = getInitialNodeTypes(projectType);

    setOptions((prev) => {
      const updated = {
        ...prev,
        selectedNodeType: nodeTypes.selectedNodeType,
        secondaryNodeType: nodeTypes.secondaryNodeType,
        tertiaryNodeType: nodeTypes.tertiaryNodeType,
        afterTertiaryNodeType: nodeTypes.afterTertiaryNodeType,
      };
      return updated;
    });

    const componentElement = document.querySelector(".FlowGenerator");
    if (componentElement) {
      componentElement.setAttribute("data-project-type", projectType);
    }

    const handleProjectTypeChanged = (event: CustomEvent<ProjectType>) => {
      const newType = event.detail;

      if (newType === currentProjectTypeRef.current) {
        return;
      }

      currentProjectTypeRef.current = newType;

      const eventNodeTypes = getInitialNodeTypes(newType);

      setOptions((prev) => {
        const eventUpdated = {
          ...prev,
          selectedNodeType: eventNodeTypes.selectedNodeType,
          secondaryNodeType: eventNodeTypes.secondaryNodeType,
          tertiaryNodeType: eventNodeTypes.tertiaryNodeType,
          afterTertiaryNodeType: eventNodeTypes.afterTertiaryNodeType,
        };
        return eventUpdated;
      });
    };

    window.addEventListener("projectTypeChanged", handleProjectTypeChanged as EventListener);

    return () => {
      window.removeEventListener("projectTypeChanged", handleProjectTypeChanged as EventListener);
    };
  }, [projectType]);

  useEffect(() => {
    const checkOllamaAvailability = async () => {
      try {
        const response = await fetch("http://localhost:11434/api/version", {
          method: "GET",
          signal: AbortSignal.timeout(3000),
        });

        if (response.ok) {
          logger.debug("Ollama API is available");
          setOllamaAvailable(true);
        } else {
          logger.warn("Ollama API returned an error:", response.status);
          setOllamaAvailable(false);
        }
      } catch (error) {
        logger.error("Failed to connect to Ollama API:", error);
        setOllamaAvailable(false);
      }
    };

    checkOllamaAvailability();
  }, []);

  const handleGenerateNodes = async () => {

    const {
      npcCount,
      responsesPerNpc,
      topic,
      tags,
      selectedNodeType,
      secondaryNodeType,
      tertiaryNodeType,
      afterTertiaryNodeType,
      useTertiaryNode,
      tertiaryFrequency,
    } = options;

    logger.debug("FlowGenerator.generate.start", {
      npcCount,
      responsesPerNpc,
      topicLength: topic?.length || 0,
      tagsCount: tags.length,
      useTertiaryNode,
      tertiaryFrequency,
      hasOllama: ollamaAvailable,
    });

    const actualTertiaryNodeType: DialogNodeType = useTertiaryNode
      ? tertiaryNodeType
      : secondaryNodeType;

    if (topic && topic.trim() !== "" && !ollamaAvailable) {
      setShowOllamaWarning(true);
      logger.warn("Ollama API is not available. Creating nodes without AI generation.");
    }

    setIsGenerating(true);
    const totalNodes = calculateTotalNodes(npcCount, responsesPerNpc);
    setGenerationProgress({ current: 0, total: totalNodes });

    // Create persistent progress toast
    toast.loading(`Preparing ${totalNodes} nodes...`, {
      id: "flowgen-progress",
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

  try {
      // UX FIX: Batch size = 1 for smooth, incremental node appearance
      const NODE_BATCH_SIZE = 1;
      const nodeBatch: DialogNode[] = [];
      const connectionBatch: Connection[] = [];

      const flushBatches = () => {
        if (nodeBatch.length > 0) {
          const nodesToAdd = [...nodeBatch];
          nodeBatch.length = 0;

          if (nodesToAdd.length >= 15 && 'requestIdleCallback' in window) {
            requestIdleCallback(() => onAddNodes(nodesToAdd), { timeout: 100 });
          } else {
            onAddNodes(nodesToAdd);
          }
        }
        if (connectionBatch.length > 0) {
          const connectionsToAdd = [...connectionBatch];
          connectionBatch.length = 0;

          if (connectionsToAdd.length >= 15 && 'requestIdleCallback' in window) {
            requestIdleCallback(() => onAddConnections?.(connectionsToAdd), { timeout: 100 });
          } else {
            onAddConnections?.(connectionsToAdd);
          }
        }
      };

      const GRID_SPACING_X = 450;
      const MIN_GRID_SPACING_Y = 200;
      const NODE_HEIGHT_ESTIMATE = 120;
      const INITIAL_Y_OFFSET = 100;

      logger.debug("FlowGenerator.generate.initialNode.create");
      const initialNode = createNode(
        selectedNodeType,
        { x: 0, y: INITIAL_Y_OFFSET },
        ""
      ) as DialogNode;
      initialNode.data.isProcessing = true;
      const getEffectiveTagsForType = (nodeType: DialogNodeType): Tag[] => {
        const typeTags = options.perTypeTags?.[nodeType] || [];
        return [...typeTags, ...(tags || [])];
      };
      const initialTags = getEffectiveTagsForType(selectedNodeType);
      if (initialTags.length > 0) {
        initialNode.data.metadata = {
          ...initialNode.data.metadata,
          nodeData: {
            ...initialNode.data.metadata?.nodeData,
            tags: [...initialTags],
          },
        };
      }

      nodeBatch.push(initialNode);
      flushBatches();
      logger.debug("FlowGenerator.generate.onAddNodes", {
        phase: "initial",
        nodeId: initialNode.id,
      });

      if (topic && topic.trim() !== "" && ollamaAvailable) {
        try {
          const context: GenerateContext = {
            current: {
              nodeId: initialNode.id,
              type: initialNode.type,
              text: initialNode.data.text,
              tags: initialNode.data.metadata?.nodeData?.tags || [],
            },
            characterInfo: `TOPIC: ${topic}`,
          };

          const generatedText = await ollamaService.generateDialog(
            initialNode.type,
            convertTagsForOllama(context)
          );
          onEditNode(initialNode.id, generatedText);
          onUpdateNode?.(initialNode.id, { isProcessing: false, aiStatus: "idle" });
        } catch (error) {
          logger.error(`Error generating dialog for initial node:`, error);
        }
      }

      let currentLevel = 0;
      let currentNodes = [initialNode];
      let previousNodeTypes: Record<string, DialogNodeType> = {};
      const siblingTextMap: Record<string, string[]> = {};
      const siblingNextTextMap: Record<string, string[]> = {};

      while (currentLevel < npcCount - 1) {
        logger.debug("FlowGenerator.generate.level.start", {
          level: currentLevel + 1,
          branchingFrom: currentNodes.length,
        });
        const nextLevelNodes: DialogNode[] = [];

        const totalNodesCurrentLevel = currentNodes.length * responsesPerNpc;
        const baseSpacing = NODE_HEIGHT_ESTIMATE + 80;
        const verticalSpacing = Math.max(
          MIN_GRID_SPACING_Y,
          Math.max(baseSpacing, Math.min(400, 1000 / Math.max(1, totalNodesCurrentLevel)))
        );

        const minSourceY = Math.min(...currentNodes.map(node => node.position.y));
        const totalHeightNeeded = (totalNodesCurrentLevel - 1) * verticalSpacing;
        const levelStartY = minSourceY - (totalHeightNeeded / 2);

        let globalNodeIndex = 0;

        for (let i = 0; i < currentNodes.length; i++) {
          const sourceNode = currentNodes[i];
          const siblingResponses: DialogNode[] = [];
          const siblingNextNodes: DialogNode[] = [];
          const existingSiblingTexts = siblingTextMap[sourceNode.id] || [];
          const existingSiblingNextTexts = siblingNextTextMap[sourceNode.id] || [];

          for (let j = 0; j < responsesPerNpc; j++) {
            const currentNodeCount = (i * responsesPerNpc) + j + 1;
            const progressPercent = Math.round((currentNodeCount / totalNodes) * 100);

            setGenerationProgress({
              current: currentNodeCount,
              total: totalNodes,
            });

            toast.loading(
              `Generating... ${progressPercent}% (${currentNodeCount}/${totalNodes})`,
              {
                id: "flowgen-progress",
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

            const responseNodeType =
              useTertiaryNode && j % tertiaryFrequency === tertiaryFrequency - 1
                ? actualTertiaryNodeType
                : secondaryNodeType;

            const responseX = sourceNode.position.x + GRID_SPACING_X / 2;
            const responseY = levelStartY + (globalNodeIndex * verticalSpacing);
            globalNodeIndex++;

            const responseNode = createNode(
              responseNodeType,
              { x: responseX, y: responseY },
              ""
            ) as DialogNode;
            responseNode.data.isProcessing = true;
            const responseTags = getEffectiveTagsForType(responseNodeType);
            if (responseTags.length > 0) {
              responseNode.data.metadata = {
                ...responseNode.data.metadata,
                nodeData: {
                  ...responseNode.data.metadata?.nodeData,
                  tags: [...responseTags],
                },
              };
            }

            const responseConnection: Connection = {
              id: generateConnectionId(sourceNode.id, responseNode.id),
              source: sourceNode.id,
              target: responseNode.id,
              sourceHandle: "right",
              targetHandle: "left",
            };

            let nextNodeType;

            if (responseNodeType === tertiaryNodeType && useTertiaryNode) {
              nextNodeType = afterTertiaryNodeType;
            } else {
              nextNodeType = selectedNodeType;
            }

            previousNodeTypes[responseNode.id] = responseNodeType;

            const npcX = sourceNode.position.x + GRID_SPACING_X;
            const npcY = responseY;

            const nextNode = createNode(
              nextNodeType,
              { x: npcX, y: npcY },
              ""
            ) as DialogNode;
            nextNode.data.isProcessing = true;
            const nextTags = getEffectiveTagsForType(nextNodeType);
            if (nextTags.length > 0) {
              nextNode.data.metadata = {
                ...nextNode.data.metadata,
                nodeData: {
                  ...nextNode.data.metadata?.nodeData,
                  tags: [...nextTags],
                },
              };
            }

            const npcConnection: Connection = {
              id: generateConnectionId(responseNode.id, nextNode.id),
              source: responseNode.id,
              target: nextNode.id,
              sourceHandle: "right",
              targetHandle: "left",
            };

            nodeBatch.push(responseNode, nextNode);
            connectionBatch.push(responseConnection, npcConnection);
            if (nodeBatch.length >= NODE_BATCH_SIZE) {
              flushBatches();
            }
            logger.debug("FlowGenerator.generate.onAddNodes", {
              phase: "branch",
              sourceId: sourceNode.id,
              responseId: responseNode.id,
              nextId: nextNode.id,
            });

            if (topic && topic.trim() !== "" && ollamaAvailable) {
              const generationTask = {
                responseNode,
                nextNode,
                sourceNode,
                siblingResponses: [...siblingResponses],
                siblingNextNodes: [...siblingNextNodes],
                existingSiblingTexts: [...existingSiblingTexts],
                existingSiblingNextTexts: [...existingSiblingNextTexts],
              };

              (window as any).__flowGenTasks = (window as any).__flowGenTasks || [];
              (window as any).__flowGenTasks.push(generationTask);
            }

            siblingResponses.push(responseNode);
            siblingNextNodes.push(nextNode);
            nextLevelNodes.push(nextNode);
          }
        }

        const tasks = (window as any).__flowGenTasks || [];
        if (tasks.length > 0) {
          const processingMode = options.sequentialProcessing ? "sequential" : "parallel";
          logger.debug(`[FlowGenerator] Processing ${tasks.length} generation tasks in ${processingMode} mode`);

          const processTask = async (task: any) => {
            const {
              responseNode,
              nextNode,
              sourceNode,
              siblingResponses,
              siblingNextNodes,
              existingSiblingTexts,
              existingSiblingNextTexts,
            } = task;

            try {
              const siblingResponseNodes: DialogContext[] = [
                ...existingSiblingTexts.map((text: string, idx: number) => ({
                  nodeId: `${sourceNode.id}-resp-sib-${idx}`,
                  type: responseNode.type,
                  text,
                  tags: responseNode.data.metadata?.nodeData?.tags || [],
                })),
                ...siblingResponses.map((sib: any) => ({
                  nodeId: sib.id,
                  type: sib.type,
                  text: sib.data.text,
                  tags: sib.data.metadata?.nodeData?.tags || [],
                })),
              ];

              const responseContext: GenerateContext = {
                current: {
                  nodeId: responseNode.id,
                  type: responseNode.type,
                  text: responseNode.data.text,
                  tags: responseNode.data.metadata?.nodeData?.tags || [],
                },
                previous: [
                  {
                    nodeId: sourceNode.id,
                    type: sourceNode.type,
                    text: sourceNode.data.text,
                    tags: sourceNode.data.metadata?.nodeData?.tags || [],
                  },
                ],
                next: siblingResponseNodes,
                siblingNodes: siblingResponseNodes,
                characterInfo: `TOPIC: ${topic}`,
              };

              const responseText = await ollamaService.generateDialog(
                responseNode.type,
                convertTagsForOllama(responseContext)
              );
              onEditNode(responseNode.id, responseText);
              onUpdateNode?.(responseNode.id, { isProcessing: false, aiStatus: "idle" });

              siblingTextMap[sourceNode.id] = [
                ...(siblingTextMap[sourceNode.id] || []),
                responseText,
              ];

              const siblingNextNodeContexts: DialogContext[] = [
                ...existingSiblingNextTexts.map((text: string, idx: number) => ({
                  nodeId: `${sourceNode.id}-npc-sib-${idx}`,
                  type: nextNode.type,
                  text,
                  tags: nextNode.data.metadata?.nodeData?.tags || [],
                })),
                ...siblingNextNodes.map((sib: any) => ({
                  nodeId: sib.id,
                  type: sib.type,
                  text: sib.data.text,
                  tags: sib.data.metadata?.nodeData?.tags || [],
                })),
              ];

              const npcContext: GenerateContext = {
                current: {
                  nodeId: nextNode.id,
                  type: nextNode.type,
                  text: nextNode.data.text,
                  tags: nextNode.data.metadata?.nodeData?.tags || [],
                },
                previous: [
                  {
                    nodeId: responseNode.id,
                    type: responseNode.type,
                    text: responseText,
                    tags: responseNode.data.metadata?.nodeData?.tags || [],
                  },
                ],
                next: siblingNextNodeContexts,
                siblingNodes: siblingNextNodeContexts,
                characterInfo: `TOPIC: ${topic}`,
              };

              const npcText = await ollamaService.generateDialog(
                nextNode.type,
                convertTagsForOllama(npcContext)
              );
              onEditNode(nextNode.id, npcText);
              onUpdateNode?.(nextNode.id, { isProcessing: false, aiStatus: "idle" });

              siblingNextTextMap[sourceNode.id] = [
                ...(siblingNextTextMap[sourceNode.id] || []),
                npcText,
              ];
            } catch (error) {
              logger.error(`Error generating dialog for nodes:`, error);
              onUpdateNode?.(responseNode.id, { isProcessing: false, aiStatus: "error" });
              onUpdateNode?.(nextNode.id, { isProcessing: false, aiStatus: "error" });
            }
          };

          try {
            if (options.sequentialProcessing) {
              for (let i = 0; i < tasks.length; i++) {
                logger.debug(`[FlowGenerator] Processing task ${i + 1}/${tasks.length} sequentially`);
                await processTask(tasks[i]);
              }
            } else {
              await Promise.all(tasks.map(processTask));
            }
            logger.debug(`[FlowGenerator] Completed ${tasks.length} ${processingMode} generation tasks`);
          } catch (error) {
            logger.error(`[FlowGenerator] Error in ${processingMode} processing:`, error);
          }

          (window as any).__flowGenTasks = [];
        }

        currentNodes = nextLevelNodes;
        currentLevel++;
      }

      logger.debug("FlowGenerator.generate.beforeFinalFlush", {
        nodeBatchLength: nodeBatch.length,
        connectionBatchLength: connectionBatch.length,
      });
      flushBatches();
      logger.debug("FlowGenerator.generate.afterFinalFlush", {
        nodeBatchLength: nodeBatch.length,
        connectionBatchLength: connectionBatch.length,
      });
      setGenerationProgress({ current: totalNodes, total: totalNodes });

      toast.dismiss("flowgen-progress");
      toast.success(`Flow generated successfully! ${totalNodes} nodes created.`, {
        duration: 4000,
        position: "bottom-center",
      });

      logger.debug("FlowGenerator.generate.complete", { totalNodes });
    } catch (error) {
      logger.error("Error generating flow:", error);

      toast.dismiss("flowgen-progress");
      toast.error("Failed to generate flow", {
        duration: 4000,
        position: "bottom-center",
      });
    } finally {
      setIsGenerating(false);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(() => {
            try {
              const event = new Event("request-auto-layout");
              window.dispatchEvent(event);
            } catch {}
          }, 50);
        });
      });
    }
  };

  const handleGenerateAndClose = async () => {
    logger.debug("FlowGenerator.generate.buttonClick");
    await handleGenerateNodes();
    onClose();
  };

  useEffect(() => {
    const componentElement = document.querySelector(".FlowGenerator");
    if (componentElement) {
      componentElement.setAttribute("data-project-type", currentProjectTypeRef.current);
    }
  }, []);

  useEffect(() => {
    if (!show) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [show]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm FlowGenerator"
      data-flowgenerator-modal
      data-project-type={currentProjectTypeRef.current}
      onMouseDown={handleOverlayMouseDown}
    >
      <div
        className="w-[680px] max-h-[92vh] overflow-hidden bg-[#0D0D0F] rounded-xl border border-white/10 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-14 px-4 border-b border-white/5 flex items-center justify-between bg-[#12121A] shrink-0">
          <div className="flex items-center space-x-3">
            <div className="flex items-center px-3 py-1.5 gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-indigo-400"
              >
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
              </svg>
              <h1 className="text-base font-medium text-white">Generate Flow</h1>
            </div>
            <div className="px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-400 text-xs font-medium">
              {currentProjectTypeRef.current
                .replace("_", " ")
                .replace(/\b\w/g, (l) => l.toUpperCase())}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md text-white/40 hover:text-white hover:bg-white/5 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
          {/* Topic Section */}
          <div className="mb-5">
            <div className="mb-2 flex justify-between items-center">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
                Dialog Topic
              </h3>
              <div className="rounded-full py-0.5 px-2.5 text-xs font-medium bg-[#2D3154]/30 text-[#A5ADFF] border border-[#2D3154]/60">
                {options.topic ? `${options.topic.length} chars` : "No topic"}
              </div>
            </div>
            <div className="relative">
              <input
                type="text"
                value={options.topic}
                onChange={(e) => setOptions((prev) => ({ ...prev, topic: e.target.value }))}
                className="w-full px-4 py-3 bg-[#161A36] text-white rounded-lg border border-[#2D3154]/60 focus:outline-none focus:border-[#5B63C5]/70 placeholder-[#A5ADFF]/30 text-sm transition-all shadow-sm"
                placeholder="Enter a creative topic for your dialog..."
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    if (options.tags.length > 0) {
                      if (ollamaAvailable) {
                        setIsGenerating(true);
                        const tagSummaries = options.tags
                          .map(
                            (tag) =>
                              `[${tag.type}] ${tag.label}: ${tag.content || tag.label}`
                          )
                          .join("\n");

                        const context: GenerateContext = {
                          current: {
                            nodeId: "topic",
                            type: "topic",
                            text: "",
                            tags: options.tags,
                          },
                        };

                        const customPrompt = `You are helping design a dialog flow.

TAGS:
${tagSummaries}

TASK:
Generate a single, short dialog topic that fits these tags.
- Keep it under 10 words.
- Make it concrete and game-appropriate.
- Do NOT include quotation marks or meta commentary.

TOPIC:`;

                        const generatedTopic = await ollamaService.generateWithCustomPrompt(
                          "topic",
                          convertTagsForOllama(context),
                          customPrompt,
                          undefined,
                          false,
                          true
                        );

                        setOptions((prev) => ({
                          ...prev,
                          topic: normalizeGeneratedTopic(generatedTopic),
                        }));
                      } else {
                        const tagLabels = options.tags.map((tag) => tag.label).join(", ");
                        setOptions((prev) => ({
                          ...prev,
                          topic: `${tagLabels} based dialog`,
                        }));
                      }
                    } else {
                      if (ollamaAvailable) {
                        setIsGenerating(true);
                        const projectType = currentProjectTypeRef.current;
                        let promptInfo = "";

                        switch (projectType) {
                          case "game":
                            promptInfo =
                              "Generate a very brief and creative quest topic for a fantasy RPG game. Keep it under 10 words. Just return the topic without any explanation or quotation marks.";
                            break;
                          case "interactive_story":
                            promptInfo =
                              "Create a brief and interesting topic for a branching interactive story. Keep it under 10 words. Just return the topic without any explanation or quotation marks.";
                            break;
                          case "novel":
                            promptInfo =
                              "Suggest a brief and compelling scene topic for a dramatic narrative. Keep it under 10 words. Just return the topic without any explanation or quotation marks.";
                            break;
                          default:
                            promptInfo =
                              "Generate a short and engaging dialog topic. Keep it under 10 words. Just return the topic without any explanation or quotation marks.";
                        }

                        const context: GenerateContext = {
                          current: {
                            nodeId: "topic",
                            type: "topic",
                            text: "",
                            tags: [],
                          },
                        };

                        try {
                          const generatedResponse = await ollamaService.generateWithCustomPrompt(
                            "topic",
                            convertTagsForOllama(context),
                            promptInfo,
                            undefined,
                            false,
                            true
                          );

                          setOptions((prev) => ({
                            ...prev,
                            topic: normalizeGeneratedTopic(generatedResponse),
                          }));
                        } catch (error) {
                          logger.error("Error generating topic:", error);
                          setOptions((prev) => ({
                            ...prev,
                            topic: generateTopicFromProjectType(currentProjectTypeRef.current),
                          }));
                        }
                      } else {
                        setOptions((prev) => ({
                          ...prev,
                          topic: generateTopicFromProjectType(currentProjectTypeRef.current),
                        }));
                      }
                    }
                  } catch (error) {
                    logger.error("Error generating topic:", error);

                    setOptions((prev) => ({
                      ...prev,
                      topic: generateTopicFromProjectType(currentProjectTypeRef.current),
                    }));
                  } finally {
                    setIsGenerating(false);
                  }
                }}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#5B63C5] hover:text-[#A5ADFF] p-1.5 rounded-md hover:bg-[#2D3154]/30 transition-colors"
                title={
                  options.tags.length > 0
                    ? "Generate topic from tags with AI"
                    : "Generate topic based on project type with AI"
                }
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Tags Section */}
          <div className="px-5 py-4 bg-gradient-to-b from-[#121430]/0 to-[#121430]/40">
            <div className="mb-2 flex justify-between items-center">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Tags</h3>
              <button
                onClick={() =>
                  setOptions((prev) => ({
                    ...prev,
                    showTagManager: !prev.showTagManager,
                  }))
                }
                className="flex items-center gap-1 py-0.5 px-2 rounded-full text-xs font-medium bg-[#2D3154]/30 text-[#A5ADFF] hover:bg-[#2D3154]/50 border border-[#2D3154]/60 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span>Add Tags</span>
              </button>
            </div>

            <div className="bg-[#161A36] rounded-lg p-3.5 min-h-[60px] border border-[#2D3154]/60 shadow-sm">
              {options.tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {options.tags.map((tag) => {
                    const tagColors = {
                      character: "bg-blue-900/50 text-blue-300 border-blue-500/40",
                      location: "bg-emerald-900/50 text-emerald-300 border-emerald-500/40",
                      action: "bg-amber-900/50 text-amber-300 border-amber-500/40",
                      emotion: "bg-pink-900/50 text-pink-300 border-pink-500/40",
                      item: "bg-purple-900/50 text-purple-300 border-purple-500/40",
                      default: "bg-[#2D3154]/50 text-[#A5ADFF] border-[#5B63C5]/40",
                    };

                    const tagType = tag.type?.toLowerCase() || "default";
                    const tagColor =
                      tagColors[tagType as keyof typeof tagColors] || tagColors.default;

                    return (
                      <div
                        key={tag.id}
                        className={`group flex items-center gap-1 px-2.5 py-1.5 rounded-md border ${tagColor} text-xs transition-all hover:shadow-glow-sm`}
                      >
                        {tag.label}
                        <button
                          onClick={() =>
                            setOptions((prev) => ({
                              ...prev,
                              tags: prev.tags.filter((t) => t.id !== tag.id),
                            }))
                          }
                          className="ml-1 opacity-0 group-hover:opacity-100 hover:text-white transition-all"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-3 w-3"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-[42px] text-[#A5ADFF]/40 text-xs">
                  Tags enhance dialog quality and content generation
                </div>
              )}
            </div>

            {/* Tag info tooltip */}
            <div className="mt-2 flex items-center text-[10px] text-[#A5ADFF]/50 gap-1.5">
              <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Tags apply to all generated nodes and influence AI content</span>
            </div>
          </div>

          {/* Dialog Structure Section */}
          <div className="px-5 py-4">
            <div className="mb-4 flex items-center space-x-3">
              <h3 className="text-sm font-semibold text-white">Dialog Structure</h3>
              <div className="h-px flex-grow bg-gradient-to-r from-[#5B63C5]/20 via-[#5B63C5]/40 to-transparent"></div>
              <div className="flex items-center space-x-1 px-2.5 py-1 rounded-full border border-[#2D3154]/80 bg-[#161A36]">
                <span className="block w-2 h-2 rounded-full bg-[#5B63C5]"></span>
                <span className="text-xs text-[#A5ADFF]">
                  {currentProjectTypeRef.current === "game"
                    ? "RPG Dialog"
                    : currentProjectTypeRef.current === "interactive_story"
                      ? "Branching Story"
                      : "Scene Sequence"}
                </span>
              </div>
            </div>

            {/* Flow structure diagram - improved with tertiary and after tertiary nodes */}
            <div className="mb-5 py-1 relative w-full bg-[#161A36]/40 rounded-lg border border-[#2D3154]/60 overflow-hidden">
              <div className="flex flex-col">
                {/* Standard flow without tertiary node */}
                <div className="flex items-center mb-3 px-4 py-1">
                  <div className="text-xs text-[#A5ADFF]/80 w-24 mr-2">Standard Flow:</div>
                  <div className="flex items-center">
                    <div className="flex flex-col items-center justify-center w-auto px-2 h-8 rounded bg-[#4F87FF]/10 border border-[#4F87FF]/30">
                      <div className="w-2 h-2 rounded-full bg-[#4F87FF]"></div>
                      <span className="text-[10px] text-white whitespace-nowrap">
                        {options.selectedNodeType === "npcDialog"
                          ? "NPC Dialog"
                          : options.selectedNodeType === "narratorNode"
                            ? "Story Voice"
                            : options.selectedNodeType === "characterDialogNode"
                              ? "Character"
                              : options.selectedNodeType}
                      </span>
                    </div>

                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      className="mx-1 text-[#5B63C5]/70"
                    >
                      <path
                        d="M5 12h14M12 5l7 7-7 7"
                        stroke="currentColor"
                        fill="none"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>

                    <div className="flex flex-col items-center justify-center w-auto px-2 h-8 rounded bg-[#3DBAA2]/10 border border-[#3DBAA2]/30">
                      <div className="w-2 h-2 rounded-full bg-[#3DBAA2]"></div>
                      <span className="text-[10px] text-white whitespace-nowrap">
                        {options.secondaryNodeType === "playerResponse"
                          ? "Player Response"
                          : options.secondaryNodeType === "choiceNode"
                            ? "Decision Path"
                            : options.secondaryNodeType === "sceneDescriptionNode"
                              ? "Visual Canvas"
                              : options.secondaryNodeType}
                      </span>
                    </div>

                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      className="mx-1 text-[#5B63C5]/70"
                    >
                      <path
                        d="M5 12h14M12 5l7 7-7 7"
                        stroke="currentColor"
                        fill="none"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>

                    <div className="flex flex-col items-center justify-center w-auto px-2 h-8 rounded bg-[#4F87FF]/10 border border-[#4F87FF]/30">
                      <div className="w-2 h-2 rounded-full bg-[#4F87FF]"></div>
                      <span className="text-[10px] text-white whitespace-nowrap">
                        {options.selectedNodeType === "npcDialog"
                          ? "NPC Dialog"
                          : options.selectedNodeType === "narratorNode"
                            ? "Story Voice"
                            : options.selectedNodeType === "characterDialogNode"
                              ? "Character"
                              : options.selectedNodeType}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tertiary node flow */}
                {options.useTertiaryNode && (
                  <div className="flex items-center px-4 py-1 mt-1 border-t border-[#2D3154]/30">
                    <div className="text-xs text-[#A5ADFF]/80 w-24 mr-2">With Tertiary:</div>
                    <div className="flex items-center">
                      <div className="flex flex-col items-center justify-center w-auto px-2 h-8 rounded bg-[#4F87FF]/10 border border-[#4F87FF]/30">
                        <div className="w-2 h-2 rounded-full bg-[#4F87FF]"></div>
                        <span className="text-[10px] text-white whitespace-nowrap">
                          {options.selectedNodeType === "npcDialog"
                            ? "NPC Dialog"
                            : options.selectedNodeType === "narratorNode"
                              ? "Story Voice"
                              : options.selectedNodeType === "characterDialogNode"
                                ? "Character"
                                : options.selectedNodeType}
                        </span>
                      </div>

                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        className="mx-1 text-[#5B63C5]/70"
                      >
                        <path
                          d="M5 12h14M12 5l7 7-7 7"
                          stroke="currentColor"
                          fill="none"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>

                      <div className="flex flex-col items-center justify-center w-auto px-2 h-8 rounded bg-[#BB6BD9]/10 border border-[#BB6BD9]/30">
                        <div className="w-2 h-2 rounded-full bg-[#BB6BD9]"></div>
                        <span className="text-[10px] text-white whitespace-nowrap">
                          {options.tertiaryNodeType === "enemyDialog"
                            ? "Enemy Dialog"
                            : options.tertiaryNodeType === "branchingNode"
                              ? "Branching Path"
                              : options.tertiaryNodeType === "sceneNode"
                                ? "Scene"
                                : options.tertiaryNodeType}
                        </span>
                      </div>

                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        className="mx-1 text-[#5B63C5]/70"
                      >
                        <path
                          d="M5 12h14M12 5l7 7-7 7"
                          stroke="currentColor"
                          fill="none"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>

                      <div className="flex flex-col items-center justify-center w-auto px-2 h-8 rounded bg-[#4F87FF]/10 border border-[#4F87FF]/30">
                        <div className="w-2 h-2 rounded-full bg-[#4F87FF]"></div>
                        <span className="text-[10px] text-white whitespace-nowrap">
                          {options.afterTertiaryNodeType === "npcDialog"
                            ? "NPC Dialog"
                            : options.afterTertiaryNodeType === "enemyDialog"
                              ? "Enemy Dialog"
                              : options.afterTertiaryNodeType === "narratorNode"
                                ? "Story Voice"
                                : options.afterTertiaryNodeType === "characterDialogNode"
                                  ? "Character"
                                  : options.afterTertiaryNodeType}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Legend */}
                <div className="flex items-center px-4 pt-2 mt-1 text-[10px] text-[#A5ADFF]/60 border-t border-[#2D3154]/30">
                  <div className="flex items-center mr-3">
                    <div className="w-2 h-2 rounded-full bg-[#4F87FF] mr-1.5"></div>
                    <span>Primary</span>
                  </div>
                  <div className="flex items-center mr-3">
                    <div className="w-2 h-2 rounded-full bg-[#3DBAA2] mr-1.5"></div>
                    <span>Secondary</span>
                  </div>
                  {options.useTertiaryNode && (
                    <>
                      <div className="flex items-center mr-3">
                        <div className="w-2 h-2 rounded-full bg-[#BB6BD9] mr-1.5"></div>
                        <span>Tertiary</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-[#4F87FF] mr-1.5"></div>
                        <span>After Tertiary</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Node Configuration - Primary and Secondary */}
            <div className="space-y-4">
              <div className="flex gap-4">
                {/* Primary Node Type */}
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="w-2 h-2 bg-[#4F87FF] rounded-full"></div>
                    <label className="text-xs text-[#A5ADFF] font-medium">Primary Node Type</label>
                  </div>
                  <div className="relative">
                    <select
                      value={options.selectedNodeType}
                      onChange={(e) =>
                        setOptions((prev) => ({
                          ...prev,
                          selectedNodeType: e.target.value as DialogNodeType,
                        }))
                      }
                      className="w-full bg-[#161A36] text-white text-xs pl-8 pr-3 py-2.5 rounded-lg border border-[#2D3154]/60 appearance-none focus:outline-none focus:border-[#4F87FF]/70 focus:ring-1 focus:ring-[#4F87FF]/20"
                    >
                      {currentProjectTypeRef.current === "game" ? (
                        <>
                          <option value="npcDialog">NPC Dialog</option>
                        </>
                      ) : currentProjectTypeRef.current === "interactive_story" ? (
                        <>
                          <option value="narratorNode">Story Voice</option>
                          <option value="characterDialogNode">Character Dialog</option>
                        </>
                      ) : (
                        <>
                          <option value="characterDialogNode">Character Dialog</option>
                          <option value="narratorNode">Story Voice</option>
                        </>
                      )}
                    </select>
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#4F87FF]/30"></div>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg
                        className="w-4 h-4 text-[#A5ADFF]/50"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Secondary Node Type */}
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="w-2 h-2 bg-[#3DBAA2] rounded-full"></div>
                    <label className="text-xs text-[#A5ADFF] font-medium">
                      Secondary Node Type
                    </label>
                  </div>
                  <div className="relative">
                    <select
                      value={options.secondaryNodeType}
                      onChange={(e) =>
                        setOptions((prev) => ({
                          ...prev,
                          secondaryNodeType: e.target.value as DialogNodeType,
                        }))
                      }
                      className="w-full bg-[#161A36] text-white text-xs pl-8 pr-3 py-2.5 rounded-lg border border-[#2D3154]/60 appearance-none focus:outline-none focus:border-[#3DBAA2]/70 focus:ring-1 focus:ring-[#3DBAA2]/20"
                    >
                      {currentProjectTypeRef.current === "game" ? (
                        <>
                          <option value="playerResponse">Player Response</option>
                          <option value="choiceNode">Choice</option>
                        </>
                      ) : currentProjectTypeRef.current === "interactive_story" ? (
                        <>
                          <option value="choiceNode">Decision Path</option>
                          <option value="playerResponse">Player Response</option>
                        </>
                      ) : (
                        <>
                          <option value="sceneDescriptionNode">Visual Canvas</option>
                          <option value="characterDialogNode">Character Dialog</option>
                        </>
                      )}
                    </select>
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#3DBAA2]/30"></div>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg
                        className="w-4 h-4 text-[#A5ADFF]/50"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tertiary Node Toggle and Type */}
              <div className="flex items-center">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.useTertiaryNode}
                    onChange={(e) =>
                      setOptions((prev) => ({
                        ...prev,
                        useTertiaryNode: e.target.checked,
                      }))
                    }
                    className="hidden"
                  />
                  <div
                    className={`w-10 h-5 flex items-center rounded-full p-1 duration-300 ease-in-out ${options.useTertiaryNode ? "bg-[#BB6BD9]/30" : "bg-[#2D3154]/50"}`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out ${options.useTertiaryNode ? "translate-x-5" : "translate-x-0"}`}
                    ></div>
                  </div>
                  <span className="ml-2 text-xs text-[#A5ADFF] font-medium">
                    Enable Tertiary Nodes
                  </span>
                </label>
              </div>

              {options.useTertiaryNode && (
                <div className="grid grid-cols-2 gap-4">
                  {/* Tertiary Node Type */}
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="w-2 h-2 bg-[#BB6BD9] rounded-full"></div>
                      <label className="text-xs text-[#A5ADFF] font-medium">
                        Tertiary Node Type
                      </label>
                    </div>
                    <div className="relative">
                      <select
                        value={options.tertiaryNodeType}
                        onChange={(e) =>
                          setOptions((prev) => ({
                            ...prev,
                            tertiaryNodeType: e.target.value as DialogNodeType,
                          }))
                        }
                        className="w-full bg-[#161A36] text-white text-xs pl-8 pr-3 py-2.5 rounded-lg border border-[#2D3154]/60 appearance-none focus:outline-none focus:border-[#BB6BD9]/70 focus:ring-1 focus:ring-[#BB6BD9]/20"
                      >
                        {currentProjectTypeRef.current === "game" ? (
                          <>
                            <option value="enemyDialog">Enemy Dialog</option>
                            <option value="sceneNode">Scene Node</option>
                          </>
                        ) : currentProjectTypeRef.current === "interactive_story" ? (
                          <>
                            <option value="branchingNode">Branching Path</option>
                            <option value="sceneDescriptionNode">Visual Canvas</option>
                          </>
                        ) : (
                          <>
                            <option value="sceneNode">Scene</option>
                            <option value="narratorNode">Story Voice</option>
                          </>
                        )}
                      </select>
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#BB6BD9]/30"></div>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <svg
                          className="w-4 h-4 text-[#A5ADFF]/50"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* After Tertiary Node Type */}
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="w-2 h-2 bg-[#4F87FF] rounded-full"></div>
                      <label className="text-xs text-[#A5ADFF] font-medium">
                        After Tertiary Node
                      </label>
                    </div>
                    <div className="relative">
                      <select
                        value={options.afterTertiaryNodeType}
                        onChange={(e) =>
                          setOptions((prev) => ({
                            ...prev,
                            afterTertiaryNodeType: e.target.value as DialogNodeType,
                          }))
                        }
                        className="w-full bg-[#161A36] text-white text-xs pl-8 pr-3 py-2.5 rounded-lg border border-[#2D3154]/60 appearance-none focus:outline-none focus:border-[#4F87FF]/70 focus:ring-1 focus:ring-[#4F87FF]/20"
                      >
                        {currentProjectTypeRef.current === "game" ? (
                          <>
                            <option value="npcDialog">NPC Dialog</option>
                            <option value="playerResponse">Player Response</option>
                          </>
                        ) : currentProjectTypeRef.current === "interactive_story" ? (
                          <>
                            <option value="narratorNode">Story Voice</option>
                            <option value="characterDialogNode">Character Dialog</option>
                            <option value="choiceNode">Player Choice</option>
                          </>
                        ) : (
                          <>
                            <option value="characterDialogNode">Character Dialog</option>
                            <option value="narratorNode">Story Voice</option>
                            <option value="sceneDescriptionNode">Visual Canvas</option>
                          </>
                        )}
                      </select>
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#4F87FF]/30"></div>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <svg
                          className="w-4 h-4 text-[#A5ADFF]/50"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Tertiary Frequency */}
                  <div className="col-span-2 mt-1">
                    <div className="flex justify-between items-center mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs text-[#A5ADFF] font-medium">
                          Tertiary Frequency
                        </label>
                      </div>
                      <span className="text-white text-xs px-2 py-0.5 bg-[#BB6BD9]/20 border border-[#BB6BD9]/30 rounded-full">
                        Every {options.tertiaryFrequency} responses
                      </span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="10"
                      value={options.tertiaryFrequency}
                      onChange={(e) =>
                        setOptions((prev) => ({
                          ...prev,
                          tertiaryFrequency: parseInt(e.target.value),
                        }))
                      }
                      className="w-full h-1.5 rounded-full bg-[#2D3154]/60 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#BB6BD9] [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-[#BB6BD9]/30"
                    />
                    <div className="flex justify-between mt-1 text-[10px] text-[#A5ADFF]/60">
                      <span>More frequent</span>
                      <span>Less frequent</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Sequential Processing Toggle */}
              <div className="flex items-center mt-4 pt-4 border-t border-[#2D3154]/40">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.sequentialProcessing}
                    onChange={(e) =>
                      setOptions((prev) => ({
                        ...prev,
                        sequentialProcessing: e.target.checked,
                      }))
                    }
                    className="hidden"
                  />
                  <div
                    className={`w-10 h-5 flex items-center rounded-full p-1 duration-300 ease-in-out ${options.sequentialProcessing ? "bg-[#4F87FF]/30" : "bg-[#2D3154]/50"}`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out ${options.sequentialProcessing ? "translate-x-5" : "translate-x-0"}`}
                    ></div>
                  </div>
                  <span className="ml-2 text-xs text-[#A5ADFF] font-medium">
                    Sequential Processing
                  </span>
                </label>
                <div className="ml-auto">
                  <span className="text-[10px] text-[#A5ADFF]/60">
                    {options.sequentialProcessing ? "One at a time (slower, stable)" : "Parallel (faster, may overload)"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Size and Stats Section */}
          <div className="px-5 py-4 bg-gradient-to-b from-[#121430]/0 to-[#121430]/40">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-2">
                Flow Parameters
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {/* NPC Count */}
                <div className="bg-[#161A36] p-3.5 rounded-lg border border-[#2D3154]/60 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-[#A5ADFF] font-medium">NPC Count</span>
                    <div className="flex items-center gap-2 text-[#A5ADFF]/60 text-[10px]">
                      <span className="text-xs py-0.5 px-2.5 bg-[#2D3154]/30 text-[#A5ADFF] rounded-full border border-[#2D3154]/60 font-medium">
                        {options.npcCount}
                      </span>
                    </div>
                  </div>
                  <div className="relative pt-1">
                    <div className="h-1 rounded-full overflow-hidden bg-[#2D3154]/50">
                      <div
                        className="h-full bg-[#FFA836] rounded-full"
                        style={{ width: `${(options.npcCount / 5) * 100}%` }}
                      ></div>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={options.npcCount}
                      onChange={(e) =>
                        setOptions((prev) => ({
                          ...prev,
                          npcCount: parseInt(e.target.value) || 1,
                        }))
                      }
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                  <div className="flex justify-between mt-1.5 text-[10px] text-[#A5ADFF]/40">
                    <span>Fewer Characters</span>
                    <span>More Characters</span>
                  </div>
                </div>

                {/* Responses */}
                <div className="bg-[#161A36] p-3.5 rounded-lg border border-[#2D3154]/60 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-[#A5ADFF] font-medium">Responses per NPC</span>
                    <div className="flex items-center gap-2 text-[#A5ADFF]/60 text-[10px]">
                      <span className="text-xs py-0.5 px-2.5 bg-[#2D3154]/30 text-[#A5ADFF] rounded-full border border-[#2D3154]/60 font-medium">
                        {options.responsesPerNpc}
                      </span>
                    </div>
                  </div>
                  <div className="relative pt-1">
                    <div className="h-1 rounded-full overflow-hidden bg-[#2D3154]/50">
                      <div
                        className="h-full bg-[#4F87FF] rounded-full"
                        style={{
                          width: `${(options.responsesPerNpc / 5) * 100}%`,
                        }}
                      ></div>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={options.responsesPerNpc}
                      onChange={(e) =>
                        setOptions((prev) => ({
                          ...prev,
                          responsesPerNpc: parseInt(e.target.value) || 1,
                        }))
                      }
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                  <div className="flex justify-between mt-1.5 text-[10px] text-[#A5ADFF]/40">
                    <span>Fewer Options</span>
                    <span>More Options</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
                Flow Metrics
              </h3>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[#161A36] p-4 rounded-lg border border-[#2D3154]/60 shadow-sm">
                  <div className="mb-1 text-[10px] text-[#A5ADFF]/60 uppercase tracking-wider">
                    Total Nodes
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="text-2xl font-bold text-white">
                      {calculateTotalNodes(options.npcCount, options.responsesPerNpc)}
                    </div>
                    <div className="text-xs text-[#A5ADFF]/60 mb-1">nodes</div>
                  </div>
                </div>
                <div className="bg-[#161A36] p-4 rounded-lg border border-[#2D3154]/60 shadow-sm">
                  <div className="mb-1 text-[10px] text-[#A5ADFF]/60 uppercase tracking-wider">
                    Dialog Paths
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="text-2xl font-bold text-white">
                      {calculateTotalPaths(options.npcCount, options.responsesPerNpc)}
                    </div>
                    <div className="text-xs text-[#A5ADFF]/60 mb-1">paths</div>
                  </div>
                </div>
                <div className="bg-[#161A36] p-4 rounded-lg border border-[#2D3154]/60 shadow-sm">
                  <div className="mb-1 text-[10px] text-[#A5ADFF]/60 uppercase tracking-wider">
                    Complexity
                  </div>
                  <div className="flex items-end gap-2">
                    <div
                      className={`text-lg font-bold ${
                        calculateComplexityLevel(options.npcCount, options.responsesPerNpc) ===
                        "Low"
                          ? "text-green-400"
                          : calculateComplexityLevel(options.npcCount, options.responsesPerNpc) ===
                              "Medium"
                            ? "text-yellow-400"
                            : calculateComplexityLevel(
                                  options.npcCount,
                                  options.responsesPerNpc
                                ) === "High"
                              ? "text-orange-400"
                              : "text-red-400"
                      }`}
                    >
                      {calculateComplexityLevel(options.npcCount, options.responsesPerNpc)}
                    </div>
                  </div>
                </div>
              </div>

              {options.npcCount > 3 && options.responsesPerNpc > 3 && (
                <div className="mt-4 py-2 px-3 rounded-lg bg-amber-500/5 border border-amber-500/20 flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-amber-400 flex-shrink-0"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-xs text-amber-300">Large flow may impact performance</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-14 px-4 border-t border-white/5 flex items-center justify-between bg-[#0F0F15] shrink-0">
          <div className="text-xs text-white/40 flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-indigo-400"
            >
              <path d="M12 8V12L15 15"></path>
              <circle cx="12" cy="12" r="9"></circle>
            </svg>
            <span>
              Est. time: ~{Math.ceil(calculateTotalNodes(options.npcCount, options.responsesPerNpc) * 0.8)}s
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="h-9 px-4 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerateAndClose}
              disabled={isGenerating}
              className="h-9 px-5 rounded-lg text-sm bg-indigo-500 hover:bg-indigo-600 text-white flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {Math.round((generationProgress.current / generationProgress.total) * 100)}%
                  </span>
                </>
              ) : (
                <span>Generate Flow</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Ollama warning modal */}
      {showOllamaWarning && (
        <div className="fixed inset-0 bg-[#08080A]/95 backdrop-blur-lg flex items-center justify-center z-50">
          <div className="w-full max-w-md bg-[#0F1021] p-5 rounded-lg border border-red-500/20 shadow-xl shadow-red-500/5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-medium text-white">Connection Failed</h3>
                <p className="text-sm text-[#A5ADFF]/70">Unable to connect to Ollama API</p>
              </div>
            </div>
            <p className="text-sm text-[#A5ADFF]/70 mb-5">
              The dialog flow will be created without AI-generated content. You can manually add
              content to the nodes later.
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setShowOllamaWarning(false)}
                className="px-5 py-2.5 text-sm bg-[#2D3154] hover:bg-[#383D66] text-[#A5ADFF] hover:text-white text-sm rounded-lg border border-[#2D3154]/60 transition-colors shadow-md shadow-[#1E2143]/30"
              >
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tag manager modal */}
      {options.showTagManager && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <div className="w-[800px] max-h-[600px] overflow-auto bg-[#0F1021] rounded-xl border border-[#2D3154]/40 shadow-2xl shadow-[#161A36]/20">
            <div className="flex justify-between items-center p-4 border-b border-[#2D3154]/40">
              <h3 className="text-lg font-medium text-white">Manage Tags</h3>
              <button
                onClick={() => setOptions((prev) => ({ ...prev, showTagManager: false }))}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[#A5ADFF]/60 hover:text-[#A5ADFF] hover:bg-[#2D3154]/20 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="p-4">
              <TagSection
                tags={options.tags}
                onUpdateTags={(updatedTags: Tag[]) =>
                  setOptions((prev) => ({ ...prev, tags: updatedTags }))
                }
                projectType={currentProjectTypeRef.current}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
