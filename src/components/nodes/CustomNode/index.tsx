import React, { useState, useEffect, useCallback, useMemo } from "react";
import { NodeConfig } from "../../../types/nodes";
import registry from "../registry";
import BaseNode from "../base/BaseNode";
import { DialogNodeData } from "../../../types/dialog";
import { Settings, Sparkles, Brain, X } from "lucide-react";
import { useStore } from "reactflow";
import { GenerateDialogOptions } from "../NodeWrapper";
import { toast } from "react-hot-toast";
import { getNodeBaseId } from "../../../utils/nodeIdUtils";
import { safeStorage } from "../../../utils/safeStorage";
import logger from "../../../utils/logger";

export const nodeConfig: NodeConfig = {
  id: "customNode",
  displayNames: {
    short: "Custom",
    full: "Custom Node",
  },
  style: {
    primaryColor: "#0EA5E9",
    bgBase: "rgba(15, 23, 42, 0.6)",
    bgSelected: "rgba(15, 23, 42, 0.85)",
    borderBase: "rgba(14, 165, 233, 0.2)",
    borderSelected: "#0EA5E9",
  },
  projectTypes: ["game", "interactive_story", "novel"],
  defaultText: "Custom node with your own prompt",
  buttonConfig: {
    icon: "#0ea5e9",
    background: "rgba(12, 74, 110, 0.2)",
    hoverBackground: "rgba(12, 74, 110, 0.3)",
  },
};

interface CustomNodeProps {
  id: string;
  data: DialogNodeData & {
    onGenerateDialog?: (
      _nodeId: string,
      _mode: "recreate" | "improve" | "custom" | "regenerateFromHere",
      _options?: GenerateDialogOptions
    ) => void;
    onDataChange?: (_data: DialogNodeData) => void;
  };
  selected: boolean;
  type: string;
}

interface CustomNodeComponent extends React.FC<CustomNodeProps> {
  displayName: string;
  nodeConfig: NodeConfig;
}

const zoomSelector = (state: any): number => state.transform[2];
const ZOOM_THRESHOLDS = { LOW: 0.5, MEDIUM: 0.8, HIGH: 1.2 };

const CUSTOM_NODE_SETTINGS_KEY_PREFIX = "dialog-flow-custom-node-";

const getNodeUniqueKey = (id: string) => {
  return `${CUSTOM_NODE_SETTINGS_KEY_PREFIX}${getNodeBaseId(id)}`;
};

