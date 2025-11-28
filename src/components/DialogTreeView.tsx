import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { FixedSizeList as List } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import {
  Search,
  ChevronRight,
  ChevronDown,
  GitBranch,
  GitMerge,
  AlertTriangle,
  FileText,
  MessageSquare,
  User,
  Target,
  X,
  TrendingUp,
} from "lucide-react";
import { DialogNode } from "../types/dialog";
import { Connection } from "../types/nodes";
import logger from "../utils/logger";

interface DialogTreeViewProps {
  nodes: DialogNode[];
  connections: Connection[];
  onNodeSelect?: (nodeId: string) => void;
}

interface TreeNode extends DialogNode {
  children: TreeNode[];
  parent: TreeNode | null;
  level: number;
  expanded: boolean;
  visible: boolean;
  isBranchPoint?: boolean;
  isMergePoint?: boolean;
  isDeadEnd?: boolean;
  isOrphan?: boolean;
  pathCount?: number;
  complexity?: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TreeModeState {
  searchTerm: string;
  selectedFilters: Set<string>;
  expandedNodes: Set<string>;
  selectedNode: string | null;
  showAnalytics: boolean;
  compactMode: boolean;
  highlightSearch: boolean;
}

interface TreeAnalytics {
  totalNodes: number;
  branchPoints: number;
  mergePoints: number;
  deadEnds: number;
  orphanNodes: number;
  maxDepth: number;
  averageDepth: number;
  complexityScore: number;
  totalPaths: number;
}

const NODE_HEIGHT = 56;
const COMPACT_NODE_HEIGHT = 40;
const INDENT_WIDTH = 20;

const getNodeIcon = (type: string) => {
  const iconClass = "w-3.5 h-3.5";
  switch (type) {
    case "npcDialog":
      return <MessageSquare className={`${iconClass} text-blue-400`} />;
    case "playerResponse":
      return <User className={`${iconClass} text-green-400`} />;
    case "narrator":
    case "narratorNode":
      return <FileText className={`${iconClass} text-yellow-400`} />;
    case "choice":
    case "choiceNode":
      return <GitBranch className={`${iconClass} text-purple-400`} />;
    case "enemyDialog":
      return <AlertTriangle className={`${iconClass} text-red-400`} />;
    default:
      return <Target className={`${iconClass} text-gray-400`} />;
  }
};

const getNodeTypeColor = (type: string) => {
  switch (type) {
    case "npcDialog":
      return "border-l-blue-500";
    case "playerResponse":
      return "border-l-green-500";
    case "narrator":
    case "narratorNode":
      return "border-l-yellow-500";
    case "choice":
    case "choiceNode":
      return "border-l-purple-500";
    case "enemyDialog":
      return "border-l-red-500";
    default:
      return "border-l-gray-500";
  }
};

export const DialogTreeView: React.FC<DialogTreeViewProps> = ({
  nodes,
  connections,
  onNodeSelect,
}) => {
  const [state, setState] = useState<TreeModeState>({
    searchTerm: "",
    selectedFilters: new Set(),
    expandedNodes: new Set(),
    selectedNode: null,
    showAnalytics: false,
    compactMode: false,
    highlightSearch: true,
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const treeContainerRef = useRef<HTMLDivElement>(null);

  // Build tree structure with analysis
  const { flattenedNodes, analytics } = useMemo(() => {
    logger.debug("[DialogTreeView] Building tree structure", {
      nodeCount: nodes.length,
      connectionCount: connections.length,
    });

    const nodeMap = new Map<string, TreeNode>();
    const rootNodes: TreeNode[] = [];

    nodes.forEach((node) => {
      const treeNode: TreeNode = {
        ...node,
        children: [],
        parent: null,
        level: 0,
        expanded: state.expandedNodes.has(node.id),
        visible: true,
        x: 0,
        y: 0,
        width: 300,
        height: state.compactMode ? COMPACT_NODE_HEIGHT : NODE_HEIGHT,
      };
      nodeMap.set(node.id, treeNode);
    });

    connections.forEach((conn) => {
      const parent = nodeMap.get(conn.source);
      const child = nodeMap.get(conn.target);
      if (parent && child) {
        parent.children.push(child);
        child.parent = parent;
      }
    });

    nodeMap.forEach((node) => {
      if (!node.parent) {
        rootNodes.push(node);
      }
    });

    const calculateNodeAnalysis = (node: TreeNode, level: number = 0) => {
      node.level = level;
      node.isBranchPoint = node.children.length > 1;
      node.isDeadEnd = node.children.length === 0;
      node.isOrphan = !node.parent && node.children.length === 0;
      const incomingConnections = connections.filter((c) => c.target === node.id);
      node.isMergePoint = incomingConnections.length > 1;
      node.pathCount = node.children.length;
      node.complexity =
        (node.isBranchPoint ? 2 : 0) + (node.isMergePoint ? 3 : 0) + (node.isDeadEnd ? 1 : 0);
      node.children.forEach((child) => calculateNodeAnalysis(child, level + 1));
    };

    rootNodes.forEach((root) => calculateNodeAnalysis(root));

    const flattenTree = (nodes: TreeNode[]): TreeNode[] => {
      const result: TreeNode[] = [];
      const flatten = (node: TreeNode) => {
        result.push(node);
        if (node.expanded && node.children.length > 0) {
          node.children.forEach((child) => flatten(child));
        }
      };
      nodes.forEach((node) => flatten(node));
      return result;
    };

    const flattened = flattenTree(rootNodes);

    const allNodes = Array.from(nodeMap.values());
    const branchPoints = allNodes.filter((n) => n.isBranchPoint).length;
    const mergePoints = allNodes.filter((n) => n.isMergePoint).length;
    const deadEnds = allNodes.filter((n) => n.isDeadEnd).length;
    const orphanNodes = allNodes.filter((n) => n.isOrphan).length;
    const maxDepth = Math.max(...allNodes.map((n) => n.level), 0);
    const averageDepth =
      allNodes.length > 0 ? allNodes.reduce((sum, n) => sum + n.level, 0) / allNodes.length : 0;
    const complexityScore = allNodes.reduce((sum, n) => sum + (n.complexity || 0), 0);

    const analyticsData: TreeAnalytics = {
      totalNodes: allNodes.length,
      branchPoints,
      mergePoints,
      deadEnds,
      orphanNodes,
      maxDepth,
      averageDepth: Math.round(averageDepth * 10) / 10,
      complexityScore,
      totalPaths: connections.length,
    };

    return {
      flattenedNodes: flattened,
      analytics: analyticsData,
    };
  }, [nodes, connections, state.expandedNodes, state.compactMode]);

  const filteredNodes = useMemo(() => {
    let filtered = flattenedNodes;
    if (state.searchTerm.trim()) {
      const searchLower = state.searchTerm.toLowerCase();
      filtered = filtered.filter(
        (node) =>
          node.data.text.toLowerCase().includes(searchLower) ||
          node.type.toLowerCase().includes(searchLower) ||
          node.id.toLowerCase().includes(searchLower)
      );
    }
    if (state.selectedFilters.size > 0) {
      filtered = filtered.filter((node) => {
        if (state.selectedFilters.has(node.type)) return true;
        if (state.selectedFilters.has("branch") && node.isBranchPoint) return true;
        if (state.selectedFilters.has("merge") && node.isMergePoint) return true;
        if (state.selectedFilters.has("deadend") && node.isDeadEnd) return true;
        if (state.selectedFilters.has("orphan") && node.isOrphan) return true;
        return false;
      });
    }
    return filtered;
  }, [flattenedNodes, state.searchTerm, state.selectedFilters]);

  const highlightText = useCallback((text: string, searchTerm: string) => {
    if (!searchTerm.trim() || !state.highlightSearch) return text;
    const parts = text.split(new RegExp(`(${searchTerm})`, "gi"));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === searchTerm.toLowerCase() ? (
            <mark key={i} className="bg-yellow-500/30 text-yellow-200 rounded px-0.5">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  }, [state.highlightSearch]);

  const toggleNodeExpansion = useCallback((nodeId: string) => {
    setState((prev) => {
      const newExpanded = new Set(prev.expandedNodes);
      if (newExpanded.has(nodeId)) {
        newExpanded.delete(nodeId);
      } else {
        newExpanded.add(nodeId);
      }
      return { ...prev, expandedNodes: newExpanded };
    });
  }, []);

  const expandAll = useCallback(() => {
    const allNodeIds = new Set(nodes.map((n) => n.id));
    setState((prev) => ({ ...prev, expandedNodes: allNodeIds }));
  }, [nodes]);

  const collapseAll = useCallback(() => {
    setState((prev) => ({ ...prev, expandedNodes: new Set() }));
  }, []);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      setState((prev) => ({ ...prev, selectedNode: nodeId }));
      onNodeSelect?.(nodeId);
    },
    [onNodeSelect]
  );

  const toggleFilter = useCallback((filter: string) => {
    setState((prev) => {
      const newFilters = new Set(prev.selectedFilters);
      if (newFilters.has(filter)) {
        newFilters.delete(filter);
      } else {
        newFilters.add(filter);
      }
      return { ...prev, selectedFilters: newFilters };
    });
  }, []);

  const TreeItem = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const node = filteredNodes[index];
      if (!node) return null;

      const hasChildren = node.children.length > 0;
      const isExpanded = state.expandedNodes.has(node.id);
      const isSelected = state.selectedNode === node.id;
      const indentWidth = node.level * INDENT_WIDTH;

      return (
        <div style={style}>
          <div
            className={`
            group flex items-center px-3 py-2 cursor-pointer transition-colors duration-150 border-l-2
            ${getNodeTypeColor(node.type)}
            ${isSelected ? "bg-blue-500/10" : "hover:bg-gray-800/30"}
            ${state.compactMode ? "min-h-[40px]" : "min-h-[56px]"}
          `}
            style={{
              marginLeft: indentWidth,
              width: `calc(100% - ${indentWidth}px)`,
            }}
            onClick={() => {
              handleNodeClick(node.id);
              // Allow expanding/collapsing when clicking the text as well
              if (hasChildren) {
                toggleNodeExpansion(node.id);
              }
            }}
          >
            <div className="flex-shrink-0 w-6 flex items-center justify-center">
              {hasChildren ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleNodeExpansion(node.id);
                  }}
                  className="p-1 hover:bg-gray-700/50 rounded transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                  )}
                </button>
              ) : (
                <div className="w-3.5" />
              )}
            </div>

