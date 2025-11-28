import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  PanelLeft,
  PanelRight,
  AlignStartVertical,
  Bot,
  Loader2,
  Settings,
  Plus,
  LayoutGrid,
  AlignLeft,
  Tag as TagIcon,
  Search,
} from "lucide-react";
import { DialogNode } from "../types/dialog";
import { Connection } from "../types/nodes";
import TagManagerModal from "./Tag/TagManagerModal";
import { useTheme } from "../theme/ThemeProvider";
import { useReactFlow, Node, Edge } from "reactflow";
import { autoLayout } from "../utils/autoLayout";
import { FlowGenerator } from "./FlowGenerator/FlowGenerator";
import { ProjectType } from "../types/project";
import { getToolbarTheme } from "../theme/components/ToolbarTheme";
import { ThemeConfig } from "../theme/theme";
import SmartSearchBar from "./SmartSearchBar";
import logger from "../utils/logger";
import { useRegenerationStore } from "../store/regenerationStore";

export interface ToolbarProps {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onCenterViewport?: () => void;
  onToggleLeftPanel: () => void;
  onToggleRightPanel: () => void;
  onAutoLayout: () => void;
  selectedNodes: string[];
  nodes: DialogNode[];
  connections: Edge[];
  onEditNode: (_id: string, _text: string) => void;
  onUpdateNode?: (_id: string, _data: Partial<import("../types/dialog").DialogNodeData>) => void;
  setIsSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onGenerateDialog?: (_nodeId: string, _mode: "recreate" | "improve" | "custom") => Promise<void>;
  onClearDialog?: () => void;
  onDeleteSelected?: () => void;
  onNodeSelect?: (nodeId: string) => void;
  viewportOffset: { x: number; y: number };
  viewportSize: { width: number; height: number };
  zoom: number;
  onAddNodes: (_nodes: DialogNode[]) => void;
  onAddConnections?: (_connections: Connection[]) => void;
  viewMode?: "grid" | "single";
  onViewModeChange?: (_mode: "grid" | "single") => void;
  projectType: ProjectType;
  detectTestContent?: boolean;
  onDetectTestContentChange?: (_value: boolean) => void;
  setProcessingNodeId?: (_nodeId: string | null) => void;
  onCreateSubgraph?: () => void;
}

interface HoverStyleConfig {
  defaultStyle: React.CSSProperties;
  hoverStyle: React.CSSProperties;
  disabled?: boolean;
}

const createHoverHandlers = ({ defaultStyle, hoverStyle, disabled }: HoverStyleConfig) => ({
  onMouseEnter: (event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    Object.assign(event.currentTarget.style, hoverStyle);
  },
  onMouseLeave: (event: React.MouseEvent<HTMLButtonElement>) => {
    Object.assign(event.currentTarget.style, defaultStyle);
  },
});

interface ToolbarButtonProps {
  onClick: () => void;
  title: string;
  icon: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  onClick,
  title,
  icon,
  className = "",
  disabled = false,
}) => {
  const { theme } = useTheme();
  const toolbarTheme = useMemo(() => getToolbarTheme(theme), [theme]);

  const defaultStyle: React.CSSProperties = {
    background: disabled
      ? (toolbarTheme.button.disabled.background as string)
      : (toolbarTheme.button.default.background as string),
    color: disabled
      ? (toolbarTheme.button.disabled.text as string)
      : (toolbarTheme.button.default.text as string),
    borderColor: disabled
      ? (toolbarTheme.button.disabled.border as string)
      : (toolbarTheme.button.default.border as string),
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
  };

  const hoverStyle: React.CSSProperties = {
    background: toolbarTheme.button.hover.background as string,
    color: toolbarTheme.button.hover.text as string,
    borderColor: toolbarTheme.button.hover.border as string,
  };

  const hoverHandlers = createHoverHandlers({ defaultStyle, hoverStyle, disabled });

  return (
    <button
      onClick={onClick}
      className={`p-1.5 rounded-sm transition-colors ${className}`}
      style={defaultStyle}
      {...hoverHandlers}
      title={title}
      disabled={disabled}
    >
      {icon}
    </button>
  );
};

