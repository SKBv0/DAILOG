import { NodeTypes } from "reactflow";
import { createNodeWrapper } from "./NodeWrapper";
import { NODE_CONFIGS, NodeConfig } from "../../types/nodes";
import { DialogNodeType } from "../../types/dialog";
import { NodeType } from "../../types/nodes";
import logger from "../../utils/logger";

export interface NodeComponent {
  displayName: string;
  nodeConfig: NodeConfig;
}

class NodeRegistry {
  private static instance: NodeRegistry;
  private nodeComponents: Record<string, React.ComponentType<any>> = {};
  private nodeConfigs: Record<string, NodeConfig> = {};

  private registeredNodeTypes: Set<string> = new Set();

  private constructor() {}

  public static getInstance(): NodeRegistry {
    if (!NodeRegistry.instance) {
      NodeRegistry.instance = new NodeRegistry();
    }
    return NodeRegistry.instance;
  }

  public registerNode(type: string, component: React.ComponentType<any>): void {
    if (this.registeredNodeTypes.has(type)) {
      return;
    }

    if (this.nodeComponents[type]) {
      console.warn(`Node type '${type}' already exists in registry. Overwriting...`);
    }

    this.nodeComponents[type] = createNodeWrapper(component);

    if ((component as any).nodeConfig) {
      const nodeConfig = (component as any).nodeConfig;
      this.nodeConfigs[type] = nodeConfig;

      NODE_CONFIGS[type] = nodeConfig;

      if (nodeConfig.behavior?.onAddToGraph) {
        logger.debug(`[NodeRegistry] '${type}' defines onAddToGraph behavior`);
      }

      if (nodeConfig.validation?.validateData) {
        logger.debug(`[NodeRegistry] '${type}' defines custom validateData`);
      }

      if (nodeConfig.ui?.contextMenuItems) {
        logger.debug(
          `[NodeRegistry] '${type}' exposes context menu items: ${nodeConfig.ui.contextMenuItems
            .map((item: { label: string }) => item.label)
            .join(", ")}`,
        );
      }
    }

    this.registeredNodeTypes.add(type);

    logger.debug(`[NodeRegistry] Registered node type '${type}'`);
    logger.debug(`[NodeRegistry] Available node types: ${Object.keys(this.nodeComponents).join(", ")}`);

  }

  public unregisterNode(type: string): void {
    if (!this.registeredNodeTypes.has(type)) {
      return;
    }

    delete this.nodeComponents[type];
    delete this.nodeConfigs[type];
    delete (NODE_CONFIGS as any)[type];

    this.registeredNodeTypes.delete(type);
    logger.debug(`[NodeRegistry] Unregistered node type '${type}'`);
  }

  public getNodeTypes(): NodeTypes {
    return { ...this.nodeComponents };
  }

  public getNodeComponent(type: string): React.ComponentType<any> | undefined {
    return this.nodeComponents[type];
  }

  public getRegisteredNodeTypes(): string[] {
    return Array.from(this.registeredNodeTypes);
  }

  public getRegisteredTypes(): string[] {
    return this.getRegisteredNodeTypes();
  }

  public isValidNodeType(type: string): boolean {
    return this.registeredNodeTypes.has(type);
  }

  public isValidDialogNodeType(type: string): boolean {
    return this.isValidNodeType(type);
  }

  public getNodeConfigsByProjectType(projectType: string): NodeConfig[] {
    return Object.values(this.nodeConfigs).filter((config) =>
      config.projectTypes.includes(projectType as any)
    );
  }

  public updateNodeConfigs(configs: Record<string, NodeConfig>): void {
    this.nodeConfigs = { ...this.nodeConfigs, ...configs };
  }
}

const registry = NodeRegistry.getInstance();

registry.updateNodeConfigs(NODE_CONFIGS);

export function getLatestNodeTypes(): NodeTypes {
  // Return a fresh copy to ensure React Flow detects changes
  return { ...registry.getNodeTypes() };
}

export const nodeTypes = getLatestNodeTypes();

export default registry;

export function isValidNodeType(type: string): type is NodeType {
  return registry.isValidNodeType(type);
}

export function isValidDialogNodeType(type: string): type is DialogNodeType {
  return registry.isValidDialogNodeType(type);
}