            <div className="flex-shrink-0 mr-2">{getNodeIcon(node.type)}</div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-sm text-gray-200 truncate"
                  title={node.data.text || `${node.type} Node`}
                >
                  {highlightText(node.data.text || `${node.type} Node`, state.searchTerm)}
                </span>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {node.isBranchPoint && (
                    <span title="Branch Point">
                      <GitBranch className="w-3 h-3 text-purple-400" />
                    </span>
                  )}
                  {node.isMergePoint && (
                    <span title="Merge Point">
                      <GitMerge className="w-3 h-3 text-orange-400" />
                    </span>
                  )}
                  {node.isDeadEnd && (
                    <span title="Dead End">
                      <AlertTriangle className="w-3 h-3 text-red-400" />
                    </span>
                  )}
                </div>
              </div>

              {!state.compactMode && (
                <div className="text-xs text-gray-500 mt-0.5 truncate">
                  {node.type} • L{node.level}
                  {hasChildren && ` • ${node.children.length} children`}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    },
    [filteredNodes, state, toggleNodeExpansion, handleNodeClick, highlightText]
  );

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setState((prev) => ({ ...prev, searchTerm: e.target.value }));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setState((prev) => ({ ...prev, searchTerm: "", selectedFilters: new Set() }));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filterOptions = [
    { id: "npcDialog", label: "NPC", color: "blue" },
    { id: "playerResponse", label: "Player", color: "green" },
    { id: "narrator", label: "Narrator", color: "yellow" },
    { id: "choice", label: "Choice", color: "purple" },
    { id: "branch", label: "Branches", color: "purple" },
    { id: "merge", label: "Merges", color: "orange" },
    { id: "deadend", label: "Dead Ends", color: "red" },
    { id: "orphan", label: "Orphans", color: "gray" },
  ];