async function sortNodesByDialogFlow(
  selectedNodeIds: string[],
  nodes: DialogNode[],
  connections: Connection[]
): Promise<DialogNode[]> {
  const visited = new Set<string>();
  const sorted: DialogNode[] = [];

  const startNodes = selectedNodeIds
    .filter((id) => !connections.some((conn) => conn.target === id))
    .map((id) => nodes.find((n) => n.id === id))
    .filter((n): n is DialogNode => n !== undefined);

  function visit(node: DialogNode) {
    if (visited.has(node.id)) return;
    visited.add(node.id);

    if (selectedNodeIds.includes(node.id)) {
      sorted.push(node);
    }

    const nextNodes = connections
      .filter((conn) => conn.source === node.id)
      .map((conn) => nodes.find((n) => n.id === conn.target))
      .filter((n): n is DialogNode => n !== undefined);

    nextNodes.forEach(visit);
  }

  startNodes.forEach(visit);

  selectedNodeIds.forEach((id) => {
    if (!visited.has(id)) {
      const node = nodes.find((n) => n.id === id);
      if (node) sorted.push(node);
    }
  });

  return sorted;
}


export function Toolbar({
  onToggleLeftPanel,
  onToggleRightPanel,
  selectedNodes,
  nodes,
  connections,
  onEditNode,
  onUpdateNode,
  setIsSettingsOpen,
  onGenerateDialog,
  onAddNodes,
  onAddConnections,
  onNodeSelect,
  viewMode = "grid",
  onViewModeChange,
  projectType,
  onCreateSubgraph,
}: ToolbarProps) {
  const setProcessingNodeId = useRegenerationStore((state) => state.setProcessingNodeId);
  const { getNodes, setNodes, getEdges } = useReactFlow();
  const { theme } = useTheme();
  const [isGeneratingMultiple, setIsGeneratingMultiple] = React.useState(false);
  const [generationProgress, setGenerationProgress] = React.useState({
    current: 0,
    total: 0,
  });
  const [showFlowGenerator, setShowFlowGenerator] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showRegenerateButton, setShowRegenerateButton] = useState(false);
  const [selectedNodesCount, setSelectedNodesCount] = useState(0);
  const setIsRegeneratingNodes = useRegenerationStore(
    (state) => state.setIsRegeneratingNodes
  );
  const setCurrentBulkRegenerationNodes = useRegenerationStore(
    (state) => state.setCurrentBulkRegenerationNodes
  );

  const handleAutoLayout = useCallback(() => {
    const allNodes = getNodes();
    const allEdges = getEdges();
    const selected = allNodes.filter((n) => n.selected);

    let nodesToLayout: Node[];
    let edgesToLayout: Edge[];
    let originalTopLeft: { x: number; y: number } | null = null;

    if (selected.length === 0) {
      nodesToLayout = allNodes;
      edgesToLayout = allEdges;
    } else {
      nodesToLayout = selected;
      const selectedIds = new Set(selected.map((n) => n.id));
      edgesToLayout = allEdges.filter(
        (edge) => selectedIds.has(edge.source) &&         selectedIds.has(edge.target)
      );

      if (nodesToLayout.length > 0) {
        originalTopLeft = nodesToLayout.reduce(
          (acc, node) => ({
            x: Math.min(acc.x, node.position.x),
            y: Math.min(acc.y, node.position.y),
          }),
          { x: Infinity, y: Infinity }
        );
      }
    }

    if (nodesToLayout.length === 0) return;

    const layoutedNodesResult = autoLayout(
      nodesToLayout as DialogNode[],
      edgesToLayout.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle || undefined,
        targetHandle: edge.targetHandle || undefined,
        type: edge.type,
      })) as Connection[],
      {
        rankdir: "LR",
        nodeWidth: 340,
        ranksep: 180,
        nodesep: 120,
        edgesep: 60,
        heightBuffer: 28,
      }
    );

    let offsetX = 0;
    let offsetY = 0;

    if (originalTopLeft && layoutedNodesResult.length > 0) {
      const newTopLeft = layoutedNodesResult.reduce(
        (acc, node) => ({
          x: Math.min(acc.x, node.position.x),
          y: Math.min(acc.y, node.position.y),
        }),
        { x: Infinity, y: Infinity }
      );

      offsetX = originalTopLeft.x - newTopLeft.x;
      offsetY = originalTopLeft.y - newTopLeft.y;
    }

    const positionMap = new Map(
      layoutedNodesResult.map((node) => [
        node.id,
        { x: node.position.x + offsetX, y: node.position.y + offsetY },
      ])
    );

    setNodes((nds) =>
      nds.map((node) => {
        if (positionMap.has(node.id)) {
          return { ...node, position: positionMap.get(node.id)! };
        }
        return node;
      })
    );
  }, [getNodes, getEdges, setNodes]);

  useEffect(() => {
    const listener = () => {
      handleAutoLayout();
    };
    window.addEventListener("request-auto-layout", listener as any);
    return () => window.removeEventListener("request-auto-layout", listener as any);
  }, [handleAutoLayout]);

  useEffect(() => {
    const handleSelectionUpdate = () => {
      const selectedNodes = getNodes().filter((node) => node.selected);
      if (selectedNodes.length > 1 && onGenerateDialog) {
        setShowRegenerateButton(true);
        setSelectedNodesCount(selectedNodes.length);
      } else {
        setShowRegenerateButton(false);
      }
    };

    document.addEventListener("mouseup", handleSelectionUpdate);

    return () => {
      document.removeEventListener("mouseup", handleSelectionUpdate);
    };
  }, [getNodes, onGenerateDialog]);

  const handleRegenerateSelected = useCallback(async () => {
    if (!onGenerateDialog) return;

    setIsGeneratingMultiple(true);

      const actualSelectedNodes = getNodes()
        .filter((node) => node.selected)
        .map((node) => node.id);

      setGenerationProgress({ current: 0, total: actualSelectedNodes.length });

      setIsRegeneratingNodes(true);
      setCurrentBulkRegenerationNodes(actualSelectedNodes);

    try {
      const sortedNodes = await sortNodesByDialogFlow(
        actualSelectedNodes,
        nodes,
        connections.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle || undefined,
          targetHandle: edge.targetHandle || undefined,
          type: edge.type,
        }))
      );

      for (let i = 0; i < sortedNodes.length; i++) {
        const nodeId = sortedNodes[i].id;
        const node = nodes.find((n) => n.id === nodeId);
        if (!node) continue;

        setProcessingNodeId(nodeId);

        setGenerationProgress((prev) => ({ ...prev, current: i + 1 }));

        try {
          await onGenerateDialog(nodeId, "recreate");
          await new Promise((resolve) => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                resolve(undefined);
              });
            });
          });
        } catch (error) {
          logger.error(`Error generating dialog for node ${nodeId}:`, error);
        }
      }
      } finally {
        setIsGeneratingMultiple(false);
        setGenerationProgress({ current: 0, total: 0 });

        setIsRegeneratingNodes(false);
        setCurrentBulkRegenerationNodes(undefined);

      setProcessingNodeId(null);
    }
  }, [onGenerateDialog, nodes, connections, getNodes]);

  const [showSearchOverlay, setShowSearchOverlay] = useState(false);

  // Focus search input when overlay opens
  useEffect(() => {
    if (showSearchOverlay) {
      // Small delay to ensure the overlay is fully rendered
      const timer = setTimeout(() => {
        const searchInput = document.querySelector('input[placeholder*="Search nodes"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showSearchOverlay]);

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2 shadow-md"
      style={{
        background: theme.colors.toolbar.background,
        borderBottom: `1px solid ${theme.colors.toolbar.border}`,
      }}
    >
      <div
        className="flex items-center gap-2 py-1 px-2 rounded-md flex-1 justify-start"
        style={{ background: theme.colors.toolbar.background }}
      >
        <ToolbarButton
          onClick={onToggleLeftPanel}
          title="Toggle Left Panel"
          icon={
            <PanelLeft
              className="w-3.5 h-3.5"
              style={{ color: theme.colors.toolbar.button.default.text }}
            />
          }
        />

        <div className="w-px h-4" style={{ background: theme.colors.toolbar.divider }}></div>

        <ToolbarButton
          onClick={() => setShowTagManager(true)}
          title="Open Tag Manager"
          icon={
            <TagIcon
              className="w-3.5 h-3.5"
              style={{ color: theme.colors.toolbar.button.default.text }}
            />
          }
        />

        <ToolbarButton
          onClick={() => setShowSearchOverlay(true)}
          title="Search"
          icon={
            <Search
              className="w-3.5 h-3.5"
              style={{ color: theme.colors.toolbar.button.default.text }}
            />
          }
        />

        <ToolbarButton
          onClick={() => setShowFlowGenerator(true)}
          title="Generate Dialog Flow"
          icon={
            <Plus
              className="w-3.5 h-3.5"
              style={{ color: theme.colors.toolbar.button.default.text }}
            />
          }
        />

        <div className="w-px h-4" style={{ background: theme.colors.toolbar.divider }}></div>

        {viewMode !== undefined && viewMode !== null && onViewModeChange && (
          <>
            <div className="flex gap-0.5 bg-[#0D0D0F] rounded-sm p-0.5">
              <ToolbarButton
                onClick={() => onViewModeChange("grid")}
                title="Grid View"
                icon={<LayoutGrid className="w-3.5 h-3.5" />}
                className={viewMode === "grid" ? "bg-[#1E1E24]" : ""}
              />
              <ToolbarButton
                onClick={() => onViewModeChange("single")}
                title="Single View"
                icon={<AlignLeft className="w-3.5 h-3.5" />}
                className={viewMode === "single" ? "bg-[#1E1E24]" : ""}
              />
            </div>
          </>
        )}

        <ToolbarButton
          onClick={handleAutoLayout}
          title="Auto Layout"
          icon={
            <AlignStartVertical
              className="w-3.5 h-3.5"
              style={{ color: theme.colors.toolbar.button.default.text }}
            />
          }
        />

        {(selectedNodes.length > 1 || showRegenerateButton) && (
          <>
            <div className="w-px h-4" style={{ background: theme.colors.toolbar.divider }}></div>

            {selectedNodes.length > 1 && (
              <ToolbarButton
                onClick={() => onCreateSubgraph?.()}
                title={`Create Subgraph from ${selectedNodes.length} Selected Nodes`}
                icon={
                  <div className="relative">
                    <span className="text-sm">📦</span>
                    <div className="absolute -top-1 -right-1 bg-green-500 text-white text-[8px] rounded-full w-3 h-3 flex items-center justify-center">
                      {selectedNodes.length}
                    </div>
                  </div>
                }
              />
            )}

            <ToolbarButton
              onClick={handleRegenerateSelected}
              title="Regenerate Selected Dialogs"
              disabled={isGeneratingMultiple}
              icon={
                isGeneratingMultiple ? (
                  <div className="relative">
                    <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                    <div className="absolute -top-1 -right-1 bg-blue-500 text-white text-[8px] rounded-full w-3 h-3 flex items-center justify-center">
                      {generationProgress.current}
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <Bot className="w-3.5 h-3.5 text-blue-400" />
                    <div className="absolute -top-1 -right-1 bg-blue-500 text-white text-[8px] rounded-full w-3 h-3 flex items-center justify-center">
                      {selectedNodesCount > 0 ? selectedNodesCount : selectedNodes.length}
                    </div>
                  </div>
                )
              }
              className="relative group"
            />
          </>
        )}
      </div>

      <div className="flex-shrink-0">
        <AnimatedLogo theme={theme} />
      </div>

      <div
        className="flex items-center gap-2 py-1 px-2 rounded-md flex-1 justify-end"
        style={{ background: theme.colors.toolbar.background }}
      >
        <ToolbarButton
          onClick={() => setIsSettingsOpen(true)}
          title="Settings"
          icon={
            <Settings
              className="w-3.5 h-3.5"
              style={{ color: theme.colors.toolbar.button.default.text }}
            />
          }
        />

        <div className="w-px h-4" style={{ background: theme.colors.toolbar.divider }}></div>

        <ToolbarButton
          onClick={onToggleRightPanel}
          title="Toggle Right Panel"
          icon={
            <PanelRight
              className="w-3.5 h-3.5"
              style={{ color: theme.colors.toolbar.button.default.text }}
            />
          }
        />
      </div>

      <FlowGenerator
        key={`flowgenerator-${projectType}`}
        show={showFlowGenerator}
        onClose={() => setShowFlowGenerator(false)}
        onAddNodes={onAddNodes}
        onAddConnections={onAddConnections}
        onEditNode={onEditNode}
        onUpdateNode={onUpdateNode}
        projectType={projectType}
      />

      <TagManagerModal show={showTagManager} onClose={() => setShowTagManager(false)} />

      {showSearchOverlay && (
        <div className="fixed inset-0 z-50" onClick={() => setShowSearchOverlay(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[720px] max-w-[92vw]">
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0B0B0C] border border-gray-700 rounded-xl shadow-xl p-2"
            >
              <SmartSearchBar
                key={showSearchOverlay ? 'search-open' : 'search-closed'}
                nodes={nodes}
                connections={connections.map((edge) => ({
                  id: edge.id,
                  source: edge.source,
                  target: edge.target,
                  sourceHandle: edge.sourceHandle || undefined,
                  targetHandle: edge.targetHandle || undefined,
                  type: edge.type,
                }))}
                onNodeSelect={onNodeSelect}
                onClose={() => setShowSearchOverlay(false)}
                placeholder="Search nodes, content, and connections..."
                className="w-full"
                autoFocus={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const AnimatedLogo: React.FC<{ theme: ThemeConfig }> = ({ theme }) => {
  const animationStyles = `
    @keyframes border-pulse {
      0% { border-color: ${theme.colors.toolbar.logo.borderAnimation.color}00; }
      50% { border-color: ${theme.colors.toolbar.logo.borderAnimation.color}; }
      100% { border-color: ${theme.colors.toolbar.logo.borderAnimation.color}00; }
    }

    @keyframes pulse-opacity {
      0% { opacity: 0.7; }
      50% { opacity: 1; }
      100% { opacity: 0.7; }
    }

    @keyframes gradient-shift {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }

    @keyframes shine-sweep {
      0% { background-position: -200% 0%, 0% 0%; }
      50% { background-position: 200% 0%, 0% 0%; }
      100% { background-position: -200% 0%, 0% 0%; }
    }

    @keyframes float-y {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-1px); }
    }
  `;

  React.useEffect(() => {
    const styleElement = document.createElement("style");
    styleElement.textContent = animationStyles;
    document.head.appendChild(styleElement);

    return () => {
      if (document.head.contains(styleElement)) {
        document.head.removeChild(styleElement);
      }
    };
  }, [animationStyles]);

  const logoColors = theme.colors.toolbar.logo;

  return (
    <div
      className="relative h-8 flex items-center justify-center px-3.5 py-1.5 rounded-md overflow-hidden"
      style={{
        background:
          `linear-gradient(120deg, ${logoColors.background}, ` +
          `${logoColors.glow.secondary}22, ` +
          `${logoColors.background})`,
        backgroundSize: "220% 220%",
        borderColor: logoColors.borderColor,
        boxShadow:
          `0 0 10px ${logoColors.glow.primary}55, ` +
          `0 0 4px ${logoColors.glow.secondary}55`,
        animation: "gradient-shift 10s ease-in-out infinite, border-pulse 4s infinite",
        backdropFilter: "saturate(140%) blur(6px)",
      }}
    >
      <div className="flex items-center gap-0.5 relative z-10">
        {Array.from("DAILOG").map((char, i) => (
          <AnimatedLogoChar key={i} char={char} index={i} theme={theme} />
        ))}
      </div>

      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0"
        style={{
          height: 2,
          background:
            `linear-gradient(90deg, ${logoColors.glow.secondary}, ${logoColors.glow.primary})`,
          opacity: 0.35,
        }}
      />
    </div>
  );
};

const AnimatedLogoChar = React.memo<{ char: string; index: number; theme: ThemeConfig }>(
  ({ char, index, theme }) => {
    const palette = theme.colors.toolbar.logo.text.colors;
    const charColor = palette[index % palette.length];

    const baseGradient = `linear-gradient(180deg, rgba(255,255,255,0.9), ${charColor})`;
    const shineGradient = `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)`;

    return (
      <span
        className="text-[17px] font-extrabold tracking-wider select-none relative inline-block"
        style={{
          animation: `pulse-opacity 2.4s infinite ${index * 0.12}s, float-y 3.4s ease-in-out infinite`,
          willChange: "opacity, transform",
          letterSpacing: 1,
        }}
      >
        <span
          style={{
            backgroundImage: `${shineGradient}, ${baseGradient}`,
            backgroundSize: "200% 100%, 100% 100%",
            backgroundPosition: `${-100 + (index * 15)}% 0%, 0% 0%`,
            animation: `shine-sweep 6s ease-in-out infinite ${index * 0.3}s`,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "transparent",
            textShadow: theme.colors.toolbar.logo.text.shadow,
            display: "inline-block",
            position: "relative",
            zIndex: 2,
          }}
        >
          {char}
        </span>
      </span>
    );
  }
);
