import React from "react";
import { NodeConfig } from "../../../types/nodes";
import registry from "../registry";
import BaseNode from "../base/BaseNode";
import { AIControls } from "../AIControls";
import { DialogNodeData } from "../../../types/dialog";
import { GenerateMode } from "../../../hooks/useNodeAI";

export const nodeConfig: NodeConfig = {
  id: "enemyDialog",
  displayNames: {
    short: "ENM",
    full: "Enemy Dialog",
  },
  style: {
    primaryColor: "#EF4444",
    bgBase: "rgba(15, 23, 42, 0.6)",
    bgSelected: "rgba(15, 23, 42, 0.85)",
    borderBase: "rgba(239, 68, 68, 0.2)",
    borderSelected: "#EF4444",
  },
  projectTypes: ["game"],
  defaultText: "New enemy dialog",
  buttonConfig: {
    icon: "#ef4444",
    background: "rgba(127, 29, 29, 0.2)",
    hoverBackground: "rgba(127, 29, 29, 0.3)",
  },
} as const;

interface EnemyNodeProps {
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

interface EnemyNodeComponent extends React.FC<EnemyNodeProps> {
  displayName: string;
  nodeConfig: NodeConfig;
}

const EnemyNode: EnemyNodeComponent = ({ id, data, selected, type }) => {
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

EnemyNode.displayName = "EnemyNode";
EnemyNode.nodeConfig = nodeConfig;

registry.registerNode("enemyDialog", EnemyNode);

export default EnemyNode;
