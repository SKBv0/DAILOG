import { useState, useEffect, useCallback } from "react";
import type { ReactFlowApi } from "../types/reactflow";

export interface ViewportState {
  offset: { x: number; y: number };
  size: { width: number; height: number };
  zoom: number;
}

export function useViewport(
  editorRef: React.RefObject<HTMLDivElement>,
  reactFlowApi?: ReactFlowApi
): ViewportState & {
  updateViewportSize: () => void;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleCenterViewport: () => void;
} {
  const [viewportOffset, setViewportOffset] = useState<{
    x: number;
    y: number;
  }>({ x: 0, y: 0 });
  const [viewportSize, setViewportSize] = useState<{
    width: number;
    height: number;
  }>({ width: 0, height: 0 });

  const updateViewportSize = useCallback(() => {
    if (editorRef.current) {
      const width = editorRef.current.clientWidth;
      const height = editorRef.current.clientHeight;

      setViewportSize({ width, height });

      const viewport = reactFlowApi?.getViewport() ?? { x: 0, y: 0, zoom: 1 };
      setViewportOffset({
        x: viewport.x,
        y: viewport.y,
      });
    }
  }, [editorRef, reactFlowApi]);

  useEffect(() => {
    if (!editorRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setViewportSize({ width, height });
      }
    });

    resizeObserver.observe(editorRef.current);
    updateViewportSize();

    return () => {
      resizeObserver.disconnect();
    };
  }, [editorRef]);

  useEffect(() => {
    if (!reactFlowApi) return;

    let lastViewport = { x: 0, y: 0, zoom: 1 };
    let animationFrameId: number;

    const handleViewportChange = () => {
      const viewport = reactFlowApi.getViewport();

      if (lastViewport.x !== viewport.x || lastViewport.y !== viewport.y) {
        lastViewport = { x: viewport.x, y: viewport.y, zoom: viewport.zoom };
        setViewportOffset(lastViewport);
      }
    };

    handleViewportChange();

    const checkViewport = () => {
      handleViewportChange();
      animationFrameId = requestAnimationFrame(checkViewport);
    };

    const timeoutId = setTimeout(() => {
      animationFrameId = requestAnimationFrame(checkViewport);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [reactFlowApi]);

  const handleZoomIn = useCallback(() => {
    reactFlowApi?.zoomIn();
  }, [reactFlowApi]);

  const handleZoomOut = useCallback(() => {
    reactFlowApi?.zoomOut();
  }, [reactFlowApi]);

  const handleCenterViewport = useCallback(() => {
    reactFlowApi?.fitView();
  }, [reactFlowApi]);

  return {
    offset: viewportOffset,
    size: viewportSize,
    zoom: reactFlowApi?.getViewport().zoom ?? 1,
    updateViewportSize,
    handleZoomIn,
    handleZoomOut,
    handleCenterViewport,
  };
}
