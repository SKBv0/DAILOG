import React from "react";
import { NodeConfig } from "../../../types/nodes";
import registry from "../registry";
import BaseNode from "../base/BaseNode";
import { AIControls } from "../AIControls";
import { DialogNodeData } from "../../../types/dialog";
import { GenerateMode } from "../../../hooks/useNodeAI";

interface SceneDescriptionNodeProps {
  id: string;
  data: DialogNodeData & {
    onGenerateDialog?: (
      _nodeId: string,
      _mode: GenerateMode,
      _options?: {
        ignoreConnections?: boolean;
        customPrompt?: string;
        systemPrompt?: string;
      }
    ) => void;
  };
  selected: boolean;
  type: string;
}

interface SceneDescriptionNodeComponent extends React.FC<SceneDescriptionNodeProps> {
  displayName: string;
  nodeConfig: NodeConfig;
}

export const nodeConfig: NodeConfig = {
  id: "sceneDescriptionNode",
  displayNames: {
    short: "Scene",
    full: "Scene Description",
  },
  style: {
    primaryColor: "#F43F5E",
    bgBase: "rgba(15, 23, 42, 0.6)",
    bgSelected: "rgba(15, 23, 42, 0.85)",
    borderBase: "rgba(244, 63, 94, 0.2)",
    borderSelected: "#F43F5E",
  },
  projectTypes: ["novel"],
  defaultText: "New scene description",
  buttonConfig: {
    icon: "#f43f5e",
    background: "rgba(136, 19, 55, 0.2)",
    hoverBackground: "rgba(136, 19, 55, 0.3)",
  },
} as const;

const SceneDescriptionNode: SceneDescriptionNodeComponent = ({ id, data, selected, type }) => {
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

SceneDescriptionNode.displayName = "SceneDescriptionNode";
SceneDescriptionNode.nodeConfig = nodeConfig;

registry.registerNode("sceneDescriptionNode", SceneDescriptionNode);

export default SceneDescriptionNode;
