import React from "react";
import { NodeConfig } from "../../../types/nodes";
import registry from "../registry";
import BaseNode from "../base/BaseNode";
import { AIControls } from "../AIControls";
import { DialogNodeData } from "../../../types/dialog";
import { GenerateMode } from "../../../hooks/useNodeAI";

interface ChoiceNodeProps {
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

interface ChoiceNodeComponent extends React.FC<ChoiceNodeProps> {
  displayName: string;
  nodeConfig: NodeConfig;
}

export const nodeConfig: NodeConfig = {
  id: "choiceNode",
  displayNames: {
    short: "CHC",
    full: "Decision Path",
  },
  style: {
    primaryColor: "#06B6D4",
    bgBase: "rgba(15, 23, 42, 0.6)",
    bgSelected: "rgba(15, 23, 42, 0.85)",
    borderBase: "rgba(6, 182, 212, 0.2)",
    borderSelected: "#06B6D4",
  },
  projectTypes: ["interactive_story"],
  defaultText: "New choice",
  buttonConfig: {
    icon: "#06b6d4",
    background: "rgba(22, 78, 99, 0.2)",
    hoverBackground: "rgba(22, 78, 99, 0.3)",
  },
};

const ChoiceNode: ChoiceNodeComponent = ({ id, data, selected, type }) => {
  return (
    <>
      <BaseNode
        id={id}
        type={type}
        data={data}
        selected={selected}
        displayNames={nodeConfig.displayNames}
        style={{
          primaryColor: nodeConfig.style?.primaryColor || "#06B6D4",
          bgBase: nodeConfig.style?.bgBase || "rgba(15, 23, 42, 0.6)",
          bgSelected: nodeConfig.style?.bgSelected || "rgba(15, 23, 42, 0.85)",
          borderBase: nodeConfig.style?.borderBase || "rgba(6, 182, 212, 0.2)",
          borderSelected: nodeConfig.style?.borderSelected || "#06B6D4",
        }}
      />
      <AIControls nodeId={id} onGenerateDialog={data.onGenerateDialog} />
    </>
  );
};

ChoiceNode.displayName = "ChoiceNode";
ChoiceNode.nodeConfig = nodeConfig;

registry.registerNode("choiceNode", ChoiceNode);

export default ChoiceNode;
