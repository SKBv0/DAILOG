import React, { useState, useRef, useCallback, useMemo } from "react";
import {
  Save,
  Settings,
  Copy,
  Check,
  ChevronRight,
  FileText,
  FilePlus,
  BookOpen,
} from "lucide-react";
import { NodeConfig } from "../types/nodes";
import { DialogNode, DialogNodeType, Connection } from "../types/dialog";
import ViewportTabs from "./ViewportTabs";
import { PROJECT_TYPES, ProjectType } from "../types/project";
import registry from "./nodes/registry";
import { loadDefaultDialogFlow } from "../utils/dialogLoader";
import { clearDialogFlow, saveDialogFlow } from "../utils/localStorageUtils";
import { toast } from "react-hot-toast";
import { getLeftPanelTheme } from "../theme/components/LeftPanelTheme";
import logger from "../utils/logger";

interface LeftPanelProps {
  onExport?: () => void;
  onExportScript?: () => void;
  onImport?: () => void;
  onOpenSettings?: () => void;
  onCopyToClipboard?: () => void;
  onEdit?: (id: string, newText: string) => void;
  onAddNode?: (sourceNodeId: string, nodeType: DialogNodeType, text: string) => string;
  activeMode: "flow" | "tree" | "read";
  setActiveMode: (mode: "flow" | "tree" | "read") => void;
  projectType: ProjectType;
  onProjectTypeChange: (type: ProjectType) => void;
  setNodes?: React.Dispatch<React.SetStateAction<DialogNode[]>>;
  setConnections?: React.Dispatch<React.SetStateAction<Connection[]>>;
}

