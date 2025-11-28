import React, { useState } from "react";
import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle, Info } from "lucide-react";
import type {
  NodeValidationResult as ValidationResult,
  NodeValidationScores as ValidationScores,
  NodeValidationIssue as ValidationIssue,
} from "../../services/ollamaService";

interface ValidationScoreSectionProps {
  validationResult?: ValidationResult;
  className?: string;
}

const QualityColors = {
  excellent: '#10B981', // Green 0.7+
  good: '#F59E0B', // Yellow 0.5-0.7
  needs: '#EF4444', // Orange 0.3-0.5
  poor: '#DC2626', // Red 0.0-0.3
};

const getScoreColor = (score: number): string => {
  if (score >= 0.7) return QualityColors.excellent;
  if (score >= 0.5) return QualityColors.good;
  if (score >= 0.3) return QualityColors.needs;
  return QualityColors.poor;
};

const getScoreLabel = (score: number): string => {
  if (score >= 0.7) return 'Excellent';
  if (score >= 0.5) return 'Good';
  if (score >= 0.3) return 'Needs Improvement';
  return 'Poor';
};

const getSeverityIcon = (severity: string) => {
  switch (severity) {
    case 'high':
      return <AlertTriangle className="w-3 h-3 text-red-500" />;
    case 'medium':
      return <Info className="w-3 h-3 text-yellow-500" />;
    case 'low':
      return <Info className="w-3 h-3 text-blue-500" />;
    default:
      return <Info className="w-3 h-3 text-gray-500" />;
  }
};

const ValidationScoreHeader: React.FC<{
  score?: number;
  isValidating: boolean;
  expanded: boolean;
  onToggle: () => void;
}> = ({ score, isValidating, expanded, onToggle }) => {
  const hasScore = typeof score === 'number';
  const numericScore = hasScore ? (score as number) : undefined;

  const scoreColor = hasScore && numericScore !== undefined ? getScoreColor(numericScore) : '#6B7280';
  const scoreLabel = hasScore && numericScore !== undefined ? getScoreLabel(numericScore) : 'Unknown';

  return (
    <div
      className="flex items-center justify-between px-2 py-1.5 bg-gray-800/50 rounded cursor-pointer hover:bg-gray-800 transition-colors"
      onClick={onToggle}
    >
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: scoreColor }} />
        <span className="text-xs text-gray-300">
          {isValidating
            ? 'Validating...'
            : hasScore && numericScore !== undefined
              ? `${numericScore.toFixed(1)}`
              : 'N/A'}
        </span>
        {!isValidating && (
          <span className="text-[10px] text-gray-500">{scoreLabel}</span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {isValidating && (
          <div className="animate-spin w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full" />
        )}
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-gray-500" />
        ) : (
          <ChevronRight className="w-3 h-3 text-gray-500" />
        )}
      </div>
    </div>
  );
};

const ScoreBreakdown: React.FC<{
  scores: ValidationScores;
}> = ({ scores }) => {
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-medium text-gray-400 mb-1.5">Breakdown</div>

      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-gray-500">Voice</span>
          <span className="text-[10px] text-gray-300">{scores.characterVoice.toFixed(1)}</span>
        </div>
        <div className="w-full bg-gray-700/50 rounded-full h-1">
          <div
            className="h-1 rounded-full transition-all duration-300"
            style={{
              width: `${scores.characterVoice * 100}%`,
              backgroundColor: getScoreColor(scores.characterVoice),
            }}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-gray-500">Context</span>
          <span className="text-[10px] text-gray-300">{scores.contextCoherence.toFixed(1)}</span>
        </div>
        <div className="w-full bg-gray-700/50 rounded-full h-1">
          <div
            className="h-1 rounded-full transition-all duration-300"
            style={{
              width: `${scores.contextCoherence * 100}%`,
              backgroundColor: getScoreColor(scores.contextCoherence),
            }}
          />
        </div>
      </div>
    </div>
  );
};

const ValidationIssuesList: React.FC<{
  issues: ValidationIssue[];
}> = ({ issues }) => {
  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-green-400 text-[10px]">
        <CheckCircle className="w-3 h-3" />
        No issues
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-medium text-gray-400">Issues ({issues.length})</div>

      {issues.map((issue, index) => (
        <div key={index} className="bg-gray-750/50 rounded p-2 space-y-1">
          <div className="flex items-center gap-1.5">
            {getSeverityIcon(issue.severity)}
            <span className="text-[10px] font-medium text-gray-300 capitalize">
              {issue.type.replace('_', ' ')}
            </span>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded ${
                issue.severity === 'high'
                  ? 'bg-red-500/20 text-red-300'
                  : issue.severity === 'medium'
                    ? 'bg-yellow-500/20 text-yellow-300'
                    : 'bg-blue-500/20 text-blue-300'
              }`}
            >
              {issue.severity}
            </span>
          </div>

          <div className="text-[10px] text-gray-400">{issue.description}</div>

          {issue.suggestion && (
            <div className="text-[10px] text-blue-300 bg-blue-500/10 rounded p-1.5">• {issue.suggestion}</div>
          )}
        </div>
      ))}
    </div>
  );
};

const ImprovementSuggestions: React.FC<{
  strengths: string[];
  suggestions?: string[];
}> = ({ strengths, suggestions = [] }) => {
  if (strengths.length === 0 && suggestions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {strengths.length > 0 && (
        <div>
          <div className="text-[10px] font-medium text-gray-400 mb-1">Strengths</div>
          {strengths.map((strength, index) => (
            <div key={index} className="flex items-center gap-1.5 text-green-400 text-[10px] mb-0.5">
              <CheckCircle className="w-2.5 h-2.5" />
              {strength}
            </div>
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <div>
          <div className="text-[10px] font-medium text-gray-400 mb-1">Suggestions</div>
          {suggestions.map((suggestion, index) => (
            <div key={index} className="text-[10px] text-blue-300 bg-blue-500/10 rounded p-1.5 mb-1">
              • {suggestion}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const ValidationScoreSection: React.FC<ValidationScoreSectionProps> = React.memo(
  ({ validationResult, className = '' }) => {
    const [expanded, setExpanded] = useState(false);

    const isValidating = validationResult?.isValidating || false;
    const hasValidationData = Boolean(validationResult && !isValidating);

    // Don't show the section if there's no validation data and not validating
    if (!validationResult) {
      return null;
    }

    return (
      <div className={`validation-score-section ${className}`}>
        <ValidationScoreHeader
          score={hasValidationData ? validationResult.scores.combined : undefined}
          isValidating={isValidating}
          expanded={expanded}
          onToggle={() => setExpanded(!expanded)}
        />

        {expanded && hasValidationData && (
          <div className="mt-2 space-y-3 p-2.5 bg-gray-800/30 rounded text-xs">
            <ScoreBreakdown scores={validationResult.scores} />
            <ValidationIssuesList issues={validationResult.issues} />
            <ImprovementSuggestions
              strengths={validationResult.strengths}
              suggestions={validationResult.issues.map((issue) => issue.suggestion).filter(Boolean)}
            />
          </div>
        )}

        {expanded && isValidating && (
          <div className="mt-2 p-2.5 bg-gray-800/30 rounded text-center">
            <div className="animate-pulse space-y-1.5">
              <div className="h-3 bg-gray-600 rounded w-3/4 mx-auto" />
              <div className="h-3 bg-gray-600 rounded w-1/2 mx-auto" />
            </div>
            <div className="text-xs text-gray-400 mt-2">Analyzing...</div>
          </div>
        )}
      </div>
    );
  }
);

export default ValidationScoreSection;
