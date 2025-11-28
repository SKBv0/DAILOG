import React from "react";
import { NodeConfig } from "../../../types/nodes";
import registry from "../registry";
import BaseNode from "../base/BaseNode";
import { AIControls } from "../AIControls";
import { DialogNodeData } from "../../../types/dialog";
import { GenerateMode } from "../../../hooks/useNodeAI";

export const nodeConfig: NodeConfig = {
  id: "npcDialog",
  displayNames: {
    short: "NPC",
    full: "NPC Dialog",
  },
  style: {
    primaryColor: "#3B82F6",
    bgBase: "rgba(15, 23, 42, 0.6)",
    bgSelected: "rgba(15, 23, 42, 0.85)",
    borderBase: "rgba(59, 130, 246, 0.2)",
    borderSelected: "#3B82F6",
  },
  projectTypes: ["game"],
  defaultText: "New NPC dialog",
  buttonConfig: {
    icon: "#3B82F6",
    background: "rgba(30, 58, 138, 0.2)",
    hoverBackground: "rgba(30, 58, 138, 0.3)",
  },
} as const;

interface NpcDialogNodeProps {
  id: string;
  data: DialogNodeData & {
    onGenerateDialog?: (
      _nodeId: string,
      _mode: GenerateMode,
      _options?: {
        ignoreConnections?: boolean;
        customPrompt?: string;
        systemPrompt?: string;
      },
    ) => void;
  };
  selected: boolean;
  type: string;
}

interface NpcDialogNodeComponent extends React.FC<NpcDialogNodeProps> {
  displayName: string;
  nodeConfig: NodeConfig;
}

const NpcDialogNode: NpcDialogNodeComponent = ({
  id,
  data,
  selected,
  type,
}) => {
  return (
    <>
      <BaseNode
        id={id}
        type={type}
        data={data}
        selected={selected}
        displayNames={nodeConfig.displayNames}
        style={nodeConfig.style}
      />
      <AIControls nodeId={id} onGenerateDialog={data.onGenerateDialog} />
    </>
  );
};

NpcDialogNode.displayName = "NpcDialogNode";
NpcDialogNode.nodeConfig = nodeConfig;

registry.registerNode("npcDialog", NpcDialogNode);

export default NpcDialogNode;
