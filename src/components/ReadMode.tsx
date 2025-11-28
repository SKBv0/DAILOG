import React, { useEffect, useState, useMemo, useCallback } from "react";
import { DialogNode, Connection } from "../types/dialog";
import { Search, ChevronLeft, ChevronRight, Book } from "lucide-react";
import { collectDialogLines, DialogLine, findRootNodes } from "../utils/dialogTraversal";

interface ReadModeProps {
  nodes: DialogNode[];
  connections: Connection[];
  onSelectNode?: (id: string) => void;
  onScrollToNode?: (id: string) => void;
}

type TextSize = "sm" | "md" | "lg";

type Line = DialogLine;

export const ReadMode: React.FC<ReadModeProps> = React.memo(
  ({ nodes, connections, onSelectNode, onScrollToNode }) => {
    const startingNodes = useMemo(() => {
      const roots = findRootNodes(nodes, connections) as DialogNode[];
      if (roots.length > 0) {
        return roots;
      }
      return nodes.filter((n) => n.type !== "subgraphNode");
    }, [nodes, connections]);

    const [currentStartId, setCurrentStartId] = useState<string | null>(
      startingNodes[0]?.id || null
    );
    const [currentIndex, setCurrentIndex] = useState(0);
    const [textSize, setTextSize] = useState<TextSize>("md");
    const [query, setQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
      if (!currentStartId && startingNodes.length > 0) {
        setCurrentStartId(startingNodes[0].id);
      } else if (
        currentStartId &&
        startingNodes.length > 0 &&
        !startingNodes.some((n) => n.id === currentStartId)
      ) {
        setCurrentStartId(startingNodes[0].id);
      }
    }, [startingNodes, currentStartId]);

    const lines = useMemo<Line[]>(() => {
      if (!currentStartId) return [];
      return collectDialogLines({
        nodes,
        connections,
        startId: currentStartId,
        startingNodes,
        maxDepth: 200,
      });
    }, [nodes, connections, currentStartId, startingNodes]);

    const linesPerPage = useMemo(() => {
      if (textSize === "sm") return 50;
      if (textSize === "lg") return 30;
      return 40;
    }, [textSize]);

    const totalPages = Math.max(1, Math.ceil(lines.length / linesPerPage));
    const currentPageLines = useMemo(() => {
      const start = (currentPage - 1) * linesPerPage;
      const end = start + linesPerPage;
      return lines.slice(start, end);
    }, [lines, currentPage, linesPerPage]);

    useEffect(() => {
      setCurrentIndex(0);
      setCurrentPage(1);
    }, [currentStartId]);

    useEffect(() => {
      if (lines.length === 0) return;
      const newPage = Math.floor(currentIndex / linesPerPage) + 1;
      const clampedPage = Math.max(1, Math.min(newPage, totalPages));
      setCurrentPage((prevPage) => (prevPage === clampedPage ? prevPage : clampedPage));
    }, [lines.length, currentIndex, linesPerPage, totalPages]);

    useEffect(() => {
      setCurrentPage((prevPage) => Math.min(prevPage, totalPages));
    }, [totalPages]);

    const handleJump = useCallback(
      (nodeId: string) => {
        if (onSelectNode) onSelectNode(nodeId);
        if (onScrollToNode) onScrollToNode(nodeId);
      },
      [onSelectNode, onScrollToNode]
    );


    const goToPage = useCallback(
      (page: number) => {
        const clamped = Math.min(Math.max(page, 1), totalPages);
        const maxIndex = Math.max(lines.length - 1, 0);
        const firstIndex = (clamped - 1) * linesPerPage;
        const targetIndex = Math.min(firstIndex, maxIndex);
        setCurrentPage(clamped);
        setCurrentIndex(targetIndex);
      },
      [lines.length, linesPerPage, totalPages]
    );

    const sizeClass =
      textSize === "sm" ? "text-sm" : textSize === "lg" ? "text-lg" : "text-base";

    const renderText = useCallback((text: string) => {
      if (!query) return text;
      const lowerText = text.toLowerCase();
      const lowerQuery = query.toLowerCase();
      const parts: (string | JSX.Element)[] = [];
      let lastIndex = 0;
      let index = lowerText.indexOf(lowerQuery, lastIndex);

      while (index !== -1) {
        if (index > lastIndex) {
          parts.push(text.substring(lastIndex, index));
        }
        parts.push(
          <mark key={index} className="bg-amber-200/50 text-amber-900 rounded px-0.5">
            {text.substring(index, index + query.length)}
          </mark>
        );
        lastIndex = index + query.length;
        index = lowerText.indexOf(lowerQuery, lastIndex);
      }

      if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
      }

      return parts.length > 0 ? <>{parts}</> : text;
    }, [query]);

    return (
      <div className="h-full w-full flex flex-col bg-[#F5F1E8] text-[#2C2416] overflow-hidden">
        <div className="flex-shrink-0 px-4 py-2 bg-[#E8DFD0] border-b border-[#D4C4A8]">
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <div className="flex items-center gap-2 min-w-0">
              <Book className="w-4 h-4 text-[#8B6F47] flex-shrink-0" />
              <span className="text-xs font-serif text-[#6B5B3D] tracking-wide">Reader</span>
              <div className="ml-2 flex items-center gap-1 overflow-x-auto no-scrollbar">
                {startingNodes.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setCurrentStartId(s.id)}
                    className={`px-2 py-0.5 rounded text-[10px] font-serif whitespace-nowrap transition-colors ${
                      currentStartId === s.id
                        ? "bg-[#8B6F47] text-[#F5F1E8]"
                        : "bg-[#D4C4A8] text-[#6B5B3D] hover:bg-[#C4B498]"
                    }`}
                    title={s.data.text || s.id}
                  >
                    {(s.data.text || s.id).substring(0, 20)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5 bg-[#D4C4A8] rounded p-0.5">
                {["sm", "md", "lg"].map((sz) => (
                  <button
                    key={sz}
                    onClick={() => setTextSize(sz as TextSize)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-serif transition-colors ${
                      textSize === sz
                        ? "bg-[#8B6F47] text-[#F5F1E8]"
                        : "text-[#6B5B3D] hover:bg-[#C4B498]"
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#8B6F47] absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ara..."
                  className="pl-7 pr-2 py-1 text-xs bg-[#F5F1E8] text-[#2C2416] placeholder-[#8B6F47] border border-[#D4C4A8] rounded focus:outline-none focus:border-[#8B6F47] font-serif w-24"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden bg-gradient-to-b from-[#F5F1E8] to-[#EDE5D6]">
          <div className="h-full flex items-center justify-center px-4 py-3">
            <div className="w-full max-w-4xl h-full">
              <div className="h-full bg-[#FEFCF8] shadow-lg rounded border border-[#D4C4A8] p-6 overflow-y-auto">
                <div className="h-full flex flex-col">
                  <div className="text-center text-xs text-[#8B6F47] font-serif mb-3">
                    Page {currentPage}
                  </div>

                  <div className={`flex-1 space-y-4 leading-relaxed font-serif ${sizeClass}`}>
                    {currentPageLines.length === 0 ? (
                      <div className="text-center text-[#8B6F47] py-16 italic">
                        No content found.
                      </div>
                    ) : (
                      currentPageLines.map((ln, i) => {
                        const globalIndex = (currentPage - 1) * linesPerPage + i;
                        const isActive = globalIndex === currentIndex;
                        return (
                          <div
                            key={ln.id}
                            className={`pl-4 border-l-2 transition-all duration-150 cursor-pointer ${
                              isActive
                                ? "border-[#8B6F47] bg-[#F5F1E8]/50"
                                : "border-transparent hover:border-[#D4C4A8] hover:bg-[#F5F1E8]/30"
                            }`}
                            onClick={() => {
                              setCurrentIndex(globalIndex);
                              handleJump(ln.nodeId);
                            }}
                          >
                            <div className="text-xs tracking-wide text-[#8B6F47] mb-2 uppercase font-semibold">
                              {ln.speaker}
                            </div>
                            <div className="text-[#2C2416] leading-7">{renderText(ln.text || "")}</div>
                            {ln.choices.length > 1 && (
                              <div className="mt-4 pt-3 border-t border-[#D4C4A8]/50">
                                <div className="text-xs text-[#8B6F47] font-semibold mb-3 italic">Choices:</div>
                                <div className="space-y-2">
                                  {ln.choices.map((c, idx) => (
                                    <div
                                      key={`${ln.id}-c-${idx}`}
                                      className="text-sm leading-6 pl-3 border-l-2 border-[#D4C4A8] text-[#6B5B3D] font-medium"
                                    >
                                      {idx + 1}. {renderText(c.label || "")}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 px-4 py-1.5 bg-[#E8DFD0] border-t border-[#D4C4A8]">
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-3 py-1 rounded bg-[#D4C4A8] text-[#6B5B3D] hover:bg-[#C4B498] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-serif text-xs"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Previous
            </button>
            <div className="text-xs text-[#6B5B3D] font-serif">
              Page <span className="font-semibold">{currentPage}</span> / {totalPages}
            </div>
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 px-3 py-1 rounded bg-[#D4C4A8] text-[#6B5B3D] hover:bg-[#C4B498] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-serif text-xs"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }
);

export default ReadMode;