const CustomNode: CustomNodeComponent = React.memo(
  ({ id, data, selected, type }: CustomNodeProps) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [localSettings, setLocalSettings] = useState({
      systemPrompt: "",
      userPrompt: "",
      ignoreConnections: false,
    });

    useEffect(() => {
      if (import.meta.env.DEV) {
        logger.debug("[CustomNode] Loading data", data);
      }

      try {
        const exactKey = `${CUSTOM_NODE_SETTINGS_KEY_PREFIX}${id}`;
        let savedSettings = safeStorage.get(exactKey);

        if (!savedSettings) {
          const baseKey = getNodeUniqueKey(id);
          savedSettings = safeStorage.get(baseKey);
        }

        if (savedSettings) {
          const parsedSettings = JSON.parse(savedSettings);
          if (import.meta.env.DEV) {
            logger.debug(
              "[CustomNode] Found saved settings in dedicated localStorage key",
              parsedSettings
            );
          }

          if (
            parsedSettings.systemPrompt ||
            parsedSettings.userPrompt ||
            parsedSettings.ignoreConnections
          ) {
            setLocalSettings(parsedSettings);
            return;
          }
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          logger.error("[CustomNode] Error loading from dedicated localStorage", error);
        }
      }

      const settings = {
        systemPrompt: data?.metadata?.customSettings?.systemPrompt || "",
        userPrompt: data?.metadata?.customSettings?.userPrompt || "",
        ignoreConnections: data?.metadata?.customSettings?.ignoreConnections || false,
      };

      if (import.meta.env.DEV) {
        logger.debug("[CustomNode] Using custom settings from metadata", settings);
      }
      setLocalSettings(settings);
    }, [data, id]);

    const handleSave = useCallback(() => {
      if (data.onDataChange) {
        const currentMetadata = data.metadata || {};

        const updatedData = {
          ...data,
          metadata: {
            ...currentMetadata,
            customSettings: {
              systemPrompt: localSettings.systemPrompt,
              userPrompt: localSettings.userPrompt,
              ignoreConnections: localSettings.ignoreConnections,
            },
          },
        };

        if (import.meta.env.DEV) {
          logger.debug("[CustomNode] Saving node data", {
            oldData: data,
            newData: updatedData,
            currentMetadata,
            newSettings: localSettings,
          });
        }

        data.onDataChange(updatedData);

        try {
          const exactKey = `${CUSTOM_NODE_SETTINGS_KEY_PREFIX}${id}`;
          const baseKey = getNodeUniqueKey(id);

          safeStorage.set(exactKey, JSON.stringify(localSettings));
          safeStorage.set(baseKey, JSON.stringify(localSettings));

          if (import.meta.env.DEV) {
            logger.debug("[CustomNode] Saved settings to dedicated storage keys", {
              exactKey,
              baseKey,
              settings: localSettings,
            });
          }
        } catch (error) {
          if (import.meta.env.DEV) {
            logger.error("[CustomNode] Error saving to dedicated storage", error);
          }
        }

        try {
          const savedData = safeStorage.get("dialog-flow-state");
          if (savedData) {
            const flowData = JSON.parse(savedData);

            const updatedNodes = flowData.nodes.map((node: any) => {
              if (node.id === id) {
                const clonedNode = JSON.parse(JSON.stringify(node));

                if (!clonedNode.data.metadata) {
                  clonedNode.data.metadata = {};
                }

                clonedNode.data.metadata.customSettings = {
                  systemPrompt: localSettings.systemPrompt,
                  userPrompt: localSettings.userPrompt,
                  ignoreConnections: localSettings.ignoreConnections,
                };

                if (import.meta.env.DEV) {
                  logger.debug("[CustomNode] Updated node in flow localStorage", clonedNode);
                }
                return clonedNode;
              }
              return node;
            });

            safeStorage.set(
              "dialog-flow-state",
              JSON.stringify({
                ...flowData,
                nodes: updatedNodes,
              })
            );
          }
        } catch (error) {
          if (import.meta.env.DEV) {
            logger.error("[CustomNode] Error saving to flow localStorage", error);
          }
        }

        toast.success("Settings saved successfully", {
          duration: 2000,
          position: "bottom-center",
        });
      }
      setIsDialogOpen(false);
    }, [data, localSettings, id]);

    const handleGenerateWithCustomSettings = useCallback(() => {
      if (data.onGenerateDialog) {
        handleSave();

        const options = {
          customPrompt: localSettings.userPrompt,
          systemPrompt: localSettings.systemPrompt,
          ignoreConnections: localSettings.ignoreConnections,
        };

        if (import.meta.env.DEV) {
          logger.debug("[CustomNode] Generating with custom options", options);
        }
        data.onGenerateDialog(id, "custom", options);

        toast.loading("Generating with custom settings...", {
          duration: 1000,
          position: "bottom-center",
        });
      }
    }, [data.onGenerateDialog, id, localSettings, handleSave]);

    const zoom = useStore(zoomSelector);
    const showControls = zoom >= ZOOM_THRESHOLDS.LOW;

    const dialogContent = useMemo(
      () =>
        isDialogOpen && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4"
            onClick={() => setIsDialogOpen(false)}
          >
            <div
              className="bg-slate-900/95 backdrop-blur-sm border border-indigo-500/20 rounded-2xl overflow-hidden max-w-md w-full shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="border-b border-white/10 p-6 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white/90">Custom Node Settings</h2>
                <button
                  onClick={() => setIsDialogOpen(false)}
                  className="p-1 text-white/70 hover:text-white/90 transition-colors"
                  aria-label="Close dialog"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    System Prompt
                  </label>
                  <textarea
                    rows={4}
                    value={localSettings.systemPrompt}
                    onChange={(e) =>
                      setLocalSettings((prev) => ({
                        ...prev,
                        systemPrompt: e.target.value,
                      }))
                    }
                    placeholder="Enter system prompt..."
                    className="w-full bg-slate-900/60 border border-indigo-500/20 rounded-xl p-3 text-sm text-white/90 placeholder-white/50 resize-none focus:outline-none focus:border-indigo-500/40 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    User Prompt
                  </label>
                  <textarea
                    rows={4}
                    value={localSettings.userPrompt}
                    onChange={(e) =>
                      setLocalSettings((prev) => ({
                        ...prev,
                        userPrompt: e.target.value,
                      }))
                    }
                    placeholder="Enter user prompt..."
                    className="w-full bg-slate-900/60 border border-indigo-500/20 rounded-xl p-3 text-sm text-white/90 placeholder-white/50 resize-none focus:outline-none focus:border-indigo-500/40 transition-colors"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/70">Ignore Connections:</span>
                  <button
                    onClick={() =>
                      setLocalSettings((prev) => ({
                        ...prev,
                        ignoreConnections: !prev.ignoreConnections,
                      }))
                    }
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                      localSettings.ignoreConnections
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-800 text-white/70 border border-slate-600"
                    }`}
                  >
                    <Brain className="w-4 h-4" />
                    {localSettings.ignoreConnections ? "Yes" : "No"}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="border-t border-white/10 p-6 flex gap-3 justify-end">
                <button
                  onClick={() => setIsDialogOpen(false)}
                  className="px-4 py-2 text-white/70 hover:text-white/90 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        ),
      [isDialogOpen, localSettings, handleSave]
    );

    useEffect(() => {
      const checkLocalStorage = () => {
        try {
          const savedSettingsKey = `${CUSTOM_NODE_SETTINGS_KEY_PREFIX}${id}`;
          const dedicatedSettings = safeStorage.get(savedSettingsKey);

          const savedData = safeStorage.get("dialog-flow-state");
          if (savedData && import.meta.env.DEV) {
            const parsedData = JSON.parse(savedData);
            const thisNode = parsedData.nodes.find((node: any) => node.id === id);

            logger.debug("[CustomNode:DEBUG] Storage check", {
              nodeId: id,
              dedicatedSettings: dedicatedSettings ? JSON.parse(dedicatedSettings) : null,
              flowNode: thisNode,
              metadata: thisNode?.data?.metadata,
              flowCustomSettings: thisNode?.data?.metadata?.customSettings,
            });
          }
        } catch (error) {
          if (import.meta.env.DEV) {
            logger.error("[CustomNode] Error checking storage", error);
          }
        }
      };

      const timeoutId = window.setTimeout(checkLocalStorage, 500);
      window.addEventListener("storage", checkLocalStorage);

      return () => {
        window.removeEventListener("storage", checkLocalStorage);
        window.clearTimeout(timeoutId);
      };
    }, [id]);

    useEffect(() => {
      return () => {
        try {
          if (
            localSettings.systemPrompt ||
            localSettings.userPrompt ||
            localSettings.ignoreConnections
          ) {
            const exactKey = `${CUSTOM_NODE_SETTINGS_KEY_PREFIX}${id}`;
            const baseKey = getNodeUniqueKey(id);

            safeStorage.set(exactKey, JSON.stringify(localSettings));
            safeStorage.set(baseKey, JSON.stringify(localSettings));

            if (import.meta.env.DEV) {
              logger.debug("[CustomNode] Saved non-empty settings on unmount", {
                exactKey,
                baseKey,
                settings: localSettings,
              });
            }
          }
        } catch (error) {
          if (import.meta.env.DEV) {
            logger.error("[CustomNode] Error saving settings on unmount", error);
          }
        }
      };
    }, [id, localSettings]);

    return (
      <>
        <BaseNode
          type={type}
          data={data}
          selected={selected}
          displayNames={nodeConfig.displayNames}
          style={nodeConfig.style}
        />

        {showControls && (
          <div className="absolute -right-1.5 -top-1.5 flex gap-0.5 p-1 rounded-lg bg-slate-900/80 backdrop-blur-sm border border-sky-500/20 shadow-xl z-10">
            <div className="relative group">
              <button
                onClick={() => setIsDialogOpen(true)}
                className="p-1 text-sky-500 hover:bg-sky-500/15 transition-colors rounded"
                aria-label="Custom Prompt Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-900/95 backdrop-blur-sm border border-sky-500/20 rounded text-xs font-medium text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                Custom Prompt Settings
              </div>
            </div>

            <div className="relative group">
              <button
                onClick={handleGenerateWithCustomSettings}
                className="p-1 text-emerald-500 hover:bg-emerald-500/15 transition-colors rounded"
                aria-label="Generate with Custom Settings"
              >
                <Sparkles className="w-4 h-4" />
              </button>
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-900/95 backdrop-blur-sm border border-emerald-500/20 rounded text-xs font-medium text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                Generate with Custom Settings
              </div>
            </div>
          </div>
        )}

        {dialogContent}
      </>
    );
  }
) as unknown as CustomNodeComponent;

CustomNode.displayName = "CustomNode";
CustomNode.nodeConfig = nodeConfig;

registry.registerNode("customNode", CustomNode);

export default CustomNode;
