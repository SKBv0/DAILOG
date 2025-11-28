import React, { useState, useCallback, useRef, CSSProperties, useEffect, useMemo } from "react";
import { EdgeProps } from "reactflow";
import { useEdgeActions } from "./EdgeActionHandler";
import { useEdgePathCache } from "../../utils/edgePathCache";
import { usePerformanceTracker } from "../../utils/performanceProfiler";
import { useEdgePerformance } from "../../hooks/useEdgePerformance";

interface MenuOptionProps {
  label: string;
  onClick: () => void;
}

interface DraggableEdgeProps extends EdgeProps {
  data?: {
    menuOptions?: MenuOptionProps[];
  };
}

const DraggableEdge: React.FC<DraggableEdgeProps> = ({
  id,
  source: _source,
  target: _target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}) => {
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [isDeleteHovered, setIsDeleteHovered] = useState(false);

  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const deleteHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const edgeRef = useRef<SVGPathElement>(null);
  const { handleAddNode, handleDeleteEdge, handleInsertCondition } = useEdgeActions();

  const edgePathCache = useEdgePathCache();
  const perfTracker = usePerformanceTracker(`DraggableEdge-${id}`);
  const edgePerf = useEdgePerformance(id);

  const menuOptions = data?.menuOptions || [
    {
      label: "Add Node",
      onClick: () => handleAddNode(id, menuPosition),
    },
    {
      label: "Insert Condition",
      onClick: () => handleInsertCondition(id, menuPosition),
    },
    {
      label: "Delete Connection",
      onClick: () => handleDeleteEdge(id),
    },
  ];

  const pathData = useMemo(() => {
    edgePerf.startRender();
    perfTracker.startMeasurement("edge-path-computation");

    const result = edgePathCache.getOrComputePath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      curvature: 0.4,
    });

    perfTracker.endMeasurement("edge-path-computation");
    edgePerf.endRender();

    return result;
  }, [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, edgePathCache]);

  const centerX = (sourceX + targetX) / 2;
  const centerY = (sourceY + targetY) / 2;

  const onContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setMenuPosition({ x: event.clientX, y: event.clientY });
    setMenuVisible(true);
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    requestAnimationFrame(() => {
      setIsHovered(true);
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    requestAnimationFrame(() => {
      hoverTimeoutRef.current = setTimeout(() => {
        if (!isDeleteHovered) {
          setIsHovered(false);
        }
      }, 200);
    });
  }, [isDeleteHovered]);

  const handleDeleteMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    if (deleteHoverTimeoutRef.current) {
      clearTimeout(deleteHoverTimeoutRef.current);
      deleteHoverTimeoutRef.current = null;
    }
    requestAnimationFrame(() => {
      setIsDeleteHovered(true);
      setIsHovered(true);
    });
  }, []);

  const handleDeleteMouseLeave = useCallback(() => {
    requestAnimationFrame(() => {
      deleteHoverTimeoutRef.current = setTimeout(() => {
        setIsDeleteHovered(false);
        requestAnimationFrame(() => {
          const pathElement = document.querySelector(`path[id="${id}"]:hover`);
          if (!pathElement) {
            setIsHovered(false);
          }
        });
      }, 100);
    });
  }, [id]);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (deleteHoverTimeoutRef.current) {
        clearTimeout(deleteHoverTimeoutRef.current);
      }
    };
  }, []);

  const handleDeleteClick = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      setIsHovered(false);
      setIsDeleteHovered(false);

      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      if (deleteHoverTimeoutRef.current) {
        clearTimeout(deleteHoverTimeoutRef.current);
        deleteHoverTimeoutRef.current = null;
      }

      handleDeleteEdge(id);
    },
    [handleDeleteEdge, id]
  );

  const handleDocumentClick = useCallback(
    (_event: MouseEvent) => {
      if (menuVisible) {
        setMenuVisible(false);
      }
    },
    [menuVisible]
  );

  React.useEffect(() => {
    if (menuVisible) {
      document.addEventListener("click", handleDocumentClick);
    }

    return () => {
      document.removeEventListener("click", handleDocumentClick);
    };
  }, [menuVisible, handleDocumentClick]);

  const menuStyle: CSSProperties = {
    position: "absolute",
    top: menuPosition.y,
    left: menuPosition.x,
    background: "#1e293b",
    color: "white",
    padding: "8px 0",
    borderRadius: "6px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
    zIndex: 1000,
    minWidth: "180px",
    border: "1px solid rgba(255, 255, 255, 0.1)",
  };

  const menuHeaderStyle: CSSProperties = {
    padding: "8px 12px",
    borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
    fontSize: "14px",
    fontWeight: "bold",
  };

  const menuOptionStyle: CSSProperties = {
    padding: "8px 12px",
    cursor: "pointer",
    fontSize: "14px",
    transition: "background-color 0.2s",
  };

  return (
    <>
      <defs>
        <marker
          id="edge-arrow-contrast"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#cbd5e1" />
        </marker>
      </defs>
      <path
        style={{
          stroke: "transparent",
          strokeWidth: 20,
          fill: "none",
          cursor: "pointer",
        }}
        d={pathData.path}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onContextMenu={onContextMenu}
      />

      <path
        id={id}
        ref={edgeRef}
        style={{
          ...style,
          strokeWidth: (style.strokeWidth as number) || (isHovered ? 3 : 2.5),
          stroke: (style.stroke as string) || (isHovered ? "#94a3b8" : "#b1b1b7"),
          cursor: "pointer",
          zIndex: 1,
        }}
        className="react-flow__edge-path"
        d={pathData.path}
        markerEnd={markerEnd || "url(#edge-arrow-contrast)"}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onContextMenu={onContextMenu}
      />

      {isHovered && (
        <g
          className="edge-delete-button"
          style={{
            cursor: "pointer",
            pointerEvents: "all" as const,
          }}
          onMouseEnter={handleDeleteMouseEnter}
          onMouseLeave={handleDeleteMouseLeave}
          onClick={handleDeleteClick}
          transform={`translate(${centerX}, ${centerY})`}
        >
          <circle
            r={12}
            fill={isDeleteHovered ? "rgba(239, 68, 68, 0.9)" : "rgba(31, 41, 55, 0.85)"}
            stroke={isDeleteHovered ? "rgba(248, 113, 113, 0.4)" : "rgba(75, 85, 99, 0.4)"}
            strokeWidth={1.5}
            style={{
              transition: "all 0.15s ease",
            }}
          />

          <g
            stroke={isDeleteHovered ? "white" : "rgba(209, 213, 219, 0.8)"}
            strokeWidth={2.5}
            strokeLinecap="round"
            transform="scale(0.6)"
          >
            <line x1={-8} y1={-8} x2={8} y2={8} />
            <line x1={8} y1={-8} x2={-8} y2={8} />
          </g>
        </g>
      )}

      {menuVisible && (
        <div style={menuStyle} onClick={(e) => e.stopPropagation()}>
          <div style={menuHeaderStyle}>Edge Actions</div>
          {menuOptions.map((option, index) => (
            <div
              key={index}
              style={menuOptionStyle}
              className="menu-option"
              onClick={(e) => {
                e.stopPropagation();
                option.onClick();
                setMenuVisible(false);
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(59, 130, 246, 0.2)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = "";
              }}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default DraggableEdge;
