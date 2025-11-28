import React, { memo } from "react";
import { EdgeProps, getStraightPath, BaseEdge } from "reactflow";

interface BundledEdgeData {
  bundleId: string;
  bundleIndex: number;
  bundleSize: number;
  customPath?: string;
}

const BundledEdge: React.FC<EdgeProps<BundledEdgeData>> = ({
  sourceX,
  sourceY,
  targetX,
  targetY,
  style = {},
  data,
  markerEnd,
  selected,
}) => {
  let edgePath: string;

  if (data?.customPath) {
    edgePath = data.customPath;
  } else {
    const [path] = getStraightPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
    });
    edgePath = path;
  }

  const bundleSize = data?.bundleSize ?? 1;
  const bundleIndex = data?.bundleIndex ?? 0;

  const bundledStyle = {
    ...style,
    strokeWidth: bundleSize > 1 && bundleIndex === 0 ? 3 : 2,
    stroke: selected ? "#3b82f6" : bundleSize > 1 ? "#4f46e5" : "#6b7280",
    opacity: bundleSize > 1 ? (bundleIndex === 0 ? 0.9 : 0.6 - bundleIndex * 0.1) : 0.7,
    strokeDasharray: bundleSize > 1 && bundleIndex > 0 ? "5,5" : undefined,
    filter:
      bundleSize > 1 && bundleIndex === 0
        ? "drop-shadow(0px 2px 4px rgba(0,0,0,0.1))"
        : undefined,
    transition: "all 0.2s ease-in-out",
  };

  const handleMouseEnter = (event: React.MouseEvent) => {
    if (bundleSize > 1) {
      const path = event.currentTarget as SVGPathElement;
      path.style.opacity = "1";
      path.style.strokeWidth = "3";
    }
  };

  const handleMouseLeave = (event: React.MouseEvent) => {
    if (bundleSize > 1) {
      const path = event.currentTarget as SVGPathElement;
      path.style.opacity = bundledStyle.opacity?.toString() || "0.7";
      path.style.strokeWidth = bundledStyle.strokeWidth?.toString() || "2";
    }
  };

  return (
    <>
      <BaseEdge path={edgePath} style={bundledStyle} markerEnd={markerEnd} interactionWidth={10} />

      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth="15"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: "pointer" }}
      />

      {bundleSize > 1 && bundleIndex === 0 && (
        <g>
          <circle
            cx={sourceX + (targetX - sourceX) * 0.8}
            cy={sourceY + (targetY - sourceY) * 0.8}
            r="8"
            fill="rgba(59, 130, 246, 0.1)"
            stroke="#3b82f6"
            strokeWidth="1"
          />
          <text
            x={sourceX + (targetX - sourceX) * 0.8}
            y={sourceY + (targetY - sourceY) * 0.8}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="10"
            fill="#3b82f6"
            fontWeight="500"
          >
            {bundleSize}
          </text>
        </g>
      )}
    </>
  );
};

export default memo(BundledEdge);
