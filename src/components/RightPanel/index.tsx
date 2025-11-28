import React, { useMemo, useEffect, useState, useRef, useCallback } from "react";
import { Info, Tag as TagIcon, GripVertical } from "lucide-react";
import { Connection } from "../../types/nodes";
import { useTheme } from "../../theme/ThemeProvider";
import { DialogNode, DialogNodeType, Tag } from "../../types/dialog";
import { NodeSelectionPanel } from "./NodeSelectionPanel";
import { DialogPathList } from "../DialogPathList";
import type { ProjectType } from "../../types/project";
import MultiNodeSelection from "./MultiNodeSelection";
import TagSection from "../Tag/TagSection";
import { getRightPanelTheme } from "../../theme/components/RightPanelTheme";
import useSubgraphNavigationStore from "../../store/subgraphNavigationStore";
import { buildDialogPaths } from "../../utils/dialogTraversal";
import { safeStorage } from "../../utils/safeStorage";
import { tagService } from "../../services/tagService";

// MultiNodeTagManager component for managing tags on multiple selected nodes
const MultiNodeTagManager: React.FC<{
  selectedNodes: DialogNode[];
  onApplyTagsToMultiple: (ids: string[], tags: Tag[]) => void;
  projectType: ProjectType;
}> = ({ selectedNodes, onApplyTagsToMultiple, projectType }) => {
  const { theme } = useTheme();
  const rightPanelTheme = useMemo(() => getRightPanelTheme(theme), [theme]);

  // Helper function to extract tags from a node (handles both Tag[] and string[] formats)
  const getNodeTags = useCallback((node: DialogNode): Tag[] => {
    // First try nodeData.tags (Tag[])
    const nodeDataTags = node.data?.metadata?.nodeData?.tags;
    if (Array.isArray(nodeDataTags) && nodeDataTags.length > 0) {
      // Check if it's Tag[] or string[]
      const firstItem = nodeDataTags[0];
      if (typeof firstItem === "object" && firstItem !== null && "id" in firstItem) {
        return nodeDataTags as unknown as Tag[];
      }
      // If it's string[], convert to Tag[]
      if (typeof firstItem === "string") {
        return (nodeDataTags as unknown as string[])
          .map((tagId) => tagService.getTagById(tagId))
          .filter((tag): tag is Tag => tag !== undefined);
      }
    }

    // Then try metadata.tags (could be string[] or Tag[])
    const metadataTags = node.data?.metadata?.tags;
    if (Array.isArray(metadataTags) && metadataTags.length > 0) {
      // Check if it's Tag[] or string[]
      const firstItem = metadataTags[0];
      if (typeof firstItem === "object" && firstItem !== null && "id" in firstItem) {
        return metadataTags as unknown as Tag[];
      }
      // If it's string[], convert to Tag[]
      if (typeof firstItem === "string") {
        return (metadataTags as unknown as string[])
          .map((tagId) => tagService.getTagById(tagId))
          .filter((tag): tag is Tag => tag !== undefined);
      }
    }

    return [];
  }, []);

  // Get common tags (tags that exist on ALL selected nodes)
  const commonTags = useMemo(() => {
    if (selectedNodes.length === 0) return [];
    
    const firstNodeTags = getNodeTags(selectedNodes[0]);
    if (firstNodeTags.length === 0) return [];

    // Find tags that exist in all nodes
    return firstNodeTags.filter((tag) => {
      if (!tag || !tag.id) return false;
      return selectedNodes.every((node) => {
        const nodeTags = getNodeTags(node);
        return nodeTags.some((t) => t && t.id === tag.id);
      });
    });
  }, [selectedNodes, getNodeTags]);

  const handleUpdateTags = useCallback(
    (tags: Tag[]) => {
      const nodeIds = selectedNodes.map((node) => node.id);
      onApplyTagsToMultiple(nodeIds, tags);
    },
    [selectedNodes, onApplyTagsToMultiple]
  );

  return (
    <div className="space-y-4">
      <div>
        <h3
          className="text-sm mb-2"
          style={{ color: rightPanelTheme.content.text.primary }}
        >
          Tags for {selectedNodes.length} selected node{selectedNodes.length > 1 ? "s" : ""}
        </h3>
        <p
          className="text-xs mb-4"
          style={{ color: rightPanelTheme.content.text.secondary }}
        >
          Tags added here will be applied to all selected nodes. Common tags are shown below.
        </p>
      </div>
      <TagSection
        tags={commonTags}
        onUpdateTags={handleUpdateTags}
        projectType={projectType}
      />
    </div>
  );
};

