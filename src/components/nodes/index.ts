/**
 * Central Automatic Loading System for Node Components
 * This file is used to automatically load all node types.
 *
 * How to Add a New Node:
 * 1. Create a folder for your component under src/components/nodes/ (e.g., "MyNewNode")
 * 2. Create an index.tsx file in this folder and define your component
 * 3. Export a nodeConfig of type NodeConfig
 * 4. Define an appropriate interface for your component (you can extend NodeComponent)
 * 5. After creating the component, register it automatically with registry.registerNode
 *
 * Example:
 * ```
 * // src/components/nodes/MyNewNode/index.tsx
 * import React from "react";
 * import { NodeConfig } from "../../../types/nodes";
 * import registry from "../registry";
 *
 * export const nodeConfig: NodeConfig = { ... };
 *
 * interface MyNewNodeComponent extends React.FC<any> {
 *   displayName: string;
 *   nodeConfig: NodeConfig;
 * }
 *
 * const MyNewNode: MyNewNodeComponent = ({ data, isConnectable, selected }) => {
 *   ...
 * };
 *
 * MyNewNode.displayName = "MyNewNode";
 * MyNewNode.nodeConfig = nodeConfig;
 *
 * registry.registerNode("myNewNode", MyNewNode);
 *
 * export default MyNewNode;
 * ```
 */

// Node registry
import registry from "./registry";
import { getLatestNodeTypes } from "./registry";
import logger from "../../utils/logger";

// Automatically import node components
// These components will register themselves to the registry
import "./NpcDialog";
import "./PlayerResponse";
import "./NarratorNode";
import "./CharacterDialogNode";
import "./SceneDescriptionNode";
import "./ChoiceNode";
import "./EnemyNode";
import "./BranchingNode";
import "./SceneNode";
import "./CustomNode";
import "./SubgraphNode";

// Import node types that need to be explicitly imported (if necessary)

// To add a new node component, create a new folder in the nodes directory
// and define the component in the index.tsx file. Then import it here.
//
// Example: import './MyNewNodeType';

// Automatic node initialization function
export const initializeNodes = (): void => {
  // Check if node components are loaded correctly
  // This function can be extended in the future, for example by adding dynamic loading
  logger.debug(`[NodeRegistry] Initialized node types: ${registry.getRegisteredTypes().join(", ")}`);
  logger.debug(
    `[NodeRegistry] ReactFlow node map ready with ${Object.keys(getLatestNodeTypes()).length} entries`,
  );
};
// Export node types for external use
// Removed unused named exports

