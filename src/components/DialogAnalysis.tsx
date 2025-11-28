import React, { useState, useEffect } from "react";
import { DialogAnalysisData } from "../utils/dialogAnalyzer";
import {
  ChevronDown,
  ChevronRight,
  GitBranch,
  MessageSquare,
  GitFork,
  Activity,
  Shuffle,
  Zap,
  Unlink,
  BarChart2,
} from "lucide-react";

interface DialogAnalysisProps {
  analysis: DialogAnalysisData | null;
  className?: string;
  deadEndsCount?: number;
  showMetricCards?: boolean;
  initialSection?: string;
}

const DialogAnalysis: React.FC<DialogAnalysisProps> = ({
  analysis,
  className = "",
  deadEndsCount = 0,
  showMetricCards = true,
  initialSection,
}) => {
  const [expandedSection, setExpandedSection] = useState<string | null>("structure");

  useEffect(() => {
    if (initialSection) {
      setExpandedSection(initialSection);
    }
  }, [initialSection]);

  if (!analysis) return null;

  const averageResponseOptions =
    analysis.nodeCounts?.player && analysis.nodeCounts?.npc
      ? analysis.nodeCounts.player / analysis.nodeCounts.npc
      : 0;
  const branchingFactor = analysis.totalBranchPoints / analysis.totalNodes || 0;
  const pathComplexity = (analysis.totalNodes * branchingFactor) / analysis.totalPaths || 0;
  const interactivityScore = ((analysis.nodeCounts?.player || 0) / analysis.totalNodes) * 100 || 0;
  const convergenceRate = (analysis.totalMergePoints / analysis.totalNodes) * 100 || 0;

  const renderMetricCards = () => {
    const metrics = [
      {
        icon: <Activity className="w-3 h-3" />,
        label: "Paths",
        value: analysis.totalPaths || 0,
        color: "text-blue-400",
        bgColor: "bg-blue-400/10",
      },
      {
        icon: <Shuffle className="w-3 h-3" />,
        label: "Branches",
        value: analysis.totalBranchPoints || 0,
        color: "text-purple-400",
        bgColor: "bg-purple-400/10",
      },
      {
        icon: <Zap className="w-3 h-3" />,
        label: "Complexity",
        value: pathComplexity.toFixed(1),
        color: "text-amber-400",
        bgColor: "bg-amber-400/10",
      },
      {
        icon: <Unlink className="w-3 h-3" />,
        label: "Dead Ends",
        value: deadEndsCount,
        color: "text-rose-400",
        bgColor: "bg-rose-400/10",
      },
    ];

    return (
      <div className="flex items-center flex-wrap gap-2 mb-2">
        {metrics.map((metric, index) => (
          <div
            key={index}
            className={`inline-flex items-center gap-1 py-0.5 px-1.5 rounded-full ${metric.bgColor} group`}
            title={`${metric.label}: ${metric.value}`}
          >
            <div className={metric.color}>{metric.icon}</div>
            <span className={`text-xs font-medium ${metric.color}`}>{metric.value}</span>
          </div>
        ))}
      </div>
    );
  };

  function getScoreColor(value: number): string {
    if (value >= 90) return "text-emerald-400";
    if (value >= 70) return "text-blue-400";
    if (value >= 50) return "text-amber-400";
    return "text-rose-400";
  }

  function getNumericScoreColor(value: number, min: number, max: number): string {
    const normalizedValue = Math.min(Math.max((value - min) / (max - min), 0), 1) * 100;
    return getScoreColor(normalizedValue);
  }

  const safeToString = (value: any) => {
    if (value === undefined || value === null) return "0";
    return value.toString();
  };

  const sections = [
    {
      id: "structure",
      title: "Structure",
      icon: <GitBranch className="w-3 h-3" />,
      color: "blue",
      items: [
        { label: "Paths", value: safeToString(analysis.totalPaths) },
        { label: "Nodes", value: safeToString(analysis.totalNodes) },
        { label: "Branches", value: safeToString(analysis.totalBranchPoints) },
        { label: "Merges", value: safeToString(analysis.totalMergePoints) },
      ],
    },
    {
      id: "complexity",
      title: "Complexity Analysis",
      icon: <Zap className="w-3 h-3" />,
      color: "green",
      items: [
        { label: "Complexity Score", value: pathComplexity.toFixed(1) },
        { label: "Branching Factor", value: branchingFactor.toFixed(1) },
        { label: "Total Nodes", value: safeToString(analysis.totalNodes) },
        {
          label: "Avg Path Length",
          value: analysis.avgPathLength ? analysis.avgPathLength.toFixed(1) : "0",
        },
        { label: "Convergence Rate", value: `${Math.round(convergenceRate)}%` },
      ],
    },
    {
      id: "paths",
      title: "Paths",
      icon: <GitFork className="w-3 h-3" />,
      color: "purple",
      items: [
        {
          label: "Average Length",
          value: analysis.avgPathLength ? analysis.avgPathLength.toFixed(1) : "0",
        },
        {
          label: "Longest Path",
          value: safeToString(analysis.longestPathLength),
        },
        { label: "Convergence Rate", value: `${Math.round(convergenceRate)}%` },
      ],
    },
    {
      id: "content",
      title: "Content",
      icon: <MessageSquare className="w-3 h-3" />,
      color: "pink",
      items: [
        {
          label: "NPC Nodes",
          value: safeToString(analysis.nodeCounts?.npc || 0),
        },
        {
          label: "Player Nodes",
          value: safeToString(analysis.nodeCounts?.player || 0),
        },
        {
          label: "Responses per NPC",
          value: averageResponseOptions.toFixed(1),
        },
        { label: "Interactivity", value: `${Math.round(interactivityScore)}%` },
      ],
    },
  ];

  const keyMetrics = [
    {
      label: "Consistency",
      value: `${Math.round(analysis.consistencyPercentage || 0)}%`,
      color: getScoreColor(analysis.consistencyPercentage || 0),
    },
    {
      label: "Interactivity",
      value: `${Math.round(interactivityScore)}%`,
      color: getScoreColor(interactivityScore),
    },
    {
      label: "Branching",
      value: branchingFactor.toFixed(1),
      color: getNumericScoreColor(branchingFactor, 0, 2),
    },
    {
      label: "Paths",
      value: safeToString(analysis.totalPaths || 0),
      color: "text-gray-300",
    },
  ];

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {showMetricCards && renderMetricCards()}

      <div className="mb-2 px-2">
        <div className="flex items-center mb-2">
          <BarChart2 className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs font-medium text-gray-400 ml-1">Dialog Metrics</span>
        </div>

        <div className="grid grid-cols-4 gap-1 mb-2">
          {keyMetrics.map((metric, idx) => (
            <div key={idx} className="rounded px-2 py-1 bg-gray-800/30">
              <div className={`text-xs font-medium ${metric.color}`}>{metric.value}</div>
              <div className="text-[9px] text-gray-500">{metric.label}</div>
            </div>
          ))}
        </div>

        <div className="space-y-1 border-t border-gray-800/40 pt-2 mt-2">
          {sections.map((section) => (
            <div key={section.id} className="rounded overflow-hidden">
              <button
                onClick={() =>
                  setExpandedSection(expandedSection === section.id ? null : section.id)
                }
                className={`w-full text-left py-1 px-2 flex items-center justify-between rounded transition-colors hover:bg-gray-800/30 ${
                  expandedSection === section.id ? `bg-gray-800/40` : ""
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <div
                    className={
                      section.color === "blue"
                        ? "text-blue-500"
                        : section.color === "green"
                          ? "text-green-500"
                          : section.color === "purple"
                            ? "text-purple-500"
                            : "text-pink-500"
                    }
                  >
                    {section.icon}
                  </div>
                  <span
                    className={
                      section.color === "blue"
                        ? "text-[10px] font-medium text-blue-400"
                        : section.color === "green"
                          ? "text-[10px] font-medium text-green-400"
                          : section.color === "purple"
                            ? "text-[10px] font-medium text-purple-400"
                            : "text-[10px] font-medium text-pink-400"
                    }
                  >
                    {section.title}
                  </span>
                </div>

                {expandedSection === section.id ? (
                  <ChevronDown
                    className={
                      section.color === "blue"
                        ? "w-3 h-3 text-blue-400"
                        : section.color === "green"
                          ? "w-3 h-3 text-green-400"
                          : section.color === "purple"
                            ? "w-3 h-3 text-purple-400"
                            : "w-3 h-3 text-pink-400"
                    }
                  />
                ) : (
                  <ChevronRight className="w-3 h-3 text-gray-500" />
                )}
              </button>

              {expandedSection === section.id && (
                <div className="grid grid-cols-2 gap-1 p-1">
                  {section.items.map((item, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center py-0.5 px-2 rounded bg-gray-800/20 text-[10px]"
                    >
                      <span className="text-gray-500">{item.label}</span>
                      <span className="text-gray-300 font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DialogAnalysis;
