import React, { memo } from "react";

interface ViewportTabsProps {
  activeMode: "flow" | "tree" | "read";
  setActiveMode: (_mode: "flow" | "tree" | "read") => void;
}

const ViewportTabs: React.FC<ViewportTabsProps> = memo(({ activeMode, setActiveMode }) => {
  return (
    <div className="flex gap-1">
      <button
        onClick={() => setActiveMode("flow")}
        className={`flex items-center justify-center p-1.5 rounded text-[11px] font-medium transition-colors ${
          activeMode === "flow"
            ? "bg-blue-600/20 text-blue-400"
            : "text-gray-400 hover:text-white hover:bg-gray-800/50"
        }`}
      >
        <div className="w-2 h-2 rounded-full bg-blue-500 mr-1.5"></div>
        Flow Mode
      </button>

      <button
        onClick={() => setActiveMode("tree")}
        className={`flex items-center justify-center p-1.5 rounded text-[11px] font-medium transition-colors ${
          activeMode === "tree"
            ? "bg-emerald-600/20 text-emerald-400"
            : "text-gray-400 hover:text-white hover:bg-gray-800/50"
        }`}
      >
        <div className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5"></div>
        Tree Mode
      </button>

      <button
        onClick={() => setActiveMode("read")}
        className={`flex items-center justify-center p-1.5 rounded text-[11px] font-medium transition-colors ${
          activeMode === "read"
            ? "bg-amber-600/20 text-amber-400"
            : "text-gray-400 hover:text-white hover:bg-gray-800/50"
        }`}
      >
        <div className="w-2 h-2 rounded-full bg-amber-500 mr-1.5"></div>
        Read Mode
      </button>
    </div>
  );
});

ViewportTabs.displayName = "ViewportTabs";

export default ViewportTabs;
