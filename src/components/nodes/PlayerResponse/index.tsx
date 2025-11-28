import React from "react";
import { NodeConfig } from "../../../types/nodes";
import registry from "../registry";
import BaseNode from "../base/BaseNode";
import { AIControls } from "../AIControls";
import { DialogNodeData } from "../../../types/dialog";
import { GenerateMode } from "../../../hooks/useNodeAI";

export const nodeConfig: NodeConfig = {
  id: "playerResponse",
  displayNames: {
    short: "PLR",
    full: "Player Response",
  },
  style: {
    primaryColor: "#10B981",
    bgBase: "rgba(15, 23, 42, 0.6)",
    bgSelected: "rgba(15, 23, 42, 0.85)",
    borderBase: "rgba(16, 185, 129, 0.2)",
    borderSelected: "#10B981",
  },
  projectTypes: ["game"],
  defaultText: "New player response",
  buttonConfig: {
    icon: "#10B981",
    background: "rgba(6, 78, 59, 0.2)",
    hoverBackground: "rgba(6, 78, 59, 0.3)",
  },
} as const;

interface PlayerResponseNodeProps {
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

interface PlayerResponseNodeComponent
  extends React.FC<PlayerResponseNodeProps> {
  displayName: string;
  nodeConfig: NodeConfig;
}

const PlayerResponseNode: PlayerResponseNodeComponent = ({
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

PlayerResponseNode.displayName = "PlayerResponseNode";
PlayerResponseNode.nodeConfig = nodeConfig;

registry.registerNode("playerResponse", PlayerResponseNode);

export default PlayerResponseNode;
