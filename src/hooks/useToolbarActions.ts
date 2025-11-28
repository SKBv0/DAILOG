import { useCallback, useEffect } from "react";
import { toast } from "react-hot-toast";
import { DialogNode } from "../types/dialog";
import { Connection } from "../types/editor";
import { ProjectType } from "../types/project";
import { saveDialogFlow } from "../utils/localStorageUtils";
import logger from "../utils/logger";
import { collectDialogLines, findRootNodes } from "../utils/dialogTraversal";

interface UseToolbarActionsProps {
  nodes: DialogNode[];
  setNodes: React.Dispatch<React.SetStateAction<DialogNode[]>>;
  connections: Connection[];
  setConnections: React.Dispatch<React.SetStateAction<Connection[]>>;
  setIsSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  projectType: ProjectType;
}

const useToolbarActions = ({
  nodes,
  setNodes,
  connections,
  setConnections,
  setIsSettingsOpen,
  projectType,
}: UseToolbarActionsProps) => {
  useEffect(() => {
    saveDialogFlow(nodes, connections, projectType);
  }, [nodes, connections, projectType]);

  const handleExportDialog = useCallback(() => {
    const dialogFlow = {
      schemaVersion: "2.0.0",
      nodes,
      edges: connections,
      tags: [],
      metadata: {
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        projectType: projectType || "game",
        title: "Exported Project",
        totalNodes: nodes.length,
        totalEdges: connections.length,
      },
    };
    const jsonStr = JSON.stringify(dialogFlow, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "dialog-flow.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);

    toast.success("Dialog flow exported successfully");
  }, [nodes, connections, projectType]);

  const handleExportDialogScript = useCallback(() => {
    if (!nodes.length) {
      toast.error("No dialog nodes to export");
      return;
    }

    const rootNodes = findRootNodes(nodes, connections);
    const startingNodes = rootNodes.length > 0 ? rootNodes : nodes;
    const startId = startingNodes[0]?.id;

    if (!startId) {
      toast.error("Unable to determine start node for dialog script export");
      return;
    }

    const lines = collectDialogLines({
      nodes,
      connections,
      startId,
      startingNodes,
    });

    const scriptExport = {
      schemaVersion: "1.0.0",
      type: "dialogScript",
      metadata: {
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        projectType: projectType || "game",
        title: "Exported Dialog Script",
        totalNodes: nodes.length,
        totalEdges: connections.length,
        totalLines: lines.length,
      },
      lines,
    };

    const jsonStr = JSON.stringify(scriptExport, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "dialog-script.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);

    toast.success("Dialog script exported successfully");
  }, [nodes, connections, projectType]);

  const handleCopyToClipboard = useCallback(async () => {
    try {
      const dialogFlow = {
        schemaVersion: "2.0.0",
        nodes,
        edges: connections,
        tags: [],
        metadata: {
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          projectType: projectType || "game",
          title: "Copied Project",
          totalNodes: nodes.length,
          totalEdges: connections.length,
        },
      };
      const jsonStr = JSON.stringify(dialogFlow, null, 2);
      await navigator.clipboard.writeText(jsonStr);
      toast.success("Copied to clipboard");
    } catch (error) {
      toast.error("Failed to copy to clipboard");
    }
  }, [nodes, connections, projectType]);

  const handleImportDialog = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);

          // Check for new format (V2) with schema version
          if (data.schemaVersion === "2.0.0") {
            if (data.nodes && data.edges) {
              setNodes(data.nodes);
              setConnections(data.edges);

              saveDialogFlow(data.nodes, data.edges, data.metadata?.projectType || projectType);

              toast.success("Project imported successfully (V2 format)");
            } else {
              toast.error("Invalid V2 file format - missing nodes or edges");
            }
          }
          // Check for legacy format (V1) - backwards compatibility
          else if (data.nodes && data.connections) {
            setNodes(data.nodes);
            setConnections(data.connections);

            saveDialogFlow(data.nodes, data.connections, data.projectType || projectType);

            toast.success("Legacy project imported successfully (V1 format)");
          } else {
            toast.error("Invalid file format - unsupported structure");
          }
        } catch (error) {
          logger.error("Import error:", error);
          toast.error("Failed to parse file - check if it's a valid JSON");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [setNodes, setConnections, projectType]);

  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, [setIsSettingsOpen]);

  return {
    handleExportDialog,
    handleExportDialogScript,
    handleCopyToClipboard,
    handleImportDialog,
    handleOpenSettings,
  };
};

export default useToolbarActions;
