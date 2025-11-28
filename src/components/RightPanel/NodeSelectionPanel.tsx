import React, { useState, useEffect, useRef } from "react";
import {
  Edit,
  Trash2,
  Bot,
  Loader2,
  TagIcon,
  Info,
  GitBranch,
  RefreshCw,
  Sparkles,
  Copy,
  ChevronRight,
  X,
  BrainCircuit,
  Link2Off,
  History,
} from "lucide-react";
import { DialogNode, Tag, DialogNodeType } from "../../types/dialog";
import { Connection } from "../../types/nodes";
import TagSection from "../Tag/TagSection";
import DialogAnalysis from "../DialogAnalysis";
import ValidationScoreSection from "./ValidationScoreSection";
import { DialogAnalysisData } from "../../utils/dialogAnalyzer";
import { ollamaService, type NodeValidationResult } from "../../services/ollamaService";
import { GenerateContext } from "../../types/ollama";
import { formatDistanceToNow } from "date-fns";
import { useTheme } from "../../theme/ThemeProvider";
import { findDialogPaths, getCharacterContext } from "../../utils/dialogAnalyzer";
import type { ProjectType } from "../../types/project";
import { GenerateMode } from "../../hooks/useNodeAI";
import { AIHistoryItem } from "../../store/historyStore";
import { useOptimizedHistorySelector, useNodeHistory } from "../../store/selectors";
import { getRightPanelTheme } from "../../theme/components/RightPanelTheme";
import logger from "../../utils/logger";
import SubgraphPanel from "./SubgraphPanel";

interface NodeSelectionPanelProps {
  selectedNode: DialogNode;
  nodes: DialogNode[];
  connections: Connection[];
  onEdit: (id: string, newText: string) => void;
  onDelete: (id: string) => void;
  onSelectNode: (id: string) => void;
  onScrollToNode?: (id: string) => void;
  onUpdateNodeTags?: (id: string, tags: Tag[]) => void;
  projectType: ProjectType;
  onUngroupSubgraph?: (id: string) => void;
}

type PanelTab = "details" | "tags" | "analysis";

