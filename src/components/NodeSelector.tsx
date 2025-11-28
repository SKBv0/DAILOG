import React, { memo, useEffect, useRef, useState } from "react";

interface DialogNode {
  id: string;
  type: "npc" | "player" | "enemy" | "custom";
  text: string;
  position: { x: number; y: number };
}

interface NodeSelectorProps {
  position: { x: number; y: number };
  nodes: DialogNode[];
  onSelect: (nodeId: string) => void;
  onCancel: () => void;
}

export const NodeSelector: React.FC<NodeSelectorProps> = memo(
  ({ position, nodes = [], onSelect, onCancel }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [adjustedPosition, setAdjustedPosition] = useState(position);

    useEffect(() => {
      const overlay = document.createElement("div");
      overlay.style.position = "fixed";
      overlay.style.top = "0";
      overlay.style.left = "0";
      overlay.style.width = "100vw";
      overlay.style.height = "100vh";
      overlay.style.zIndex = "99990";
      overlay.style.backgroundColor = "transparent";
      overlay.style.cursor = "default";
      overlay.className = "node-selector-overlay";

      overlay.addEventListener("click", (e) => {
        if (!containerRef.current?.contains(e.target as HTMLElement)) {
          onCancel();

          if (document.body.contains(overlay)) {
            document.body.removeChild(overlay);
          }
        }
      });

      document.body.appendChild(overlay);

      return () => {
        if (document.body.contains(overlay)) {
          document.body.removeChild(overlay);
        }
      };
    }, [onCancel]);

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onCancel();
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }, [onCancel]);

    useEffect(() => {
      if (!containerRef.current) return;

      const checkPosition = () => {
        const width = containerRef.current!.clientWidth;
        const height = containerRef.current!.clientHeight;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        let newX = position.x;
        let newY = position.y;

        if (position.x + width > windowWidth - 20) {
          newX = windowWidth - width - 20;
        }

        if (position.y + height > windowHeight - 20) {
          newY = windowHeight - height - 20;
        }

        if (newX !== position.x || newY !== position.y) {
          setAdjustedPosition({ x: newX, y: newY });
        }
      };

      const timer = setTimeout(checkPosition, 50);

      return () => clearTimeout(timer);
    }, [position]);

    const getNodeColor = (node: any) => {
      if (node.data?.metadata?.color) {
        return node.data.metadata.color;
      }

      switch (node.type) {
        case "npc":
        case "npcDialog":
          return "#3B82F6";
        case "player":
        case "playerResponse":
          return "#10B981";
        case "enemy":
        case "enemyDialog":
          return "#EF4444";
        case "custom":
        case "customNode":
          return "#60A5FA";
        default:
          return "#6B7280";
      }
    };

    const formatText = (text: string = "") => {
      return text === text.toUpperCase() ? text.charAt(0) + text.slice(1).toLowerCase() : text;
    };

    const handleNodeSelect = (nodeId: string, e: React.MouseEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();

        if (e.nativeEvent && "stopImmediatePropagation" in e.nativeEvent) {
          (e.nativeEvent as any).stopImmediatePropagation();
        }
      }

      onSelect(nodeId);
    };

    const handleCancel = (e: React.MouseEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();

        if (e.nativeEvent && "stopImmediatePropagation" in e.nativeEvent) {
          (e.nativeEvent as any).stopImmediatePropagation();
        }
      }

      onCancel();
    };

    return (
      <div
        ref={containerRef}
        className="fixed bg-[#0D0D0F] border border-[#1A1A1D] rounded shadow-lg animate-fadeIn dialog-node-selector"
        style={{
          position: "fixed",
          left: adjustedPosition.x,
          top: adjustedPosition.y,
          minWidth: "220px",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
          backdropFilter: "blur(4px)",
          zIndex: 99999,
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.nativeEvent && "stopImmediatePropagation" in e.nativeEvent) {
            (e.nativeEvent as any).stopImmediatePropagation();
          }
        }}
      >
        <div className="p-3 border-b border-[#1A1A1D] bg-[#111113]">
          <h3 className="text-sm font-medium text-gray-200">Compatible Nodes</h3>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {nodes && nodes.length > 0 ? (
            <div className="py-2">
              {nodes.map((node) => (
                <div
                  key={node.id}
                  className="px-3 py-2.5 hover:bg-[#1A1A1F] cursor-pointer text-sm text-gray-200 flex items-center gap-3 transition-colors"
                  onClick={(e) => handleNodeSelect(node.id, e)}
                >
                  <div
                    className="w-3.5 h-3.5 rounded-full flex-shrink-0 transition-transform hover:scale-110 shadow-sm"
                    style={{ backgroundColor: getNodeColor(node) }}
                  />
                  <div className="flex flex-col overflow-hidden flex-1">
                    <span className="truncate font-normal">{formatText(node.text)}</span>
                    <span className="text-xs text-gray-500 mt-0.5">
                      {(node.type as any) === "npc" || (node.type as any) === "npcDialog"
                        ? "NPC Dialog"
                        : (node.type as any) === "player" || (node.type as any) === "playerResponse"
                          ? "Player Response"
                          : (node.type as any) === "enemy" || (node.type as any) === "enemyDialog"
                            ? "Enemy Dialog"
                            : (node.type as any) === "custom" || (node.type as any) === "customNode"
                              ? "Custom Node"
                              : node.type}{" "}
                      • ID: {node.id.substring(0, 8)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-6 text-center text-gray-500">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="mb-2"
              >
                <path
                  d="M12 8V12L15 15M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
                  stroke="#6B7280"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="text-sm">No compatible nodes found</div>
              <div className="text-xs mt-1">Try connecting to a different type of node</div>
            </div>
          )}
        </div>
        <div className="p-3 border-t border-[#1A1A1D] flex justify-end bg-[#111113]">
          <button
            className="text-sm text-gray-300 hover:text-gray-100 px-4 py-2 hover:bg-[#1D1D21] rounded transition-colors"
            onClick={handleCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }
);