interface RightPanelProps {
  onClose: () => void;
  selectedNode: DialogNode | null;
  selectedNodes?: DialogNode[];
  nodes: DialogNode[];
  connections: Connection[];
  onEdit: (_id: string, _newText: string) => void;
  onDelete: (_id: string) => void;
  onMultiDelete?: (_ids: string[]) => void;
  onSelectNode: (_id: string) => void;
  onScrollToNode?: (_id: string) => void;
  onUpdateNodeTags?: (_id: string, _tags: Tag[]) => void;
  onApplyTagsToMultiple?: (_ids: string[], _tags: Tag[]) => void;
  onAddNode?: (_sourceNodeId: string, _nodeType: DialogNodeType, _text: string) => string;
  paths: DialogNode[][];
  dialogFlow?: DialogNode[][];
  projectType: ProjectType;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  onUngroupSubgraph?: (_id: string) => void;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  selectedNode,
  selectedNodes = [],
  nodes,
  connections,
  onEdit,
  onDelete,
  onMultiDelete,
  onSelectNode,
  onScrollToNode,
  onUpdateNodeTags,
  onApplyTagsToMultiple,
  paths = [],
  dialogFlow: initialDialogFlow = [],
  projectType,
  defaultWidth = 400,
  minWidth = 300,
  maxWidth = 800,
  onUngroupSubgraph,
}) => {
  const { theme } = useTheme();
  const rightPanelTheme = useMemo(() => getRightPanelTheme(theme), [theme]);

  const [activeTab, setActiveTab] = useState<"details" | "tags" | "analysis">("details");
  const [panelWidth, setPanelWidth] = useState(defaultWidth);

  useEffect(() => {
    const saved = safeStorage.get("rightPanelWidth");
    if (saved) {
      const value = parseInt(saved, 10);
      if (!Number.isNaN(value)) setPanelWidth(Math.min(Math.max(minWidth, value), maxWidth));
    }
  }, [minWidth, maxWidth]);
  const [isResizing, setIsResizing] = useState(false);
  const [startX, setStartX] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);

  const [collapsedPaths, setCollapsedPaths] = useState<Set<number>>(() => {
    try {
      const savedState = safeStorage.get("collapsedPaths");
      if (savedState) {
        return new Set(JSON.parse(savedState));
      }

      const initialCollapsedPaths = new Set<number>();
      if (paths && paths.length > 1) {
        paths.forEach((_, index) => {
          if (index !== 0) {
            initialCollapsedPaths.add(index);
          }
        });
      }
      return initialCollapsedPaths;
    } catch (error) {
      console.error("Error loading collapsed paths from storage:", error);
      return new Set<number>();
    }
  });

  const selectedNodeId = selectedNode ? selectedNode.id : null;

  const isMultiSelection = useMemo(() => {
    return Array.isArray(selectedNodes) && selectedNodes.length > 1;
  }, [selectedNodes]);

  const dialogFlow = useMemo<DialogNode[][]>(() => {
    if (initialDialogFlow.length > 0) {
      return initialDialogFlow;
    }

    const { currentContext } = useSubgraphNavigationStore.getState();
    const contextNodes = currentContext ? currentContext.nodes : nodes;
    const contextConnections = currentContext ? currentContext.edges : connections;

    return buildDialogPaths(contextNodes, contextConnections);
  }, [nodes, connections, initialDialogFlow]);

  useEffect(() => {
    const ok = safeStorage.set("collapsedPaths", JSON.stringify(Array.from(collapsedPaths)));
    if (!ok) {
      console.error("Error saving collapsed paths to localStorage");
    }
  }, [collapsedPaths]);

  const handleTabChange = (tab: "details" | "tags" | "analysis") => {
    setActiveTab(tab);
  };

  const renderContent = useMemo(() => {
    if (isMultiSelection) {
      return (
        <div className="flex flex-col h-full">
          <div
            className="flex"
            style={{ borderBottom: `1px solid ${rightPanelTheme.header.border}` }}
          >
            <button
              onClick={() => setActiveTab("details")}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all duration-200 relative"
              style={{
                color:
                  activeTab === "details"
                    ? rightPanelTheme.tabs.active.text
                    : rightPanelTheme.tabs.default.text,
                borderBottom:
                  activeTab === "details"
                    ? `2px solid ${rightPanelTheme.tabs.active.border}`
                    : "2px solid transparent",
              }}
              onMouseEnter={(e) => {
                if (activeTab !== "details") {
                  e.currentTarget.style.color = rightPanelTheme.tabs.default.hover;
                  e.currentTarget.style.background = rightPanelTheme.button.hover.background;
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== "details") {
                  e.currentTarget.style.color = rightPanelTheme.tabs.default.text;
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              <Info className="w-3.5 h-3.5" />
              <span>Details</span>
            </button>
            <button
              onClick={() => setActiveTab("tags")}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all duration-200 relative"
              style={{
                color:
                  activeTab === "tags"
                    ? rightPanelTheme.tabs.active.text
                    : rightPanelTheme.tabs.default.text,
                borderBottom:
                  activeTab === "tags"
                    ? `2px solid ${rightPanelTheme.tabs.active.border}`
                    : "2px solid transparent",
              }}
              onMouseEnter={(e) => {
                if (activeTab !== "tags") {
                  e.currentTarget.style.color = rightPanelTheme.tabs.default.hover;
                  e.currentTarget.style.background = rightPanelTheme.button.hover.background;
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== "tags") {
                  e.currentTarget.style.color = rightPanelTheme.tabs.default.text;
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              <TagIcon className="w-3.5 h-3.5" />
              <span>Tags</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeTab === "details" && (
              <MultiNodeSelection
                selectedNodes={selectedNodes}
                onDelete={onMultiDelete || (() => {})}
                onSelectNode={onSelectNode}
                onScrollToNode={onScrollToNode}
                setActiveTab={handleTabChange}
              />
            )}

            {activeTab === "tags" && (
              <div className="p-4">
                {selectedNodes.length > 0 && onApplyTagsToMultiple ? (
                  <MultiNodeTagManager
                    selectedNodes={selectedNodes}
                    onApplyTagsToMultiple={onApplyTagsToMultiple}
                    projectType={projectType}
                  />
                ) : (
                  <div className="flex items-center justify-center min-h-[200px]">
                    <p
                      className="text-xs text-center"
                      style={{ color: rightPanelTheme.content.text.secondary }}
                    >
                      Select nodes to manage tags
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (selectedNode) {
      return (
        <NodeSelectionPanel
          selectedNode={selectedNode}
          nodes={nodes}
          connections={connections}
          onEdit={onEdit}
          onDelete={onDelete}
          onSelectNode={onSelectNode}
          onScrollToNode={onScrollToNode}
          onUpdateNodeTags={onUpdateNodeTags}
          projectType={projectType}
          onUngroupSubgraph={onUngroupSubgraph}
        />
      );
    }

    return (
      <DialogPathList
        paths={dialogFlow}
        selectedNodeId={selectedNodeId}
        onSelectNode={(id) => {
          onSelectNode(id);
          if (onScrollToNode) {
            onScrollToNode(id);
          }
        }}
        onEdit={onEdit}
        collapsedPaths={collapsedPaths}
        setCollapsedPaths={setCollapsedPaths}
        connections={connections}
        nodes={nodes}
        theme={rightPanelTheme.selectionPanel.pathList}
      />
    );
  }, [
    isMultiSelection,
    selectedNode,
    selectedNodes,
    activeTab,
    nodes,
    connections,
    onEdit,
    onDelete,
    onMultiDelete,
    onSelectNode,
    onUpdateNodeTags,
    onApplyTagsToMultiple,
    onScrollToNode,
    projectType,
    dialogFlow,
    collapsedPaths,
    selectedNodeId,
    handleTabChange,
    rightPanelTheme.selectionPanel.pathList,
  ]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    setStartX(e.clientX);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const dx = startX - e.clientX;
      const newWidth = Math.min(Math.max(minWidth, panelWidth + dx), maxWidth);
      setPanelWidth(newWidth);
      safeStorage.set("rightPanelWidth", String(newWidth));
      setStartX(e.clientX);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "default";
      document.body.style.userSelect = "auto";
    };
  }, [isResizing, panelWidth, startX, minWidth, maxWidth]);

  return (
    <div
      ref={panelRef}
      className="h-full bg-[#0D0D0F] flex flex-col relative"
      style={{ width: panelWidth }}
    >
      <div
        ref={resizeHandleRef}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-500/20 transition-colors"
        onMouseDown={handleMouseDown}
      >
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <GripVertical className="w-4 h-4 text-white/40" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pt-4">{renderContent}</div>
    </div>
  );
};