export const NodeSelectionPanel: React.FC<NodeSelectionPanelProps> = React.memo(
  ({
    selectedNode,
    nodes,
    connections,
    onEdit,
    onDelete,
    onSelectNode,
    onScrollToNode,
    onUpdateNodeTags,
    projectType,
    onUngroupSubgraph,
  }) => {
    if (selectedNode.type === "subgraphNode") {
      return (
        <SubgraphPanel
          selectedNode={selectedNode}
          onEdit={onEdit}
          onDelete={onDelete}
          onUngroup={onUngroupSubgraph}
        />
      );
    }

    const panelRef = useRef<HTMLDivElement>(null);
    const { theme } = useTheme();
    const rightPanelTheme = React.useMemo(() => getRightPanelTheme(theme), [theme]);
    const [activeTab, setActiveTab] = useState<PanelTab>("details");
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState<string>("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [customPrompt, setCustomPrompt] = useState("");
    const [showCustomPromptInput, setShowCustomPromptInput] = useState(false);
    const [showAlternativesInput, setShowAlternativesInput] = useState(false);
    const [alternativesCount, setAlternativesCount] = useState(3);
    const [alternatives, setAlternatives] = useState<string[]>([]);
    const [showAlternatives, setShowAlternatives] = useState(false);
    const [showPromptDetails, setShowPromptDetails] = useState<string | null>(null);
    const [aiMessage, setAiMessage] = useState("");
    const [ignoreConnections, setIgnoreConnections] = useState(false);
    const [localTags, setLocalTags] = useState<Tag[]>([]);

    const nodeHistory = useNodeHistory();

    const clearNodeHistory = useOptimizedHistorySelector((state) => state.clearNodeHistory);
    const clearNodeAIHistory = useOptimizedHistorySelector((state) => state.clearNodeAIHistory);
    const subscribeToAIHistory = useOptimizedHistorySelector((state) => state.subscribeToAIHistory);

    const [promptHistory, setPromptHistory] = useState<AIHistoryItem[]>([]);
    const [generationError, setGenerationError] = useState("");
    const [validationResult, setValidationResult] = useState<NodeValidationResult | null>(null);

    // PERFORMANCE: Track validation state to prevent loops
    const validationRef = useRef<{
      nodeId: string | null;
      textHash: string | null;
      isRunning: boolean;
    }>({
      nodeId: null,
      textHash: null,
      isRunning: false,
    });

    // Load or compute quality score for the selected node
    // OPTIMIZATION: Only run validation when node text actually changes, not on every nodes/connections change
    useEffect(() => {
      let isCancelled = false;

      const runValidation = async () => {
        if (!selectedNode?.id || !selectedNode?.data?.text) {
          if (!isCancelled) {
            setValidationResult(null);
            validationRef.current = { nodeId: null, textHash: null, isRunning: false };
          }
          return;
        }

        const content = typeof selectedNode.data.text === "string"
          ? selectedNode.data.text
          : String(selectedNode.data.text || "");

        // PERFORMANCE: Create content hash to detect actual text changes
        const textHash = `${selectedNode.id}-${content.length}-${content.substring(0, 50)}`;
        
        // Skip if already validating the same content
        if (
          validationRef.current.nodeId === selectedNode.id &&
          validationRef.current.textHash === textHash &&
          validationRef.current.isRunning
        ) {
          logger.debug("[NODE:VALIDATION] Skipping duplicate validation request");
          return;
        }

        // Skip if content hasn't changed
        if (
          validationRef.current.nodeId === selectedNode.id &&
          validationRef.current.textHash === textHash
        ) {
          return;
        }

        validationRef.current = {
          nodeId: selectedNode.id,
          textHash,
          isRunning: true,
        };

        // First, try to use cached validation result from the generation pipeline
        const cached = ollamaService.getValidationResult(selectedNode.id, content);
        if (cached) {
          if (!isCancelled) {
            setValidationResult(cached);
            validationRef.current.isRunning = false;
          }
          return;
        }

        try {
          // Build lightweight context for quality evaluation
          const dialogPath = findDialogPaths(selectedNode.id, nodes as any, connections);
          const characterContext = getCharacterContext(dialogPath);

          const context: GenerateContext = {
            dialogChain: {
              previous: dialogPath.previous.map((n) => ({
                id: n.id,
                type: n.type,
                position: { x: 0, y: 0 },
                data: {
                  text: n.text,
                  type: n.type,
                  metadata: { tags: n.tags as any },
                },
              })) as any,
              current: {
                id: dialogPath.current.id,
                type: dialogPath.current.type,
                position: { x: 0, y: 0 },
                data: {
                  text: content,
                  type: dialogPath.current.type,
                  metadata: { tags: dialogPath.current.tags as any },
                },
              } as any,
              next: dialogPath.next.map((n) => ({
                id: n.id,
                type: n.type,
                position: { x: 0, y: 0 },
                data: {
                  text: n.text,
                  type: n.type,
                  metadata: { tags: n.tags as any },
                },
              })) as any,
            },
            current: {
              nodeId: selectedNode.id,
              type: selectedNode.type,
              text: content,
              tags:
                (selectedNode.data.metadata?.nodeData?.tags ||
                  selectedNode.data.metadata?.tags ||
                  []) as any,
            },
            previous: dialogPath.previous.map((node) => ({
              nodeId: node.id,
              type: node.type,
              text: node.text,
              tags: node.tags as any,
            })),
            next: dialogPath.next.map((node) => ({
              nodeId: node.id,
              type: node.type,
              text: node.text,
              tags: node.tags as any,
            })),
            characterInfo: characterContext,
            projectType,
          };

            // Mark as validating while we compute scores
            if (!isCancelled) {
              setValidationResult((prev) =>
                prev && prev.isValidating
                  ? prev
                  : {
                      scores: {
                        characterVoice: 0,
                        contextCoherence: 0,
                        combined: 0,
                      },
                      issues: [],
                      strengths: [],
                      timestamp: Date.now(),
                      isValidating: true,
                    }
              );
            }

          const result = await ollamaService.evaluateNodeQuality(
            content,
            context as any,
            selectedNode.type as DialogNodeType
          );

          if (!isCancelled) {
            setValidationResult(result);
            validationRef.current.isRunning = false;
          }
        } catch (error) {
          logger.error("[NODE:VALIDATION] Failed to evaluate node quality:", error);
          if (!isCancelled) {
            setValidationResult(null);
            validationRef.current.isRunning = false;
          }
        }
      };

      // PERFORMANCE: Debounce validation to avoid rapid-fire calls
      const timeoutId = setTimeout(() => {
        runValidation();
      }, 300); // 300ms debounce

      return () => {
        isCancelled = true;
        clearTimeout(timeoutId);
        validationRef.current.isRunning = false;
      };
    }, [selectedNode?.id, selectedNode?.data?.text]); // REMOVED nodes, connections, projectType to prevent loops

    useEffect(() => {
      if (!selectedNode?.id) return;

      const unsubscribe = (subscribeToAIHistory as any)((history: AIHistoryItem[]) => {
        const filteredHistory = history.filter((item) => item.nodeId === selectedNode.id);
        setPromptHistory(filteredHistory);
      });

      return () => {
        unsubscribe();
      };
    }, [selectedNode?.id, subscribeToAIHistory]);

    useEffect(() => {
      if (selectedNode) {
        const textValue = typeof selectedNode.data.text === "string"
          ? selectedNode.data.text
          : String(selectedNode.data.text || "");
        setEditText(textValue);

        setLocalTags(
          selectedNode.data.metadata?.nodeData?.tags || selectedNode.data.metadata?.tags || []
        );
      } else {
        setEditText("");
        setLocalTags([]);
      }
    }, [selectedNode]);

    const handleTagUpdate = (tags: Tag[]) => {
      setLocalTags(tags);
      if (onUpdateNodeTags && selectedNode) {
        onUpdateNodeTags(selectedNode.id, tags);
      }
    };

    const hasAnalysisData =
      selectedNode.data.metadata?.analysisData &&
      Object.keys(selectedNode.data.metadata.analysisData).length > 0;

    const tabs = [
      { id: "details", label: "Details", icon: <Info className="w-4 h-4" /> },
      { id: "tags", label: "Tags", icon: <TagIcon className="w-4 h-4" /> },
      ...(hasAnalysisData
        ? [
            {
              id: "analysis",
              label: "Analysis",
              icon: <GitBranch className="w-4 h-4" />,
            },
          ]
        : []),
    ];

    const truncateText = (text: string | any, maxLength: number): string => {
      const safeText = typeof text === "string" ? text : String(text || "");
      if (safeText.length <= maxLength) return safeText;
      return safeText.substring(0, maxLength - 3) + "...";
    };

    const handleGenerateDialog = async (
      mode: GenerateMode = "recreate",
      customPromptText?: string,
      systemPrompt?: string
    ) => {
      try {
        setIsGenerating(true);
        setShowCustomPromptInput(false);

        const dialogPath = ignoreConnections
          ? {
              previous: [],
              next: [],
              current: {
                id: selectedNode.id,
                text: selectedNode.data.text,
                type: selectedNode.type,
                tags: selectedNode.data.metadata?.nodeData?.tags || [],
                severity: "info",
              },
            }
          : findDialogPaths(selectedNode.id, nodes as any, connections);

        const characterContext = getCharacterContext(dialogPath);

        const context: GenerateContext = {
          dialogChain: {
            previous: ignoreConnections
              ? []
              : (dialogPath.previous.map((n) => ({
                  ...n,
                  position: { x: 0, y: 0 },
                  data: {
                    text: n.text,
                    type: n.type,
                    metadata: { tags: n.tags as any },
                  },
                })) as any),
            current: {
              ...dialogPath.current,
              position: { x: 0, y: 0 },
              data: {
                text: dialogPath.current.text,
                type: dialogPath.current.type,
                metadata: { tags: dialogPath.current.tags as any },
              },
            } as any,
            next: ignoreConnections
              ? []
              : (dialogPath.next.map((n) => ({
                  ...n,
                  position: { x: 0, y: 0 },
                  data: {
                    text: n.text,
                    type: n.type,
                    metadata: { tags: n.tags as any },
                  },
                })) as any),
          },
          current: {
            nodeId: selectedNode.id,
            type: selectedNode.type,
            text: typeof selectedNode.data.text === "string"
              ? selectedNode.data.text
              : String(selectedNode.data.text || ""),
            tags: (selectedNode.data.metadata?.nodeData?.tags || []) as any,
          },
          previous: ignoreConnections
            ? []
            : dialogPath.previous.map((node) => ({
                nodeId: node.id,
                type: node.type,
                text: node.text,
                tags: node.tags as any,
              })),
          next: ignoreConnections
            ? []
            : dialogPath.next.map((node) => ({
                nodeId: node.id,
                type: node.type,
                text: node.text,
                tags: node.tags as any,
              })),
          characterInfo: characterContext,
          ignoreConnections: ignoreConnections,
        };

        let generatedText;

        switch (mode) {
          case "improve":
            const nodeTextForImprove = typeof selectedNode.data.text === "string"
              ? selectedNode.data.text
              : String(selectedNode.data.text || "");
            generatedText = await ollamaService.improveDialog(
              selectedNode.type,
              context as any,
              nodeTextForImprove,
              ignoreConnections
            );
            break;

          case "custom":
            if (!customPromptText) {
              throw new Error("Custom prompt text is required");
            }
            logger.debug("Custom prompt with params:", {
              type: selectedNode.type,
              customPromptText,
              systemPrompt,
              ignoreConnections,
            });
            generatedText = await ollamaService.generateWithCustomPrompt(
              selectedNode.type,
              context as any,
              customPromptText,
              systemPrompt,
              ignoreConnections
            );
            break;

          case "recreate":
          default:
            generatedText = await ollamaService.generateDialog(
              selectedNode.type,
              context as any,
              false,
              systemPrompt,
              ignoreConnections
            );
        }

        if (generatedText) {
          onEdit(selectedNode.id, generatedText);

          if (onScrollToNode) {
            setTimeout(() => {
              onScrollToNode(selectedNode.id);
            }, 100);
          }
        }
      } catch (error) {
        logger.error("Error generating dialog:", error);
        setGenerationError(error instanceof Error ? error.message : "Connection error occurred");
        setTimeout(() => setGenerationError(""), 5000);
      } finally {
        setIsGenerating(false);
      }
    };

    const generateAlternatives = async (count: number) => {
      try {
        setIsGenerating(true);
        setShowAlternativesInput(false);

        const dialogPath = findDialogPaths(selectedNode.id, nodes as any, connections);
        const characterContext = getCharacterContext(dialogPath);

        const context: GenerateContext = {
          dialogChain: {
            previous: dialogPath.previous.map((n) => ({
              ...n,
              position: { x: 0, y: 0 },
              data: {
                text: n.text,
                type: n.type,
                metadata: { tags: n.tags as any },
              },
            })) as any,
            current: {
              ...dialogPath.current,
              position: { x: 0, y: 0 },
              data: {
                text: dialogPath.current.text,
                type: dialogPath.current.type,
                metadata: { tags: dialogPath.current.tags as any },
              },
            } as any,
            next: dialogPath.next.map((n) => ({
              ...n,
              position: { x: 0, y: 0 },
              data: {
                text: n.text,
                type: n.type,
                metadata: { tags: n.tags as any },
              },
            })) as any,
          },
          current: {
            nodeId: selectedNode.id,
            type: selectedNode.type,
            text: typeof selectedNode.data.text === "string"
              ? selectedNode.data.text
              : String(selectedNode.data.text || ""),
            tags: (selectedNode.data.metadata?.nodeData?.tags || []) as any,
          },
          previous: dialogPath.previous.map((node) => ({
            nodeId: node.id,
            type: node.type,
            text: node.text,
            tags: node.tags as any,
          })),
          next: dialogPath.next.map((node) => ({
            nodeId: node.id,
            type: node.type,
            text: node.text,
            tags: node.tags as any,
          })),
          characterInfo: characterContext,
        };

        const generatedAlternatives = await Promise.all(
          Array(count)
            .fill(null)
            .map(() => ollamaService.generateDialog(selectedNode.type, context as any))
        );

        setAlternatives(generatedAlternatives.filter(Boolean) as string[]);
        setShowAlternatives(true);

        if (onScrollToNode) {
          setTimeout(() => {
            try {
              onScrollToNode(selectedNode.id);
            } catch (error) {
              logger.error("Error centering node:", error);
            }
          }, 100);
        }
      } catch (error) {
        logger.error("Error generating alternatives:", error);
        setGenerationError(error instanceof Error ? error.message : "Connection error occurred");
        setTimeout(() => setGenerationError(""), 5000);
      } finally {
        setIsGenerating(false);
      }
    };

    const isNPCDialog = (type: DialogNodeType) => type === "npcDialog";

    const handleIgnoreConnectionsChange = (newValue: boolean) => {
      setIgnoreConnections(newValue);

      const event = new CustomEvent("ignore-connections-changed", {
        detail: { ignoreConnections: newValue },
      });
      document.dispatchEvent(event);

      logger.debug(`[NodeSelectionPanel] Ignore Connections value changed: ${newValue}`);
    };

    return (
      <div className="h-full NodeSelectionPanel" ref={panelRef}>
        <div
          className="flex backdrop-blur-sm"
          style={{
            borderBottom: `1px solid ${rightPanelTheme.header.border}`,
            background: "rgba(13, 13, 15, 0.3)",
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as PanelTab)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all duration-200 relative"
              style={{
                color:
                activeTab === tab.id
                    ? rightPanelTheme.tabs.active.text
                    : rightPanelTheme.tabs.default.text,
                borderBottom:
                  activeTab === tab.id
                    ? `2px solid ${rightPanelTheme.tabs.active.border}`
                    : "2px solid transparent",
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.color = rightPanelTheme.tabs.default.hover;
                  e.currentTarget.style.background = rightPanelTheme.button.hover.background;
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.color = rightPanelTheme.tabs.default.text;
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              <span style={{ width: "14px", height: "14px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {React.cloneElement(tab.icon, { className: "w-3.5 h-3.5" })}
              </span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === "details" && (
            <div className="p-2.5 space-y-2.5">
              <div
                className="rounded-md p-2.5 border relative backdrop-blur-md"
                style={{
                  background: rightPanelTheme.selectionPanel.card.background,
                  borderColor: rightPanelTheme.selectionPanel.card.border,
                  backdropFilter: rightPanelTheme.selectionPanel.card.backdropFilter,
                  boxShadow: "0 2px 8px -4px rgba(0, 0, 0, 0.2)",
                }}
              >
                <div className="flex justify-between items-center mb-1.5">
                  <h3
                    className="text-xs font-medium"
                    style={{ color: rightPanelTheme.selectionPanel.card.header.text }}
                  >
                    Dialog Content
                  </h3>
                  <div className="flex space-x-0.5">
                    {!isEditing && (
                      <>
                        <button
                          onClick={() => {
                            const textValue = typeof selectedNode.data.text === "string"
                              ? selectedNode.data.text
                              : String(selectedNode.data.text || "");
                            setEditText(textValue);
                            setIsEditing(true);
                          }}
                          className="p-1 rounded transition-all duration-200"
                          style={{
                            color: rightPanelTheme.button.default.text,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background =
                              rightPanelTheme.button.hover.background;
                            e.currentTarget.style.color = rightPanelTheme.button.hover.text;
                            e.currentTarget.style.transform = "scale(1.05)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.color = rightPanelTheme.button.default.text;
                            e.currentTarget.style.transform = "scale(1)";
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.background = rightPanelTheme.button.hover.background;
                            e.currentTarget.style.outline = `2px solid ${rightPanelTheme.tabs.active.border}40`;
                            e.currentTarget.style.outlineOffset = "2px";
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.outline = "none";
                          }}
                          title="Edit content"
                        >
                          <Edit className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => onDelete(selectedNode.id)}
                          className="p-1 rounded transition-all duration-200"
                          style={{
                            color: rightPanelTheme.button.danger.text,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = rightPanelTheme.button.danger.background;
                            e.currentTarget.style.color = rightPanelTheme.button.danger.hover;
                            e.currentTarget.style.transform = "scale(1.05)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.color = rightPanelTheme.button.danger.text;
                            e.currentTarget.style.transform = "scale(1)";
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.background = rightPanelTheme.button.danger.background;
                            e.currentTarget.style.outline = `2px solid ${rightPanelTheme.button.danger.hover}40`;
                            e.currentTarget.style.outlineOffset = "2px";
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.outline = "none";
                          }}
                          title="Delete node"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <div className="relative z-10">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation();

                        if (e.key === "Escape") {
                          setIsEditing(false);
                          const textValue = typeof selectedNode.data.text === "string"
                            ? selectedNode.data.text
                            : String(selectedNode.data.text || "");
                          setEditText(textValue);
                        }
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      className="w-full min-h-[80px] p-2 rounded-md text-xs 
                      resize-none transition-all mb-1.5 whitespace-pre-wrap focus:outline-none backdrop-blur-sm"
                      style={{
                        background: rightPanelTheme.section.background,
                        color: rightPanelTheme.content.text.primary,
                        border: `1px solid ${rightPanelTheme.section.border}`,
                        boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = rightPanelTheme.tabs.active.border;
                        e.target.style.boxShadow = `0 0 0 2px ${rightPanelTheme.tabs.active.border}40`;
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = rightPanelTheme.section.border;
                        e.target.style.boxShadow = "0 1px 4px -2px rgba(0, 0, 0, 0.15)";
                      }}
                      placeholder="Enter dialog text..."
                      autoFocus
                    />
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsEditing(false);
                          const textValue = typeof selectedNode.data.text === "string"
                            ? selectedNode.data.text
                            : String(selectedNode.data.text || "");
                          setEditText(textValue);
                        }}
                        className="px-2 py-1 text-xs font-medium rounded transition-all duration-200 backdrop-blur-sm border"
                        style={{
                          background: rightPanelTheme.section.background,
                          color: rightPanelTheme.content.text.secondary,
                          borderColor: rightPanelTheme.section.border,
                          boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = rightPanelTheme.button.hover.background;
                          e.currentTarget.style.color = rightPanelTheme.content.text.primary;
                          e.currentTarget.style.borderColor = rightPanelTheme.button.hover.border;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = rightPanelTheme.section.background;
                          e.currentTarget.style.color = rightPanelTheme.content.text.secondary;
                          e.currentTarget.style.borderColor = rightPanelTheme.section.border;
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = rightPanelTheme.tabs.active.border;
                          e.currentTarget.style.boxShadow = `0 0 0 2px ${rightPanelTheme.tabs.active.border}40`;
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = rightPanelTheme.section.border;
                          e.currentTarget.style.boxShadow = "0 1px 4px -2px rgba(0, 0, 0, 0.15)";
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const nodeTextValue = typeof selectedNode.data.text === "string"
                            ? selectedNode.data.text
                            : String(selectedNode.data.text || "");
                          if (editText.trim() !== nodeTextValue.trim()) {
                            onEdit(selectedNode.id, editText);
                          }
                          setIsEditing(false);
                        }}
                        className="px-2 py-1 text-xs font-medium rounded transition-all duration-200 backdrop-blur-sm"
                        style={{
                          background: rightPanelTheme.tabs.active.border,
                          color: rightPanelTheme.tabs.active.text,
                          boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = "0.9";
                          e.currentTarget.style.transform = "scale(1.02)";
                          e.currentTarget.style.boxShadow = "0 2px 8px -4px rgba(0, 0, 0, 0.2)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = "1";
                          e.currentTarget.style.transform = "scale(1)";
                          e.currentTarget.style.boxShadow = "0 1px 4px -2px rgba(0, 0, 0, 0.15)";
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.boxShadow = `0 0 0 2px ${rightPanelTheme.tabs.active.border}60`;
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.boxShadow = "0 1px 4px -2px rgba(0, 0, 0, 0.15)";
                        }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="prose prose-sm prose-invert max-w-none">
                    <p
                      id="node-content-text"
                      className="whitespace-pre-wrap text-sm leading-relaxed"
                      style={{ color: rightPanelTheme.content.text.secondary }}
                    >
                      {typeof selectedNode?.data?.text === "string"
                        ? selectedNode.data.text
                        : selectedNode?.data?.text != null && typeof selectedNode.data.text === "object"
                          ? "[Invalid text content]"
                          : String(selectedNode?.data?.text || "")}
                    </p>
                  </div>
                )}
              </div>

              <ValidationScoreSection validationResult={validationResult || undefined} />

              <div
                className="rounded-md border backdrop-blur-md"
                style={{
                  background: rightPanelTheme.selectionPanel.card.background,
                  borderColor: rightPanelTheme.selectionPanel.card.border,
                  backdropFilter: rightPanelTheme.selectionPanel.card.backdropFilter,
                  boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
                }}
              >
                <div
                  className="flex items-center justify-between px-2.5 py-2 border-b"
                  style={{ borderColor: rightPanelTheme.header.border }}
                >
                  <div className="flex items-center gap-1.5">
                    <Bot
                      className="w-3 h-3"
                      style={{ color: rightPanelTheme.header.text.muted }}
                    />
                    <h3
                      className="text-xs font-medium"
                      style={{ color: rightPanelTheme.selectionPanel.card.header.text }}
                    >
                      AI Assistant
                    </h3>
                  </div>
                  {isGenerating && (
                    <div
                      className="flex items-center gap-1 text-xs"
                      style={{ color: rightPanelTheme.header.text.muted }}
                    >
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      <span>Generating...</span>
                    </div>
                  )}
                </div>

                <div className="p-2.5">
                  <div
                    className="mb-2 p-2 rounded-md border backdrop-blur-sm"
                    style={{
                      background: rightPanelTheme.section.background,
                      borderColor: rightPanelTheme.section.border,
                      boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Link2Off
                          className="w-4 h-4"
                          style={{
                            color: ignoreConnections
                              ? rightPanelTheme.tabs.active.text
                              : rightPanelTheme.header.text.muted,
                          }}
                        />
                        <span
                          className="text-sm"
                          style={{ color: rightPanelTheme.content.text.primary }}
                        >
                          Ignore Connections
                        </span>
                      </div>
                      <button
                        onClick={() => handleIgnoreConnectionsChange(!ignoreConnections)}
                        className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none"
                        style={{
                          background: ignoreConnections
                            ? rightPanelTheme.tabs.active.border
                            : rightPanelTheme.button.default.background,
                        }}
                      >
                        <span
                          className="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                          style={{
                            transform: ignoreConnections ? "translateX(1.25rem)" : "translateX(0.125rem)",
                          }}
                        />
                      </button>
                    </div>
                    <p
                      className="mt-1 text-[9px] leading-tight"
                      style={{ color: rightPanelTheme.content.text.muted }}
                    >
                      AI generates only for selected node, ignoring connections.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <button
                      onClick={() => handleGenerateDialog("improve")}
                      disabled={isGenerating}
                      className="flex items-center gap-1.5 p-2 rounded-md border w-full transition-all duration-200 backdrop-blur-sm"
                      style={{
                        background: rightPanelTheme.selectionPanel.card.background,
                        borderColor: rightPanelTheme.selectionPanel.card.border,
                        opacity: isGenerating ? 0.5 : 1,
                        cursor: isGenerating ? "not-allowed" : "pointer",
                        boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
                      }}
                      onMouseEnter={(e) => {
                        if (!isGenerating) {
                          e.currentTarget.style.background = rightPanelTheme.button.hover.background;
                          e.currentTarget.style.borderColor = rightPanelTheme.button.hover.border;
                          e.currentTarget.style.transform = "translateY(-1px)";
                          e.currentTarget.style.boxShadow = "0 2px 8px -4px rgba(0, 0, 0, 0.2)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isGenerating) {
                          e.currentTarget.style.background = rightPanelTheme.selectionPanel.card.background;
                          e.currentTarget.style.borderColor = rightPanelTheme.selectionPanel.card.border;
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.boxShadow = "0 1px 4px -2px rgba(0, 0, 0, 0.15)";
                        }
                      }}
                      onFocus={(e) => {
                        if (!isGenerating) {
                          e.currentTarget.style.borderColor = rightPanelTheme.tabs.active.border;
                          e.currentTarget.style.boxShadow = `0 0 0 2px ${rightPanelTheme.tabs.active.border}40`;
                        }
                      }}
                      onBlur={(e) => {
                        if (!isGenerating) {
                          e.currentTarget.style.borderColor = rightPanelTheme.selectionPanel.card.border;
                          e.currentTarget.style.boxShadow = "0 1px 4px -2px rgba(0, 0, 0, 0.15)";
                        }
                      }}
                    >
                      <div
                        className="p-1 rounded"
                        style={{
                          background: `${rightPanelTheme.tabs.active.text}1A`,
                          color: rightPanelTheme.tabs.active.text,
                        }}
                      >
                        <Sparkles className="w-3 h-3" />
                      </div>
                      <div className="text-left flex-1">
                        <div
                          className="text-xs font-medium"
                          style={{ color: rightPanelTheme.content.text.primary }}
                        >
                          Improve
                        </div>
                        <div
                          className="text-[10px]"
                          style={{ color: rightPanelTheme.content.text.muted }}
                        >
                          Enhance the current dialog
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleGenerateDialog("recreate")}
                      disabled={isGenerating}
                      className="flex items-center gap-1.5 p-2 rounded-md border w-full transition-all duration-200 backdrop-blur-sm"
                      style={{
                        background: rightPanelTheme.selectionPanel.card.background,
                        borderColor: rightPanelTheme.selectionPanel.card.border,
                        opacity: isGenerating ? 0.5 : 1,
                        cursor: isGenerating ? "not-allowed" : "pointer",
                        boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
                      }}
                      onMouseEnter={(e) => {
                        if (!isGenerating) {
                          e.currentTarget.style.background = rightPanelTheme.button.hover.background;
                          e.currentTarget.style.borderColor = rightPanelTheme.button.hover.border;
                          e.currentTarget.style.transform = "translateY(-1px)";
                          e.currentTarget.style.boxShadow = "0 2px 8px -4px rgba(0, 0, 0, 0.2)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isGenerating) {
                          e.currentTarget.style.background = rightPanelTheme.selectionPanel.card.background;
                          e.currentTarget.style.borderColor = rightPanelTheme.selectionPanel.card.border;
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.boxShadow = "0 1px 4px -2px rgba(0, 0, 0, 0.15)";
                        }
                      }}
                      onFocus={(e) => {
                        if (!isGenerating) {
                          e.currentTarget.style.borderColor = rightPanelTheme.tabs.active.border;
                          e.currentTarget.style.boxShadow = `0 0 0 2px ${rightPanelTheme.tabs.active.border}40`;
                        }
                      }}
                      onBlur={(e) => {
                        if (!isGenerating) {
                          e.currentTarget.style.borderColor = rightPanelTheme.selectionPanel.card.border;
                          e.currentTarget.style.boxShadow = "0 1px 4px -2px rgba(0, 0, 0, 0.15)";
                        }
                      }}
                    >
                      <div
                        className="p-1 rounded"
                        style={{
                          background: `${rightPanelTheme.tabs.active.text}1A`,
                          color: rightPanelTheme.tabs.active.text,
                        }}
                      >
                        <RefreshCw className="w-3 h-3" />
                      </div>
                      <div className="text-left flex-1">
                        <div
                          className="text-xs font-medium"
                          style={{ color: rightPanelTheme.content.text.primary }}
                        >
                          Recreate
                        </div>
                        <div
                          className="text-[10px]"
                          style={{ color: rightPanelTheme.content.text.muted }}
                        >
                          Generate new version
                        </div>
                      </div>
                    </button>
                  </div>

                  <div className="space-y-1 mt-2">
                    <button
                      onClick={() => setShowAlternativesInput(true)}
                      disabled={isGenerating}
                      className="flex items-center gap-1.5 p-2 rounded-md border w-full transition-all duration-200 backdrop-blur-sm"
                      style={{
                        background: rightPanelTheme.selectionPanel.card.background,
                        borderColor: rightPanelTheme.selectionPanel.card.border,
                        boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
                      }}
                      onMouseEnter={(e) => {
                        if (!isGenerating) {
                          e.currentTarget.style.background = rightPanelTheme.button.hover.background;
                          e.currentTarget.style.borderColor = rightPanelTheme.button.hover.border;
                          e.currentTarget.style.transform = "translateY(-1px)";
                          e.currentTarget.style.boxShadow = "0 2px 8px -4px rgba(0, 0, 0, 0.2)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isGenerating) {
                          e.currentTarget.style.background = rightPanelTheme.selectionPanel.card.background;
                          e.currentTarget.style.borderColor = rightPanelTheme.selectionPanel.card.border;
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.boxShadow = "0 1px 4px -2px rgba(0, 0, 0, 0.15)";
                        }
                      }}
                      onFocus={(e) => {
                        if (!isGenerating) {
                          e.currentTarget.style.borderColor = rightPanelTheme.tabs.active.border;
                          e.currentTarget.style.boxShadow = `0 0 0 2px ${rightPanelTheme.tabs.active.border}40`;
                        }
                      }}
                      onBlur={(e) => {
                        if (!isGenerating) {
                          e.currentTarget.style.borderColor = rightPanelTheme.selectionPanel.card.border;
                          e.currentTarget.style.boxShadow = "0 1px 4px -2px rgba(0, 0, 0, 0.15)";
                        }
                      }}
                    >
                      <div
                        className="p-1 rounded"
                        style={{
                          background: `${rightPanelTheme.tabs.active.text}1A`,
                          color: rightPanelTheme.tabs.active.text,
                        }}
                      >
                        <Copy className="w-3 h-3" />
                      </div>
                      <div className="flex-1 text-left">
                        <div
                          className="text-xs font-medium"
                          style={{ color: rightPanelTheme.content.text.primary }}
                        >
                          Generate Alternatives
                        </div>
                        <div
                          className="text-[10px]"
                          style={{ color: rightPanelTheme.content.text.muted }}
                        >
                          Create multiple versions to choose from
                        </div>
                      </div>
                      <ChevronRight
                        className="w-3 h-3 transition-all flex-shrink-0"
                        style={{ color: rightPanelTheme.content.text.muted }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = rightPanelTheme.content.text.secondary;
                          e.currentTarget.style.transform = "translateX(2px)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = rightPanelTheme.content.text.muted;
                          e.currentTarget.style.transform = "translateX(0)";
                        }}
                      />
                    </button>

                    <button
                      onClick={() => setShowCustomPromptInput(true)}
                      disabled={isGenerating}
                      className="flex items-center gap-1.5 p-2 rounded-md border w-full transition-all duration-200 backdrop-blur-sm"
                      style={{
                        background: rightPanelTheme.selectionPanel.card.background,
                        borderColor: rightPanelTheme.selectionPanel.card.border,
                        boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
                      }}
                      onMouseEnter={(e) => {
                        if (!isGenerating) {
                          e.currentTarget.style.background = rightPanelTheme.button.hover.background;
                          e.currentTarget.style.borderColor = rightPanelTheme.button.hover.border;
                          e.currentTarget.style.transform = "translateY(-1px)";
                          e.currentTarget.style.boxShadow = "0 2px 8px -4px rgba(0, 0, 0, 0.2)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isGenerating) {
                          e.currentTarget.style.background = rightPanelTheme.selectionPanel.card.background;
                          e.currentTarget.style.borderColor = rightPanelTheme.selectionPanel.card.border;
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.boxShadow = "0 1px 4px -2px rgba(0, 0, 0, 0.15)";
                        }
                      }}
                      onFocus={(e) => {
                        if (!isGenerating) {
                          e.currentTarget.style.borderColor = rightPanelTheme.tabs.active.border;
                          e.currentTarget.style.boxShadow = `0 0 0 2px ${rightPanelTheme.tabs.active.border}40`;
                        }
                      }}
                      onBlur={(e) => {
                        if (!isGenerating) {
                          e.currentTarget.style.borderColor = rightPanelTheme.selectionPanel.card.border;
                          e.currentTarget.style.boxShadow = "0 1px 4px -2px rgba(0, 0, 0, 0.15)";
                        }
                      }}
                    >
                      <div
                        className="p-1 rounded"
                        style={{
                          background: `${rightPanelTheme.tabs.active.text}1A`,
                          color: rightPanelTheme.tabs.active.text,
                        }}
                      >
                        <Edit className="w-3 h-3" />
                      </div>
                      <div className="flex-1 text-left">
                        <div
                          className="text-xs font-medium"
                          style={{ color: rightPanelTheme.content.text.primary }}
                        >
                          Custom Prompt
                      </div>
                        <div
                          className="text-[10px]"
                          style={{ color: rightPanelTheme.content.text.muted }}
                        >
                          Use your own instructions
                        </div>
                      </div>
                      <ChevronRight
                        className="w-3 h-3 transition-all flex-shrink-0"
                        style={{ color: rightPanelTheme.content.text.muted }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = rightPanelTheme.content.text.secondary;
                          e.currentTarget.style.transform = "translateX(2px)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = rightPanelTheme.content.text.muted;
                          e.currentTarget.style.transform = "translateX(0)";
                        }}
                      />
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div
                  className="rounded-md p-2.5 border backdrop-blur-md"
                  style={{
                    background: rightPanelTheme.selectionPanel.card.background,
                    borderColor: rightPanelTheme.selectionPanel.card.border,
                    backdropFilter: rightPanelTheme.selectionPanel.card.backdropFilter,
                    boxShadow: "0 2px 8px -4px rgba(0, 0, 0, 0.2)",
                  }}
                >
                  <h3
                    className="text-xs font-medium mb-2"
                    style={{
                      color: rightPanelTheme.selectionPanel.card.header.text,
                    }}
                  >
                    Previous
                  </h3>
                  <div className="space-y-1.5">
                    {connections
                      .filter((conn) => conn.target === selectedNode.id)
                      .map((conn) => {
                        const sourceNode = nodes.find((n) => n.id === conn.source);
                        return sourceNode ? (
                          <button
                            key={`${selectedNode.id}-prev-${conn.source}-${conn.id || ""}`}
                            onClick={() => {
                              onSelectNode(sourceNode.id);
                              if (onScrollToNode) {
                                onScrollToNode(sourceNode.id);
                              }
                            }}
                            className="w-full p-1.5 rounded-md transition-all duration-200 group backdrop-blur-sm border"
                            style={{
                              background: rightPanelTheme.selectionPanel.navigation.node.background,
                              borderColor: rightPanelTheme.selectionPanel.card.border,
                              boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = rightPanelTheme.button.hover.background;
                              e.currentTarget.style.borderColor = rightPanelTheme.button.hover.border;
                              e.currentTarget.style.transform = "translateY(-1px)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = rightPanelTheme.selectionPanel.navigation.node.background;
                              e.currentTarget.style.borderColor = rightPanelTheme.selectionPanel.card.border;
                              e.currentTarget.style.transform = "translateY(0)";
                            }}
                          >
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{
                                  background: isNPCDialog(sourceNode.type)
                                    ? rightPanelTheme.selectionPanel.navigation.node.indicator.npc
                                    : rightPanelTheme.selectionPanel.navigation.node.indicator
                                        .player,
                                }}
                              />
                              <span
                                className="text-xs truncate"
                                style={{
                                  color: rightPanelTheme.selectionPanel.navigation.node.text,
                                }}
                              >
                                {truncateText(sourceNode.data.text, 30)}
                              </span>
                            </div>
                          </button>
                        ) : null;
                      })}
                  </div>
                </div>

                <div
                  className="rounded-lg p-4 border backdrop-blur-sm"
                  style={{
                    background: rightPanelTheme.selectionPanel.card.background,
                    borderColor: rightPanelTheme.selectionPanel.card.border,
                    backdropFilter: rightPanelTheme.selectionPanel.card.backdropFilter,
                  }}
                >
                  <h3
                    className="text-xs font-medium mb-2"
                    style={{
                      color: rightPanelTheme.selectionPanel.card.header.text,
                    }}
                  >
                    Next
                  </h3>
                  <div className="space-y-1.5">
                    {connections
                      .filter((conn) => conn.source === selectedNode.id)
                      .map((conn) => {
                        const targetNode = nodes.find((n) => n.id === conn.target);
                        return targetNode ? (
                          <button
                            key={`${selectedNode.id}-next-${conn.target}-${conn.id || ""}`}
                            onClick={() => {
                              onSelectNode(targetNode.id);
                              if (onScrollToNode) {
                                onScrollToNode(targetNode.id);
                              }
                            }}
                            className={`
                            w-full p-2 rounded-md transition-colors group
                            hover:bg-opacity-80 hover:border-primary/30
                          `}
                            style={{
                              background: rightPanelTheme.selectionPanel.navigation.node.background,
                            }}
                          >
                            <div className="flex items-center space-x-2">
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{
                                  background: isNPCDialog(targetNode.type)
                                    ? rightPanelTheme.selectionPanel.navigation.node.indicator.npc
                                    : rightPanelTheme.selectionPanel.navigation.node.indicator
                                        .player,
                                }}
                              />
                              <span
                                className="text-sm truncate transition-colors group-hover:text-opacity-80"
                                style={{
                                  color: rightPanelTheme.selectionPanel.navigation.node.text,
                                }}
                              >
                                {truncateText(targetNode.data.text, 30)}
                              </span>
                            </div>
                          </button>
                        ) : null;
                      })}
                  </div>
                </div>
              </div>

              <div
                className="mt-2.5 rounded-md p-2.5 border backdrop-blur-md"
                style={{
                  background: rightPanelTheme.selectionPanel.card.background,
                  borderColor: rightPanelTheme.selectionPanel.card.border,
                  backdropFilter: rightPanelTheme.selectionPanel.card.backdropFilter,
                  boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <History
                      className="w-3 h-3"
                      style={{ color: rightPanelTheme.header.text.muted }}
                    />
                    <h3
                      className="text-xs font-medium"
                      style={{ color: rightPanelTheme.selectionPanel.card.header.text }}
                    >
                      History
                    </h3>
                  </div>
                  <div className="flex gap-2">
                    {(nodeHistory as any[]).filter((item: any) => item.nodeId === selectedNode.id).length > 0 && (
                      <button
                        onClick={() => {
                          logger.debug(
                            "[NodeSelectionPanel] Clearing node history for:",
                            selectedNode.id
                          );
                          (clearNodeHistory as any)(selectedNode.id);
                        }}
                        className="text-[10px] transition-all duration-200 flex items-center gap-1 px-1.5 py-1 rounded-md backdrop-blur-sm"
                        style={{
                          color: rightPanelTheme.content.text.muted,
                          background: "transparent",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = rightPanelTheme.button.hover.background;
                          e.currentTarget.style.color = rightPanelTheme.content.text.primary;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.color = rightPanelTheme.content.text.muted;
                        }}
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                        <span>Clear Node History</span>
                      </button>
                    )}
                    {promptHistory.filter((item) => item.nodeId === selectedNode.id).length > 0 && (
                      <button
                        onClick={() => {
                  logger.debug(
                    "[NodeSelectionPanel] Clearing AI history for node:",
                    selectedNode.id
                  );
                  (clearNodeAIHistory as any)(selectedNode.id);
                        }}
                        className="text-[10px] transition-all duration-200 flex items-center gap-1 px-1.5 py-1 rounded-md backdrop-blur-sm"
                        style={{
                          color: rightPanelTheme.content.text.muted,
                          background: "transparent",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = rightPanelTheme.button.hover.background;
                          e.currentTarget.style.color = rightPanelTheme.content.text.primary;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.color = rightPanelTheme.content.text.muted;
                        }}
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                        <span>Clear AI History</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-0.5 max-h-60 overflow-y-auto pr-2">
                  {promptHistory
                    .filter((item) => item.nodeId === selectedNode.id)
                    .map((item) => (
                      <div
                        key={item.id}
                        className={`group border-l-2 transition-all ${
                          showPromptDetails === item.id
                            ? "bg-gray-800/40 border-violet-500/50"
                            : "border-transparent hover:border-gray-700"
                        }`}
                      >
                        <button
                          onClick={() =>
                            setShowPromptDetails(showPromptDetails === item.id ? null : item.id)
                          }
                          className="w-full flex items-center gap-2 py-2 px-3 text-left"
                        >
                          <div
                            className={`w-1 h-1 rounded-full ${
                              item.success ? "bg-emerald-500" : "bg-red-500"
                            }`}
                          />
                          <span className="text-xs text-gray-400 flex-1 truncate">
                            {truncateText(item.result, 50)}
                          </span>
                          <span className="text-[10px] text-gray-500">
                            {formatDistanceToNow(item.timestamp)} ago
                          </span>
                          <ChevronRight
                            className={`w-3.5 h-3.5 text-gray-500 transition-transform ${
                              showPromptDetails === item.id ? "rotate-90" : ""
                            }`}
                          />
                        </button>

                        {showPromptDetails === item.id && (
                          <div className="px-3 pb-2 animate-in fade-in duration-200">
                            <div className="pl-3 ml-0.5 border-l border-gray-800">
                              <p className="text-xs text-gray-400 mb-3 whitespace-pre-wrap">
                                {item.result}
                              </p>
                              <div className="flex flex-col gap-3">
                                <div className="text-[10px] text-gray-600">
                                  <span className="font-medium">Prompt:</span>
                                  <span className="ml-1">{truncateText(item.prompt, 100)}</span>
                                </div>
                                <button
                                  onClick={() => {
                                    onEdit(selectedNode.id, item.result);
                                    setShowPromptDetails(null);
                                  }}
                                  className="flex items-center gap-1.5 text-[10px] text-violet-400 hover:text-violet-300 transition-colors"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  <span>Reuse Result</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                  {promptHistory.filter((item) => item.nodeId === selectedNode.id).length === 0 && (
                    <div className="py-6 text-center">
                      <p className="text-xs text-gray-500">No history yet for this node</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "tags" && selectedNode && (
            <div className="p-4">
              <TagSection
                tags={localTags}
                onUpdateTags={handleTagUpdate}
                projectType={projectType}
              />
            </div>
          )}

          {activeTab === "analysis" && (
            <div className="p-4">
              <DialogAnalysis
                analysis={(selectedNode.data.metadata?.analysisData as DialogAnalysisData) || null}
              />
            </div>
          )}
        </div>

        {generationError && (
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-red-500/90 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg">
            {generationError}
          </div>
        )}

        {false && isEditing && (
          <div
            className="fixed inset-0 flex items-center justify-center z-30"
            style={{
              background: rightPanelTheme.selectionPanel.modal.overlay,
              backdropFilter: rightPanelTheme.selectionPanel.modal.backdropFilter,
            }}
          >
            <div
              className="max-w-md w-full mx-4 rounded-xl p-6 shadow-2xl border animate-in fade-in slide-in-from-bottom-4 duration-200"
              style={{
                background: rightPanelTheme.selectionPanel.modal.background,
                borderColor: rightPanelTheme.selectionPanel.modal.border,
              }}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-200">Edit Dialog Content</h3>
                <button
                  onClick={() => setIsEditing(false)}
                  className="p-2 rounded-full hover:bg-gray-800/50 text-gray-400 hover:text-gray-200 transition-all"
                >
                  <Edit className="h-5 w-5" />
                </button>
              </div>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full h-48 bg-gray-900/50 text-gray-200 p-4 rounded-lg mb-4 text-sm border border-gray-800 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 focus:outline-none resize-none transition-all"
                placeholder="Enter dialog text..."
                autoFocus
              />
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onEdit(selectedNode.id, editText);
                    setIsEditing(false);
                  }}
                  className="px-4 py-2 bg-violet-500 text-white text-sm font-medium rounded-lg hover:bg-violet-600 transition-all"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {showAlternativesInput && (
          <div
            className="fixed inset-0 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
            style={{ background: rightPanelTheme.selectionPanel.modal.overlay }}
          >
            <div
              className="rounded-md border w-full max-w-[320px] shadow-xl backdrop-blur-md"
              style={{
                background: rightPanelTheme.selectionPanel.modal.background,
                borderColor: rightPanelTheme.selectionPanel.modal.border,
                backdropFilter: rightPanelTheme.selectionPanel.modal.backdropFilter,
              }}
            >
              <div
                className="h-11 px-3 border-b flex items-center justify-between backdrop-blur-sm"
                style={{
                  borderColor: rightPanelTheme.header.border,
                  background: "rgba(13, 13, 15, 0.3)",
                }}
              >
                <h3
                  className="text-xs font-medium"
                  style={{ color: rightPanelTheme.header.text.primary }}
                >
                  Generate Alternatives
                </h3>
                <button
                  onClick={() => setShowAlternativesInput(false)}
                  className="w-6 h-6 rounded-md flex items-center justify-center transition-colors"
                  style={{ color: rightPanelTheme.content.text.muted }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = rightPanelTheme.button.hover.background;
                    e.currentTarget.style.color = rightPanelTheme.content.text.primary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = rightPanelTheme.content.text.muted;
                  }}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="p-3 space-y-2.5">
                <div>
                  <label
                    className="block text-[10px] font-medium mb-1"
                    style={{ color: rightPanelTheme.content.text.secondary }}
                  >
                  Number of alternatives
                </label>
                <input
                  type="number"
                  value={alternativesCount}
                  onChange={(e) => setAlternativesCount(parseInt(e.target.value) || 1)}
                  min="1"
                  max="5"
                    className="w-full h-7 px-2 rounded-md text-xs transition-all focus:outline-none backdrop-blur-sm"
                    style={{
                      background: rightPanelTheme.section.background,
                      color: rightPanelTheme.content.text.primary,
                      border: `1px solid ${rightPanelTheme.section.border}`,
                      boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = rightPanelTheme.tabs.active.border;
                      e.target.style.boxShadow = `0 0 0 2px ${rightPanelTheme.tabs.active.border}40`;
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = rightPanelTheme.section.border;
                      e.target.style.boxShadow = "0 1px 4px -2px rgba(0, 0, 0, 0.15)";
                    }}
                />
              </div>
                <div className="flex justify-end gap-1.5 pt-1">
                <button
                  onClick={() => setShowAlternativesInput(false)}
                    className="h-7 px-2.5 rounded-md text-xs transition-all duration-200 backdrop-blur-sm border"
                    style={{
                      background: rightPanelTheme.section.background,
                      color: rightPanelTheme.content.text.secondary,
                      borderColor: rightPanelTheme.section.border,
                      boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = rightPanelTheme.button.hover.background;
                      e.currentTarget.style.color = rightPanelTheme.content.text.primary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = rightPanelTheme.section.background;
                      e.currentTarget.style.color = rightPanelTheme.content.text.secondary;
                    }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    generateAlternatives(alternativesCount);
                    setShowAlternativesInput(false);
                  }}
                  disabled={isGenerating}
                    className="h-7 px-2.5 rounded-md text-xs font-medium transition-all duration-200 backdrop-blur-sm"
                    style={{
                      background: rightPanelTheme.tabs.active.border,
                      color: rightPanelTheme.tabs.active.text,
                      opacity: isGenerating ? 0.5 : 1,
                      cursor: isGenerating ? "not-allowed" : "pointer",
                      boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
                    }}
                    onMouseEnter={(e) => {
                      if (!isGenerating) {
                        e.currentTarget.style.opacity = "0.9";
                        e.currentTarget.style.transform = "scale(1.02)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isGenerating) {
                        e.currentTarget.style.opacity = "1";
                        e.currentTarget.style.transform = "scale(1)";
                      }
                    }}
                >
                  Generate
                </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showCustomPromptInput && (
          <div
            className="fixed inset-0 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
            style={{ background: rightPanelTheme.selectionPanel.modal.overlay }}
          >
            <div
              className="rounded-md border w-full max-w-[360px] shadow-xl backdrop-blur-md"
              style={{
                background: rightPanelTheme.selectionPanel.modal.background,
                borderColor: rightPanelTheme.selectionPanel.modal.border,
                backdropFilter: rightPanelTheme.selectionPanel.modal.backdropFilter,
              }}
            >
              <div
                className="h-11 px-3 border-b flex items-center justify-between backdrop-blur-sm"
                style={{
                  borderColor: rightPanelTheme.header.border,
                  background: "rgba(13, 13, 15, 0.3)",
                }}
              >
                <h3
                  className="text-xs font-medium"
                  style={{ color: rightPanelTheme.header.text.primary }}
                >
                  Custom Prompt
                </h3>
                <button
                  onClick={() => setShowCustomPromptInput(false)}
                  className="w-6 h-6 rounded-md flex items-center justify-center transition-colors"
                  style={{ color: rightPanelTheme.content.text.muted }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = rightPanelTheme.button.hover.background;
                    e.currentTarget.style.color = rightPanelTheme.content.text.primary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = rightPanelTheme.content.text.muted;
                  }}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="p-3 space-y-2.5">
                <div>
                  <label
                    className="block text-[10px] font-medium mb-1"
                    style={{ color: rightPanelTheme.content.text.secondary }}
                  >
                  Your instructions
                </label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  rows={4}
                    className="w-full px-2 py-1.5 rounded-md text-xs transition-all focus:outline-none resize-none backdrop-blur-sm"
                    style={{
                      background: rightPanelTheme.section.background,
                      color: rightPanelTheme.content.text.primary,
                      border: `1px solid ${rightPanelTheme.section.border}`,
                      boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = rightPanelTheme.tabs.active.border;
                      e.target.style.boxShadow = `0 0 0 2px ${rightPanelTheme.tabs.active.border}40`;
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = rightPanelTheme.section.border;
                      e.target.style.boxShadow = "0 1px 4px -2px rgba(0, 0, 0, 0.15)";
                    }}
                  placeholder="Describe how you want the dialog to be generated..."
                />
              </div>
                <div className="flex justify-end gap-1.5 pt-1">
                <button
                  onClick={() => setShowCustomPromptInput(false)}
                    className="h-7 px-2.5 rounded-md text-xs transition-all duration-200 backdrop-blur-sm border"
                    style={{
                      background: rightPanelTheme.section.background,
                      color: rightPanelTheme.content.text.secondary,
                      borderColor: rightPanelTheme.section.border,
                      boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = rightPanelTheme.button.hover.background;
                      e.currentTarget.style.color = rightPanelTheme.content.text.primary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = rightPanelTheme.section.background;
                      e.currentTarget.style.color = rightPanelTheme.content.text.secondary;
                    }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleGenerateDialog("custom", customPrompt);
                    setShowCustomPromptInput(false);
                  }}
                  disabled={isGenerating || !customPrompt.trim()}
                    className="h-7 px-2.5 rounded-md text-xs font-medium transition-all duration-200 backdrop-blur-sm"
                    style={{
                      background: rightPanelTheme.tabs.active.border,
                      color: rightPanelTheme.tabs.active.text,
                      opacity: isGenerating || !customPrompt.trim() ? 0.5 : 1,
                      cursor: isGenerating || !customPrompt.trim() ? "not-allowed" : "pointer",
                      boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
                    }}
                    onMouseEnter={(e) => {
                      if (!isGenerating && customPrompt.trim()) {
                        e.currentTarget.style.opacity = "0.9";
                        e.currentTarget.style.transform = "scale(1.02)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isGenerating && customPrompt.trim()) {
                        e.currentTarget.style.opacity = "1";
                        e.currentTarget.style.transform = "scale(1)";
                      }
                    }}
                >
                  Generate
                </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showAlternatives && !isGenerating && alternatives.length > 0 && (
          <div
            className="fixed inset-0 flex items-center justify-center z-30 backdrop-blur-sm"
            style={{ background: rightPanelTheme.selectionPanel.modal.overlay }}
          >
            <div
              className="rounded-md border max-w-2xl w-full mx-4 shadow-xl backdrop-blur-md"
              style={{
                background: rightPanelTheme.selectionPanel.modal.background,
                borderColor: rightPanelTheme.selectionPanel.modal.border,
                backdropFilter: rightPanelTheme.selectionPanel.modal.backdropFilter,
              }}
            >
              <div
                className="h-11 px-3 border-b flex items-center justify-between backdrop-blur-sm"
                style={{
                  borderColor: rightPanelTheme.header.border,
                  background: "rgba(13, 13, 15, 0.3)",
                }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="p-1.5 rounded-md"
                    style={{
                      background: rightPanelTheme.tabs.active.border + "20",
                      color: rightPanelTheme.tabs.active.text,
                    }}
                  >
                    <Copy className="w-3 h-3" />
                  </div>
                  <div>
                    <h3
                      className="text-xs font-medium"
                      style={{ color: rightPanelTheme.header.text.primary }}
                    >
                      Generated Alternatives
                    </h3>
                    <p
                      className="text-[10px]"
                      style={{ color: rightPanelTheme.header.text.muted }}
                    >
                      Select the best version
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowAlternatives(false);
                    setAlternatives([]);
                  }}
                  className="w-6 h-6 rounded-md flex items-center justify-center transition-colors"
                  style={{ color: rightPanelTheme.content.text.muted }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = rightPanelTheme.button.hover.background;
                    e.currentTarget.style.color = rightPanelTheme.content.text.primary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = rightPanelTheme.content.text.muted;
                  }}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              <div className="p-2.5 space-y-1.5 max-h-[60vh] overflow-y-auto">
                {alternatives.map((alt, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      if (onEdit) {
                        onEdit(selectedNode.id, alt);
                        setShowAlternatives(false);
                        setAlternatives([]);
                      }
                    }}
                    className="w-full p-2.5 rounded-md border backdrop-blur-sm transition-all duration-200 group text-left"
                    style={{
                      background: rightPanelTheme.selectionPanel.card.background,
                      borderColor: rightPanelTheme.selectionPanel.card.border,
                      boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = rightPanelTheme.button.hover.background;
                      e.currentTarget.style.borderColor = rightPanelTheme.tabs.active.border;
                      e.currentTarget.style.boxShadow = "0 2px 8px -4px rgba(0, 0, 0, 0.2)";
                      e.currentTarget.style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = rightPanelTheme.selectionPanel.card.background;
                      e.currentTarget.style.borderColor = rightPanelTheme.selectionPanel.card.border;
                      e.currentTarget.style.boxShadow = "0 1px 4px -2px rgba(0, 0, 0, 0.15)";
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-medium"
                        style={{
                          background: rightPanelTheme.tabs.active.border + "30",
                          color: rightPanelTheme.tabs.active.text,
                        }}
                      >
                        {index + 1}
                      </div>
                      <span
                        className="text-[10px] font-medium"
                        style={{ color: rightPanelTheme.content.text.secondary }}
                      >
                        Alternative {index + 1}
                      </span>
                    </div>
                    <p
                      className="text-xs leading-relaxed whitespace-pre-wrap"
                      style={{ color: rightPanelTheme.content.text.primary }}
                    >
                      {alt}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {aiMessage && !isGenerating && (
          <div
            className="fixed bottom-6 right-6 max-w-xs rounded-md border shadow-xl p-2.5 z-50 backdrop-blur-md"
            style={{
              background: rightPanelTheme.selectionPanel.modal.background,
              borderColor: rightPanelTheme.selectionPanel.modal.border,
              backdropFilter: rightPanelTheme.selectionPanel.modal.backdropFilter,
            }}
          >
            <div className="flex items-start gap-2">
              <div
                className="p-1.5 rounded-md flex-shrink-0"
                style={{
                  background: rightPanelTheme.tabs.active.border + "20",
                  color: rightPanelTheme.tabs.active.text,
                }}
              >
                <BrainCircuit className="w-3 h-3" />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="text-xs font-medium mb-0.5"
                  style={{ color: rightPanelTheme.header.text.primary }}
                >
                  AI Assistant
                </div>
                <div
                  className="text-xs leading-relaxed"
                  style={{ color: rightPanelTheme.content.text.secondary }}
                >
                  {aiMessage}
                </div>
              </div>
              <button
                onClick={() => setAiMessage("")}
                className="w-5 h-5 rounded-md flex items-center justify-center transition-colors flex-shrink-0"
                style={{ color: rightPanelTheme.content.text.muted }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = rightPanelTheme.button.hover.background;
                  e.currentTarget.style.color = rightPanelTheme.content.text.primary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = rightPanelTheme.content.text.muted;
                }}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {isGenerating && (
          <div
            className="fixed bottom-6 right-6 max-w-xs rounded-md border shadow-xl p-2.5 z-50 backdrop-blur-md"
            style={{
              background: rightPanelTheme.selectionPanel.modal.background,
              borderColor: rightPanelTheme.selectionPanel.modal.border,
              backdropFilter: rightPanelTheme.selectionPanel.modal.backdropFilter,
            }}
          >
            <div className="flex items-start gap-2">
              <div
                className="p-1.5 rounded-md flex-shrink-0"
                style={{
                  background: rightPanelTheme.tabs.active.border + "20",
                  color: rightPanelTheme.tabs.active.text,
                }}
              >
                <BrainCircuit className="w-3 h-3" />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="text-xs font-medium mb-0.5"
                  style={{ color: rightPanelTheme.header.text.primary }}
                >
                  AI Assistant
                </div>
                <div className="flex items-center gap-1.5">
                  <Loader2
                    className="w-3 h-3 animate-spin"
                    style={{ color: rightPanelTheme.tabs.active.text }}
                  />
                  <span
                    className="text-xs"
                    style={{ color: rightPanelTheme.content.text.secondary }}
                  >
                  Generating dialog content...
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.selectedNode?.id === nextProps.selectedNode?.id &&
      prevProps.selectedNode?.data?.text === nextProps.selectedNode?.data?.text &&
      prevProps.nodes.length === nextProps.nodes.length &&
      prevProps.connections.length === nextProps.connections.length &&
      prevProps.projectType === nextProps.projectType
    );
  }
);
