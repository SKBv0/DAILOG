import React, { useState, useEffect } from "react";
import { ChevronUp, ChevronDown, GitBranch, Zap, GitFork, MessageSquare } from "lucide-react";
import DialogAnalysis from "../DialogAnalysis";
import { DialogNode } from "../../types/dialog";
import { DialogAnalysisData } from "../../utils/dialogAnalyzer";

interface BottomPanelProps {
  dialogAnalysis: DialogAnalysisData | null;
  nodes: DialogNode[];
}

const BottomPanel: React.FC<BottomPanelProps> = ({
  dialogAnalysis,
  nodes,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [panelHeight, setPanelHeight] = useState(240);
  const [isDragging, setIsDragging] = useState(false);

  const totalNodes = dialogAnalysis?.totalNodes ?? nodes.length;
  const totalPaths = dialogAnalysis?.totalPaths ?? 0;
  const totalBranches = dialogAnalysis?.totalBranchPoints ?? 0;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const viewportHeight = window.innerHeight;
      const mouseY = e.clientY;
      const newHeight = Math.max(120, Math.min(500, viewportHeight - mouseY));

      setPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div
      className="w-full bg-[#0D0D0F] border-t border-[#1A1A1F] transition-all flex-shrink-0 relative"
      style={{ height: isExpanded ? `${panelHeight}px` : "32px" }}
    >
      {isExpanded && (
        <div
          className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize z-10"
          onMouseDown={handleMouseDown}
          style={{ transform: "translateY(-50%)" }}
        />
      )}

      <div className="h-8 flex items-center justify-between px-2">
        <div className="flex items-center gap-3 pl-1">
          <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
            Analysis
          </span>

          <div className="flex items-center gap-2 text-[10px] text-gray-500">
            <div className="flex items-center gap-1">
              <GitBranch className="w-3 h-3 text-blue-400" />
              <span>{totalBranches}</span>
            </div>
            <div className="flex items-center gap-1">
              <GitFork className="w-3 h-3 text-purple-400" />
              <span>{totalPaths}</span>
            </div>
            <div className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3 text-pink-400" />
              <span>{totalNodes}</span>
            </div>
            {dialogAnalysis && (
              <div className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" />
                <span>{(dialogAnalysis.consistencyPercentage ?? 0).toFixed(0)}%</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-sm hover:bg-[#1A1A1F]/30 transition-colors"
            aria-label={isExpanded ? "Collapse panel" : "Expand panel"}
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-gray-500" />
            ) : (
              <ChevronUp className="w-3 h-3 text-gray-500" />
            )}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="h-[calc(100%-2rem)] overflow-y-auto">
          {dialogAnalysis ? (
            <div className="p-3">
              <DialogAnalysis
                analysis={dialogAnalysis}
                deadEndsCount={dialogAnalysis.deadEndCount || 0}
                showMetricCards={true}
              />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-[11px] text-gray-500">
              No analysis available yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BottomPanel;

