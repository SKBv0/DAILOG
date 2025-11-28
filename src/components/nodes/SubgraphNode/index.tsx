import React, { useState, useCallback, useRef, useEffect } from "react";
import { Handle, Position, useStore } from "reactflow";
import { LogIn, Edit3 } from "lucide-react";
import { DialogNode } from "../../../types/dialog";
import { NodeConfig } from "../../../types/nodes";
import { ProjectType } from "../../../types/project";
import registry from "../registry";
import BaseNode from "../base/BaseNode";
import useSubgraphNavigationStore from "../../../store/subgraphNavigationStore";
import logger from "../../../utils/logger";

const zoomSelector = (state: any): number => state.transform?.[2] ?? 1;


interface SubgraphNodeProps {
  id: string;
  data: DialogNode["data"];
  selected: boolean;
  type: string;
}

export const SubgraphNode: React.FC<SubgraphNodeProps> = ({ id, data, selected, type }) => {
  const subgraphData = (data.metadata as any)?.subgraph;
  const nodeCount = subgraphData?.nodes?.length || 0;
  const inputCount = subgraphData?.inputs?.length || 0;
  const outputCount = subgraphData?.outputs?.length || 0;

  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });

  const contextMenuRef = useRef<HTMLDivElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const zoom = useStore(zoomSelector);

  const { enterSubgraph } = useSubgraphNavigationStore();

  // Determine if we're in compact mode (zoom <= 0.7)
  const isCompactMode = zoom <= 0.7;

  const subgraphNodeMap = React.useMemo(() => {
    const map = new Map<string, DialogNode>();
    subgraphData?.nodes?.forEach((node: DialogNode) => {
      map.set(node.id, node);
    });
    return map;
  }, [subgraphData?.nodes]);

  const tooltipWrapperClasses = React.useMemo(
    () =>
      [
        "pointer-events-none",
        "absolute",
        "-top-3",
        "left-1/2",
        "z-[60]",
        "flex",
        "-translate-x-1/2",
        "-translate-y-full",
        "flex-col",
        "items-center",
      ].join(" "),
    []
  );

  const tooltipCardClasses = React.useMemo(
    () =>
      [
        "w-full",
        "min-w-[220px]",
        "max-w-[260px]",
        "rounded-lg",
        "border",
        "border-white/8",
        "bg-[#0A0D1F]/90",
        "px-3",
        "py-2",
        "shadow-2xl",
        "shadow-black/50",
        "backdrop-blur-md",
      ].join(" "),
    []
  );

  const [portTooltip, setPortTooltip] = useState<{
    visible: boolean;
    label: string;
    text: string;
    type: "input" | "output";
  }>({
    visible: false,
    label: "",
    text: "",
    type: "input",
  });

  const formatTooltipText = useCallback((text?: string) => {
    if (!text || !text.trim()) {
      return "No dialog content available";
    }
    const normalized = text.trim();
    return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
  }, []);

  const showPortTooltip = useCallback(
    (port: any, portType: "input" | "output") => {
      const connectedNodeId =
        portType === "input"
          ? port.targetNode || port.sourceNode
          : port.sourceNode || port.targetNode;
      const connectedNode = connectedNodeId ? subgraphNodeMap.get(connectedNodeId) : undefined;
      const nodeText = connectedNode?.data?.text;
      const content = port.previewText || nodeText || port.label;

      setPortTooltip({
        visible: true,
        label: port.label || (portType === "input" ? "Input" : "Output"),
        text: formatTooltipText(content),
        type: portType,
      });
    },
    [formatTooltipText, subgraphNodeMap]
  );

  const hidePortTooltip = useCallback(() => {
    setPortTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev));
  }, []);

  const handleDoubleClick = useCallback(() => {
    if (import.meta.env.DEV) {
      logger.debug("[SubgraphNode] Enter subgraph via double‑click", { id });
    }
    enterSubgraph(id, {
      name: data.text || `Subgraph ${id}`,
      nodes: subgraphData?.nodes || [],
      edges: subgraphData?.edges || [],
    });
  }, [id, data.text, subgraphData, enterSubgraph]);

  const handleEnterClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      handleDoubleClick();
    },
    [handleDoubleClick]
  );

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (nodeRef.current) {
      const rect = nodeRef.current.getBoundingClientRect();
      setContextMenuPosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setShowContextMenu(true);
    }
  }, []);

  const handleRename = useCallback(() => {
    const newName = prompt("Enter new name for subgraph:", data.text || "Subgraph");
    if (newName && import.meta.env.DEV) {
      logger.debug("[SubgraphNode] Rename subgraph", { id, newName });
    }
    setShowContextMenu(false);
  }, [data.text]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setShowContextMenu(false);
      }
    };

    if (showContextMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showContextMenu]);


  return (
    <div
      ref={nodeRef}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onMouseLeave={hidePortTooltip}
      className="relative"
    >
      <BaseNode
        id={id}
        type={type}
        data={data}
        selected={selected}
        displayNames={subgraphNodeConfig.displayNames}
        style={subgraphNodeConfig.style}
        hideDefaultHandles
        headerContent={
          <div className="flex items-center gap-2">
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded text-white/90">
              {nodeCount} nodes
            </span>
            <button
              onClick={handleEnterClick}
              className="p-1.5 bg-purple-600/30 hover:bg-purple-600/50 rounded text-purple-200 transition-colors flex items-center justify-center"
              title="Enter subgraph (or double-click)"
            >
              <LogIn className="w-3.5 h-3.5" />
            </button>
          </div>
        }
      >
        <div className="flex justify-between text-xs text-white/60 mt-2">
          <span>{inputCount} inputs</span>
          <span>{outputCount} outputs</span>
        </div>
      </BaseNode>

      {subgraphData?.inputs?.map((input: any, index: number) => {
        const handleCount = subgraphData.inputs.length;

        // In compact mode, use percentage-based positioning for stability
        if (isCompactMode) {
          return (
            <Handle
              key={`input-${input.id}-${index}-${zoom.toFixed(2)}`}
              type="target"
              position={Position.Left}
              id={`input_${index}`}
              className="!w-3 !h-3 !border-2 !transition-all !duration-200"
              style={{
                top: "50%",
                transform: "translateY(-50%)",
                left: "-6px",
                background: "#7C3AED",
                borderColor: "#7C3AED",
                pointerEvents: "auto",
              }}
              title=""
              onMouseEnter={() => showPortTooltip(input, "input")}
              onMouseLeave={hidePortTooltip}
            />
          );
        }

        // Full mode - use percentage-based positioning
        // Distribute handles between 30% and 70% of node height (avoiding header and footer)
        let topPercent: number;
        if (handleCount === 1) {
          topPercent = 50;
        } else {
          const range = 40; // 30% to 70% = 40% range
          const step = range / (handleCount - 1);
          topPercent = 30 + (step * index);
        }

        return (
          <Handle
            key={`input-${input.id}-${index}-${zoom.toFixed(2)}`}
            type="target"
            position={Position.Left}
            id={`input_${index}`}
            className="!w-3 !h-3 !border-2 !transition-all !duration-200"
            style={{
              top: `${topPercent}%`,
              left: "-6px",
              background: "#7C3AED",
              borderColor: "#7C3AED",
              pointerEvents: "auto",
            }}
            title=""
            onMouseEnter={() => showPortTooltip(input, "input")}
            onMouseLeave={hidePortTooltip}
          />
        );
      })}
      
      {subgraphData?.outputs?.map((output: any, index: number) => {
        const handleCount = subgraphData.outputs.length;

        // In compact mode, use percentage-based positioning for stability
        if (isCompactMode) {
          return (
            <Handle
              key={`output-${output.id}-${index}-${zoom.toFixed(2)}`}
              type="source"
              position={Position.Right}
              id={`output_${index}`}
              className="!w-3 !h-3 !border-2 !transition-all !duration-200"
              style={{
                top: "50%",
                transform: "translateY(-50%)",
                right: "-6px",
                background: "#7C3AED",
                borderColor: "#7C3AED",
                pointerEvents: "auto",
              }}
              title=""
              onMouseEnter={() => showPortTooltip(output, "output")}
              onMouseLeave={hidePortTooltip}
            />
          );
        }

        // Full mode - use percentage-based positioning
        // Distribute handles between 30% and 70% of node height (avoiding header and footer)
        let topPercent: number;
        if (handleCount === 1) {
          topPercent = 50;
        } else {
          const range = 40; // 30% to 70% = 40% range
          const step = range / (handleCount - 1);
          topPercent = 30 + (step * index);
        }

        return (
          <Handle
            key={`output-${output.id}-${index}-${zoom.toFixed(2)}`}
            type="source"
            position={Position.Right}
            id={`output_${index}`}
            className="!w-3 !h-3 !border-2 !transition-all !duration-200"
            style={{
              top: `${topPercent}%`,
              right: "-6px",
              background: "#7C3AED",
              borderColor: "#7C3AED",
              pointerEvents: "auto",
            }}
            title=""
            onMouseEnter={() => showPortTooltip(output, "output")}
            onMouseLeave={hidePortTooltip}
          />
        );
      })}

      {portTooltip.visible && (
        <div className={tooltipWrapperClasses}>
          <div className={tooltipCardClasses}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-white/60">
                {portTooltip.label}
              </span>
              <span
                className={`text-[10px] font-semibold ${
                  portTooltip.type === "input" ? "text-purple-300" : "text-emerald-300"
                }`}
              >
                {portTooltip.type === "input" ? "Input" : "Output"}
              </span>
            </div>
            <p className="mt-1 text-xs leading-snug text-white/90 whitespace-pre-wrap">
              {portTooltip.text}
            </p>
          </div>
          <div className="mt-1 h-1 w-12 rounded-full bg-white/15" />
        </div>
      )}

      {showContextMenu && (
        <div
          ref={contextMenuRef}
          className="absolute z-50 bg-gray-800 border border-gray-600 rounded shadow-lg py-1 min-w-32"
          style={{
            left: contextMenuPosition.x,
            top: contextMenuPosition.y,
          }}
        >
          <button
            onClick={handleEnterClick}
            className="w-full text-left px-3 py-1.5 text-sm text-white hover:bg-gray-700 flex items-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            Enter
          </button>
          <button
            onClick={handleRename}
            className="w-full text-left px-3 py-1.5 text-sm text-white hover:bg-gray-700 flex items-center gap-2"
          >
            <Edit3 className="w-4 h-4" />
            Rename
          </button>
        </div>
      )}
    </div>
  );
};

export const subgraphNodeConfig: NodeConfig = {
  id: "subgraphNode",
  displayNames: {
    short: "SUB",
    full: "Subgraph",
  },
  style: {
    primaryColor: "#7C3AED",
    bgBase: "rgba(15, 23, 42, 0.6)",
    bgSelected: "rgba(15, 23, 42, 0.85)",
    borderBase: "rgba(124, 58, 237, 0.2)",
    borderSelected: "#7C3AED",
  },
  projectTypes: ["game", "interactive_story", "novel"] as ProjectType[],
  defaultText: "Grouped nodes",
  buttonConfig: {
    icon: "📦",
    background: "#7C3AED",
    hoverBackground: "#6D28D9",
  },
};

(SubgraphNode as any).nodeConfig = subgraphNodeConfig;

registry.registerNode("subgraphNode", SubgraphNode);

export default SubgraphNode;
