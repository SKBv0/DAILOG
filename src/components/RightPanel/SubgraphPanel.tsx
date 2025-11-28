import React, { useState } from "react";
import { LogIn, Edit3, Box, ArrowRight, Users, Split, Trash2 } from "lucide-react";
import { DialogNode } from "../../types/dialog";
import useSubgraphNavigationStore from "../../store/subgraphNavigationStore";
import { useTheme } from "../../theme/ThemeProvider";
import { getRightPanelTheme } from "../../theme/components/RightPanelTheme";

interface SubgraphPanelProps {
  selectedNode: DialogNode;
  onEdit: (id: string, newText: string) => void;
  onDelete: (id: string) => void;
  onUngroup?: (id: string) => void;
}

export const SubgraphPanel: React.FC<SubgraphPanelProps> = React.memo(
  ({ selectedNode, onEdit, onDelete, onUngroup }) => {
    const { theme } = useTheme();
    const rightPanelTheme = React.useMemo(() => getRightPanelTheme(theme), [theme]);
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(selectedNode.data.text);

    const { enterSubgraph } = useSubgraphNavigationStore();

    const subgraphData = (selectedNode.data.metadata as any)?.subgraph;
    const nodeCount = subgraphData?.nodes?.length || 0;
    const inputCount = subgraphData?.inputs?.length || 0;
    const outputCount = subgraphData?.outputs?.length || 0;
    const edgeCount = subgraphData?.edges?.length || 0;

    const handleEnterSubgraph = () => {
      enterSubgraph(selectedNode.id, {
        name: selectedNode.data.text || `Subgraph ${selectedNode.id}`,
        nodes: subgraphData?.nodes || [],
        edges: subgraphData?.edges || [],
      });
    };

    const handleUngroupSubgraph = () => {
      if (onUngroup) onUngroup(selectedNode.id);
    };

    const handleSaveEdit = () => {
      onEdit(selectedNode.id, editText);
      setIsEditing(false);
    };

    const handleCancelEdit = () => {
      setEditText(selectedNode.data.text);
      setIsEditing(false);
    };

    return (
      <div className="p-2.5 space-y-2.5">
        <div
          className="rounded-md p-2.5 border backdrop-blur-md"
          style={{
            background: rightPanelTheme.selectionPanel.card.background,
            borderColor: rightPanelTheme.selectionPanel.card.border,
            backdropFilter: rightPanelTheme.selectionPanel.card.backdropFilter,
            boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Box
                className="w-3 h-3"
                style={{ color: rightPanelTheme.tabs.active.text }}
              />
              <h2
                className="text-xs font-medium"
                style={{ color: rightPanelTheme.selectionPanel.card.header.text }}
              >
                Subgraph Details
              </h2>
          </div>
          <button
            onClick={handleEnterSubgraph}
              className="flex items-center gap-1 px-2 py-1 rounded-md transition-all duration-200 backdrop-blur-sm border flex-shrink-0"
              style={{
                background: rightPanelTheme.button.default.background,
                color: rightPanelTheme.tabs.active.text,
                borderColor: rightPanelTheme.button.default.border,
                boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = rightPanelTheme.button.hover.background;
                e.currentTarget.style.borderColor = rightPanelTheme.button.hover.border;
                e.currentTarget.style.boxShadow = "0 2px 8px -4px rgba(0, 0, 0, 0.2)";
                e.currentTarget.style.transform = "scale(1.02)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = rightPanelTheme.button.default.background;
                e.currentTarget.style.borderColor = rightPanelTheme.button.default.border;
                e.currentTarget.style.boxShadow = "0 1px 4px -2px rgba(0, 0, 0, 0.15)";
                e.currentTarget.style.transform = "scale(1)";
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = rightPanelTheme.tabs.active.border;
                e.currentTarget.style.boxShadow = `0 0 0 2px ${rightPanelTheme.tabs.active.border}40`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = rightPanelTheme.button.default.border;
                e.currentTarget.style.boxShadow = "0 1px 4px -2px rgba(0, 0, 0, 0.15)";
              }}
          >
              <LogIn className="w-3 h-3" />
              <span className="text-[10px]">Enter</span>
          </button>
        </div>

          <div className="space-y-2">
          <div className="flex items-center justify-between">
              <label
                className="text-[10px] font-medium"
                style={{ color: rightPanelTheme.content.text.muted }}
              >
                Title
              </label>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                  className="p-1 rounded transition-colors"
                  style={{ color: rightPanelTheme.button.default.text }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = rightPanelTheme.button.hover.background;
                    e.currentTarget.style.color = rightPanelTheme.button.hover.text;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = rightPanelTheme.button.default.text;
                  }}
                title="Edit title"
              >
                  <Edit3 className="w-3 h-3" />
              </button>
            )}
          </div>

          {isEditing ? (
              <div className="space-y-1.5">
              <input
                type="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-md text-xs transition-all focus:outline-none backdrop-blur-sm"
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
                placeholder="Enter subgraph title..."
                autoFocus
              />
                <div className="flex gap-1.5">
                <button
                  onClick={handleSaveEdit}
                    className="px-2 py-1 rounded text-[10px] font-medium transition-all"
                    style={{
                      background: rightPanelTheme.tabs.active.border,
                      color: "#FFFFFF",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = "0.9";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = "1";
                    }}
                >
                  Save
                </button>
                <button
                  onClick={handleCancelEdit}
                    className="px-2 py-1 rounded text-[10px] font-medium transition-colors"
                    style={{
                      background: rightPanelTheme.button.default.background,
                      color: rightPanelTheme.button.default.text,
                      borderColor: rightPanelTheme.button.default.border,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = rightPanelTheme.button.hover.background;
                      e.currentTarget.style.color = rightPanelTheme.button.hover.text;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = rightPanelTheme.button.default.background;
                      e.currentTarget.style.color = rightPanelTheme.button.default.text;
                    }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
              <p
                className="rounded-md p-2 border backdrop-blur-sm"
                style={{
                  background: rightPanelTheme.section.background,
                  borderColor: rightPanelTheme.section.border,
                  color: rightPanelTheme.content.text.primary,
                  boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
                }}
              >
                <span className="text-xs">
              {selectedNode.data.text || "Untitled Subgraph"}
                </span>
            </p>
          )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div
            className="rounded-md p-2.5 border backdrop-blur-sm"
            style={{
              background: rightPanelTheme.selectionPanel.card.background,
              borderColor: rightPanelTheme.selectionPanel.card.border,
              backdropFilter: rightPanelTheme.selectionPanel.card.backdropFilter,
              boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
            }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Users
                className="w-3 h-3"
                style={{ color: rightPanelTheme.nodeType.npcDialog }}
              />
              <span
                className="text-[10px] font-medium"
                style={{ color: rightPanelTheme.content.text.muted }}
              >
                Nodes
              </span>
            </div>
            <p
              className="text-lg font-light"
              style={{ color: rightPanelTheme.stats.text.value }}
            >
              {nodeCount}
            </p>
          </div>

          <div
            className="rounded-md p-2.5 border backdrop-blur-sm"
            style={{
              background: rightPanelTheme.selectionPanel.card.background,
              borderColor: rightPanelTheme.selectionPanel.card.border,
              backdropFilter: rightPanelTheme.selectionPanel.card.backdropFilter,
              boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
            }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <ArrowRight
                className="w-3 h-3"
                style={{ color: rightPanelTheme.nodeType.playerResponse }}
              />
              <span
                className="text-[10px] font-medium"
                style={{ color: rightPanelTheme.content.text.muted }}
              >
                Edges
              </span>
            </div>
            <p
              className="text-lg font-light"
              style={{ color: rightPanelTheme.stats.text.value }}
            >
              {edgeCount}
            </p>
          </div>

          <div
            className="rounded-md p-2.5 border backdrop-blur-sm"
            style={{
              background: rightPanelTheme.selectionPanel.card.background,
              borderColor: rightPanelTheme.selectionPanel.card.border,
              backdropFilter: rightPanelTheme.selectionPanel.card.backdropFilter,
              boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
            }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: rightPanelTheme.nodeType.npcDialog }}
              />
              <span
                className="text-[10px] font-medium"
                style={{ color: rightPanelTheme.content.text.muted }}
              >
                Inputs
              </span>
            </div>
            <p
              className="text-lg font-light"
              style={{ color: rightPanelTheme.stats.text.value }}
            >
              {inputCount}
            </p>
          </div>

          <div
            className="rounded-md p-2.5 border backdrop-blur-sm"
            style={{
              background: rightPanelTheme.selectionPanel.card.background,
              borderColor: rightPanelTheme.selectionPanel.card.border,
              backdropFilter: rightPanelTheme.selectionPanel.card.backdropFilter,
              boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
            }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: rightPanelTheme.nodeType.playerResponse }}
              />
              <span
                className="text-[10px] font-medium"
                style={{ color: rightPanelTheme.content.text.muted }}
              >
                Outputs
              </span>
            </div>
            <p
              className="text-lg font-light"
              style={{ color: rightPanelTheme.stats.text.value }}
            >
              {outputCount}
            </p>
          </div>
        </div>

        {subgraphData?.nodes && subgraphData.nodes.length > 0 && (
          <div
            className="rounded-md p-2.5 border backdrop-blur-md space-y-2"
            style={{
              background: rightPanelTheme.selectionPanel.card.background,
              borderColor: rightPanelTheme.selectionPanel.card.border,
              backdropFilter: rightPanelTheme.selectionPanel.card.backdropFilter,
              boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
            }}
          >
            <h3
              className="text-xs font-medium"
              style={{ color: rightPanelTheme.content.text.secondary }}
            >
              Internal Nodes
            </h3>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {subgraphData.nodes.map((node: any, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-1.5 rounded-md border backdrop-blur-sm transition-all"
                  style={{
                    background: rightPanelTheme.section.background,
                    borderColor: rightPanelTheme.section.border,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = rightPanelTheme.button.hover.background;
                    e.currentTarget.style.borderColor = rightPanelTheme.button.hover.border;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = rightPanelTheme.section.background;
                    e.currentTarget.style.borderColor = rightPanelTheme.section.border;
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-xs truncate"
                      style={{ color: rightPanelTheme.content.text.primary }}
                    >
                      {node.data?.text || `Node ${index + 1}`}
                    </p>
                    <p
                      className="text-[10px]"
                      style={{ color: rightPanelTheme.content.text.muted }}
                    >
                      {node.type}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(inputCount > 0 || outputCount > 0) && (
          <div
            className="rounded-md p-2.5 border backdrop-blur-md space-y-2"
            style={{
              background: rightPanelTheme.selectionPanel.card.background,
              borderColor: rightPanelTheme.selectionPanel.card.border,
              backdropFilter: rightPanelTheme.selectionPanel.card.backdropFilter,
              boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
            }}
          >
            <h3
              className="text-xs font-medium"
              style={{ color: rightPanelTheme.content.text.secondary }}
            >
              Input/Output Ports
            </h3>

            {inputCount > 0 && (
              <div className="space-y-1.5">
                <h4
                  className="text-[10px] font-medium"
                  style={{ color: rightPanelTheme.nodeType.npcDialog }}
                >
                  Inputs ({inputCount})
                </h4>
                {subgraphData?.inputs?.map((input: any, index: number) => (
                  <div key={index} className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ background: rightPanelTheme.nodeType.npcDialog }}
                    />
                    <span
                      className="text-xs"
                      style={{ color: rightPanelTheme.content.text.secondary }}
                    >
                      {input.label}
                    </span>
                    {input.dataType && (
                      <span
                        className="text-[10px]"
                        style={{ color: rightPanelTheme.content.text.muted }}
                      >
                        ({input.dataType})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {outputCount > 0 && (
              <div className="space-y-1.5">
                <h4
                  className="text-[10px] font-medium"
                  style={{ color: rightPanelTheme.nodeType.playerResponse }}
                >
                  Outputs ({outputCount})
                </h4>
                {subgraphData?.outputs?.map((output: any, index: number) => (
                  <div key={index} className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ background: rightPanelTheme.nodeType.playerResponse }}
                    />
                    <span
                      className="text-xs"
                      style={{ color: rightPanelTheme.content.text.secondary }}
                    >
                      {output.label}
                    </span>
                    {output.dataType && (
                      <span
                        className="text-[10px]"
                        style={{ color: rightPanelTheme.content.text.muted }}
                      >
                        ({output.dataType})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div
          className="pt-2.5 border-t space-y-1.5"
          style={{ borderColor: rightPanelTheme.header.border }}
        >
          <button
            onClick={handleUngroupSubgraph}
            className="w-full px-2.5 py-1.5 rounded-md transition-all duration-200 backdrop-blur-sm border flex items-center gap-1.5 justify-center"
            style={{
              background: rightPanelTheme.button.default.background,
              color: rightPanelTheme.tabs.active.text,
              borderColor: rightPanelTheme.button.default.border,
              boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = rightPanelTheme.button.hover.background;
              e.currentTarget.style.borderColor = rightPanelTheme.button.hover.border;
              e.currentTarget.style.boxShadow = "0 2px 8px -4px rgba(0, 0, 0, 0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = rightPanelTheme.button.default.background;
              e.currentTarget.style.borderColor = rightPanelTheme.button.default.border;
              e.currentTarget.style.boxShadow = "0 1px 4px -2px rgba(0, 0, 0, 0.15)";
            }}
          >
            <Split className="w-3 h-3" />
            <span className="text-xs">Ungroup Subgraph</span>
          </button>
          <button
            onClick={() => onDelete(selectedNode.id)}
            className="w-full px-2.5 py-1.5 rounded-md transition-all duration-200 backdrop-blur-sm border flex items-center gap-1.5 justify-center"
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
            <span className="text-xs">Delete Subgraph</span>
          </button>
        </div>
      </div>
    );
  }
);

export default SubgraphPanel;
