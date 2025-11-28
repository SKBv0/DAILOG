import React, { memo, useState, useEffect } from "react";
import { ChevronUp, ChevronDown, ChevronRight, GitBranch, Bot, TagIcon } from "lucide-react";
import { Edge } from "reactflow";
import { DialogNode } from "../types/dialog";
import { toast } from "react-hot-toast";
import { ollamaService } from "../services/ollamaService";
import type { RightPanelTheme } from "../theme/components/RightPanelTheme";
import { NODE_CONFIGS } from "../types/nodes";
import useSubgraphNavigationStore from "../store/subgraphNavigationStore";
import logger from "../utils/logger";
import { useRegenerationStore } from "../store/regenerationStore";

interface DialogPathListProps {
  paths: Array<Array<DialogNode>>;
  selectedNodeId: string | null | undefined;
  onSelectNode: (nodeId: string) => void;
  onEdit: (id: string, newText: string) => void;
  collapsedPaths: Set<number>;
  setCollapsedPaths: React.Dispatch<React.SetStateAction<Set<number>>>;
  connections: Edge[];
  nodes: DialogNode[];
  theme: RightPanelTheme["selectionPanel"]["pathList"];
}

const DialogPathListComponent: React.FC<DialogPathListProps> = ({
  paths = [],
  selectedNodeId,
  onSelectNode,
  onEdit,
  collapsedPaths,
  setCollapsedPaths,
  connections,
  nodes,
  theme,
}) => {
  const setProcessingNodeId = useRegenerationStore((state) => state.setProcessingNodeId);
  const [isConfirmingGroup, setIsConfirmingGroup] = useState<string | null>(null);
  const [isConfirmingPath, setIsConfirmingPath] = useState<number | null>(null);

  if (!theme) {
    return <div className="py-8 text-center text-sm text-gray-500">Loading theme...</div>;
  }

  const defaultPathListTheme = {
    stats: {
      background: "rgba(17, 17, 17, 0.5)",
      border: "rgba(31, 31, 31, 0.5)",
      text: {
        primary: "#E5E7EB",
        secondary: "#6B7280",
      },
      icon: {
        paths: "#8B5CF6",
        player: "#10B981",
        npc: "#8B5CF6",
      },
      button: {
        background: "rgba(31, 31, 31, 0.4)",
        hover: "rgba(31, 31, 31, 0.8)",
        text: "#6B7280",
        hoverText: "#E5E7EB",
      },
    },
    group: {
      background: "rgba(17, 17, 17, 0.8)",
      border: "rgba(31, 31, 31, 0.6)",
      header: {
        background: "rgba(17, 17, 17, 0.3)",
        border: "rgba(31, 31, 31, 0.4)",
        text: {
          primary: "#E5E7EB",
          secondary: "#6B7280",
        },
        counter: {
          npc: {
            background: "rgba(139, 92, 246, 0.4)",
            text: "#DDD6FE",
          },
          player: {
            background: "rgba(16, 185, 129, 0.4)",
            text: "#A7F3D0",
          },
        },
        button: {
          default: {
            background: "rgba(31, 31, 31, 0.6)",
            text: "#6B7280",
          },
          hover: {
            background: "rgba(139, 92, 246, 0.2)",
            text: "#A78BFA",
          },
          active: {
            background: "rgba(139, 92, 246, 0.4)",
            text: "#DDD6FE",
          },
        },
      },
      content: {
        background: "rgba(17, 17, 17, 0.3)",
      },
    },
    path: {
      background: "rgba(17, 17, 17, 0.6)",
      border: "rgba(31, 31, 31, 0.4)",
      hoverBorder: "rgba(55, 65, 81, 0.6)",
      header: {
        text: {
          primary: "#E5E7EB",
          secondary: "#6B7280",
        },
        counter: {
          background: "rgba(31, 31, 31, 0.8)",
          text: "#9CA3AF",
        },
        indicator: {
          npc: {
            background: "rgba(139, 92, 246, 0.3)",
            border: "rgba(139, 92, 246, 0.5)",
            text: "#DDD6FE",
          },
          player: {
            background: "rgba(16, 185, 129, 0.3)",
            border: "rgba(16, 185, 129, 0.5)",
            text: "#A7F3D0",
          },
        },
        button: {
          collapsed: {
            background: "rgba(31, 31, 31, 0.6)",
            text: "#6B7280",
          },
          expanded: {
            background: "rgba(139, 92, 246, 0.2)",
            text: "#A78BFA",
          },
        },
      },
    },
    timeline: {
      line: "rgba(31, 31, 31, 0.6)",
      dot: {
        npc: "#8B5CF6",
        player: "#10B981",
      },
      message: {
        npc: {
          background: "rgba(139, 92, 246, 0.1)",
          border: "rgba(139, 92, 246, 0.2)",
          text: "#E5E7EB",
        },
        player: {
          background: "rgba(16, 185, 129, 0.1)",
          border: "rgba(16, 185, 129, 0.2)",
          text: "#E5E7EB",
        },
      },
    },
  };

  const pathListTheme = theme || defaultPathListTheme;

  useEffect(() => {
    const root = document.documentElement;

    root.style.setProperty("--stats-button-hover-bg", pathListTheme.stats.button.hover);
    root.style.setProperty("--stats-button-hover-text", pathListTheme.stats.button.hoverText);
    root.style.setProperty(
      "--group-button-hover-bg",
      pathListTheme.group.header.button.hover.background
    );
    root.style.setProperty(
      "--group-button-hover-text",
      pathListTheme.group.header.button.hover.text
    );
    root.style.setProperty("--path-hover-border", pathListTheme.path.hoverBorder);
  }, [pathListTheme]);

  const truncateText = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + "...";
  };

  const getPathTitle = (path: DialogNode[]) => {
    if (!path || path.length === 0) return "";
    return truncateText(path[0].data.text, 20);
  };

  const toggleAllPaths = (collapse: boolean) => {
    if (!paths || paths.length === 0) return;

    if (collapse) {
      const allIndices = new Set<number>();
      for (let i = 0; i < paths.length; i++) {
        allIndices.add(i);
      }
      setCollapsedPaths(allIndices);
    } else {
      setCollapsedPaths(new Set());
    }
  };

  const togglePathCollapse = (pathIndex: number) => {
    setCollapsedPaths((prev: Set<number>) => {
      const newSet = new Set(prev);
      if (newSet.has(pathIndex)) {
        newSet.delete(pathIndex);
      } else {
        newSet.add(pathIndex);
      }
      return newSet;
    });
  };

  const groupedPaths = paths.reduce((groups: { [key: string]: DialogNode[][] }, path) => {
    if (!path || path.length === 0) return groups;
    const startNodeId = path[0].id;
    if (!groups[startNodeId]) {
      groups[startNodeId] = [];
    }
    groups[startNodeId].push(path);
    return groups;
  }, {});

  if (!paths || paths.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-4">
        <div
          className="rounded-md p-6 border backdrop-blur-sm max-w-[200px]"
          style={{
            background: pathListTheme.stats.background,
            borderColor: pathListTheme.stats.border,
            boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
          }}
        >
          <GitBranch
            className="w-6 h-6 mb-2 mx-auto"
            style={{ color: pathListTheme.stats.icon.paths, opacity: 0.3 }}
          />
          <p
            className="text-xs font-medium mb-1"
            style={{ color: pathListTheme.stats.text.primary }}
          >
            No dialog paths
          </p>
          <p
            className="text-[10px] leading-relaxed"
            style={{ color: pathListTheme.stats.text.secondary }}
          >
            Create connections between nodes to generate paths
          </p>
        </div>
      </div>
    );
  }

  const regeneratePath = async (path: DialogNode[]) => {
    if (!path || path.length === 0) {
      logger.warn("Cannot regenerate empty path");
      return;
    }

    try {
      const { currentContext } = useSubgraphNavigationStore.getState();
      const contextConnections = currentContext ? currentContext.edges : connections;

      const nodeMap = new Map<string, DialogNode>();
      path.forEach((node) => nodeMap.set(node.id, node));

      const incomingConnections = new Map<string, string[]>();
      const outgoingConnections = new Map<string, string[]>();

      contextConnections.forEach((conn) => {
        if (nodeMap.has(conn.source) && nodeMap.has(conn.target)) {
          if (!incomingConnections.has(conn.target)) {
            incomingConnections.set(conn.target, []);
          }
          incomingConnections.get(conn.target)!.push(conn.source);

          if (!outgoingConnections.has(conn.source)) {
            outgoingConnections.set(conn.source, []);
          }
          outgoingConnections.get(conn.source)!.push(conn.target);
        }
      });

      const rootNodes = path.filter(
        (node) =>
          !incomingConnections.has(node.id) || incomingConnections.get(node.id)!.length === 0
      );

      const orderedNodes: DialogNode[] = [];
      const visited = new Set<string>();

      function traverseDialogChain(nodeId: string) {
        if (visited.has(nodeId)) return;

        visited.add(nodeId);
        const node = nodeMap.get(nodeId);

        if (node) {
          orderedNodes.push(node);

          const nextNodeIds = outgoingConnections.get(nodeId) || [];
          for (const nextId of nextNodeIds) {
            traverseDialogChain(nextId);
          }
        }
      }

      for (const rootNode of rootNodes) {
        traverseDialogChain(rootNode.id);
      }

      path.forEach((node) => {
        if (!visited.has(node.id)) {
          orderedNodes.push(node);
          visited.add(node.id);
        }
      });

      logger.debug(
        "Regenerating path nodes in order:",
        orderedNodes.map((n) => `${n.id} (${n.type})`)
      );

      for (let i = 0; i < orderedNodes.length; i++) {
        const node = orderedNodes[i];

        if (!node || !node.id) {
          logger.warn(`Invalid node at index ${i}`);
          continue;
        }

        const existingNode = nodes.find((n) => n.id === node.id);
        if (!existingNode) {
          logger.warn(`Node with id ${node.id} not found in nodes array`);
          continue;
        }

        logger.debug(
          `Regenerating node ${i + 1}/${orderedNodes.length}: ${node.id} (${node.type})`
        );

        setProcessingNodeId(node.id);

        if (node.type === "subgraphNode") {
          const subgraphData = node.data.metadata?.subgraph;
          if (subgraphData?.nodes && Array.isArray(subgraphData.nodes) && subgraphData.nodes.length > 0) {
            logger.debug(
              `[DialogPathList] Expanding subgraph ${node.id} with ${subgraphData.nodes.length} internal nodes`
            );

            const subgraphNodes = subgraphData.nodes as DialogNode[];
            const subgraphEdges = (subgraphData.edges || []) as Edge[];

            for (const internalNode of subgraphNodes) {
              try {
                setProcessingNodeId(internalNode.id);

                const internalNewText = await ollamaService.regenerateNodeText(
                  internalNode,
                  subgraphNodes,
                  subgraphEdges
                );

                const updatedNodes = subgraphNodes.map((n: DialogNode) =>
                  n.id === internalNode.id
                    ? { ...n, data: { ...n.data, text: internalNewText } }
                    : n
                );
                subgraphData.nodes = updatedNodes;

                await new Promise((resolve) => setTimeout(resolve, 100));
              } catch (error) {
                logger.error(`Failed to regenerate internal node ${internalNode.id}:`, error);
              }
            }

            onEdit(node.id, `Subgraph (${subgraphNodes.length} nodes) - Updated`);
          }
        } else {
          const newText = await ollamaService.regenerateNodeText(node, nodes, connections);

          onEdit(node.id, newText);
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      setProcessingNodeId(null);

    toast.success("Dialog path regenerated");
    } catch (error) {
      setProcessingNodeId(null);

      logger.error("Error regenerating path:", error);
      toast.error("An error occurred while regenerating the path");
    }
  };

  const regeneratePathGroup = async (pathGroup: DialogNode[][]): Promise<string> => {
    if (!pathGroup || pathGroup.length === 0) {
      logger.warn("Cannot regenerate empty path group");
      return "Failed to regenerate dialog group";
    }

    try {
      const allNodes: DialogNode[] = [];
      const processedNodeIds = new Set<string>();

      pathGroup.forEach((path) => {
        path.forEach((node) => {
          if (!processedNodeIds.has(node.id)) {
            allNodes.push(node);
            processedNodeIds.add(node.id);
          }
        });
      });

      const nodeMap = new Map<string, DialogNode>();
      allNodes.forEach((node) => nodeMap.set(node.id, node));

      const incomingConnections = new Map<string, string[]>();
      const outgoingConnections = new Map<string, string[]>();

      connections.forEach((conn) => {
        if (!incomingConnections.has(conn.target)) {
          incomingConnections.set(conn.target, []);
        }
        incomingConnections.get(conn.target)!.push(conn.source);

        if (!outgoingConnections.has(conn.source)) {
          outgoingConnections.set(conn.source, []);
        }
        outgoingConnections.get(conn.source)!.push(conn.target);
      });

      const rootNodes = allNodes.filter(
        (node) =>
          !incomingConnections.has(node.id) || incomingConnections.get(node.id)!.length === 0
      );

      const orderedNodes: DialogNode[] = [];
      const visited = new Set<string>();

      function traverseDialogChain(nodeId: string) {
        if (visited.has(nodeId)) return;

        visited.add(nodeId);
        const node = nodeMap.get(nodeId);

        if (node) {
          orderedNodes.push(node);

          const nextNodeIds = outgoingConnections.get(nodeId) || [];
          for (const nextId of nextNodeIds) {
            traverseDialogChain(nextId);
          }
        }
      }

      for (const rootNode of rootNodes) {
        traverseDialogChain(rootNode.id);
      }

      allNodes.forEach((node) => {
        if (!visited.has(node.id)) {
          orderedNodes.push(node);
          visited.add(node.id);
        }
      });

      logger.debug(
        "Regenerating nodes in order:",
        orderedNodes.map((n) => `${n.id} (${n.type})`)
      );

      for (let i = 0; i < orderedNodes.length; i++) {
        const node = orderedNodes[i];

        if (!node || !node.id) {
          logger.warn(`Invalid node at index ${i}`);
          continue;
        }

        setProcessingNodeId(node.id);

        try {
          const existingNode = nodes.find((n) => n.id === node.id);
          if (!existingNode) {
            logger.warn(`Node with id ${node.id} not found in nodes array`);
            continue;
          }

          logger.debug(
            `Regenerating node ${i + 1}/${orderedNodes.length}: ${node.id} (${node.type})`
          );

          if (node.type === "subgraphNode") {
            const subgraphData = node.data.metadata?.subgraph;
            if (subgraphData?.nodes && Array.isArray(subgraphData.nodes) && subgraphData.nodes.length > 0) {
              logger.debug(
                `[DialogPathList] Expanding subgraph ${node.id} with ${subgraphData.nodes.length} internal nodes in group regeneration`
              );

              const subgraphNodes = subgraphData.nodes as DialogNode[];
              const subgraphEdges = (subgraphData.edges || []) as Edge[];

              for (const internalNode of subgraphNodes) {
                try {
                  if (setProcessingNodeId) {
                    setProcessingNodeId(internalNode.id);
                  }

                  const internalNewText = await ollamaService.regenerateNodeText(
                    internalNode,
                    subgraphNodes,
                    subgraphEdges
                  );

                  const updatedNodes = subgraphNodes.map((n: DialogNode) =>
                    n.id === internalNode.id
                      ? { ...n, data: { ...n.data, text: internalNewText } }
                      : n
                  );
                  subgraphData.nodes = updatedNodes;

                  await new Promise((resolve) => setTimeout(resolve, 100));
                } catch (error) {
                  logger.error(
                    `Failed to regenerate internal node ${internalNode.id} in group:`,
                    error
                  );
                }
              }

              onEdit(node.id, `Subgraph (${subgraphNodes.length} nodes) - Updated`);
            }
          } else {
            const newText = await ollamaService.regenerateNodeText(node, nodes, connections);

            onEdit(node.id, newText);
          }

          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          logger.error(`Error regenerating node ${node.id}:`, error);
        }
      }

      setProcessingNodeId(null);

      return "Dialog group regenerated!";
    } catch (error) {
      setProcessingNodeId(null);

      logger.error("Error regenerating dialog group:", error);
    toast.error("An error occurred while generating dialog groups");
      throw new Error("Failed to regenerate dialog group");
    }
  };

  const formatNodeType = (type: string): string => {
    if (type === "npcDialog") return "NPC";
    if (type === "playerResponse") return "PLAYER";
    if (type === "enemyDialog") return "ENEMY";
    if (type === "storyVoice") return "STORY";
    if (type === "decisionPath") return "DECISION";
    if (type === "narratorNode") return "NARRATOR";
    if (type === "choiceNode") return "CHOICE";

    return type.toUpperCase();
  };

  const getNodeConfig = (nodeType: string) => {
    try {
      return NODE_CONFIGS[nodeType];
    } catch (error) {
      return null;
    }
  };

  const getDotColor = (nodeType: string): string => {
    if (nodeType === "npcDialog") return pathListTheme.timeline.dot.npc;
    if (nodeType === "playerResponse") return pathListTheme.timeline.dot.player;

    const nodeConfig = getNodeConfig(nodeType);
    if (nodeConfig?.style?.primaryColor) {
      return nodeConfig.style.primaryColor;
    }

    return pathListTheme.timeline.dot.player;
  };

  const getMessageBackground = (nodeType: string): string => {
    if (nodeType === "npcDialog") return pathListTheme.timeline.message.npc.background;
    if (nodeType === "playerResponse") return pathListTheme.timeline.message.player.background;

    const nodeConfig = getNodeConfig(nodeType);
    if (nodeConfig?.style?.primaryColor) {
      const color = nodeConfig.style.primaryColor;
      return `${color}1A`;
    }

    return pathListTheme.timeline.message.player.background;
  };

  const getMessageBorder = (nodeType: string): string => {
    if (nodeType === "npcDialog") return pathListTheme.timeline.message.npc.border;
    if (nodeType === "playerResponse") return pathListTheme.timeline.message.player.border;

    const nodeConfig = getNodeConfig(nodeType);
    if (nodeConfig?.style?.borderBase) {
      return nodeConfig.style.borderBase;
    }

    return pathListTheme.timeline.message.player.border;
  };

  const getMessageTextColor = (nodeType: string): string => {
    if (nodeType === "npcDialog") return pathListTheme.timeline.message.npc.text;
    if (nodeType === "playerResponse") return pathListTheme.timeline.message.player.text;
    return pathListTheme.timeline.message.player.text;
  };

  const getBadgeBackground = (nodeType: string): string => {
    if (nodeType === "npcDialog") return pathListTheme.path.header.indicator.npc.background;
    if (nodeType === "playerResponse") return pathListTheme.path.header.indicator.player.background;

    const nodeConfig = getNodeConfig(nodeType);
    if (nodeConfig?.style?.primaryColor) {
      const color = nodeConfig.style.primaryColor;
      return `${color}4D`;
    }

    return pathListTheme.path.header.indicator.player.background;
  };

  const getBadgeBorder = (nodeType: string): string => {
    if (nodeType === "npcDialog") return pathListTheme.path.header.indicator.npc.border;
    if (nodeType === "playerResponse") return pathListTheme.path.header.indicator.player.border;

    const nodeConfig = getNodeConfig(nodeType);
    if (nodeConfig?.style?.primaryColor) {
      const color = nodeConfig.style.primaryColor;
      return `${color}80`;
    }

    return pathListTheme.path.header.indicator.player.border;
  };

  const getBadgeTextColor = (nodeType: string): string => {
    if (nodeType === "npcDialog") return pathListTheme.path.header.indicator.npc.text;
    if (nodeType === "playerResponse") return pathListTheme.path.header.indicator.player.text;

    return "#FFFFFF";
  };

  return (
    <div className="space-y-2.5 p-2.5">
      <div
        className="flex items-center justify-between rounded-md p-2.5 border backdrop-blur-md"
        style={{
          background: pathListTheme.stats.background,
          borderColor: pathListTheme.stats.border,
          boxShadow: "0 2px 8px -4px rgba(0, 0, 0, 0.2)",
        }}
      >
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <GitBranch
                className="w-3.5 h-3.5"
                style={{ color: pathListTheme.stats.icon.paths }}
              />
              <span
                className="text-sm font-medium"
                style={{ color: pathListTheme.stats.text.primary }}
              >
                {paths.length}
              </span>
            </div>
            <span className="text-xs" style={{ color: pathListTheme.stats.text.secondary }}>
              Paths
            </span>
          </div>
          <div className="h-8 w-px" style={{ background: pathListTheme.stats.border }}></div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <div
                className="w-3.5 h-3.5 rounded-full border flex items-center justify-center"
                style={{ borderColor: pathListTheme.stats.icon.player }}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: pathListTheme.stats.icon.player }}
                ></div>
              </div>
              <span
                className="text-sm font-medium"
                style={{ color: pathListTheme.stats.text.primary }}
              >
                {paths.reduce(
                  (acc, path) => acc + path.filter((n) => n.type === "playerResponse").length,
                  0
                )}
              </span>
            </div>
            <span className="text-xs" style={{ color: pathListTheme.stats.text.secondary }}>
              Player
            </span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <div
                className="w-3.5 h-3.5 rounded-full border flex items-center justify-center"
                style={{ borderColor: pathListTheme.stats.icon.npc }}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: pathListTheme.stats.icon.npc }}
                ></div>
              </div>
              <span
                className="text-sm font-medium"
                style={{ color: pathListTheme.stats.text.primary }}
              >
                {paths.reduce(
                  (acc, path) => acc + path.filter((n) => n.type === "npcDialog").length,
                  0
                )}
              </span>
            </div>
            <span className="text-xs" style={{ color: pathListTheme.stats.text.secondary }}>
              NPC
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleAllPaths(false)}
            className="p-1 rounded-md transition-all duration-200 backdrop-blur-sm"
            style={{
              background: pathListTheme.stats.button.background,
              color: pathListTheme.stats.button.text,
              boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.05)";
              e.currentTarget.style.boxShadow = "0 2px 8px -4px rgba(0, 0, 0, 0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "0 1px 4px -2px rgba(0, 0, 0, 0.15)";
            }}
            onFocus={(e) => {
              e.currentTarget.style.outline = `2px solid ${pathListTheme.stats.button.text}40`;
              e.currentTarget.style.outlineOffset = "2px";
            }}
            onBlur={(e) => {
              e.currentTarget.style.outline = "none";
            }}
            title="Expand All"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
          <button
            onClick={() => toggleAllPaths(true)}
            className="p-1 rounded-md transition-all duration-200 backdrop-blur-sm"
            style={{
              background: pathListTheme.stats.button.background,
              color: pathListTheme.stats.button.text,
              boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.05)";
              e.currentTarget.style.boxShadow = "0 2px 8px -4px rgba(0, 0, 0, 0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "0 1px 4px -2px rgba(0, 0, 0, 0.15)";
            }}
            onFocus={(e) => {
              e.currentTarget.style.outline = `2px solid ${pathListTheme.stats.button.text}40`;
              e.currentTarget.style.outlineOffset = "2px";
            }}
            onBlur={(e) => {
              e.currentTarget.style.outline = "none";
            }}
            title="Collapse All"
          >
            <ChevronUp className="w-3 h-3" />
          </button>
        </div>
      </div>

      {Object.entries(groupedPaths).map(([startNodeId, pathGroup], groupIndex) => {
        const startNode = pathGroup[0][0];
        const isGroupExpanded = pathGroup.some((path) => !collapsedPaths.has(paths.indexOf(path)));

        return (
          <div
            key={`group-${groupIndex}`}
            className="rounded-lg border overflow-hidden backdrop-blur-md"
            style={{
              background: pathListTheme.group.background,
              borderColor: pathListTheme.group.border,
              boxShadow: "0 2px 8px -4px rgba(0, 0, 0, 0.2)",
            }}
          >
            <div
              className="flex items-center justify-between p-2.5 border-b"
              style={{
                background: pathListTheme.group.header.background,
                borderColor: pathListTheme.group.header.border,
              }}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
                  style={{
                    background: getBadgeBackground(startNode.type),
                    color: getBadgeTextColor(startNode.type),
                  }}
                >
                  {pathGroup.length}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span
                    className="text-xs font-medium truncate"
                    style={{ color: pathListTheme.group.header.text.primary }}
                  >
                    Dialog Group
                  </span>
                  <span
                    className="text-[10px] truncate"
                    style={{
                      color: pathListTheme.group.header.text.secondary,
                    }}
                  >
                    {truncateText(startNode.data.text, 40)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isConfirmingGroup === startNodeId) {
                      toast.promise(regeneratePathGroup(pathGroup), {
                        loading: "Regenerating dialog group...",
                        success: (message) => message,
                        error: (error) => error.message,
                      });
                      setIsConfirmingGroup(null);
                    } else {
                      setIsConfirmingGroup(startNodeId);
                      setTimeout(() => setIsConfirmingGroup(null), 3000);
                    }
                  }}
                  className="p-1 rounded transition-all duration-200 backdrop-blur-sm flex-shrink-0"
                  style={{
                    background:
                      isConfirmingGroup === startNodeId
                        ? pathListTheme.group.header.button.active.background
                        : pathListTheme.group.header.button.default.background,
                    color:
                      isConfirmingGroup === startNodeId
                        ? pathListTheme.group.header.button.active.text
                        : pathListTheme.group.header.button.default.text,
                    boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
                  }}
                  onMouseEnter={(e) => {
                    if (isConfirmingGroup !== startNodeId) {
                      e.currentTarget.style.transform = "scale(1.05)";
                      e.currentTarget.style.boxShadow = "0 2px 8px -4px rgba(0, 0, 0, 0.2)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (isConfirmingGroup !== startNodeId) {
                      e.currentTarget.style.transform = "scale(1)";
                      e.currentTarget.style.boxShadow = "0 1px 4px -2px rgba(0, 0, 0, 0.15)";
                    }
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.outline = `2px solid ${pathListTheme.group.header.button.default.text}40`;
                    e.currentTarget.style.outlineOffset = "2px";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.outline = "none";
                  }}
                  title={
                    isConfirmingGroup === startNodeId
                      ? "Click again to confirm"
                      : "Regenerate dialog group with AI"
                  }
                >
                  <Bot className="w-3 h-3" />
                </button>
                <button
                  onClick={() => {
                    const newCollapsedPaths = new Set(collapsedPaths);
                    pathGroup.forEach((path) => {
                      const pathIndex = paths.indexOf(path);
                      if (isGroupExpanded) {
                        newCollapsedPaths.add(pathIndex);
                      } else {
                        newCollapsedPaths.delete(pathIndex);
                      }
                    });
                    setCollapsedPaths(newCollapsedPaths);
                  }}
                  className="p-1 rounded transition-all duration-200 backdrop-blur-sm flex-shrink-0"
                  style={{
                    background: pathListTheme.group.header.button.default.background,
                    color: pathListTheme.group.header.button.default.text,
                    boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "scale(1.05)";
                    e.currentTarget.style.boxShadow = "0 2px 8px -4px rgba(0, 0, 0, 0.2)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "scale(1)";
                    e.currentTarget.style.boxShadow = "0 1px 4px -2px rgba(0, 0, 0, 0.15)";
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.outline = `2px solid ${pathListTheme.group.header.button.default.text}40`;
                    e.currentTarget.style.outlineOffset = "2px";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.outline = "none";
                  }}
                  title={isGroupExpanded ? "Collapse Group" : "Expand Group"}
                >
                  {isGroupExpanded ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>

            <div
              className="p-2 space-y-2"
              style={{ background: pathListTheme.group.content.background }}
            >
              {pathGroup.map((path, pathIndex) => (
                <div
                  key={`path-${groupIndex}-${pathIndex}`}
                  className="group relative rounded-lg border overflow-hidden transition-all backdrop-blur-sm"
                  style={{
                    background: pathListTheme.path.background,
                    borderColor: pathListTheme.path.border,
                    boxShadow: "0 2px 8px -4px rgba(0, 0, 0, 0.2)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = pathListTheme.path.hoverBorder;
                    e.currentTarget.style.boxShadow = "0 4px 12px -6px rgba(0, 0, 0, 0.3)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = pathListTheme.path.border;
                    e.currentTarget.style.boxShadow = "0 2px 8px -4px rgba(0, 0, 0, 0.2)";
                  }}
                >
                  <div
                    onClick={() => togglePathCollapse(paths.indexOf(path))}
                    className="w-full flex items-center justify-between p-2.5 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center transition-all"
                        style={{
                          background: collapsedPaths.has(paths.indexOf(path))
                            ? pathListTheme.path.header.button.collapsed.background
                            : pathListTheme.path.header.button.expanded.background,
                          color: collapsedPaths.has(paths.indexOf(path))
                            ? pathListTheme.path.header.button.collapsed.text
                            : pathListTheme.path.header.button.expanded.text,
                        }}
                      >
                        {collapsedPaths.has(paths.indexOf(path)) ? (
                          <ChevronRight className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-sm font-medium"
                            style={{
                              color: pathListTheme.path.header.text.primary,
                            }}
                          >
                            Path {pathIndex + 1}
                          </span>
                          <div
                            className="flex items-center px-1.5 py-0.5 rounded-full text-xs"
                            style={{
                              background: pathListTheme.path.header.counter.background,
                              color: pathListTheme.path.header.counter.text,
                            }}
                          >
                            {path.length}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <div className="flex -space-x-1">
                            {path.slice(0, 3).map((node, i) => (
                              <div
                                key={i}
                                className="w-4 h-4 rounded-full flex items-center justify-center border text-[8px] font-medium"
                                style={{
                                  background: getBadgeBackground(node.type),
                                  borderColor: getBadgeBorder(node.type),
                                  color: getBadgeTextColor(node.type),
                                }}
                              >
                                {formatNodeType(node.type).charAt(0)}
                              </div>
                            ))}
                          </div>
                          {path.length > 3 && (
                            <span
                              className="text-xs"
                              style={{
                                color: pathListTheme.path.header.text.secondary,
                              }}
                            >
                              +{path.length - 3}
                            </span>
                          )}
                          <span
                            className="text-xs truncate max-w-[150px]"
                            style={{
                              color: pathListTheme.path.header.text.secondary,
                            }}
                          >
                            {getPathTitle(path)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const pathIndex = paths.indexOf(path);
                          if (isConfirmingPath === pathIndex) {
                            toast.promise(regeneratePath(path), {
                              loading: "Regenerating path...",
                              success: "Path regenerated!",
                              error: "Failed to regenerate path",
                            });
                            setIsConfirmingPath(null);
                          } else {
                            setIsConfirmingPath(pathIndex);
                            setTimeout(() => setIsConfirmingPath(null), 3000);
                          }
                        }}
                        className="p-1 rounded-md transition-all duration-200 backdrop-blur-sm"
                        style={{
                          background:
                            isConfirmingPath === paths.indexOf(path)
                              ? pathListTheme.group.header.button.active.background
                              : pathListTheme.group.header.button.default.background,
                          color:
                            isConfirmingPath === paths.indexOf(path)
                              ? pathListTheme.group.header.button.active.text
                              : pathListTheme.group.header.button.default.text,
                          boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
                        }}
                        onMouseEnter={(e) => {
                          if (isConfirmingPath !== paths.indexOf(path)) {
                            e.currentTarget.style.background = pathListTheme.group.header.button.hover?.background || pathListTheme.group.header.button.default.background;
                            e.currentTarget.style.transform = "scale(1.05)";
                            e.currentTarget.style.boxShadow = "0 2px 8px -4px rgba(0, 0, 0, 0.2)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (isConfirmingPath !== paths.indexOf(path)) {
                            e.currentTarget.style.background = pathListTheme.group.header.button.default.background;
                            e.currentTarget.style.transform = "scale(1)";
                            e.currentTarget.style.boxShadow = "0 1px 4px -2px rgba(0, 0, 0, 0.15)";
                          }
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.outline = `2px solid ${pathListTheme.path.header.text.primary}40`;
                          e.currentTarget.style.outlineOffset = "2px";
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.outline = "none";
                        }}
                        title={
                          isConfirmingPath === paths.indexOf(path)
                            ? "Click again to confirm"
                            : "Regenerate path with AI"
                        }
                      >
                        <Bot className="w-3 h-3" />
                      </button>
                      {path.some(
                        (node) => node.data?.metadata?.tags && node.data.metadata.tags.length > 0
                      ) && (
                        <div
                          className="flex items-center px-1.5 py-0.5 rounded-md"
                          style={{
                            background: pathListTheme.path.header.counter.background,
                            color: pathListTheme.path.header.counter.text,
                          }}
                        >
                          <TagIcon className="w-3 h-3 mr-1" />
                          <span className="text-xs">
                            {path.reduce(
                              (sum, node) => sum + (node.data?.metadata?.tags?.length || 0),
                              0
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {!collapsedPaths.has(paths.indexOf(path)) && (
                    <div className="border-t" style={{ borderColor: pathListTheme.path.border }}>
                      <div className="relative py-3">
                        <div
                          className="absolute left-3 top-0 bottom-0 w-0.5"
                          style={{ background: pathListTheme.timeline.line }}
                        ></div>

                        {path.map((node, nodeIndex) => (
                          <div key={node.id} className="relative mb-3">
                            <div
                              className="absolute left-3 top-5 -translate-x-1/2 w-2.5 h-2.5 rounded-full z-10"
                              style={{
                                background: getDotColor(node.type),
                              }}
                            ></div>

                            <div className="ml-6 mr-2.5">
                              <button
                                onClick={() => onSelectNode(node.id)}
                                className="relative w-full rounded-md transition-all duration-200 backdrop-blur-sm"
                                style={{
                                  background: getMessageBackground(node.type),
                                  border: `1px solid ${getMessageBorder(node.type)}`,
                                  boxShadow:
                                  node.id === selectedNodeId
                                      ? `0 0 0 2px ${getMessageBorder(node.type)}60, 0 2px 8px -4px rgba(0, 0, 0, 0.2)`
                                      : "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
                                }}
                                onMouseEnter={(e) => {
                                  if (node.id !== selectedNodeId) {
                                    e.currentTarget.style.boxShadow = "0 2px 8px -4px rgba(0, 0, 0, 0.2)";
                                    e.currentTarget.style.transform = "translateY(-1px)";
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (node.id !== selectedNodeId) {
                                    e.currentTarget.style.boxShadow = "0 1px 4px -2px rgba(0, 0, 0, 0.15)";
                                    e.currentTarget.style.transform = "translateY(0)";
                                  }
                                }}
                              >
                                <div className="flex justify-start">
                                  <div
                                    className="relative w-full px-2.5 py-2 rounded-md border rounded-tl-none"
                                    style={{
                                      background: getMessageBackground(node.type),
                                      borderColor: getMessageBorder(node.type),
                                    }}
                                  >
                                    <div className="absolute left-1.5 top-1.5">
                                      <div className="flex items-center gap-1">
                                        <span
                                          className="text-[9px] font-medium px-1 py-0.5 rounded border"
                                          style={{
                                            background: getBadgeBackground(node.type),
                                            borderColor: getBadgeBorder(node.type),
                                            color: getBadgeTextColor(node.type),
                                          }}
                                        >
                                          {formatNodeType(node.type)}
                                        </span>

                                        <div
                                          className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-medium border"
                                          style={{
                                            background: getBadgeBackground(node.type),
                                            borderColor: getBadgeBorder(node.type),
                                            color: getBadgeTextColor(node.type),
                                          }}
                                        >
                                          {nodeIndex + 1}
                                        </div>
                                      </div>
                                    </div>

                                    <p
                                      className="text-xs text-left pt-7 leading-relaxed"
                                      style={{
                                        color: getMessageTextColor(node.type),
                                      }}
                                    >
                                      {node.data.text}
                                    </p>

                                    {node.data?.metadata?.tags &&
                                      node.data.metadata.tags.length > 0 && (
                                        <div
                                          className="flex items-center px-1.5 py-0.5 mt-2 rounded w-fit"
                                          style={{
                                            background:
                                              pathListTheme.path.header.counter.background,
                                            color: pathListTheme.path.header.counter.text,
                                          }}
                                        >
                                          <TagIcon className="w-2.5 h-2.5 mr-0.5" />
                                          <span className="text-[10px]">
                                            {node.data.metadata.tags.length}
                                          </span>
                                        </div>
                                      )}
                                  </div>
                                </div>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
export const DialogPathList = memo(DialogPathListComponent);
