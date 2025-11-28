import { Node, Edge, XYPosition, NodeDragHandler } from "reactflow";
import { v4 as uuidv4 } from "uuid";
import { useCallback, useState, useRef, type MouseEvent } from "react";

interface CopyPasteHandlerProps {
  selectedNodes: Node[];
  getEdges: () => Edge[];
  setNodes: (updater: (nodes: Node[]) => Node[]) => void;
  setEdges: (updater: (edges: Edge[]) => Edge[]) => void;
  zoom: number;
}

export const useCopyPaste = ({
  selectedNodes,
  getEdges,
  setNodes,
  setEdges,
  zoom,
}: CopyPasteHandlerProps) => {
  const [isDraggingWithAlt, setIsDraggingWithAlt] = useState(false);
  const dragStartPositionRef = useRef<{ x: number; y: number } | null>(null);
  const originalPositionsRef = useRef<Map<string, XYPosition>>(new Map());
  const lastUpdateRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const lockedNodeIdsRef = useRef<string[]>([]);

  const onNodeDragStart: NodeDragHandler = useCallback(
    (event, draggedNode) => {
      if (!event.altKey) {
        return;
      }

      let nodesToCopy = selectedNodes;

      if (!selectedNodes.find((n) => n.id === draggedNode.id)) {
        nodesToCopy = [draggedNode];
      }

      if (nodesToCopy.length === 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setIsDraggingWithAlt(true);
      dragStartPositionRef.current = { x: event.clientX, y: event.clientY };

      lockedNodeIdsRef.current = nodesToCopy.map((n) => n.id);
      originalPositionsRef.current.clear();
      nodesToCopy.forEach((node) => {
        originalPositionsRef.current.set(node.id, { ...node.position });
      });

      const ghostNodes = nodesToCopy.map((node) => ({
        ...node,
        id: `ghost-${node.id}`,
        className: "ghost-node",
        draggable: false,
        selectable: false,
        position: {
          x: node.position.x + 20,
          y: node.position.y + 20,
        },
        data: { ...node.data, isGhost: true },
      }));

      setNodes((nodes) => [
        ...nodes.map((n) =>
          lockedNodeIdsRef.current.includes(n.id) ? { ...n, draggable: false } : n
        ),
        ...ghostNodes,
      ]);
    },
    [selectedNodes, setNodes]
  );

  const onNodeDrag = useCallback(
    (event: MouseEvent, _node: Node) => {
      if (!isDraggingWithAlt || !dragStartPositionRef.current || !event.altKey) return;

      const now = performance.now();
      if (now - lastUpdateRef.current < 16) return; // Throttle to ~60fps
      lastUpdateRef.current = now;

      event.preventDefault();
      event.stopPropagation();

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      const dx = (event.clientX - dragStartPositionRef.current.x) / zoom;
      const dy = (event.clientY - dragStartPositionRef.current.y) / zoom;

      animationFrameRef.current = requestAnimationFrame(() => {
        setNodes((nodes) =>
          nodes.map((n) => {
            if (n.id.startsWith("ghost-")) {
              const originalId = n.id.replace("ghost-", "");
              const originalPos = originalPositionsRef.current.get(originalId);
              if (!originalPos) {
                return n;
              }
              return {
                ...n,
                position: {
                  x: originalPos.x + dx + 20,
                  y: originalPos.y + dy + 20,
                },
              };
            }

            const originalPos = originalPositionsRef.current.get(n.id);
            if (originalPos) {
              return { ...n, position: originalPos };
            }
            return n;
          })
        );
      });
    },
    [isDraggingWithAlt, zoom, setNodes]
  );

  const onNodeDragStop = useCallback(
    (event: MouseEvent, _draggedNode: Node) => {
      if (!isDraggingWithAlt) {
        setIsDraggingWithAlt(false);
        dragStartPositionRef.current = null;
        originalPositionsRef.current.clear();
        lockedNodeIdsRef.current = [];
        return;
      }

      if (!event.altKey) {
        setNodes((nodes) =>
          nodes
            .filter((n) => !n.id.startsWith("ghost-"))
            .map((n) =>
              lockedNodeIdsRef.current.includes(n.id) ? { ...n, draggable: true } : n
            )
        );
        setIsDraggingWithAlt(false);
        dragStartPositionRef.current = null;
        originalPositionsRef.current.clear();
        lockedNodeIdsRef.current = [];
        return;
      }

      const idMap = new Map<string, string>();
      const newNodes: Node[] = [];

      setNodes((nodes) => {
        const ghostNodes = nodes.filter((n) => n.id.startsWith("ghost-"));
        const regularNodes = nodes.filter((n) => !n.id.startsWith("ghost-"));

        ghostNodes.forEach((ghostNode) => {
          const originalId = ghostNode.id.replace("ghost-", "");
          const newId = `node-${uuidv4()}`;
          idMap.set(originalId, newId);

          newNodes.push({
            ...ghostNode,
            id: newId,
            className: "",
            draggable: true,
            selectable: true,
            selected: true,
            data: { ...ghostNode.data, isGhost: false },
          });
        });

        return [
          ...regularNodes.map((n) => ({
            ...n,
            selected: false,
            draggable: lockedNodeIdsRef.current.includes(n.id) ? true : n.draggable,
          })),
          ...newNodes,
        ];
      });

      if (newNodes.length > 0) {
        const relevantEdges = getEdges().filter(
          (edge) =>
            selectedNodes.some((n) => n.id === edge.source) &&
            selectedNodes.some((n) => n.id === edge.target)
        );

        const newEdges = relevantEdges.map((edge) => ({
          ...edge,
          id: `edge-${uuidv4()}`,
          source: idMap.get(edge.source) || edge.source,
          target: idMap.get(edge.target) || edge.target,
        }));

        setEdges((edges) => [...edges, ...newEdges]);
      }

      setIsDraggingWithAlt(false);
      dragStartPositionRef.current = null;
      originalPositionsRef.current.clear();
      lockedNodeIdsRef.current = [];

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    },
    [isDraggingWithAlt, selectedNodes, getEdges, setNodes, setEdges]
  );

  return {
    onNodeDragStart,
    onNodeDrag,
    onNodeDragStop,
    isAltCopying: isDraggingWithAlt,
    getLockedNodeIds: () => lockedNodeIdsRef.current,
  };
};
