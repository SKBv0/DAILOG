import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Settings,
  Info,
  GamepadIcon,
  BookIcon,
  BookOpen,
  Code,
  PencilLine,
  ChevronRight,
} from "lucide-react";
import { ollamaService, OllamaConfig } from "../services/ollamaService";
import { useTheme } from "../theme/ThemeProvider";
import { ProjectType } from "../types/ollama";
import { Portal } from "./ui/Portal";
import InputField from "./InputField";
import logger from "../utils/logger";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type PromptTab = "general" | "game" | "interactive_story" | "novel" | "advanced";

interface PromptField {
  field: string;
  label: string;
  projectType?: ProjectType;
}

const getCategoryPrompts = (category: PromptTab): PromptField[] => {
  switch (category) {
    case "general":
      return [
        { field: "baseUrl", label: "API Endpoint" },
        { field: "model", label: "Model" },
        { field: "temperature", label: "Temperature" },
        { field: "maxTokens", label: "Max Tokens" },
      ];
    case "game":
      return [
        { field: "npcDialog", label: "NPC Dialog", projectType: "game" },
        {
          field: "playerResponse",
          label: "Player Responses",
          projectType: "game",
        },
        { field: "enemyDialog", label: "Enemy Dialog", projectType: "game" },
        { field: "general", label: "General", projectType: "game" },
      ];
    case "interactive_story":
      return [
        {
          field: "narratorNode",
          label: "Narrator Node",
          projectType: "interactive_story",
        },
        {
          field: "choiceNode",
          label: "Choice Node",
          projectType: "interactive_story",
        },
        {
          field: "branchingNode",
          label: "Branching Node",
          projectType: "interactive_story",
        },
        {
          field: "general",
          label: "General",
          projectType: "interactive_story",
        },
      ];
    case "novel":
      return [
        {
          field: "characterDialogNode",
          label: "Character Dialog",
          projectType: "novel",
        },
        {
          field: "sceneDescriptionNode",
          label: "Scene Description",
          projectType: "novel",
        },
        { field: "sceneNode", label: "Scene Node", projectType: "novel" },
        { field: "general", label: "General", projectType: "novel" },
      ];
    case "advanced":
      return [
        { field: "isolatedNodePrompt", label: "Isolated Node Prompt" },
        { field: "dialogStartPrompt", label: "Dialog Start Prompt" },
        { field: "continuationPrompt", label: "Continuation Prompt" },
        { field: "improvementPrompt", label: "Improvement Prompt" },
        { field: "diversityPrompt", label: "Diversity Prompt" },
        { field: "siblingAwarenessPrompt", label: "Sibling Awareness Prompt" },
        {
          field: "forcedDifferentiationPrompt",
          label: "Forced Differentiation Prompt",
        },
        { field: "deadendFixPrompt", label: "Dead End Fix Prompt" },
        { field: "inconsistencyFixPrompt", label: "Inconsistency Fix Prompt" },
        { field: "contextGapFixPrompt", label: "Context Gap Fix Prompt" },
        {
          field: "questionAnswerFixPrompt",
          label: "Question Answer Fix Prompt",
        },
        { field: "toneShiftFixPrompt", label: "Tone Shift Fix Prompt" },
        { field: "generalFixPrompt", label: "General Fix Prompt" },
        { field: "customPromptWrapper", label: "Custom Prompt Wrapper" },
      ];
    default:
      return [];
  }
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { theme } = useTheme();
  const [config, setConfig] = useState<OllamaConfig>(ollamaService.getConfig());
  const [isDirty, setIsDirty] = useState(false);
  const saveTimeoutRef = useRef<number | null>(null);
  const [activeSection, setActiveSection] = useState<PromptTab>("general");
  const [models, setModels] = useState<string[]>([]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    general: false,
    game: false,
    interactive_story: false,
    novel: false,
    advanced: false,
    npcDialog: false,
    playerResponse: false,
    gameNpcDialog: false,
    gamePlayerResponse: false,
    gameEnemyDialog: false,
    gameGeneral: false,
    narratorNode: false,
    choiceNode: false,
    branchingNode: false,
    interactiveStoryGeneral: false,
    characterDialogNode: false,
    sceneDescriptionNode: false,
    sceneNode: false,
    novelGeneral: false,
    isolatedNodePrompt: false,
    dialogStartPrompt: false,
    continuationPrompt: false,
    improvementPrompt: false,
    diversityPrompt: false,
    siblingAwarenessPrompt: false,
    forcedDifferentiationPrompt: false,
    deadendFixPrompt: false,
    inconsistencyFixPrompt: false,
    contextGapFixPrompt: false,
    questionAnswerFixPrompt: false,
    toneShiftFixPrompt: false,
    generalFixPrompt: false,
    customPromptWrapper: false,
  });

  const getPromptValue = (field: string, projectType?: ProjectType): string => {
    if (projectType && config.systemPrompts?.projectTypes?.[projectType]) {
      const projectPrompts = config.systemPrompts.projectTypes[projectType];
      return (projectPrompts as any)[field] || "";
    }
    return (config.systemPrompts as any)?.[field] || "";
  };

  useEffect(() => {
    if (isOpen) {
      setConfig(ollamaService.getConfig());
      setIsDirty(false);

      const fetchModels = async () => {
        try {
          const modelList = await ollamaService.listModels();
          setModels(modelList);
        } catch (err) {
          logger.error("Failed to fetch models:", err);
        }
      };

      fetchModels();

      const rfPane = document.querySelector(".react-flow__pane");
      if (rfPane) {
        (rfPane as HTMLElement).style.pointerEvents = "none";
      }

      const reactFlowNodes = document.querySelectorAll(".react-flow__node");
      reactFlowNodes.forEach((node) => {
        (node as HTMLElement).style.pointerEvents = "none";
      });
    }

    return () => {
      const rfPane = document.querySelector(".react-flow__pane");
      if (rfPane) {
        (rfPane as HTMLElement).style.pointerEvents = "auto";
      }

      const reactFlowNodes = document.querySelectorAll(".react-flow__node");
      reactFlowNodes.forEach((node) => {
        (node as HTMLElement).style.pointerEvents = "auto";
      });
    };
  }, [isOpen]);

  const handleSave = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    ollamaService.updateConfig(config);
    setIsDirty(false);
    onClose();
  };
  
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const handleChange = (
    field: string,
    value: string,
    category: "systemPrompts" | null = null,
    projectType?: ProjectType,
    nodeType?: string
  ) => {
    setIsDirty(true);
    if (category === "systemPrompts") {
      if (projectType) {
        setConfig((prev) => {
          const newConfig = { ...prev } as OllamaConfig;

          if (!newConfig.systemPrompts) {
            newConfig.systemPrompts = {
              npcDialog: "",
              playerResponse: "",
              general: "",
            };
          }

          if (!newConfig.systemPrompts.projectTypes) {
            newConfig.systemPrompts.projectTypes = {
              game: { general: "" },
              interactive_story: { general: "" },
              novel: { general: "" },
            };
          }

          if (
            newConfig.systemPrompts.projectTypes &&
            !newConfig.systemPrompts.projectTypes[projectType]
          ) {
            newConfig.systemPrompts.projectTypes[projectType] = {
              general: "",
            };
          }

          const fieldName = nodeType || field;
          if (newConfig.systemPrompts.projectTypes) {
            if (!newConfig.systemPrompts.projectTypes[projectType]) {
              newConfig.systemPrompts.projectTypes[projectType] = {
                general: "",
              };
            }
            (newConfig.systemPrompts.projectTypes[projectType] as any)[fieldName] = value;
          }

          return newConfig;
        });
      } else {
        setConfig((prev) => {
          const newConfig = { ...prev } as OllamaConfig;

          if (!newConfig.systemPrompts) {
            newConfig.systemPrompts = {
              npcDialog: "",
              playerResponse: "",
              general: "",
            };
          }

          (newConfig.systemPrompts as any)[field] = value;

          return newConfig;
        });
      }
    } else {
      setConfig((prev) => {
        const newConfig = {
          ...prev,
          [field]: value,
        };
        
        // Debounced save for critical settings like model, baseUrl, temperature, maxTokens
        // These should persist even if user doesn't click Save
        if (field === "model" || field === "baseUrl" || field === "temperature" || field === "maxTokens") {
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
          }
          saveTimeoutRef.current = window.setTimeout(() => {
            ollamaService.updateConfig({ [field]: value } as Partial<OllamaConfig>);
          }, 300); // 300ms debounce
        }
        
        return newConfig;
      });
    }
  };

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  const SectionHeader = useCallback(
    ({
      title,
      section,
      icon: Icon,
    }: {
      title: string;
      section: string;
      icon: React.ElementType;
    }) => {
      const isExpanded = expandedSections[section];

      return (
        <div
          className="flex items-center py-3 px-4 cursor-pointer rounded-lg transition-all duration-200 hover:shadow-md"
          onClick={() => toggleSection(section)}
          style={{
            background: isExpanded ? theme.colors.hover.background : "transparent",
            color: isExpanded ? theme.colors.accent.npc : theme.colors.text.primary,
            border: `1px solid ${isExpanded ? theme.colors.accent.npc + "40" : "transparent"}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = theme.colors.hover.background;
            e.currentTarget.style.borderColor = theme.colors.accent.npc + "40";
          }}
          onMouseLeave={(e) => {
            if (!isExpanded) {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "transparent";
            }
          }}
        >
          <div className="flex items-center gap-3 flex-1">
            <div
              className="p-1.5 rounded-md transition-colors"
              style={{
                background: isExpanded ? theme.colors.accent.npc + "20" : "transparent",
              }}
            >
              <Icon
                size={16}
                style={{
                  color: isExpanded ? theme.colors.accent.npc : theme.colors.text.muted,
                }}
              />
            </div>
            <span className="text-sm font-medium">{title}</span>
          </div>
          <ChevronRight
            size={16}
            className="transition-transform duration-200"
            style={{
              transform: isExpanded ? "rotate(90deg)" : "none",
              color: isExpanded ? theme.colors.accent.npc : theme.colors.text.muted,
            }}
          />
        </div>
      );
    },
    [expandedSections, toggleSection, theme.colors]
  );

  if (!isOpen) return null;

  const fieldDescriptions: Record<string, string> = {
    baseUrl: "The API endpoint URL for your Ollama instance (e.g., http://localhost:11434)",
    model: "The model to use for generating dialog (e.g., gemma3:latest)",
    npcDialog: "System prompt for NPC dialog generation",
    playerResponse: "System prompt for player response generation",
    general: "General system prompt for all dialog generation",
    isolatedNodePrompt: "Prompt used when generating content for nodes without context",
    dialogStartPrompt: "Prompt used for starting a new dialog chain",
    continuationPrompt: "Prompt used for continuing existing dialog",
  };

  const renderCategoryContent = () => {
    const prompts = getCategoryPrompts(activeSection);

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        {prompts.map((prompt: PromptField) => (
          <div key={prompt.field}>
            <SectionHeader
              title={prompt.label}
              section={prompt.field}
              icon={
                activeSection === "game"
                  ? GamepadIcon
                  : activeSection === "interactive_story"
                    ? BookIcon
                    : activeSection === "novel"
                      ? BookOpen
                      : Code
              }
            />
            {expandedSections[prompt.field] && (
              <div className="mt-4 pl-6">
                <InputField
                  label={prompt.label}
                  field={prompt.field}
                  value={getPromptValue(prompt.field, prompt.projectType)}
                  onChange={(value) =>
                    handleChange(prompt.field, value, "systemPrompts", prompt.projectType)
                  }
                  multiline
                  description={fieldDescriptions[prompt.field] || ""}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 flex items-center justify-center z-[9999] settings-modal"
        style={{
          background: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(8px)",
          pointerEvents: "auto",
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="rounded-2xl shadow-2xl w-[1200px] max-h-[90vh] flex overflow-hidden"
          style={{
            background: theme.colors.background,
            border: `1px solid ${theme.colors.border}`,
            pointerEvents: "auto",
          }}
        >
          <div
            className="w-64 border-r flex flex-col"
            style={{
              background: theme.colors.surface,
              borderColor: theme.colors.border,
            }}
          >
            <div className="p-6 border-b" style={{ borderColor: theme.colors.border }}>
              <div className="flex items-center gap-3">
                <div
                  className="p-2 rounded-lg"
                  style={{ background: theme.colors.accent.npc + "20" }}
                >
                  <Settings size={20} style={{ color: theme.colors.accent.npc }} />
                </div>
                <div>
                  <h2
                    className="text-lg font-semibold"
                    style={{ color: theme.colors.text.primary }}
                  >
                    AI Settings
                  </h2>
                  <p className="text-xs" style={{ color: theme.colors.text.muted }}>
                    Configure your AI model and prompts
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-1">
                <button
                  onClick={() => setActiveSection("general")}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
                    activeSection === "general"
                      ? "bg-accent/10 text-accent"
                      : "text-muted hover:bg-hover"
                  }`}
                >
                  <Settings size={16} />
                  General
                </button>
                <button
                  onClick={() => setActiveSection("game")}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
                    activeSection === "game"
                      ? "bg-accent/10 text-accent"
                      : "text-muted hover:bg-hover"
                  }`}
                >
                  <GamepadIcon size={16} />
                  Game
                </button>
                <button
                  onClick={() => setActiveSection("interactive_story")}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
                    activeSection === "interactive_story"
                      ? "bg-accent/10 text-accent"
                      : "text-muted hover:bg-hover"
                  }`}
                >
                  <BookIcon size={16} />
                  Interactive Story
                </button>
                <button
                  onClick={() => setActiveSection("novel")}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
                    activeSection === "novel"
                      ? "bg-accent/10 text-accent"
                      : "text-muted hover:bg-hover"
                  }`}
                >
                  <BookOpen size={16} />
                  Novel
                </button>
                <button
                  onClick={() => setActiveSection("advanced")}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
                    activeSection === "advanced"
                      ? "bg-accent/10 text-accent"
                      : "text-muted hover:bg-hover"
                  }`}
                >
                  <Code size={16} />
                  Advanced
                </button>
              </div>
            </div>

            <div className="p-4 border-t" style={{ borderColor: theme.colors.border }}>
              <div className="flex items-center justify-between">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm rounded-lg transition-colors"
                  style={{
                    color: theme.colors.text.muted,
                    background: theme.colors.background,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = theme.colors.hover.background;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = theme.colors.background;
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!isDirty}
                  className="px-4 py-2 text-sm rounded-lg transition-all flex items-center gap-2"
                  style={
                    isDirty
                      ? {
                          background: theme.colors.accent.npc,
                          color: "#ffffff",
                          border: "none",
                        }
                      : {
                          background: theme.colors.background,
                          color: theme.colors.text.muted,
                          border: `1px solid ${theme.colors.border}`,
                          cursor: "not-allowed",
                        }
                  }
                  onMouseEnter={(e) => {
                    if (isDirty) {
                      e.currentTarget.style.opacity = "0.9";
                      e.currentTarget.style.boxShadow = `0 0 10px ${theme.colors.accent.npc}80`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (isDirty) {
                      e.currentTarget.style.opacity = "1";
                      e.currentTarget.style.boxShadow = "none";
                    }
                  }}
                >
                  <PencilLine size={16} />
                  Save
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            <div
              className="flex items-center justify-between p-4 border-b"
              style={{
                background: theme.colors.surface,
                borderColor: theme.colors.border,
              }}
            >
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-medium" style={{ color: theme.colors.text.primary }}>
                  {activeSection === "general" && "General Prompts"}
                  {activeSection === "game" && "Game Prompts"}
                  {activeSection === "interactive_story" && "Interactive Story Prompts"}
                  {activeSection === "novel" && "Novel Prompts"}
                  {activeSection === "advanced" && "Advanced Settings"}
                </h3>
                {isDirty && (
                  <span
                    className="text-xs py-1 px-2 rounded-full"
                    style={{
                      background: "rgba(239, 68, 68, 0.1)",
                      color: "#F87171",
                      border: "1px solid rgba(239, 68, 68, 0.2)",
                    }}
                  >
                    Unsaved Changes
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {activeSection === "general" && (
                <div className="max-w-2xl mx-auto space-y-6">
                  <div className="space-y-6">
                    <InputField
                      label="API Endpoint"
                      field="baseUrl"
                      value={config.baseUrl || ""}
                      onChange={(value) => handleChange("baseUrl", value)}
                      description="The API endpoint URL for your Ollama instance (e.g., http://localhost:11434)"
                    />

                    <div className="mb-4">
                      <div className="flex items-center mb-2">
                        <label
                          htmlFor="model-select"
                          className="text-sm font-medium"
                          style={{ color: theme.colors.text.primary }}
                        >
                          Model
                        </label>
                        <div className="ml-1 relative cursor-help">
                          <Info size={14} style={{ color: theme.colors.text.muted }} />
                        </div>
                      </div>
                      <select
                        id="model-select"
                        value={config.model || ""}
                        onChange={(e) => handleChange("model", e.target.value)}
                        className="w-full rounded p-2 text-sm"
                        style={{
                          background: theme.colors.surface,
                          border: `1px solid ${theme.colors.border}`,
                          color: theme.colors.text.primary,
                        }}
                      >
                        {models.length === 0 && <option value="">Loading models...</option>}
                        {models.map((model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                      </select>
                      <div className="mt-1 text-xs" style={{ color: theme.colors.text.muted }}>
                        The model to use for generating dialog
                      </div>
                    </div>

                    <InputField
                      label="Temperature"
                      field="temperature"
                      value={config.temperature?.toString() || "0.7"}
                      onChange={(value) => handleChange("temperature", value)}
                      description="Controls randomness: Lower values are more focused, higher values more creative"
                      type="number"
                      min={0}
                      max={2}
                      step={0.1}
                    />

                    <InputField
                      label="Diversity Boost"
                      field="diversityBoost"
                      value={config.diversityBoost?.toString() || "0.5"}
                      onChange={(value) => handleChange("diversityBoost", value)}
                      description="Extra temperature added when forcing different responses (0-1.3, higher = more variety)"
                      type="number"
                      min={0}
                      max={1.3}
                      step={0.1}
                    />

                    <InputField
                      label="Max Tokens"
                      field="maxTokens"
                      value={config.maxTokens?.toString() || "300"}
                      onChange={(value) => handleChange("maxTokens", value)}
                      description="Maximum number of tokens to generate"
                      type="number"
                      min={10}
                      max={4000}
                      step={10}
                    />

                    <InputField
                      label="Request Timeout (ms)"
                      field="requestTimeout"
                      value={config.requestTimeout?.toString() || "30000"}
                      onChange={(value) => handleChange("requestTimeout", value)}
                      description="Maximum time to wait for AI response (in milliseconds)"
                      type="number"
                      min={5000}
                      max={120000}
                      step={1000}
                    />
                  </div>
                </div>
              )}

              {activeSection === "game" && renderCategoryContent()}

              {activeSection === "interactive_story" && renderCategoryContent()}

              {activeSection === "novel" && renderCategoryContent()}

              {activeSection === "advanced" && (
                <div className="max-w-2xl mx-auto space-y-8">
                  <div>
                    <h4
                      className="text-sm font-medium mb-4"
                      style={{ color: theme.colors.text.secondary }}
                    >
                      Dialog Context
                    </h4>
                    <div className="space-y-6">
                      <SectionHeader
                        title="Isolated Node Prompt"
                        section="isolatedNodePrompt"
                        icon={Code}
                      />
                      {expandedSections.isolatedNodePrompt && (
                        <div className="mt-4 pl-6">
                          <InputField
                            label="Isolated Node Prompt"
                            field="isolatedNodePrompt"
                            value={config.systemPrompts?.isolatedNodePrompt || ""}
                            onChange={(value) =>
                              handleChange("isolatedNodePrompt", value, "systemPrompts")
                            }
                            multiline
                            description="Prompt used when generating content for nodes without context"
                          />
                        </div>
                      )}

                      <SectionHeader
                        title="Dialog Start Prompt"
                        section="dialogStartPrompt"
                        icon={Code}
                      />
                      {expandedSections.dialogStartPrompt && (
                        <div className="mt-4 pl-6">
                          <InputField
                            label="Dialog Start Prompt"
                            field="dialogStartPrompt"
                            value={config.systemPrompts?.dialogStartPrompt || ""}
                            onChange={(value) =>
                              handleChange("dialogStartPrompt", value, "systemPrompts")
                            }
                            multiline
                            description="Prompt used for starting a new dialog chain"
                          />
                        </div>
                      )}

                      <SectionHeader
                        title="Continuation Prompt"
                        section="continuationPrompt"
                        icon={Code}
                      />
                      {expandedSections.continuationPrompt && (
                        <div className="mt-4 pl-6">
                          <InputField
                            label="Continuation Prompt"
                            field="continuationPrompt"
                            value={config.systemPrompts?.continuationPrompt || ""}
                            onChange={(value) =>
                              handleChange("continuationPrompt", value, "systemPrompts")
                            }
                            multiline
                            description="Prompt used for continuing existing dialog"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4
                      className="text-sm font-medium mb-4"
                      style={{ color: theme.colors.text.secondary }}
                    >
                      Enhancement
                    </h4>
                    <div className="space-y-6">
                      <SectionHeader
                        title="Improvement Prompt"
                        section="improvementPrompt"
                        icon={Code}
                      />
                      {expandedSections.improvementPrompt && (
                        <div className="mt-4 pl-6">
                          <InputField
                            label="Improvement Prompt"
                            field="improvementPrompt"
                            value={config.systemPrompts?.improvementPrompt || ""}
                            onChange={(value) =>
                              handleChange("improvementPrompt", value, "systemPrompts")
                            }
                            multiline
                            description="System prompt for improving dialog generation"
                          />
                        </div>
                      )}

                      <SectionHeader
                        title="Diversity Prompt"
                        section="diversityPrompt"
                        icon={Code}
                      />
                      {expandedSections.diversityPrompt && (
                        <div className="mt-4 pl-6">
                          <InputField
                            label="Diversity Prompt"
                            field="diversityPrompt"
                            value={config.systemPrompts?.diversityPrompt || ""}
                            onChange={(value) =>
                              handleChange("diversityPrompt", value, "systemPrompts")
                            }
                            multiline
                            description="System prompt for increasing dialog diversity"
                          />
                        </div>
                      )}

                      <SectionHeader
                        title="Sibling Awareness Prompt"
                        section="siblingAwarenessPrompt"
                        icon={Code}
                      />
                      {expandedSections.siblingAwarenessPrompt && (
                        <div className="mt-4 pl-6">
                          <InputField
                            label="Sibling Awareness Prompt"
                            field="siblingAwarenessPrompt"
                            value={config.systemPrompts?.siblingAwarenessPrompt || ""}
                            onChange={(value) =>
                              handleChange("siblingAwarenessPrompt", value, "systemPrompts")
                            }
                            multiline
                            description="System prompt for sibling awareness in dialog generation"
                          />
                        </div>
                      )}

                      <SectionHeader
                        title="Forced Differentiation Prompt"
                        section="forcedDifferentiationPrompt"
                        icon={Code}
                      />
                      {expandedSections.forcedDifferentiationPrompt && (
                        <div className="mt-4 pl-6">
                          <InputField
                            label="Forced Differentiation Prompt"
                            field="forcedDifferentiationPrompt"
                            value={config.systemPrompts?.forcedDifferentiationPrompt || ""}
                            onChange={(value) =>
                              handleChange("forcedDifferentiationPrompt", value, "systemPrompts")
                            }
                            multiline
                            description="System prompt for forced differentiation in dialog generation"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4
                      className="text-sm font-medium mb-4"
                      style={{ color: theme.colors.text.secondary }}
                    >
                      Validation Fix
                    </h4>
                    <div className="space-y-6">
                      <SectionHeader
                        title="Dead End Fix Prompt"
                        section="deadendFixPrompt"
                        icon={Code}
                      />
                      {expandedSections.deadendFixPrompt && (
                        <div className="mt-4 pl-6">
                          <InputField
                            label="Dead End Fix Prompt"
                            field="deadendFixPrompt"
                            value={config.systemPrompts?.deadendFixPrompt || ""}
                            onChange={(value) =>
                              handleChange("deadendFixPrompt", value, "systemPrompts")
                            }
                            multiline
                            description="System prompt for fixing dead end in dialog generation"
                          />
                        </div>
                      )}

                      <SectionHeader
                        title="Inconsistency Fix Prompt"
                        section="inconsistencyFixPrompt"
                        icon={Code}
                      />
                      {expandedSections.inconsistencyFixPrompt && (
                        <div className="mt-4 pl-6">
                          <InputField
                            label="Inconsistency Fix Prompt"
                            field="inconsistencyFixPrompt"
                            value={config.systemPrompts?.inconsistencyFixPrompt || ""}
                            onChange={(value) =>
                              handleChange("inconsistencyFixPrompt", value, "systemPrompts")
                            }
                            multiline
                            description="System prompt for fixing inconsistency in dialog generation"
                          />
                        </div>
                      )}

                      <SectionHeader
                        title="Context Gap Fix Prompt"
                        section="contextGapFixPrompt"
                        icon={Code}
                      />
                      {expandedSections.contextGapFixPrompt && (
                        <div className="mt-4 pl-6">
                          <InputField
                            label="Context Gap Fix Prompt"
                            field="contextGapFixPrompt"
                            value={config.systemPrompts?.contextGapFixPrompt || ""}
                            onChange={(value) =>
                              handleChange("contextGapFixPrompt", value, "systemPrompts")
                            }
                            multiline
                            description="System prompt for fixing context gap in dialog generation"
                          />
                        </div>
                      )}

                      <SectionHeader
                        title="Question Answer Fix Prompt"
                        section="questionAnswerFixPrompt"
                        icon={Code}
                      />
                      {expandedSections.questionAnswerFixPrompt && (
                        <div className="mt-4 pl-6">
                          <InputField
                            label="Question Answer Fix Prompt"
                            field="questionAnswerFixPrompt"
                            value={config.systemPrompts?.questionAnswerFixPrompt || ""}
                            onChange={(value) =>
                              handleChange("questionAnswerFixPrompt", value, "systemPrompts")
                            }
                            multiline
                            description="System prompt for fixing question answer inconsistency in dialog generation"
                          />
                        </div>
                      )}

                      <SectionHeader
                        title="Tone Shift Fix Prompt"
                        section="toneShiftFixPrompt"
                        icon={Code}
                      />
                      {expandedSections.toneShiftFixPrompt && (
                        <div className="mt-4 pl-6">
                          <InputField
                            label="Tone Shift Fix Prompt"
                            field="toneShiftFixPrompt"
                            value={config.systemPrompts?.toneShiftFixPrompt || ""}
                            onChange={(value) =>
                              handleChange("toneShiftFixPrompt", value, "systemPrompts")
                            }
                            multiline
                            description="System prompt for fixing tone shift inconsistency in dialog generation"
                          />
                        </div>
                      )}

                      <SectionHeader
                        title="General Fix Prompt"
                        section="generalFixPrompt"
                        icon={Code}
                      />
                      {expandedSections.generalFixPrompt && (
                        <div className="mt-4 pl-6">
                          <InputField
                            label="General Fix Prompt"
                            field="generalFixPrompt"
                            value={config.systemPrompts?.generalFixPrompt || ""}
                            onChange={(value) =>
                              handleChange("generalFixPrompt", value, "systemPrompts")
                            }
                            multiline
                            description="System prompt for general dialog generation"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4
                      className="text-sm font-medium mb-4"
                      style={{ color: theme.colors.text.secondary }}
                    >
                      Other
                    </h4>
                    <div className="space-y-6">
                      <SectionHeader
                        title="Custom Prompt Wrapper"
                        section="customPromptWrapper"
                        icon={Code}
                      />
                      {expandedSections.customPromptWrapper && (
                        <div className="mt-4 pl-6">
                          <InputField
                            label="Custom Prompt Wrapper"
                            field="customPromptWrapper"
                            value={config.systemPrompts?.customPromptWrapper || ""}
                            onChange={(value) =>
                              handleChange("customPromptWrapper", value, "systemPrompts")
                            }
                            multiline
                            height="160px"
                            description="Custom system prompt wrapper for dialog generation"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
};
