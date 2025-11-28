import { useCallback } from "react";
import { autoLayout } from "../utils/autoLayout";
import { DialogNode, Connection } from "../types/editor";
import { useAutoLayoutWorker } from "./useAutoLayoutWorker";
import { isFeatureEnabled } from "../config/features";
import logger from "../utils/logger";

interface UseAutoLayoutProps {
  nodes: DialogNode[];
  connections: Connection[];
  setNodes: React.Dispatch<React.SetStateAction<DialogNode[]>>;
}

export function useAutoLayout({
  nodes,
  connections,
  setNodes,
}: UseAutoLayoutProps) {
  const layoutWorker = useAutoLayoutWorker();

  const handleAutoLayout = useCallback(async () => {
    try {
      let newNodes: DialogNode[] | null = null;
      
      if (isFeatureEnabled('WORKER_LAYOUT') && layoutWorker.isInitialized) {
        logger.debug('[useAutoLayout] Using worker layout calculation');
        
        newNodes = await layoutWorker.autoLayout(nodes, connections, {
          rankdir: "LR",
          nodeWidth: 340,
          ranksep: 240,
          nodesep: 180,
          edgesep: 60,
        });
      } else {
        logger.debug('[useAutoLayout] Using regular layout calculation');
        newNodes = autoLayout(nodes, connections, {
          rankdir: "LR",
          nodeWidth: 340,
          ranksep: 240,
          nodesep: 180,
          edgesep: 60,
        });
      }
      
      if (newNodes) {
        setNodes(newNodes);
      }
    } catch (error) {
      logger.error('[useAutoLayout] Layout error:', error);
      // Fallback to regular layout on error
      const newNodes = autoLayout(nodes, connections, {
        rankdir: "LR",
        nodeWidth: 340,
        ranksep: 240,
        nodesep: 180,
        edgesep: 60,
      });
      setNodes(newNodes);
    }
  }, [nodes, connections, setNodes, layoutWorker.isInitialized, layoutWorker.autoLayout]);

  return {
    handleAutoLayout,
    isCalculating: layoutWorker.isCalculating,
    layoutStats: layoutWorker.stats,
  };
}