  const getFilterColorClass = (color: string, isActive: boolean) => {
    if (!isActive) return "text-gray-400 bg-gray-800/30 hover:bg-gray-800/50 border-gray-700/30";
    const colors: Record<string, string> = {
      blue: "text-blue-400 bg-blue-500/10 border-blue-500/30",
      green: "text-green-400 bg-green-500/10 border-green-500/30",
      yellow: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
      purple: "text-purple-400 bg-purple-500/10 border-purple-500/30",
      orange: "text-orange-400 bg-orange-500/10 border-orange-500/30",
      red: "text-red-400 bg-red-500/10 border-red-500/30",
      gray: "text-gray-400 bg-gray-500/10 border-gray-500/30",
    };
    return colors[color] || colors.gray;
  };

  return (
    <div className="h-full flex flex-col bg-[#0A0A0B] text-white">
      <div className="flex-shrink-0 p-3 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-300">Tree View</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setState((prev) => ({ ...prev, compactMode: !prev.compactMode }))}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                state.compactMode
                  ? "bg-blue-500/20 text-blue-400"
                  : "bg-gray-800/50 text-gray-400 hover:text-gray-300"
              }`}
              title="Compact Mode"
            >
              Compact
            </button>
            <button
              onClick={() => setState((prev) => ({ ...prev, showAnalytics: !prev.showAnalytics }))}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                state.showAnalytics
                  ? "bg-blue-500/20 text-blue-400"
                  : "bg-gray-800/50 text-gray-400 hover:text-gray-300"
              }`}
              title="Analytics"
            >
              <TrendingUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={expandAll}
              className="px-2 py-1 text-xs bg-gray-800/50 text-gray-400 hover:text-gray-300 rounded transition-colors"
              title="Expand All"
            >
              All
            </button>
            <button
              onClick={collapseAll}
              className="px-2 py-1 text-xs bg-gray-800/50 text-gray-400 hover:text-gray-300 rounded transition-colors"
              title="Collapse All"
            >
              None
            </button>
          </div>
        </div>

        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input
            ref={searchInputRef}
            type="text"
            value={state.searchTerm}
            onChange={handleSearch}
            placeholder="Search... (Ctrl+F)"
            className="w-full pl-8 pr-8 py-1.5 text-sm bg-gray-800/50 border border-gray-700/50 rounded text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none transition-colors"
          />
          {state.searchTerm && (
            <button
              onClick={() => setState((prev) => ({ ...prev, searchTerm: "" }))}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 p-0.5 text-gray-500 hover:text-gray-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {filterOptions.map((filter) => {
            const isActive = state.selectedFilters.has(filter.id);
            return (
              <button
                key={filter.id}
                onClick={() => toggleFilter(filter.id)}
                className={`px-2 py-0.5 text-xs rounded border transition-colors ${getFilterColorClass(
                  filter.color,
                  isActive
                )}`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      {state.showAnalytics && (
        <div className="flex-shrink-0 p-3 bg-gray-900/30 border-b border-gray-800">
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="text-center">
              <div className="text-base font-semibold text-white">{analytics.totalNodes}</div>
              <div className="text-gray-500">Nodes</div>
            </div>
            <div className="text-center">
              <div className="text-base font-semibold text-purple-400">{analytics.branchPoints}</div>
              <div className="text-gray-500">Branches</div>
            </div>
            <div className="text-center">
              <div className="text-base font-semibold text-orange-400">{analytics.mergePoints}</div>
              <div className="text-gray-500">Merges</div>
            </div>
            <div className="text-center">
              <div className="text-base font-semibold text-red-400">{analytics.deadEnds}</div>
              <div className="text-gray-500">Dead Ends</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 relative overflow-hidden" ref={treeContainerRef}>
        <AutoSizer>
          {({ height, width }) => (
            <List
              height={height}
              width={width}
              itemCount={filteredNodes.length}
              itemSize={state.compactMode ? COMPACT_NODE_HEIGHT : NODE_HEIGHT}
              overscanCount={5}
            >
              {TreeItem}
            </List>
          )}
        </AutoSizer>
      </div>

      <div className="flex-shrink-0 px-3 py-1.5 bg-gray-900/30 border-t border-gray-800 text-xs text-gray-500">
        <div className="flex justify-between">
          <span>
            {filteredNodes.length} / {flattenedNodes.length}
            {state.searchTerm && ` • "${state.searchTerm}"`}
          </span>
          {state.selectedFilters.size > 0 && (
            <span>{state.selectedFilters.size} filters</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default DialogTreeView;
