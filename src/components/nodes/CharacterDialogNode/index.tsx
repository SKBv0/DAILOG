import React from "react";
import { NodeConfig, NodeData } from "../../../types/nodes";
import { DialogNode } from "../../../types/dialog";
import registry from "../registry";
import BaseNode from "../base/BaseNode";
import { AIControls } from "../AIControls";
import { DialogNodeData } from "../../../types/dialog";
import { GenerateMode } from "../../../hooks/useNodeAI";

interface CharacterDialogNodeProps {
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

interface CharacterDialogNodeComponent extends React.FC<CharacterDialogNodeProps> {
  displayName: string;
  nodeConfig: NodeConfig;
}

export const nodeConfig: NodeConfig = {
  id: "characterDialogNode",
  displayNames: {
    short: "CHR",
    full: "Character Dialogue",
  },
  style: {
    primaryColor: "#8B5CF6",
    bgBase: "rgba(15, 23, 42, 0.6)",
    bgSelected: "rgba(15, 23, 42, 0.85)",
    borderBase: "rgba(139, 92, 246, 0.2)",
    borderSelected: "#8B5CF6",
  },
  projectTypes: ["novel"],
  defaultText: "New character dialogue",
  buttonConfig: {
    icon: "#8b5cf6",
    background: "rgba(76, 29, 149, 0.2)",
    hoverBackground: "rgba(76, 29, 149, 0.3)",
  },
  allowedConnections: {
    inputs: ["npcDialog", "playerResponse", "characterDialogNode", "sceneDescriptionNode"],
    outputs: [
      "npcDialog",
      "playerResponse",
      "characterDialogNode",
      "sceneDescriptionNode",
      "branchingNode",
    ],
  },
  validation: {
    validateData: (data: NodeData) => {
      return !!data.text && data.text.length > 0;
    },
  },
  behavior: {
    onAddToGraph: (node: DialogNode) => {
      if (node.data.text) {
        const characterNameMatch = node.data.text.match(/^([A-Z][a-z]+):/);
        if (characterNameMatch && characterNameMatch[1]) {
          node.data.metadata = {
            ...node.data.metadata,
            nodeData: {
              ...node.data.metadata?.nodeData,
              characterName: characterNameMatch[1],
            },
          };
        }
      }
      return node;
    },
  },
  ui: {
    contextMenuItems: [
      {
        label: "Edit Character Info",
        action: (nodeId: string) => {
          console.log("Character edit requested", nodeId);
        },
      },
    ],
  },
} as const;

const CharacterDialogNode: CharacterDialogNodeComponent = ({ id, data, selected, type }) => {
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

CharacterDialogNode.displayName = "CharacterDialogNode";
CharacterDialogNode.nodeConfig = nodeConfig;

registry.registerNode("characterDialogNode", CharacterDialogNode);

export default CharacterDialogNode;
