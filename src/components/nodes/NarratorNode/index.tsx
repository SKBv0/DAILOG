import React from "react";
import { NodeConfig } from "../../../types/nodes";
import registry from "../registry";
import BaseNode from "../base/BaseNode";
import { AIControls } from "../AIControls";
import { DialogNodeData } from "../../../types/dialog";
import { GenerateMode } from "../../../hooks/useNodeAI";

interface NarratorNodeProps {
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

interface NarratorNodeComponent extends React.FC<NarratorNodeProps> {
  displayName: string;
  nodeConfig: NodeConfig;
}

export const nodeConfig: NodeConfig = {
  id: "narratorNode",
  displayNames: {
    short: "NAR",
    full: "Story Voice",
  },
  style: {
    primaryColor: "#F59E0B",
    bgBase: "rgba(15, 23, 42, 0.6)",
    bgSelected: "rgba(15, 23, 42, 0.85)",
    borderBase: "rgba(245, 158, 11, 0.2)",
    borderSelected: "#F59E0B",
  },
  projectTypes: ["interactive_story"],
  defaultText: "New narrator text",
  buttonConfig: {
    icon: "#f59e0b",
    background: "rgba(120, 53, 15, 0.2)",
    hoverBackground: "rgba(120, 53, 15, 0.3)",
  },
};

const NarratorNode: NarratorNodeComponent = ({ id, data, selected, type }) => {
  return (
    <>
      <BaseNode
        id={id}
        type={type}
        data={data}
        selected={selected}
        displayNames={nodeConfig.displayNames}
        style={{
          primaryColor: nodeConfig.style?.primaryColor || "#F59E0B",
          bgBase: nodeConfig.style?.bgBase || "rgba(15, 23, 42, 0.6)",
          bgSelected: nodeConfig.style?.bgSelected || "rgba(15, 23, 42, 0.85)",
          borderBase: nodeConfig.style?.borderBase || "rgba(245, 158, 11, 0.2)",
          borderSelected: nodeConfig.style?.borderSelected || "#F59E0B",
        }}
      />
      <AIControls nodeId={id} onGenerateDialog={data.onGenerateDialog} />
    </>
  );
};

NarratorNode.displayName = "NarratorNode";
NarratorNode.nodeConfig = nodeConfig;

registry.registerNode("narratorNode", NarratorNode);

export default NarratorNode;
