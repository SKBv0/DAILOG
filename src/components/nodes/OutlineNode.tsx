import React, { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { MessageSquare, User, FileText, GitBranch, Zap, Brain, Target } from "lucide-react";

export const getNodeTypeColor = (nodeType: string) => {
  switch (nodeType) {
    case "npcDialog":
    case "npc":
      return {
        border: "border-blue-500/30",
        text: "text-blue-400",
        bg: "bg-blue-500/10",
      };
    case "playerResponse":
    case "player":
      return {
        border: "border-green-500/30",
        text: "text-green-400",
        bg: "bg-green-500/10",
      };
    case "narrator":
      return {
        border: "border-yellow-500/30",
        text: "text-yellow-400",
        bg: "bg-yellow-500/10",
      };
    case "choice":
      return {
        border: "border-purple-500/30",
        text: "text-purple-400",
        bg: "bg-purple-500/10",
      };
    case "enemyDialog":
    case "enemy":
      return {
        border: "border-red-500/30",
        text: "text-red-400",
        bg: "bg-red-500/10",
      };
    default:
      return {
        border: "border-gray-500/30",
        text: "text-gray-400",
        bg: "bg-gray-500/10",
      };
  }
};

export const getNodeIcon = (nodeType: string) => {
  switch (nodeType) {
    case "npcDialog":
    case "npc":
      return MessageSquare;
    case "playerResponse":
    case "player":
      return User;
    case "narrator":
      return FileText;
    case "choice":
      return GitBranch;
    case "enemyDialog":
    case "enemy":
      return Zap;
    case "custom":
      return Brain;
    default:
      return Target;
  }
};

interface OutlineNodeData {
  nodeType: string;
  title?: string;
  text?: string;
  [key: string]: any;
}

interface OutlineNodeProps extends NodeProps<OutlineNodeData> {
  isConnecting?: boolean;
}

export const OutlineNode: React.FC<OutlineNodeProps> = memo(
  ({ data, selected, isConnecting = false }) => {
    const nodeType = data?.nodeType || "custom";
    const title = data?.title || data?.text || `${nodeType} Node`;
    const shortTitle = title.length > 30 ? title.substring(0, 27) + "..." : title;

    const colorClasses = getNodeTypeColor(nodeType);
    const NodeIcon = getNodeIcon(nodeType);

    return (
      <div
        className={`
        outline-node min-w-[200px] max-w-[250px] 
        bg-gray-900/80 border-2 border-dashed rounded-lg
        ${selected ? "border-blue-500" : colorClasses.border}
        ${isConnecting ? "opacity-60" : "opacity-40"}
        transition-all duration-200 hover:opacity-80
        backdrop-blur-sm
      `}
        style={{
          minHeight: "40px",
          fontSize: "12px",
        }}
      >
        <Handle
          type="target"
          position={Position.Left}
          className="handle-input w-3 h-3 border-2 border-gray-400 bg-gray-800"
          style={{ left: "-6px" }}
        />

        <div className="p-2 flex items-center gap-2">
          <div className={`flex-shrink-0 ${colorClasses.text}`}>
            <NodeIcon className="w-4 h-4" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-gray-300 truncate">{shortTitle}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide">{nodeType}</div>
          </div>

          {selected && <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />}
        </div>

        <Handle
          type="source"
          position={Position.Right}
          className="handle-output w-3 h-3 border-2 border-gray-400 bg-gray-800"
          style={{ right: "-6px" }}
        />
      </div>
    );
  }
);

OutlineNode.displayName = "OutlineNode";

export default OutlineNode;
