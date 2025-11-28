import React, { memo, useEffect, useRef, useState } from "react";
import { Plus, FileText, MessageSquare, User, Zap, Brain, Target, GitBranch } from "lucide-react";
import { DialogNodeType } from "../types/dialog";
import { NodeConfig } from "../types/nodes";
import registry from "./nodes/registry";
import { ProjectType } from "../types/project";
import logger from "../utils/logger";

interface ConnectionMenuProps {
  position: { x: number; y: number };
  sourceNodeId: string;
  projectType: ProjectType;
  onNodeTypeSelect: (nodeType: DialogNodeType) => void;
  onCancel: () => void;
}

const getNodeIcon = (nodeType: string) => {
  switch (nodeType) {
    case "npcDialog":
      return <MessageSquare className="w-4 h-4" />;
    case "playerResponse":
      return <User className="w-4 h-4" />;
    case "narrator":
      return <FileText className="w-4 h-4" />;
    case "choice":
      return <GitBranch className="w-4 h-4" />;
    case "enemyDialog":
      return <Zap className="w-4 h-4" />;
    case "custom":
      return <Brain className="w-4 h-4" />;
    default:
      return <Target className="w-4 h-4" />;
  }
};

const getNodeTypeColor = (nodeType: string) => {
  switch (nodeType) {
    case "npcDialog":
      return "border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400";
    case "playerResponse":
      return "border-green-500/30 bg-green-500/10 hover:bg-green-500/20 text-green-400";
    case "narrator":
      return "border-yellow-500/30 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400";
    case "choice":
      return "border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400";
    case "enemyDialog":
      return "border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400";
    default:
      return "border-gray-500/30 bg-gray-500/10 hover:bg-gray-500/20 text-gray-400";
  }
};

export const ConnectionMenu: React.FC<ConnectionMenuProps> = memo(
  ({ position, sourceNodeId, projectType, onNodeTypeSelect, onCancel }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [adjustedPosition, setAdjustedPosition] = useState(position);

    const nodeConfigs = registry
      .getNodeConfigsByProjectType(projectType)
      .filter((cfg: any) => cfg.id !== "subgraphNode");

    useEffect(() => {
      const overlay = document.createElement("div");
      overlay.style.position = "fixed";
      overlay.style.top = "0";
      overlay.style.left = "0";
      overlay.style.width = "100vw";
      overlay.style.height = "100vh";
      overlay.style.zIndex = "99990";
      overlay.style.backgroundColor = "transparent";
      overlay.style.cursor = "default";
      overlay.className = "connection-menu-overlay";

      overlay.addEventListener("click", (e) => {
        if (!containerRef.current?.contains(e.target as HTMLElement)) {
          onCancel();
          if (document.body.contains(overlay)) {
            document.body.removeChild(overlay);
          }
        }
      });

      document.body.appendChild(overlay);

      return () => {
        if (document.body.contains(overlay)) {
          document.body.removeChild(overlay);
        }
      };
    }, [onCancel]);

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onCancel();
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }, [onCancel]);

    useEffect(() => {
      if (!containerRef.current) return;

      const checkPosition = () => {
        const rect = containerRef.current!.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        let newX = position.x;
        let newY = position.y;

        if (position.x + rect.width > windowWidth - 20) {
          newX = windowWidth - rect.width - 20;
        }

        if (position.y + rect.height > windowHeight - 20) {
          newY = windowHeight - rect.height - 20;
        }

        if (newX !== position.x || newY !== position.y) {
          setAdjustedPosition({ x: newX, y: newY });
        }
      };

      const timer = setTimeout(checkPosition, 50);
      return () => clearTimeout(timer);
    }, [position]);

    const handleNodeTypeSelect = (config: NodeConfig) => {
      logger.debug(`[ConnectionMenu] Selected node type: ${config.id} for source: ${sourceNodeId}`);
      onNodeTypeSelect(config.id as DialogNodeType);
    };

    return (
      <div
        ref={containerRef}
        className="connection-menu fixed z-[99999] bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-xl shadow-2xl p-3 min-w-[280px] animate-in fade-in slide-in-from-bottom-2 duration-200"
        style={{
          left: adjustedPosition.x,
          top: adjustedPosition.y,
        }}
      >
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-700/50">
          <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Plus className="w-4 h-4 text-blue-400" />
          </div>
          <h3 className="text-sm font-medium text-white">Create New Node</h3>
        </div>

        <div className="space-y-1.5">
          {nodeConfigs.map((config) => (
            <button
              key={config.id}
              onClick={() => handleNodeTypeSelect(config)}
              className={`
                w-full flex items-center gap-3 p-3 rounded-lg border transition-all duration-200
                ${getNodeTypeColor(config.id)}
                hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500/20
              `}
            >
              <div className="flex-shrink-0">
                {getNodeIcon(config.id)}
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium text-sm text-white">
                  {config.displayNames.full}
                </div>
                <div className="text-xs opacity-75 mt-0.5">
                  {`Create a new ${config.displayNames.full.toLowerCase() || 'node'}`}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-3 pt-2 border-t border-gray-700/50">
          <div className="text-xs text-gray-500 text-center">
            Press <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs">Esc</kbd> to cancel
          </div>
        </div>
      </div>
    );
  }
);

ConnectionMenu.displayName = "ConnectionMenu";

export default ConnectionMenu;