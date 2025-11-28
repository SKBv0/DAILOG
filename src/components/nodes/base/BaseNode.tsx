import React, { memo, useEffect, useRef, useState } from "react";
import { Handle, Position, useStore } from "reactflow";
import { DialogNodeData } from "../../../types/dialog";
import logger from "../../../utils/logger";

const zoomSelector = (state: any): number => state.transform?.[2] ?? 1;

const nodeIsDraggingSelector =
  (_nodeId: string) =>
    (state: any): boolean => {
      return !!state.nodeDragging;
    };

const ZOOM_THRESHOLDS = {
  LOW: 0.75,
  ZOOM_IN: 0.8,
  ZOOM_OUT: 0.7,
};

interface BaseNodeStyleProps {
  primaryColor: string;
  bgBase: string;
  bgSelected: string;
  borderBase: string;
  borderSelected: string;
}

interface BaseNodeProps {
  id?: string;
  data: DialogNodeData;
  selected: boolean;
  type: string;
  style?: BaseNodeStyleProps;
  headerContent?: React.ReactNode;
  children?: React.ReactNode;
  displayNames: {
    short: string;
    full: string;
  };
  hideDefaultHandles?: boolean;
}

const BaseNode: React.FC<BaseNodeProps> = ({
  id,
  data,
  selected,
  type,
  style,
  headerContent,
  children,
  displayNames,
  hideDefaultHandles = false,
}) => {
  const nodeId = id || `node-${Math.random().toString(36).substring(2, 9)}`;

  const prevProcessingRef = useRef<boolean | null>(null);

  const nodeStyle = style || {
    primaryColor: "#3B82F6",
    bgBase: "rgba(15, 23, 42, 0.6)",
    bgSelected: "rgba(15, 23, 42, 0.85)",
    borderBase: "rgba(59, 130, 246, 0.2)",
    borderSelected: "#3B82F6",
  };

  let nodeColor = nodeStyle.primaryColor;

  if (data.metadata?.nodeData?.color) {
    nodeColor = data.metadata.nodeData.color;
  } else if (data.style?.primaryColor) {
    nodeColor = data.style.primaryColor;
  } else {
    switch (type) {
      case "playerResponse":
      case "player":
        nodeColor = "#10B981";
        break;
      case "npcDialog":
      case "npc":
        nodeColor = "#3B82F6";
        break;
      case "enemyDialog":
      case "enemy":
        nodeColor = "#EF4444";
        break;
      case "narrator":
        nodeColor = "#F59E0B";
        break;
      case "choice":
        nodeColor = "#8B5CF6";
        break;
      default:
        nodeColor = nodeStyle.primaryColor;
    }
  }

  const effectiveNodeStyle = {
    ...nodeStyle,
    primaryColor: nodeColor,
    borderSelected: nodeColor,
  };

  const zoom = useStore(zoomSelector);
  const isDragging = useStore(nodeIsDraggingSelector(nodeId));

  // PHASE 2.2 OPTIMIZATION: Consolidate 3 useState → 1, single rAF
  const zoomRef = useRef(zoom);
  const viewModeRef = useRef<"compact" | "full">(zoom <= ZOOM_THRESHOLDS.ZOOM_OUT ? "compact" : "full");
  const [zoomState, setZoomState] = useState({
    throttledZoom: zoom,
    viewMode: (zoom <= ZOOM_THRESHOLDS.ZOOM_OUT ? "compact" : "full") as "compact" | "full",
    isZooming: false,
  });
  const zoomTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const prevZoom = zoomRef.current;
    const currentZoom = zoom;
    const prevViewMode = viewModeRef.current;

    // Early return for insignificant changes
    const zoomDelta = Math.abs(currentZoom - prevZoom);
    if (zoomDelta < 0.02) return;

    let newViewMode: "compact" | "full";
    if (currentZoom <= ZOOM_THRESHOLDS.ZOOM_OUT) {
      newViewMode = "compact";
    } else if (currentZoom >= ZOOM_THRESHOLDS.ZOOM_IN) {
      newViewMode = "full";
    } else {
      newViewMode = prevViewMode;
    }

    const viewModeChanged = newViewMode !== prevViewMode;
    const significantChange = zoomDelta > 0.15;

    if (viewModeChanged || significantChange) {
      zoomRef.current = currentZoom;
      viewModeRef.current = newViewMode;

      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
        zoomTimeoutRef.current = null;
      }

      // Single rAF instead of double - batch all state updates
      requestAnimationFrame(() => {
        setZoomState({
          throttledZoom: currentZoom,
          viewMode: newViewMode,
          isZooming: viewModeChanged,
        });

        if (viewModeChanged) {
          zoomTimeoutRef.current = window.setTimeout(() => {
            setZoomState((prev) => ({ ...prev, isZooming: false }));
            zoomTimeoutRef.current = null;
          }, 300);
        }
      });
    }

    return () => {
      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
        zoomTimeoutRef.current = null;
      }
    };
  }, [zoom]);

  const { throttledZoom, viewMode, isZooming } = zoomState;
  const isLowDetail = throttledZoom < ZOOM_THRESHOLDS.LOW;

  const hasTags = !!(data.metadata?.nodeData?.tags?.length || data.metadata?.tags?.length);
  const tagsCount = data.metadata?.nodeData?.tags?.length || data.metadata?.tags?.length || 0;

  const isProcessing = typeof data.isProcessing === "boolean"
    ? data.isProcessing
    : typeof data.isProcessing === "object" && data.isProcessing !== null
      ? false
      : Boolean(data.isProcessing);
  const hasIssue = !!(data as any).hasIssue;
  const aiStatus = data.aiStatus || "idle";
  const hasError = aiStatus === "error" || aiStatus === "timeout";
  const IssueAccent = () =>
    hasIssue ? (
      <div
        aria-label="Has validation issue"
        title="Has validation issue"
        className="node-issue-accent"
      />
    ) : null;

  const styleId = `processing-animation-${nodeId}`;

  useEffect(() => {
    if (isDragging) return;

    if (prevProcessingRef.current !== isProcessing) {
      logger.throttledLog(
        "basenode_processing",
        `BaseNode ${nodeId} processing state: ${isProcessing}`
      );
    }

    if (isProcessing && !isLowDetail) {
      let styleEl = document.getElementById(styleId) as HTMLStyleElement;

      if (!styleEl) {
        styleEl = document.createElement("style");
        styleId && (styleEl.id = styleId);
      }

      styleEl.textContent = `
        @keyframes node-processing-pulse {
          0% {
            box-shadow: 0 0 8px 1px ${nodeColor}70;
            border-color: ${nodeColor}90;
          }
          50% {
            box-shadow: 0 0 20px 4px ${nodeColor}80;
            border-color: ${nodeColor};
          }
          100% {
            box-shadow: 0 0 8px 1px ${nodeColor}70;
            border-color: ${nodeColor}90;
          }
        }
        
        @keyframes handle-pulse {
          0% {
            transform: scale(1);
            box-shadow: 0 0 5px 1px ${nodeColor}80;
          }
          50% {
            transform: scale(1.2);
            box-shadow: 0 0 8px 2px ${nodeColor};
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 5px 1px ${nodeColor}80;
          }
        }
        
        @keyframes fade-pulse {
          0% { opacity: 0.1; }
          50% { opacity: 0.4; }
          100% { opacity: 0.1; }
        }
        
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        @keyframes indeterminate {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }

        .processing-node-${nodeId} {
          animation: node-processing-pulse 1.5s infinite ease-in-out;
          z-index: 5 !important;
          border-width: 2px !important;
          position: relative;
        }
        
        .processing-node-${nodeId}::before {
          content: "";
          position: absolute;
          top: -8px;
          left: -8px;
          right: -8px;
          bottom: -8px;
          border-radius: 16px;
          background: linear-gradient(135deg, ${nodeColor}10, ${nodeColor}30);
          z-index: -1;
          animation: fade-pulse 1.5s infinite ease-in-out;
        }
        
        .processing-node-${nodeId} .react-flow__handle {
          animation: handle-pulse 1.5s infinite ease-in-out;
          z-index: 6;
        }
      `;

      if (!styleEl.parentNode) {
        document.head.appendChild(styleEl);
      }

      prevProcessingRef.current = true;
    } else {
      const existingStyle = document.getElementById(styleId);
      if (existingStyle && existingStyle.parentNode) {
        existingStyle.remove();
        logger.throttledLog("basenode_animation", `BaseNode ${nodeId} animation style removed.`);
      }

      prevProcessingRef.current = false;
    }

    return () => {
      const styleElement = document.getElementById(styleId);
      if (styleElement && styleElement.parentNode) {
        styleElement.remove();
        logger.throttledLog(
          "basenode_cleanup",
          `BaseNode ${nodeId} animation style cleanup on unmount.`
        );
      }
    };
  }, [nodeId, isProcessing, isDragging, nodeColor]);

  const handleStyle = {
    backgroundColor: isProcessing ? `${nodeColor}` : nodeColor,
    borderColor: isProcessing ? nodeColor : `${nodeColor}40`,
    boxShadow:
      isProcessing && !isDragging
        ? `0 0 10px 2px ${nodeColor}`
        : isDragging
          ? "none"
          : `0 0 6px -2px ${nodeColor}40`,
    zIndex: isProcessing ? 101 : 100,
  };

  const nodeClasses = isProcessing && !isDragging ? `processing-node-${nodeId}` : "";

  const TagFlag = ({
    size = "xs",
    showCount = false,
  }: {
    size?: "xs" | "sm" | "md";
    showCount?: boolean;
  }) => {
    if (!hasTags) return null;

    const sizeClasses = {
      xs: "w-1.5 h-1.5 rounded-sm",
      sm: "w-2 h-2 rounded-sm",
      md: "px-1.5 py-0.5 rounded text-[10px]",
    };

    return (
      <div
        className={`
          ${sizeClasses[size]} 
          ${size === "md" ? "flex items-center gap-0.5" : ""}
          ${isDragging ? "" : "transition-all duration-300"}
        `}
        style={{
          background: `linear-gradient(135deg, ${nodeColor}, ${nodeColor}90)`,
          boxShadow: isDragging ? "none" : `0 0 8px -1px ${nodeColor}60`,
        }}
      >
        {size === "md" && showCount && <span className="text-white font-medium">{tagsCount}</span>}
      </div>
    );
  };

  const renderCompactNode = () => {
    const borderColor = hasError
      ? aiStatus === "timeout"
        ? "#F59E0B" // Orange for timeout
        : "#EF4444" // Red for error
      : isProcessing
        ? nodeColor
        : selected
          ? effectiveNodeStyle.borderSelected
          : effectiveNodeStyle.borderBase;

    const glowColor = hasError
      ? aiStatus === "timeout"
        ? "#F59E0B70"
        : "#EF444470"
      : `${nodeColor}70`;

    return (
    <div
      className={`group p-3 rounded-xl backdrop-blur-md ${isDragging ? "" : "transition-opacity duration-200"} ${nodeClasses}`}
      style={{
        backgroundColor: effectiveNodeStyle.bgBase,
        width: "110px",
        border: `${isProcessing || hasError ? "2px" : "1px"} solid ${borderColor}`,
        boxShadow:
          (isProcessing || hasError) && !isDragging
            ? `0 0 15px 3px ${glowColor}`
            : isDragging
              ? "none"
              : `0 0 20px -5px ${nodeColor}30`,
        transform: (isProcessing || selected || hasError) && !isDragging ? "scale(1.05)" : "scale(1)",
        position: "relative",
        willChange: isZooming ? "width, height, transform" : "auto",
        contain: "layout style",
      }}
      title={hasError ? `AI ${aiStatus}: ${data.aiError || "Unknown error"}` : undefined}
    >
      <IssueAccent />
      {isProcessing && <div aria-hidden className="node-processing-overlay" />}
      <div
        className={`w-full h-8 rounded-lg flex items-center justify-center ${isDragging ? "" : "transition-all duration-300 group-hover:scale-105"} relative`}
        style={{
          background: `linear-gradient(135deg, ${nodeColor}, ${nodeColor}90)`,
          boxShadow: isDragging ? "none" : `0 0 15px -3px ${nodeColor}40`,
          backdropFilter: isDragging ? "none" : "blur(8px)",
        }}
      >
        <span className="text-white text-xs font-medium tracking-wider">{displayNames.short}</span>
        {hasTags && (
          <div className="absolute top-1 right-1">
            <TagFlag size="xs" />
          </div>
        )}
      </div>
    </div>
    );
  };

  const renderFullNode = () => {
    const borderColor = hasError
      ? aiStatus === "timeout"
        ? "#F59E0B"
        : "#EF4444"
      : isProcessing
        ? nodeColor
        : selected
          ? effectiveNodeStyle.borderSelected
          : effectiveNodeStyle.borderBase;

    const glowColor = hasError
      ? aiStatus === "timeout"
        ? "#F59E0B70"
        : "#EF444470"
      : `${nodeColor}70`;

    return (
    <div
      className={`group rounded-xl backdrop-blur-lg ${isDragging ? "" : "transition-opacity duration-200"} ${nodeClasses}`}
      style={{
        padding: 22,
        width: "340px",
        backgroundColor: selected ? effectiveNodeStyle.bgSelected : effectiveNodeStyle.bgBase,
        border: `${isProcessing || hasError ? "2px" : "1px"} solid ${borderColor}`,
        boxShadow:
          (isProcessing || hasError) && !isDragging
            ? `0 0 20px 4px ${glowColor}`
            : isDragging
              ? "none"
              : selected
                ? `0 8px 16px -5px ${nodeColor}30`
                : `0 4px 12px -6px ${nodeColor}20`,
        transform: (isProcessing || selected || hasError) && !isDragging ? "scale(1.05)" : "scale(1)",
        position: "relative",
        willChange: isZooming ? "width, height, transform" : "auto",
        contain: "layout style",
      }}
      tabIndex={0}
      aria-label={`${displayNames.full}${hasIssue ? " (has issues)" : ""}${hasError ? ` (AI ${aiStatus})` : ""}`}
      title={hasError ? `AI ${aiStatus}: ${data.aiError || "Unknown error"}` : undefined}
    >
      <IssueAccent />
      {isProcessing && <div aria-hidden className="node-processing-overlay" style={{ borderRadius: 16 }} />}
      {hasIssue && (
        <div
          aria-label="Node has validation issues"
          title="Validation issue"
          className="node-issue-indicator"
        >
          ⚠️
        </div>
      )}
      <div className="flex items-center justify-between mb-4 node-header-container">
        <div className="flex items-center gap-3">
          <div
            className={`px-4 py-1.5 rounded-lg text-xs font-medium tracking-wider text-white/90 ${isDragging ? "" : "transition-all duration-300 group-hover:shadow-lg"} flex items-center gap-2`}
            style={{
              background: `linear-gradient(135deg, ${nodeColor}, ${nodeColor}90)`,
              boxShadow: isDragging ? "none" : `0 4px 15px -3px ${nodeColor}30`,
              backdropFilter: isDragging ? "none" : "blur(8px)",
            }}
            aria-label={`${displayNames.full} node type`}
            title={displayNames.full}
          >
            <span>{displayNames.full}</span>
            {hasTags && (
              <div className="w-3.5 h-3.5 rounded-full bg-white/20 flex items-center justify-center text-[8px] font-bold">
                {tagsCount}
              </div>
            )}
          </div>
          {headerContent && React.isValidElement(headerContent) ? headerContent : null}
        </div>
      </div>
      <div
        className="text-white/90 font-medium overflow-hidden"
        style={{
          fontSize: 15,
          lineHeight: 1.5,
          paddingLeft: 4,
          contain: "layout",
          minHeight: isProcessing && !data.text ? "60px" : "auto",
        }}
      >
        {isProcessing && (!data.text || data.text.trim() === "") ? (
          <div className="space-y-2.5 animate-pulse">
            <div
              className="h-4 bg-gradient-to-r from-white/20 via-white/10 to-white/20 rounded"
              style={{ width: "85%", animation: "shimmer 2s infinite" }}
            />
            <div
              className="h-4 bg-gradient-to-r from-white/20 via-white/10 to-white/20 rounded"
              style={{ width: "70%", animation: "shimmer 2s infinite 0.2s" }}
            />
            <div
              className="h-4 bg-gradient-to-r from-white/20 via-white/10 to-white/20 rounded"
              style={{ width: "90%", animation: "shimmer 2s infinite 0.4s" }}
            />
          </div>
        ) : (
          typeof data.text === "string" 
            ? data.text 
            : data.text != null && typeof data.text === "object"
              ? "[Invalid text content]"
              : String(data.text || "")
        )}
      </div>
      {children && React.isValidElement(children) ? <div className="mt-4 pt-4 border-t border-white/10">{children}</div> : null}
      {isProcessing && (
        <div aria-label="Generating..." className="node-processing-bar-container" style={{ bottom: 10, height: 6 }}>
          <div className="node-processing-bar" style={{ background: nodeColor, opacity: 0.8 }} />
        </div>
      )}
    </div>
  );
};

  const renderNode = () => {
    if (viewMode === "compact") return renderCompactNode();
    return renderFullNode();
  };

  return (
    <>
      {!hideDefaultHandles && (
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          className="!w-3 !h-3 !border-2"
          style={handleStyle}
        />
      )}
      {renderNode()}
      {!hideDefaultHandles && (
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          className="!w-3 !h-3 !border-2"
          style={handleStyle}
        />
      )}
    </>
  );
};

// Custom comparison function for React.memo
// Only re-render if essential props actually change
const arePropsEqual = (prevProps: BaseNodeProps, nextProps: BaseNodeProps): boolean => {
  // Always re-render if selected state changes
  if (prevProps.selected !== nextProps.selected) return false;

  // Always re-render if processing state changes
  if (prevProps.data.isProcessing !== nextProps.data.isProcessing) return false;

  // Always re-render if text content changes
  if (prevProps.data.text !== nextProps.data.text) return false;

  // Always re-render if visibility changes
  if (prevProps.data.isVisible !== nextProps.data.isVisible) return false;

  // Check if metadata changed (for tags, color, etc)
  const prevMetadata = JSON.stringify(prevProps.data.metadata);
  const nextMetadata = JSON.stringify(nextProps.data.metadata);
  if (prevMetadata !== nextMetadata) return false;

  // Props are equal, skip re-render
  return true;
};

export default memo(BaseNode, arePropsEqual);
