import React from "react";
import { NodeConfig } from "../../../types/nodes";
import registry from "../registry";
import BaseNode from "../base/BaseNode";
import { AIControls } from "../AIControls";
import { DialogNodeData } from "../../../types/dialog";
import { GenerateMode } from "../../../hooks/useNodeAI";

export const nodeConfig: NodeConfig = {
  id: "branchingNode",
  displayNames: {
    short: "BR",
    full: "Branching Point",
  },
  style: {
    primaryColor: "#F97316",
    bgBase: "rgba(15, 23, 42, 0.6)",
    bgSelected: "rgba(15, 23, 42, 0.85)",
    borderBase: "rgba(249, 115, 22, 0.2)",
    borderSelected: "#F97316",
  },
  projectTypes: ["interactive_story"],
  defaultText: "New branching point",
  buttonConfig: {
    icon: "#f97316",
    background: "rgba(124, 45, 18, 0.2)",
    hoverBackground: "rgba(124, 45, 18, 0.3)",
  },
} as const;

interface BranchingNodeProps {
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

interface BranchingNodeComponent extends React.FC<BranchingNodeProps> {
  displayName: string;
  nodeConfig: NodeConfig;
}

const BranchingNode: BranchingNodeComponent = ({
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

BranchingNode.displayName = "BranchingNode";
BranchingNode.nodeConfig = nodeConfig;

registry.registerNode("branchingNode", BranchingNode);

export default BranchingNode;
