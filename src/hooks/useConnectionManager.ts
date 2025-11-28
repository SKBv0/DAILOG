import { useState, useCallback } from "react";
import { DialogNode } from "../types/dialog";
import { Connection } from "../types/nodes";

interface Point {
  x: number;
  y: number;
}

interface TempConnection {
  id: string;
  source: string;
  target: string;
  sourcePoint: Point;
  targetPoint: Point;
}

interface UseConnectionManagerProps {
  nodes: DialogNode[];
  connections: Connection[];
  setConnections: (
    connections: Connection[] | ((prev: Connection[]) => Connection[]),
  ) => void;
  selectedNodes: string[];
  updateHighlightedConnections?: (selectedNodeIds: string[]) => void;
}

export const useConnectionManager = ({
  nodes,
  connections,
  setConnections,
  selectedNodes,
  updateHighlightedConnections,
}: UseConnectionManagerProps) => {
  const [tempConnection, setTempConnection] = useState<TempConnection | null>(
    null,
  );
  const [selectedConnection, setSelectedConnection] = useState<string | null>(
    null,
  );

  const handleConnectionRemove = useCallback(
    (connectionId: string) => {
      const [source, target] = connectionId.split("-");
      setConnections((prev) =>
        prev.filter(
          (conn) => !(conn.source === source && conn.target === target),
        ),
      );

      updateHighlightedConnections?.(selectedNodes);
    },
    [selectedNodes, updateHighlightedConnections, setConnections],
  );

  const handleConnectionClick = useCallback(
    (connectionId: string) => {
      const connection = connections.find((conn) => conn.id === connectionId);
      return connection || null;
    },
    [connections],
  );

  const handleConnectionUpdate = useCallback(
    (updatedConnection: Connection) => {
      setConnections((prev) =>
        prev.map((conn) =>
          conn.id === updatedConnection.id ? updatedConnection : conn,
        ),
      );
      return null;
    },
    [setConnections],
  );

  const handleNodeSelectorSelect = useCallback(
    (
      sourceNodeId: string,
      targetNodeId: string,
      connectionType: "input" | "output",
    ) => {
      const newConnection: Connection = {
        id: `conn-${Date.now()}`,
        source: connectionType === "output" ? sourceNodeId : targetNodeId,
        target: connectionType === "output" ? targetNodeId : sourceNodeId,
      };

      const connectionExists = connections.some(
        (conn) =>
          (conn.source === newConnection.source &&
            conn.target === newConnection.target) ||
          (conn.source === newConnection.target &&
            conn.target === newConnection.source),
      );

      if (!connectionExists) {
        setConnections((prev) => [...prev, newConnection]);

        updateHighlightedConnections?.([sourceNodeId, targetNodeId]);
      }
    },
    [connections, updateHighlightedConnections, setConnections],
  );

  const getConnectionPoint = useCallback(
    (nodeId: string, pointId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return { x: 0, y: 0 };

      const isInput = pointId.includes("input");
      const width = node.data.metadata?.dimensions?.width || 256;
      const height = node.data.metadata?.dimensions?.height || 80;

      return {
        x: node.position.x + (isInput ? 0 : width),
        y: node.position.y + height / 2,
      };
    },
    [nodes],
  );

  const handleConnectionStart = useCallback(
    (nodeId: string, pointId: string, pointType: "input" | "output") => {
      setTempConnection({
        id: "temp",
        source: pointType === "output" ? nodeId : "",
        target: pointType === "input" ? nodeId : "",
        sourcePoint:
          pointType === "output"
            ? getConnectionPoint(nodeId, pointId)
            : { x: 0, y: 0 },
        targetPoint:
          pointType === "input"
            ? getConnectionPoint(nodeId, pointId)
            : { x: 0, y: 0 },
      });
    },
    [getConnectionPoint],
  );

  const handleConnectionDrag = useCallback(
    (e: MouseEvent) => {
      if (tempConnection) {
        setTempConnection((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            [prev.source ? "targetPoint" : "sourcePoint"]: {
              x: e.clientX,
              y: e.clientY,
            },
          };
        });
      }
    },
    [tempConnection],
  );

  const handleConnectionEnd = useCallback(
    (nodeId: string, pointId: string, pointType: "input" | "output") => {
      if (tempConnection) {
        if (
          (pointType === "input" && tempConnection.source) ||
          (pointType === "output" && tempConnection.target)
        ) {
          const source = pointType === "input" ? tempConnection.source : nodeId;
          const target =
            pointType === "output" ? tempConnection.target : nodeId;

          const sourceNode = nodes.find((n) => n.id === source);
          const targetNode = nodes.find((n) => n.id === target);

          if (sourceNode && targetNode) {
            const connectionExists = connections.some(
              (conn) => conn.source === source && conn.target === target,
            );

            if (!connectionExists) {
              const newConnection: Connection = {
                id: `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                source,
                target,
                sourceHandle: pointId,
                targetHandle: pointId,
              };

              setConnections((prev) => [...prev, newConnection]);
            }
          }
        }

        setTempConnection(null);
      }
    },
    [tempConnection, nodes, connections, setConnections],
  );

  const deleteConnection = useCallback(
    (connectionId: string) => {
      setConnections((prevConnections) => {
        const filteredConnections = prevConnections.filter(
          (conn) => conn.id !== connectionId,
        );

        const highlightedIds = filteredConnections
          .filter(
            (conn) =>
              selectedNodes.includes(conn.source) ||
              selectedNodes.includes(conn.target),
          )
          .map((conn) => conn.id);

        if (highlightedIds.length !== prevConnections.length) {
          updateHighlightedConnections?.(selectedNodes);
        }

        return filteredConnections;
      });

      setSelectedConnection(null);
    },
    [
      setConnections,
      selectedNodes,
      updateHighlightedConnections,
      setSelectedConnection,
    ],
  );

  return {
    connections,
    setConnections,
    handleConnectionStart,
    handleConnectionEnd,
    handleConnectionDrag,
    deleteConnection,
    tempConnection,
    setTempConnection,
    selectedConnection,
    setSelectedConnection,
    handleConnectionRemove,
    handleConnectionClick,
    handleConnectionUpdate,
    handleNodeSelectorSelect,
    getConnectionPoint,
  };
};

export default useConnectionManager;
