import React from "react";
import { NodeConfig } from "../../../types/nodes";
import registry from "../registry";
import BaseNode from "../base/BaseNode";
import { AIControls } from "../AIControls";
import { DialogNodeData } from "../../../types/dialog";
import { GenerateMode } from "../../../hooks/useNodeAI";

export const nodeConfig: NodeConfig = {
  id: "sceneNode",
  displayNames: {
    short: "SCN",
    full: "Scene",
  },
  style: {
    primaryColor: "#6366F1",
    bgBase: "rgba(15, 23, 42, 0.6)",
    bgSelected: "rgba(15, 23, 42, 0.85)",
    borderBase: "rgba(99, 102, 241, 0.2)",
    borderSelected: "#6366F1",
  },
  projectTypes: ["novel"],
  defaultText: "New scene description",
  buttonConfig: {
    icon: "#6366f1",
    background: "rgba(49, 46, 129, 0.2)",
    hoverBackground: "rgba(49, 46, 129, 0.3)",
  },
};

interface SceneNodeProps {
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

interface SceneNodeComponent extends React.FC<SceneNodeProps> {
  displayName: string;
  nodeConfig: NodeConfig;
}

const SceneNode: SceneNodeComponent = ({ id, data, selected, type }) => {
  return (
    <>
      <BaseNode
        id={id}
        type={type}
        data={data}
        selected={selected}
        displayNames={nodeConfig.displayNames}
        style={{
          primaryColor: nodeConfig.style?.primaryColor || "#6366F1",
          bgBase: nodeConfig.style?.bgBase || "rgba(15, 23, 42, 0.6)",
          bgSelected: nodeConfig.style?.bgSelected || "rgba(15, 23, 42, 0.85)",
          borderBase: nodeConfig.style?.borderBase || "rgba(99, 102, 241, 0.2)",
          borderSelected: nodeConfig.style?.borderSelected || "#6366F1",
        }}
      />
      <AIControls nodeId={id} onGenerateDialog={data.onGenerateDialog} />
    </>
  );
};

SceneNode.displayName = "SceneNode";
SceneNode.nodeConfig = nodeConfig;

registry.registerNode("sceneNode", SceneNode);

export default SceneNode;