const LeftPanelComponent: React.FC<LeftPanelProps> = ({
  onExport,
  onExportScript,
  onImport,
  onOpenSettings,
  onCopyToClipboard,
  onAddNode,
  activeMode,
  setActiveMode,
  projectType,
  onProjectTypeChange,
  setNodes,
  setConnections,
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const leftPanelTheme = useMemo(() => getLeftPanelTheme(), []);

  const handleCopy = useCallback(async () => {
    if (onCopyToClipboard) {
      await onCopyToClipboard();
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  }, [onCopyToClipboard]);

  const handleAddNode = useCallback(
    (nodeType: string) => {
      const nodeConfigs = registry.getNodeConfigsByProjectType(projectType);
      const config = nodeConfigs.find((cfg: NodeConfig) => cfg.id === nodeType);

      const defaultText = config ? config.defaultText : `New ${nodeType} Node`;

      if (onAddNode) {
        onAddNode("", nodeType as DialogNodeType, defaultText);
      }
    },
    [projectType, onAddNode]
  );

  const nodeConfigsForCurrentProjectType = registry
    .getNodeConfigsByProjectType(projectType)
    .filter((cfg: any) => cfg.id !== "subgraphNode");

  const handleProjectTypeChange = useCallback(
    (newType: ProjectType) => {
      onProjectTypeChange(newType);
    },
    [onProjectTypeChange]
  );

  const handleNewProject = useCallback(() => {
    if (
      window.confirm(
        "This will clear the current project and create a new empty project. Are you sure you want to continue?"
      )
    ) {
      try {
        if (setNodes) {
          setNodes([]);
        }
        if (setConnections) {
          setConnections([]);
        }

        clearDialogFlow();

        toast.success("New empty project created");
      } catch (error) {
        logger.error("Error creating new project:", error);
        toast.error("Failed to create new project");
      }
    }
  }, [setNodes, setConnections]);

  const handleLoadDefaultProject = useCallback(() => {
    if (
      window.confirm(
        "This will load the default dialog flow template. Are you sure you want to continue?"
      )
    ) {
      try {
        const defaultFlow = loadDefaultDialogFlow();
        if (setNodes) {
          setNodes(defaultFlow.nodes);
        }
        if (setConnections) {
          setConnections(defaultFlow.connections);
        }

        saveDialogFlow(defaultFlow.nodes, defaultFlow.connections, projectType);

        toast.success("Default dialog flow loaded");
      } catch (error) {
        logger.error("Error loading default project:", error);
        toast.error("Failed to load default project");
      }
    }
  }, [setNodes, setConnections, projectType]);

  return (
    <div
      ref={panelRef}
      className="h-full w-56 border-r"
      style={{
        background: leftPanelTheme.background,
        borderColor: leftPanelTheme.border,
      }}
    >
      <div className="flex flex-col h-full">
        <div
          className="pt-8 pb-3 px-3"
          style={{ borderBottom: `1px solid ${leftPanelTheme.section.border}` }}
        >
          <label htmlFor="project-type-select">
            <h3
              className="text-xs font-medium uppercase tracking-wider mb-2"
              style={{ color: leftPanelTheme.header.text }}
            >
              Project Type
            </h3>
          </label>
          <div className="grid grid-cols-1 gap-1.5">
            <div className="relative">
              <select
                id="project-type-select"
                value={projectType}
                onChange={(e) => handleProjectTypeChange(e.target.value as ProjectType)}
                className="w-full appearance-none pl-3 pr-8 py-1.5 rounded text-[11px] transition-colors cursor-pointer"
                style={{
                  background: leftPanelTheme.select.background,
                  color: leftPanelTheme.select.text,
                }}
                aria-label="Select project type for dialog flow"
              >
                {Object.entries(PROJECT_TYPES).map(([id, pt]) => (
                  <option
                    key={id}
                    value={id}
                    className="py-2"
                    style={{
                      background: leftPanelTheme.select.option.background,
                      color: leftPanelTheme.select.option.text,
                    }}
                  >
                    {pt.label}
                  </option>
                ))}
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                <ChevronRight className="w-3 h-3" style={{ color: leftPanelTheme.button.icon }} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col flex-grow">
          <div
            className="p-4"
            style={{
              borderBottom: `1px solid ${leftPanelTheme.section.border}`,
            }}
          >
            <ViewportTabs activeMode={activeMode} setActiveMode={setActiveMode} />
          </div>

          <div
            className="py-3 px-3"
            style={{
              borderBottom: `1px solid ${leftPanelTheme.section.border}`,
            }}
          >
            <h3
              className="text-xs font-medium uppercase tracking-wider mb-2"
              style={{ color: leftPanelTheme.header.text }}
            >
              Create
            </h3>

            <div className="grid grid-cols-1 gap-1.5">
              {nodeConfigsForCurrentProjectType.map((config: NodeConfig) => (
                <button
                  key={config.id}
                  onClick={() => handleAddNode(config.id)}
                  className="px-3 py-1.5 rounded flex items-center gap-2 transition-colors hover:opacity-80"
                  style={{
                    background: config.buttonConfig?.background || leftPanelTheme.button.background,
                  }}
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{
                      background: config.buttonConfig?.icon || "#6B7280",
                    }}
                  />
                  <span className="text-[11px]" style={{ color: leftPanelTheme.nodeButton.text }}>
                    {config.displayNames.full}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div
            className="py-3 px-3"
            style={{
              borderBottom: `1px solid ${leftPanelTheme.section.border}`,
            }}
          >
            <h3
              className="text-xs font-medium uppercase tracking-wider mb-2"
              style={{ color: leftPanelTheme.header.text }}
            >
              Project
            </h3>

            <div className="grid grid-cols-1 gap-1.5">
              <button
                onClick={handleNewProject}
                className="px-3 py-1.5 rounded flex items-center gap-2 transition-colors"
                style={{
                  background: leftPanelTheme.projectButton.background,
                  color: leftPanelTheme.projectButton.text,
                }}
                aria-label="Create new empty dialog project"
                title="Create New Project"
              >
                <FilePlus
                  className="w-3.5 h-3.5"
                  style={{ color: leftPanelTheme.projectButton.icon }}
                />
                <span className="text-[11px]">New Empty Project</span>
              </button>

              <button
                onClick={handleLoadDefaultProject}
                className="px-3 py-1.5 rounded flex items-center gap-2 transition-colors"
                style={{
                  background: leftPanelTheme.projectButton.background,
                  color: leftPanelTheme.projectButton.text,
                }}
                aria-label="Load sample dialog project template"
                title="Load Sample Project"
              >
                <BookOpen
                  className="w-3.5 h-3.5"
                  style={{ color: leftPanelTheme.projectButton.icon }}
                />
                <span className="text-[11px]">Load Sample</span>
              </button>

              <button
                onClick={() => onImport?.()}
                className="px-3 py-1.5 rounded flex items-center gap-2 transition-colors"
                style={{
                  background: leftPanelTheme.projectButton.background,
                  color: leftPanelTheme.projectButton.text,
                }}
                aria-label="Import dialog project from JSON file"
                title="Import Project"
              >
                <FilePlus
                  className="w-3.5 h-3.5"
                  style={{ color: leftPanelTheme.projectButton.icon }}
                />
                <span className="text-[11px]">Import JSON</span>
              </button>

              <button
                onClick={onExport}
                className="px-3 py-1.5 rounded flex items-center gap-2 transition-colors"
                style={{
                  background: leftPanelTheme.projectButton.background,
                  color: leftPanelTheme.projectButton.text,
                }}
                aria-label="Export current dialog project as JSON file"
                title="Export Project as JSON"
              >
                <Save
                  className="w-3.5 h-3.5"
                  style={{ color: leftPanelTheme.projectButton.icon }}
                />
                <span className="text-[11px]">Export JSON</span>
              </button>

              <button
                onClick={onExportScript}
                className="px-3 py-1.5 rounded flex items-center gap-2 transition-colors"
                style={{
                  background: leftPanelTheme.projectButton.background,
                  color: leftPanelTheme.projectButton.text,
                }}
                aria-label="Export dialog script as JSON file"
                title="Export Dialog Script"
              >
                <FileText
                  className="w-3.5 h-3.5"
                  style={{ color: leftPanelTheme.projectButton.icon }}
                />
                <span className="text-[11px]">Export Script</span>
              </button>
            </div>
          </div>

          <div className="py-3 px-3">
            <div className="flex gap-2">
              <button
                onClick={onOpenSettings}
                className="flex-1 flex items-center justify-center px-2 py-1.5 rounded transition-colors"
                style={{
                  background: leftPanelTheme.button.background,
                  color: leftPanelTheme.button.text,
                }}
                aria-label="Open application settings"
                title="Open Settings"
              >
                <Settings
                  className="w-3.5 h-3.5 mr-1.5"
                  style={{ color: leftPanelTheme.button.icon }}
                />
                <span className="text-[11px]">Settings</span>
              </button>

              <button
                onClick={handleCopy}
                className="flex items-center justify-center p-1.5 rounded transition-colors"
                style={{
                  background: leftPanelTheme.button.background,
                  color: leftPanelTheme.button.text,
                }}
                aria-label={
                  isCopied ? "Content copied to clipboard" : "Copy dialog flow to clipboard"
                }
                title={isCopied ? "Copied!" : "Copy to Clipboard"}
              >
                {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const LeftPanel = React.memo(LeftPanelComponent);
