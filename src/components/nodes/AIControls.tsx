import React, { useState, useEffect } from "react";
import { RotateCcw, Sparkles, Brain, FastForward, X } from "lucide-react";
import { useStore } from "reactflow";
import { GenerateMode } from "../../hooks/useNodeAI";
import logger from "../../utils/logger";

const zoomSelector = (state: any): number => state.transform[2];
const ZOOM_THRESHOLDS = { LOW: 0.5, MEDIUM: 0.8, HIGH: 1.2 };

interface AIControlsProps {
  nodeId: string;
  ignoreConnections?: boolean;
  onGenerateDialog?: (
    nodeId: string,
    mode: GenerateMode,
    options?: {
      ignoreConnections?: boolean;
      customPrompt?: string;
      systemPrompt?: string;
    }
  ) => void;
}

export const AIControls: React.FC<AIControlsProps> = ({
  nodeId,
  ignoreConnections = false,
  onGenerateDialog,
}) => {
  const [isCustomPromptOpen, setIsCustomPromptOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [hoveredButton, setHoveredButton] = useState<GenerateMode | null>(null);
  const zoom = useStore(zoomSelector);
  const [localIgnoreConnections, setLocalIgnoreConnections] = useState(ignoreConnections);

  useEffect(() => {
    const handleIgnoreConnectionsChanged = (event: CustomEvent) => {
      const newValue = event.detail?.ignoreConnections;
      if (newValue !== undefined) {
        setLocalIgnoreConnections(newValue);
        logger.debug(`[AIControls] Ignore Connections value updated: ${newValue}`);
      }
    };

    document.addEventListener(
      "ignore-connections-changed",
      handleIgnoreConnectionsChanged as EventListener
    );

    return () => {
      document.removeEventListener(
        "ignore-connections-changed",
        handleIgnoreConnectionsChanged as EventListener
      );
    };
  }, []);

  useEffect(() => {
    setLocalIgnoreConnections(ignoreConnections);
  }, [ignoreConnections]);

  if (!onGenerateDialog || zoom <= ZOOM_THRESHOLDS.MEDIUM) return null;

  const handleCustomPromptSubmit = () => {
    if (customPrompt.trim() && onGenerateDialog) {
      onGenerateDialog(nodeId, "custom", {
        ignoreConnections: localIgnoreConnections,
        customPrompt: customPrompt.trim(),
      });
      setIsCustomPromptOpen(false);
      setCustomPrompt("");
    }
  };

  const handleRegenerateFromHere = () => {
    if (onGenerateDialog) {
      // SEMANTIC FIX: regenerateFromHere respects ignoreConnections toggle
      // If toggle is ON, each node regenerates in isolation
      // If toggle is OFF (default), uses full context chain
      const effectiveIgnoreConnections = localIgnoreConnections;
      
      logger.debug(
        `[AIControls] Node ${nodeId} regenerateFromHere started (mode: regenerateFromHere)`
      );
      logger.debug(
        `[AIControls:TRACE] RegenerateFromHere button clicked for node ${nodeId} - ignoreConnections=${effectiveIgnoreConnections} (from user toggle)`
      );
      logger.debug(
        `[AIControls:PARAMS] regenerateFromHere will ${effectiveIgnoreConnections ? 'regenerate nodes in isolation' : 'use full context chain'}`
      );

      const options = {
        ignoreConnections: effectiveIgnoreConnections,
      };

      logger.debug(
        `[AIControls:DIALOG] Calling onGenerateDialog with mode=regenerateFromHere, ignoreConnections=${effectiveIgnoreConnections}`
      );

      try {
        onGenerateDialog(nodeId, "regenerateFromHere", options);
      } catch (err) {
        logger.error(`[AIControls:ERROR] regenerateFromHere call failed: ${err}`);
      }
    }
  };

  const handleButtonClick = (mode: GenerateMode) => {
    if (!onGenerateDialog) return;

    switch (mode) {
      case "custom":
        setIsCustomPromptOpen(true);
        break;
      case "regenerateFromHere":
        logger.debug(`[AIControls:DEBUG] 'Regenerate From Here' button clicked, node: ${nodeId}`);
        handleRegenerateFromHere();
        break;
      default:
        logger.debug(
        `[AIControls:DEBUG] '${mode}' button clicked, node: ${nodeId}, ignoreConnections: ${localIgnoreConnections}`
        );

        const options = {
          ignoreConnections: localIgnoreConnections,
        };

        logger.debug(`[AIControls:OPTIONS] Options for mode ${mode}:`, options);

        onGenerateDialog(nodeId, mode, options);
        break;
    }
  };

  return (
    <>
      <div className="absolute right-2 top-2 flex gap-0.5 p-1 rounded-lg bg-slate-900/80 backdrop-blur-sm border border-indigo-500/20 shadow-xl z-[60] hover:bg-slate-900/90 hover:border-indigo-500/30 hover:shadow-2xl transition-all">
        {[
          {
            title: "Recreate",
            icon: <RotateCcw className="w-3.5 h-3.5" />,
            mode: "recreate" as GenerateMode,
          },
          {
            title: "Improve",
            icon: <Sparkles className="w-3.5 h-3.5" />,
            mode: "improve" as GenerateMode,
          },
          {
            title: "Custom Prompt",
            icon: <Brain className="w-3.5 h-3.5" />,
            mode: "custom" as GenerateMode,
          },
          {
            title: "Regenerate From Here",
            icon: <FastForward className="w-3.5 h-3.5" />,
            mode: "regenerateFromHere" as GenerateMode,
          },
        ].map(({ title, icon, mode }) => (
          <div key={mode} className="relative group">
            <button
              className={`p-1 w-6 h-6 min-w-6 bg-transparent text-indigo-400 transition-all duration-200 ease-out hover:bg-indigo-500/15 hover:text-indigo-300 hover:-translate-y-0.5 rounded ${
                hoveredButton === mode ? "text-indigo-300 scale-110 -rotate-2" : ""
              }`}
              onClick={() => handleButtonClick(mode)}
              onMouseEnter={() => setHoveredButton(mode)}
              onMouseLeave={() => setHoveredButton(null)}
              title={title}
              aria-label={title}
            >
              {icon}
            </button>
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-900/95 backdrop-blur-sm border border-indigo-500/20 rounded text-xs font-medium text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
              {title}
            </div>
          </div>
        ))}
      </div>

      {isCustomPromptOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] flex items-center justify-center p-4"
          onClick={() => setIsCustomPromptOpen(false)}
        >
          <div
            className="bg-slate-900/95 backdrop-blur-sm border border-indigo-500/20 rounded-2xl overflow-hidden max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-white/10 p-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white/90">Custom AI Prompt</h2>
              <button
                onClick={() => setIsCustomPromptOpen(false)}
                className="p-1 text-white/70 hover:text-white/90 transition-colors"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <textarea
                autoFocus
                rows={4}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Enter your custom prompt..."
                className="w-full bg-slate-900/60 border border-indigo-500/20 rounded-xl p-3 text-sm text-white/90 placeholder-white/50 resize-none focus:outline-none focus:border-indigo-500/40 transition-colors"
              />
            </div>

            <div className="border-t border-white/10 p-6 flex gap-3 justify-end">
              <button
                onClick={() => setIsCustomPromptOpen(false)}
                className="px-4 py-2 text-white/70 hover:text-white/90 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCustomPromptSubmit}
                disabled={!customPrompt.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/40 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
              >
                Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
