import React, { useMemo } from "react";
import { X } from "lucide-react";
import { getToolbarTheme } from "../theme/components/ToolbarTheme";
import { useTheme } from "../theme/ThemeProvider";

type Variant = "toolbar" | "flow";

interface OllamaWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  toolbarThemeOverride?: ReturnType<typeof getToolbarTheme>;
  variant?: Variant;
}

const toolbarContent = (
  toolbarTheme: ReturnType<typeof getToolbarTheme>,
  onClose: () => void
) => (
  <div
    className="rounded-md shadow-lg p-4 w-96 max-w-[calc(100vw-2rem)]"
    style={{
      background: toolbarTheme.modal.background,
      borderColor: toolbarTheme.modal.border,
    }}
  >
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-medium" style={{ color: toolbarTheme.modal.header.text }}>
        Ollama Service Warning
      </h3>
      <button
        onClick={onClose}
        className="p-1 rounded-full transition-colors"
        style={{ color: toolbarTheme.modal.content.text }}
      >
        <X className="w-4 h-4" />
      </button>
    </div>

    <div className="space-y-4" style={{ color: toolbarTheme.modal.content.text }}>
      <p className="text-xs">
        Ollama is required for AI features, but it appears to be offline or unreachable.
      </p>
      <p className="text-xs">Follow these steps to install and configure it:</p>
      <ol className="text-xs list-decimal pl-5 space-y-1">
        <li>
          Download and install Ollama from{" "}
          <a
            href="https://ollama.ai/download"
            className="underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            https://ollama.ai/download
          </a>
        </li>
        <li>
          Pull the Llama3 model:{" "}
          <code className="px-1 py-0.5 rounded bg-black/20">ollama pull llama3:8b</code>
        </li>
        <li>
          Verify the service is running:{" "}
          <code className="px-1 py-0.5 rounded bg-black/20">ollama list</code>
        </li>
      </ol>

      <div className="flex justify-end mt-4">
        <button
          onClick={onClose}
          className="px-3 py-1.5 rounded text-xs transition-colors"
          style={{
            background: toolbarTheme.button.default.background,
            color: toolbarTheme.button.default.text,
          }}
        >
          Close
        </button>
      </div>
    </div>
  </div>
);

const flowContent = (onClose: () => void) => (
  <div className="w-full max-w-md bg-[#0F1021] p-5 rounded-lg border border-red-500/20 shadow-xl shadow-red-500/5">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div>
        <h3 className="text-lg font-medium text-white">Connection Failed</h3>
        <p className="text-sm text-[#A5ADFF]/70">Unable to connect to Ollama API</p>
      </div>
    </div>
    <p className="text-sm text-[#A5ADFF]/70 mb-5">
      The dialog flow will be created without AI-generated content. You can manually add content to the nodes later.
    </p>
    <div className="flex justify-end">
      <button
        onClick={onClose}
        className="px-5 py-2.5 text-sm bg-[#2D3154] hover:bg-[#383D66] text-[#A5ADFF] hover:text-white rounded-lg border border-[#2D3154]/60 transition-colors shadow-md shadow-[#1E2143]/30"
      >
        I Understand
      </button>
    </div>
  </div>
);

export const OllamaWarningModal: React.FC<OllamaWarningModalProps> = ({
  isOpen,
  onClose,
  variant = "toolbar",
  toolbarThemeOverride,
}) => {
  const { theme } = useTheme();
  const resolvedToolbarTheme = useMemo(
    () => toolbarThemeOverride || getToolbarTheme(theme),
    [toolbarThemeOverride, theme]
  );

  if (!isOpen) return null;

  const containerClass =
    variant === "flow" ? "bg-[#08080A]/95 backdrop-blur-lg" : "";

  const containerStyle =
    variant === "toolbar"
      ? { background: resolvedToolbarTheme.modal.overlay }
      : undefined;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center ${containerClass}`}
      style={containerStyle}
    >
      {variant === "toolbar" ? toolbarContent(resolvedToolbarTheme, onClose) : flowContent(onClose)}
    </div>
  );
};

export default OllamaWarningModal;

