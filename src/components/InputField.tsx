import React, { useState, useCallback } from "react";
import { Info } from "lucide-react";
import { useTheme } from "../theme/ThemeProvider";

interface InputFieldProps {
  label: string;
  field: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  height?: string;
  description?: string;
  type?: string;
  min?: number;
  max?: number;
  step?: number;
}

const InputField: React.FC<InputFieldProps> = ({
  label,
  field,
  value,
  onChange,
  multiline = false,
  height = "120px",
  description,
  type = "text",
  min,
  max,
  step,
}) => {
  const { theme } = useTheme();
  const [showTooltip, setShowTooltip] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const id = `field-${field}`;

  const handleFocus = useCallback(() => {
    setIsFocused(true);

    const reactFlowPane = document.querySelector(".react-flow__pane");
    if (reactFlowPane) {
      (reactFlowPane as HTMLElement).style.pointerEvents = "none";
    }

    const reactFlowNodes = document.querySelectorAll(".react-flow__node");
    reactFlowNodes.forEach((node) => {
      (node as HTMLElement).style.pointerEvents = "none";
    });

    const reactFlowEdges = document.querySelectorAll(".react-flow__edge");
    reactFlowEdges.forEach((edge) => {
      (edge as HTMLElement).style.pointerEvents = "none";
    });
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);

    const reactFlowPane = document.querySelector(".react-flow__pane");
    if (reactFlowPane) {
      (reactFlowPane as HTMLElement).style.pointerEvents = "auto";
    }

    const reactFlowNodes = document.querySelectorAll(".react-flow__node");
    reactFlowNodes.forEach((node) => {
      (node as HTMLElement).style.pointerEvents = "auto";
    });

    const reactFlowEdges = document.querySelectorAll(".react-flow__edge");
    reactFlowEdges.forEach((edge) => {
      (edge as HTMLElement).style.pointerEvents = "auto";
    });
  }, []);

  return (
    <div className="mb-4">
      <div className="flex items-center mb-2">
        <label
          htmlFor={id}
          className="text-sm font-medium"
          style={{ color: theme.colors.text.primary }}
        >
          {label}
        </label>
        {description && (
          <div
            className="ml-1 relative cursor-help"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <Info size={14} style={{ color: theme.colors.text.muted }} />
            {showTooltip && (
              <div
                className="absolute left-6 top-0 z-10 p-2 rounded text-xs w-64"
                style={{
                  background: theme.colors.surface,
                  color: theme.colors.text.primary,
                  border: `1px solid ${theme.colors.border}`,
                }}
              >
                {description}
              </div>
            )}
          </div>
        )}
      </div>
      {multiline ? (
        <textarea
          id={id}
          name={field}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className={`w-full rounded p-2 text-sm resize-none ${isFocused ? "focused-input" : ""}`}
          style={{
            height,
            background: theme.colors.surface,
            border: isFocused
              ? `2px solid ${theme.colors.accent.npc}`
              : `1px solid ${theme.colors.border}`,
            color: theme.colors.text.primary,
            zIndex: isFocused ? 10000 : "auto",
          }}
          placeholder={`Enter ${label.toLowerCase()} prompt...`}
        />
      ) : (
        <input
          id={id}
          name={field}
          type={type}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          min={min}
          max={max}
          step={step}
          className={`w-full rounded p-2 text-sm ${isFocused ? "focused-input" : ""}`}
          style={{
            background: theme.colors.surface,
            border: isFocused
              ? `2px solid ${theme.colors.accent.npc}`
              : `1px solid ${theme.colors.border}`,
            color: theme.colors.text.primary,
            zIndex: isFocused ? 10000 : "auto",
          }}
          placeholder={`Enter ${label.toLowerCase()}...`}
        />
      )}
    </div>
  );
};

export default InputField;
