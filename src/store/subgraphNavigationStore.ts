import { create } from "zustand";
import { DialogNode, Connection } from "../types/dialog";
import logger from "../utils/logger";

export interface SubgraphContext {
  id: string;
  name: string;
  parentId?: string;
  nodes: DialogNode[];
  edges: Connection[];
}

interface SubgraphNavigationStore {
  navigationStack: SubgraphContext[];
  currentContext: SubgraphContext | null;
  enterSubgraph: (subgraphNodeId: string, subgraphData: any) => void;
  exitSubgraph: () => void;
  exitToMain: () => void;
  updateCurrentContext: (nodes: DialogNode[], edges: Connection[]) => void;
  isInSubgraph: () => boolean;
  getCurrentDepth: () => number;
  getBreadcrumbs: () => Array<{ id: string; name: string }>;
}

const useSubgraphNavigationStore = create<SubgraphNavigationStore>((set, get) => ({
  navigationStack: [],
  currentContext: null,

  enterSubgraph: (subgraphNodeId: string, subgraphData: any) => {
    const { navigationStack, currentContext } = get();

    if (currentContext && currentContext.id === subgraphNodeId) {
      logger.warn(`Already in subgraph ${subgraphNodeId}, ignoring duplicate enter request`);
      return;
    }

    const newContext: SubgraphContext = {
      id: subgraphNodeId,
      name: subgraphData.name || `Subgraph ${subgraphNodeId}`,
      parentId:
        navigationStack.length > 0 ? navigationStack[navigationStack.length - 1].id : undefined,
      nodes: subgraphData.nodes || [],
      edges: subgraphData.edges || [],
    };

    const newStack = [...navigationStack, newContext];

    set({
      navigationStack: newStack,
      currentContext: newContext,
    });

    logger.debug("Entered subgraph:", subgraphNodeId, "Depth:", newStack.length);
  },

  exitSubgraph: () => {
    const { navigationStack, currentContext } = get();

    if (navigationStack.length === 0) {
      logger.warn("Already at main context, cannot exit further");
      return;
    }

    if (currentContext) {
      logger.debug(`[SubgraphNav] Saving ${currentContext.nodes.length} nodes and ${currentContext.edges.length} edges from subgraph ${currentContext.id}`);

      window.dispatchEvent(new CustomEvent("subgraph:save", {
        detail: {
          subgraphNodeId: currentContext.id,
          nodes: currentContext.nodes,
          edges: currentContext.edges,
        }
      }));
    }

    const newStack = navigationStack.slice(0, -1);
    const newContext = newStack.length > 0 ? newStack[newStack.length - 1] : null;

    set({
      navigationStack: newStack,
      currentContext: newContext,
    });

    logger.debug(
      "Exited to:",
      newContext ? newContext.name : "Main Graph",
      "Depth:",
      newStack.length
    );
  },

  exitToMain: () => {
    const { currentContext } = get();

    if (currentContext) {
      logger.debug(`[SubgraphNav] Saving ${currentContext.nodes.length} nodes from subgraph before exiting to main`);

      window.dispatchEvent(new CustomEvent("subgraph:save", {
        detail: {
          subgraphNodeId: currentContext.id,
          nodes: currentContext.nodes,
          edges: currentContext.edges,
        }
      }));
    }

    set({
      navigationStack: [],
      currentContext: null,
    });

    logger.debug("Exited to main graph");
  },

  updateCurrentContext: (nodes: DialogNode[], edges: Connection[]) => {
    const { currentContext, navigationStack } = get();

    if (!currentContext) {
      return;
    }

    const updatedContext: SubgraphContext = {
      ...currentContext,
      nodes,
      edges,
    };

    const updatedStack = navigationStack.map((ctx, idx, arr) =>
      idx === arr.length - 1 ? updatedContext : ctx
    );

    set({
      currentContext: updatedContext,
      navigationStack: updatedStack,
    });

    logger.debug(`[SubgraphNav] Updated context ${currentContext.id} with ${nodes.length} nodes and ${edges.length} edges`);
  },

  isInSubgraph: () => {
    return get().navigationStack.length > 0;
  },

  getCurrentDepth: () => {
    return get().navigationStack.length;
  },

  getBreadcrumbs: () => {
    const { navigationStack } = get();
    const breadcrumbs = [{ id: "main", name: "Main Graph" }];

    navigationStack.forEach((context) => {
      breadcrumbs.push({ id: context.id, name: context.name });
    });

    return breadcrumbs;
  },
}));

export default useSubgraphNavigationStore;
