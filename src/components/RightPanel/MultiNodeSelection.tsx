import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  Trash2,
  TagIcon,
  Filter,
  ArrowDown,
  ArrowUp,
  Search,
  X,
  Info as InfoIcon,
} from "lucide-react";
import { DialogNode, Tag } from "../../types/dialog";
import { useTheme } from "../../theme/ThemeProvider";
import { getRightPanelTheme } from "../../theme/components/RightPanelTheme";

interface MultiNodeSelectionProps {
  selectedNodes: DialogNode[];
  onDelete: (ids: string[]) => void;
  onSelectNode: (id: string) => void;
  onScrollToNode?: (id: string) => void;
  setActiveTab?: (tab: "details" | "tags" | "analysis") => void;
}

interface NodeTypeStat {
  type: string;
  count: number;
  color: string;
}

const MultiNodeSelection: React.FC<MultiNodeSelectionProps> = ({
  selectedNodes,
  onDelete,
  onSelectNode,
  onScrollToNode,
  setActiveTab,
}) => {
  const { theme } = useTheme();
  const rightPanelTheme = useMemo(() => getRightPanelTheme(theme), [theme]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [sortOrder, setSortOrder] = useState<"default" | "asc" | "desc">(
    "default",
  );
  const [showStats, setShowStats] = useState(true);

  const resetFilters = useCallback(() => {
    setSearchTerm("");
    setSelectedType(null);
    setSortOrder("default");
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        (searchTerm || selectedType || sortOrder !== "default")
      ) {
        resetFilters();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "f" && !showConfirmDelete) {
        e.preventDefault();
        const searchInput = document.getElementById("multi-node-search");
        if (searchInput) {
          searchInput.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchTerm, selectedType, sortOrder, resetFilters, showConfirmDelete]);

  const getColorForNodeType = (nodeType: string): string => {
    switch (nodeType) {
      case "npcDialog":
        return "#3B82F6";
      case "playerResponse":
        return "#10B981";
      case "enemyDialog":
        return "#EF4444";
      case "customNode":
        return "#60A5FA";
      case "narratorNode":
        return "#8B5CF6";
      case "choiceNode":
        return "#F59E0B";
      case "branchingNode":
        return "#EC4899";
      case "sceneNode":
        return "#6366F1";
      case "characterDialogNode":
        return "#0EA5E9";
      case "sceneDescriptionNode":
        return "#14B8A6";
      default:
        return "#6B7280";
    }
  };

  const truncateText = (text: string | any, maxLength: number): string => {
    const safeText = typeof text === "string" ? text : String(text || "");
    if (!safeText) return "";
    if (safeText.length <= maxLength) return safeText;
    return safeText.substring(0, maxLength - 3) + "...";
  };

  const nodeTypeStats: NodeTypeStat[] = useMemo(() => {
    const typeCounter: { [key: string]: number } = {};

    selectedNodes.forEach((node) => {
      const type = node.type;
      typeCounter[type] = (typeCounter[type] || 0) + 1;
    });

    return Object.entries(typeCounter).map(([type, count]) => ({
      type,
      count,
      color: getColorForNodeType(type),
    }));
  }, [selectedNodes]);

  const filteredNodes = useMemo(() => {
    let filtered = selectedNodes;

    if (searchTerm) {
      filtered = filtered.filter(
        (node) => {
          const nodeText = typeof node.data.text === "string"
            ? node.data.text
            : String(node.data.text || "");
          return (
            nodeText.toLowerCase().includes(searchTerm.toLowerCase()) ||
            node.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            node.type.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }
      );
    }

    if (selectedType) {
      filtered = filtered.filter((node) => node.type === selectedType);
    }

    if (sortOrder !== "default") {
      return [...filtered].sort((a, b) => {
        const aText = typeof a.data.text === "string"
          ? a.data.text
          : String(a.data.text || "");
        const bText = typeof b.data.text === "string"
          ? b.data.text
          : String(b.data.text || "");
        if (sortOrder === "asc") {
          return aText.localeCompare(bText);
        } else {
          return bText.localeCompare(aText);
        }
      });
    }

    return filtered;
  }, [selectedNodes, searchTerm, selectedType, sortOrder]);

  const stats = useMemo(() => {
    const totalChars = selectedNodes.reduce(
      (sum, node) => {
        const nodeText = typeof node.data.text === "string"
          ? node.data.text
          : String(node.data.text || "");
        return sum + nodeText.length;
      },
      0,
    );
    const avgChars = selectedNodes.length
      ? Math.round(totalChars / selectedNodes.length)
      : 0;

    return {
      totalNodes: selectedNodes.length,
      totalChars,
      avgChars,
    };
  }, [selectedNodes]);

  const handleConfirmDelete = useCallback(() => {
    onDelete(selectedNodes.map((node) => node.id));
    setShowConfirmDelete(false);
  }, [selectedNodes, onDelete]);

  return (
    <div
      className="h-full flex flex-col"
      style={{ background: rightPanelTheme.background }}
    >
      <div
        className="flex-none px-2.5 h-10 flex items-center justify-between backdrop-blur-sm"
        style={{
          borderBottom: `1px solid ${rightPanelTheme.header.border}`,
          background: "rgba(13, 13, 15, 0.5)",
        }}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="text-sm"
            style={{ color: rightPanelTheme.header.text.secondary }}
          >
            {selectedNodes.length} selected
          </span>
          <span
            className="text-sm"
            style={{ color: rightPanelTheme.header.text.muted }}
          >
            ·
          </span>
          <span
            className="text-sm"
            style={{ color: rightPanelTheme.header.text.muted }}
          >
            {filteredNodes.length} visible
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowStats(!showStats)}
            className="p-1.5 rounded-md transition-colors"
            style={{
              color: showStats
                ? rightPanelTheme.header.text.primary
                : rightPanelTheme.button.default.text,
            }}
          >
            <InfoIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowConfirmDelete(true)}
            className="p-1.5 rounded-md transition-colors hover:text-red-400"
            style={{
              color: rightPanelTheme.button.danger.text,
            }}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col">
          <div className="flex-none px-2.5 py-2">
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3"
                  style={{ color: rightPanelTheme.content.text.muted }}
                />
                <input
                  id="multi-node-search"
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search nodes..."
                  className="w-full h-7 rounded-md pl-7 pr-7 text-xs transition-all focus:outline-none backdrop-blur-sm"
                  style={{
                    background: rightPanelTheme.section.background,
                    color: rightPanelTheme.content.text.primary,
                    border: `1px solid ${rightPanelTheme.section.border}`,
                    boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
                  }}
                  onFocus={(e) => {
                    e.target.style.background = rightPanelTheme.button.hover.background;
                    e.target.style.borderColor = rightPanelTheme.tabs.active.border;
                    e.target.style.boxShadow = `0 0 0 2px ${rightPanelTheme.tabs.active.border}40`;
                  }}
                  onBlur={(e) => {
                    e.target.style.background = rightPanelTheme.section.background;
                    e.target.style.borderColor = rightPanelTheme.section.border;
                    e.target.style.boxShadow = "0 2px 8px -4px rgba(0, 0, 0, 0.2)";
                  }}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-md transition-colors"
                    style={{ color: rightPanelTheme.content.text.muted }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = rightPanelTheme.content.text.secondary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = rightPanelTheme.content.text.muted;
                    }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                onClick={() =>
                  setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                }
                className="p-2 rounded-md transition-colors"
                style={{
                  color:
                    sortOrder !== "default"
                      ? rightPanelTheme.content.text.primary
                      : rightPanelTheme.button.default.text,
                }}
                onMouseEnter={(e) => {
                  if (sortOrder === "default") {
                    e.currentTarget.style.color = rightPanelTheme.button.hover.text;
                    e.currentTarget.style.background = rightPanelTheme.button.hover.background;
                  }
                }}
                onMouseLeave={(e) => {
                  if (sortOrder === "default") {
                    e.currentTarget.style.color = rightPanelTheme.button.default.text;
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                {sortOrder === "asc" ? (
                  <ArrowDown className="w-3.5 h-3.5" />
                ) : (
                  <ArrowUp className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                onClick={() => setSelectedType(null)}
                className="p-2 rounded-md transition-colors"
                style={{
                  color: selectedType
                    ? rightPanelTheme.content.text.primary
                    : rightPanelTheme.button.default.text,
                }}
                onMouseEnter={(e) => {
                  if (!selectedType) {
                    e.currentTarget.style.color = rightPanelTheme.button.hover.text;
                    e.currentTarget.style.background = rightPanelTheme.button.hover.background;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!selectedType) {
                    e.currentTarget.style.color = rightPanelTheme.button.default.text;
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                <Filter className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {showStats && (
            <div className="flex-none px-2.5 py-2 space-y-2">
            <div
                className="rounded-md p-2.5 border backdrop-blur-md"
              style={{
                  background: rightPanelTheme.selectionPanel.card.background,
                  borderColor: rightPanelTheme.selectionPanel.card.border,
                  backdropFilter: rightPanelTheme.selectionPanel.card.backdropFilter,
                  boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
              }}
            >
                <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <div
                    className="text-lg font-light"
                    style={{ color: rightPanelTheme.stats.text.value }}
                  >
                    {stats.totalNodes}
                  </div>
                  <div
                    className="text-[10px] mt-0.5"
                    style={{ color: rightPanelTheme.stats.text.label }}
                  >
                    Nodes
                  </div>
                </div>
                <div>
                  <div
                    className="text-lg font-light"
                    style={{ color: rightPanelTheme.stats.text.value }}
                  >
                    {stats.totalChars}
                  </div>
                  <div
                    className="text-[10px] mt-0.5"
                    style={{ color: rightPanelTheme.stats.text.label }}
                  >
                    Characters
                  </div>
                </div>
                <div>
                  <div
                    className="text-lg font-light"
                    style={{ color: rightPanelTheme.stats.text.value }}
                  >
                    {stats.avgChars}
                  </div>
                  <div
                    className="text-[10px] mt-0.5"
                    style={{ color: rightPanelTheme.stats.text.label }}
                  >
                    Avg. Length
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 pt-1.5 border-t" style={{ borderColor: rightPanelTheme.header.border }}>
                <div className="flex items-center justify-between">
                  <span
                    className="text-xs"
                    style={{ color: rightPanelTheme.stats.text.label }}
                  >
                    Distribution
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: rightPanelTheme.stats.text.label }}
                  >
                    {nodeTypeStats.length} types
                  </span>
                </div>

                <div
                  className="relative h-1 rounded-full overflow-hidden"
                  style={{ background: rightPanelTheme.section.background }}
                >
                  {nodeTypeStats.map((stat, index, array) => {
                    const prevSum = array
                      .slice(0, index)
                      .reduce((sum, s) => sum + s.count, 0);
                    const totalNodes = array.reduce(
                      (sum, s) => sum + s.count,
                      0,
                    );
                    const width = (stat.count / totalNodes) * 100;

                    return (
                      <div
                        key={stat.type}
                        className="absolute top-0 h-full cursor-pointer transition-opacity"
                        style={{
                          left: `${(prevSum / totalNodes) * 100}%`,
                          width: `${width}%`,
                          backgroundColor: stat.color,
                          opacity:
                            selectedType === stat.type
                              ? 0.8
                              : selectedType
                                ? 0.2
                                : 0.4,
                        }}
                        title={`${stat.type}: ${stat.count} (${Math.round(width)}%)`}
                        onClick={() =>
                          setSelectedType(
                            selectedType === stat.type ? null : stat.type,
                          )
                        }
                      />
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-2">
                  {nodeTypeStats.map((stat) => (
                    <button
                      key={stat.type}
                      onClick={() =>
                        setSelectedType(
                          selectedType === stat.type ? null : stat.type,
                        )
                      }
                      className="group flex items-center gap-2 px-2 h-6 rounded-md transition-colors"
                      style={{
                        background:
                          selectedType === stat.type
                            ? rightPanelTheme.button.active.background
                            : "transparent",
                        color:
                          selectedType === stat.type
                            ? rightPanelTheme.button.active.text
                            : rightPanelTheme.button.default.text,
                      }}
                      onMouseEnter={(e) => {
                        if (selectedType !== stat.type) {
                          e.currentTarget.style.background =
                            rightPanelTheme.button.hover.background;
                          e.currentTarget.style.color = rightPanelTheme.button.hover.text;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedType !== stat.type) {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.color = rightPanelTheme.button.default.text;
                        }
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: stat.color }}
                      />
                      <span className="text-xs">{stat.type}</span>
                      <span
                        className="text-xs"
                        style={{ color: rightPanelTheme.content.text.muted }}
                      >
                        {stat.count}
                      </span>
                    </button>
                  ))}
                </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-2.5 py-2">
            {filteredNodes.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
          <div
                  className="rounded-md p-4 border backdrop-blur-sm max-w-[200px]"
            style={{
                    background: rightPanelTheme.section.background,
                    borderColor: rightPanelTheme.section.border,
                    boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
            }}
          >
                <Search
                    className="w-5 h-5 mb-2 mx-auto"
                    style={{ color: rightPanelTheme.content.text.muted, opacity: 0.2 }}
                />
                <p
                    className="text-xs font-medium mb-1"
                    style={{ color: rightPanelTheme.content.text.secondary }}
                  >
                    No results
                  </p>
                  <p
                    className="text-[10px] leading-relaxed"
                    style={{ color: rightPanelTheme.content.text.muted }}
                >
                    Try adjusting your search or filters
                </p>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredNodes.map((node) => (
                  <button
                    key={node.id}
                    className="w-full px-2.5 py-2 rounded-md text-left transition-all duration-200 group backdrop-blur-sm"
                    style={{
                      background: rightPanelTheme.selectionPanel.card.background,
                      border: `1px solid ${rightPanelTheme.selectionPanel.card.border}`,
                      boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = rightPanelTheme.button.hover.background;
                      e.currentTarget.style.borderColor = rightPanelTheme.button.hover.border;
                      e.currentTarget.style.boxShadow = "0 2px 8px -4px rgba(0, 0, 0, 0.2)";
                      e.currentTarget.style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = rightPanelTheme.selectionPanel.card.background;
                      e.currentTarget.style.borderColor = rightPanelTheme.selectionPanel.card.border;
                      e.currentTarget.style.boxShadow = "0 1px 4px -2px rgba(0, 0, 0, 0.15)";
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.background = rightPanelTheme.button.hover.background;
                      e.currentTarget.style.borderColor = rightPanelTheme.tabs.active.border;
                      e.currentTarget.style.boxShadow = `0 0 0 2px ${rightPanelTheme.tabs.active.border}40`;
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.background = rightPanelTheme.selectionPanel.card.background;
                      e.currentTarget.style.borderColor = rightPanelTheme.selectionPanel.card.border;
                      e.currentTarget.style.boxShadow = "0 1px 4px -2px rgba(0, 0, 0, 0.15)";
                    }}
                    onClick={() => {
                      onSelectNode(node.id);
                      if (onScrollToNode) {
                        onScrollToNode(node.id);
                      }
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 transition-all"
                        style={{
                          backgroundColor: getColorForNodeType(node.type),
                          boxShadow: `0 0 4px ${getColorForNodeType(node.type)}40`,
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span
                            className="text-[10px] font-medium uppercase tracking-wide"
                            style={{ color: rightPanelTheme.content.text.muted }}
                          >
                            {node.type}
                          </span>
                          <span
                            className="text-[9px] font-mono"
                            style={{ color: rightPanelTheme.content.text.muted, opacity: 0.4 }}
                          >
                            {truncateText(node.id, 6)}
                          </span>
                        </div>
                        <p
                          className="text-xs line-clamp-2 leading-relaxed"
                          style={{
                            color: rightPanelTheme.content.text.primary,
                          }}
                        >
                          {typeof node.data.text === "string"
                            ? node.data.text
                            : node.data.text != null && typeof node.data.text === "object"
                              ? "[Invalid text content]"
                              : String(node.data.text || "")}
                        </p>
                        {node.data.metadata?.nodeData?.tags &&
                          node.data.metadata.nodeData.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {node.data.metadata.nodeData.tags
                                .slice(0, 3)
                                .map((tag: Tag) => (
                                  <span
                                    key={tag.id}
                                    className="px-1 py-0.5 rounded text-[9px] backdrop-blur-sm"
                                    style={{
                                      background: rightPanelTheme.section.background,
                                      color: rightPanelTheme.content.text.muted,
                                      border: `1px solid ${rightPanelTheme.section.border}`,
                                    }}
                                  >
                                    {tag.label || tag.id}
                                  </span>
                                ))}
                              {node.data.metadata.nodeData.tags.length > 3 && (
                                <span
                                  className="px-1 py-0.5 rounded text-[9px]"
                                  style={{ color: rightPanelTheme.content.text.muted }}
                                >
                                  +{node.data.metadata.nodeData.tags.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-none px-2.5 py-2 space-y-1.5 border-t backdrop-blur-sm" style={{ borderColor: rightPanelTheme.header.border, background: "rgba(13, 13, 15, 0.3)" }}>
            <div className="flex gap-1.5">
              <button
                onClick={() => setActiveTab && setActiveTab("tags")}
                className="flex-1 h-7 flex items-center justify-center gap-1 rounded-md transition-all duration-200 backdrop-blur-sm border"
                style={{
                  background: rightPanelTheme.button.default.background,
                  color: rightPanelTheme.button.default.text,
                  borderColor: rightPanelTheme.button.default.border,
                  boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = rightPanelTheme.button.hover.background;
                  e.currentTarget.style.color = rightPanelTheme.button.hover.text;
                  e.currentTarget.style.borderColor = rightPanelTheme.button.hover.border;
                  e.currentTarget.style.boxShadow = "0 2px 8px -4px rgba(0, 0, 0, 0.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = rightPanelTheme.button.default.background;
                  e.currentTarget.style.color = rightPanelTheme.button.default.text;
                  e.currentTarget.style.borderColor = rightPanelTheme.button.default.border;
                  e.currentTarget.style.boxShadow = "0 1px 4px -2px rgba(0, 0, 0, 0.15)";
                }}
              >
                <TagIcon className="w-3 h-3" />
                <span className="text-[10px]">Manage Tags</span>
              </button>
              <button
                onClick={() => setShowConfirmDelete(true)}
                className="flex-1 h-7 flex items-center justify-center gap-1 rounded-md transition-all duration-200 backdrop-blur-sm border"
                style={{
                  background: rightPanelTheme.button.default.background,
                  color: rightPanelTheme.button.danger.text,
                  borderColor: rightPanelTheme.button.default.border,
                  boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = rightPanelTheme.button.danger.background;
                  e.currentTarget.style.color = rightPanelTheme.button.danger.hover;
                  e.currentTarget.style.borderColor = rightPanelTheme.button.danger.hover;
                  e.currentTarget.style.boxShadow = "0 2px 8px -4px rgba(0, 0, 0, 0.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = rightPanelTheme.button.default.background;
                  e.currentTarget.style.color = rightPanelTheme.button.danger.text;
                  e.currentTarget.style.borderColor = rightPanelTheme.button.default.border;
                  e.currentTarget.style.boxShadow = "0 1px 4px -2px rgba(0, 0, 0, 0.15)";
                }}
              >
                <Trash2 className="w-3 h-3" />
                <span className="text-[10px]">Delete All</span>
              </button>
            </div>

            <div
              className="flex items-start gap-1 text-[9px]"
              style={{ color: rightPanelTheme.content.text.muted }}
            >
              <InfoIcon className="w-2.5 h-2.5 mt-0.5 flex-shrink-0" />
              <p className="leading-relaxed">
                Hold <span style={{ color: rightPanelTheme.content.text.secondary }}>Shift</span> or{" "}
                <span style={{ color: rightPanelTheme.content.text.secondary }}>Ctrl</span> to select multiple
                nodes. Press <span style={{ color: rightPanelTheme.content.text.secondary }}>Ctrl+A</span> to
                select all nodes in view.
              </p>
            </div>
          </div>
        </div>
      </div>

      {showConfirmDelete && (
        <div
          className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50"
          style={{
            background: rightPanelTheme.selectionPanel.modal.overlay,
            backdropFilter: rightPanelTheme.selectionPanel.modal.backdropFilter,
          }}
        >
          <div
            className="w-full max-w-xs border rounded-lg"
            style={{
              background: rightPanelTheme.selectionPanel.modal.background,
              borderColor: rightPanelTheme.selectionPanel.modal.border,
            }}
          >
            <div className="px-6 py-4">
              <div className="flex items-start gap-4">
                <div>
                  <h3
                    className="text-sm mb-2"
                    style={{ color: rightPanelTheme.content.text.primary }}
                  >
                    Delete {selectedNodes.length} nodes?
                  </h3>
                  <p
                    className="text-xs"
                    style={{ color: rightPanelTheme.content.text.muted }}
                  >
                    This action cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowConfirmDelete(false)}
                  className="px-3 h-8 text-xs transition-colors"
                  style={{ color: rightPanelTheme.button.default.text }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = rightPanelTheme.button.hover.text;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = rightPanelTheme.button.default.text;
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="px-3 h-8 text-xs transition-colors"
                  style={{ color: rightPanelTheme.button.danger.text }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = rightPanelTheme.button.danger.hover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = rightPanelTheme.button.danger.text;
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiNodeSelection;
