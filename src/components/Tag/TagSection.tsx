import React, { useState, useEffect, useMemo } from "react";
import { Tag, TagType } from "../../types/dialog";
import { tagService } from "../../services/tagService";
import { X, Check, Plus, Search, Star, Grid3x3, List } from "lucide-react";
import { tagColors } from "./constants/tagColors";
import { ServiceTag, serviceTagToTag } from "./TagTypes";
import Tooltip from "../ui/Tooltip";
import { ProjectType } from "../../types/project";
import { ProjectTagService } from "../../services/projectTagService";
import { useTheme } from "../../theme/ThemeProvider";
import { getRightPanelTheme } from "../../theme/components/RightPanelTheme";
import { safeStorage } from "../../utils/safeStorage";

interface TagSectionProps {
  tags: Tag[];
  onUpdateTags: (_tags: Tag[]) => void;
  className?: string;
  projectType: ProjectType;
}

const TagSection: React.FC<TagSectionProps> = ({
  tags = [],
  onUpdateTags,
  className = "",
  projectType,
}) => {
  const { theme } = useTheme();
  const rightPanelTheme = useMemo(() => getRightPanelTheme(theme), [theme]);
  
  const [newTagLabel, setNewTagLabel] = useState("");
  const [newTagContent, setNewTagContent] = useState("");
  const [selectedType, setSelectedType] = useState<TagType>("all");
  const [isAdding, setIsAdding] = useState(false);
  const [availableTags, setAvailableTags] = useState<ServiceTag[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const projectTagService = useMemo(() => new ProjectTagService(projectType), [projectType]);

  const projectConfig = useMemo(() => projectTagService.getProjectConfig(), [projectTagService]);

  const tagTypes = useMemo(() => {
    const allTypes = new Set<TagType>();
    projectConfig.categories.forEach((category) => {
      category.defaultTags.forEach((tag) => {
        const tagType = projectTagService.getTagTypeFromLabel(tag);
        if (tagType) allTypes.add(tagType);
      });
    });
    return Array.from(allTypes);
  }, [projectConfig.categories, projectTagService]);

  useEffect(() => {
    const savedFavorites = safeStorage.get("tagFavorites");
    if (savedFavorites) {
      try {
        setFavorites(JSON.parse(savedFavorites));
      } catch (err) {
        console.error("Error loading favorites:", err);
      }
    }
  }, []);

  useEffect(() => {
    try {
      const serviceTags = tagService.getAllTags() as unknown as ServiceTag[];
      const filteredTags = serviceTags.filter((tag) => {
        if (tag.projectType) {
          return tag.projectType === projectType;
        }

        const category = projectConfig.categories.find((c) =>
          c.defaultTags.some((defaultTag) => {
            const tagType = projectTagService.getTagTypeFromLabel(defaultTag);
            return tagType === tag.type;
          })
        );
        return !!category;
      });

      setAvailableTags(filteredTags);
    } catch (error) {
      console.error("Error loading tags:", error);
      setAvailableTags([]);
    }
  }, [projectType, projectConfig.categories, projectTagService]);

  const handleAddTag = () => {
    if (newTagLabel.trim() && newTagContent.trim()) {
      try {
        const newServiceTag = tagService.addTag({
          label: newTagLabel.trim(),
          type: selectedType,
          content: newTagContent.trim(),
          projectType: projectType,
        } as unknown as Omit<Tag, "id">);

        const newTag = serviceTagToTag(newServiceTag as unknown as ServiceTag);
        onUpdateTags([...tags, newTag]);
        setNewTagLabel("");
        setNewTagContent("");
        setIsAdding(false);
      } catch (error) {
        console.error("Error creating tag:", error);
      }
    }
  };

  const handleRemoveTag = (tagId: string) => {
    onUpdateTags(tags.filter((tag) => tag.id !== tagId));
  };

  const handleTagSelect = (serviceTag: ServiceTag) => {
    const tag = serviceTagToTag(serviceTag);
    if (tags.some((t) => t.id === tag.id)) {
      onUpdateTags(tags.filter((t) => t.id !== tag.id));
    } else {
      const tagWithMetadata = {
        ...tag,
        metadata: {
          ...tag.metadata,
          importance: 3,
        },
      };
      onUpdateTags([...tags, tagWithMetadata]);
    }
  };

  const toggleFavorite = (tagId: string) => {
    setFavorites((prev) => {
      const newFavorites = prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId];
      safeStorage.set("tagFavorites", JSON.stringify(newFavorites));
      return newFavorites;
    });
  };

  const filteredTags = availableTags
    .filter((tag) => selectedType === "all" || tag.type === selectedType)
    .filter(
      (tag) =>
        searchQuery === "" ||
        tag.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tag.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const tagCountsByType = useMemo(() => {
    const counts: Record<string, number> = {};
    tagTypes.forEach((type) => {
      counts[type] = availableTags.filter((tag) => tag.type === type).length;
    });
    return counts;
  }, [availableTags, tagTypes]);

  return (
    <div
      className={`flex flex-col h-full overflow-hidden ${className}`}
      style={{ background: rightPanelTheme.background }}
    >
      <div
        className="h-11 px-2.5 flex items-center justify-between backdrop-blur-sm"
        style={{
          borderBottom: `1px solid ${rightPanelTheme.header.border}`,
          background: "rgba(13, 13, 15, 0.3)",
        }}
      >
        <div className="flex items-center gap-1.5">
          <h2
            className="text-xs font-medium"
            style={{ color: rightPanelTheme.header.text.primary }}
          >
            Tags
          </h2>
          <span
            className="text-[10px]"
            style={{ color: rightPanelTheme.header.text.muted }}
          >
            {tags.length} selected
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="flex items-center rounded-md overflow-hidden border backdrop-blur-sm"
            style={{
              borderColor: rightPanelTheme.section.border,
              background: rightPanelTheme.section.background,
            }}
          >
            <button
              onClick={() => setViewMode("grid")}
              className="p-1 transition-all duration-200"
              style={{
                background:
                  viewMode === "grid"
                    ? rightPanelTheme.button.hover.background
                    : "transparent",
                color:
                  viewMode === "grid"
                    ? rightPanelTheme.tabs.active.text
                    : rightPanelTheme.button.default.text,
              }}
              onMouseEnter={(e) => {
                if (viewMode !== "grid") {
                  e.currentTarget.style.background = rightPanelTheme.button.hover.background;
                }
              }}
              onMouseLeave={(e) => {
                if (viewMode !== "grid") {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              <Grid3x3 className="w-3 h-3" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className="p-1 transition-all duration-200"
              style={{
                background:
                  viewMode === "list"
                    ? rightPanelTheme.button.hover.background
                    : "transparent",
                color:
                  viewMode === "list"
                    ? rightPanelTheme.tabs.active.text
                    : rightPanelTheme.button.default.text,
              }}
              onMouseEnter={(e) => {
                if (viewMode !== "list") {
                  e.currentTarget.style.background = rightPanelTheme.button.hover.background;
                }
              }}
              onMouseLeave={(e) => {
                if (viewMode !== "list") {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              <List className="w-3 h-3" />
            </button>
          </div>
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-md transition-all duration-200 backdrop-blur-sm border text-[10px] font-medium"
            style={{
              background: rightPanelTheme.button.default.background,
              color: rightPanelTheme.button.default.text,
              borderColor: rightPanelTheme.button.default.border,
              boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = rightPanelTheme.button.hover.background;
              e.currentTarget.style.borderColor = rightPanelTheme.button.hover.border;
              e.currentTarget.style.transform = "scale(1.02)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = rightPanelTheme.button.default.background;
              e.currentTarget.style.borderColor = rightPanelTheme.button.default.border;
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            <Plus className="w-3 h-3" />
            <span>New Tag</span>
          </button>
        </div>
      </div>

      <div className="p-2.5 space-y-2" style={{ borderBottom: `1px solid ${rightPanelTheme.header.border}` }}>
        <div className="relative">
          <Search
            className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3"
            style={{ color: rightPanelTheme.content.text.muted }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tags..."
            className="w-full h-7 pl-7 pr-2 rounded-md text-xs transition-all focus:outline-none backdrop-blur-sm"
            style={{
              background: rightPanelTheme.section.background,
              color: rightPanelTheme.content.text.primary,
              border: `1px solid ${rightPanelTheme.section.border}`,
              boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
            }}
            onFocus={(e) => {
              e.target.style.background = rightPanelTheme.button.hover.background;
              e.target.style.borderColor = rightPanelTheme.tabs.active.border;
              e.target.style.boxShadow = `0 0 0 2px ${rightPanelTheme.tabs.active.border}40`;
            }}
            onBlur={(e) => {
              e.target.style.background = rightPanelTheme.section.background;
              e.target.style.borderColor = rightPanelTheme.section.border;
              e.target.style.boxShadow = "0 1px 4px -2px rgba(0, 0, 0, 0.15)";
            }}
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setSelectedType("all" as TagType)}
            className="shrink-0 px-2 py-1 rounded-md text-[10px] transition-all duration-200 backdrop-blur-sm border"
            style={{
              background:
                selectedType === "all"
                  ? rightPanelTheme.tabs.active.border + "20"
                  : rightPanelTheme.section.background,
              color:
                selectedType === "all"
                  ? rightPanelTheme.tabs.active.text
                  : rightPanelTheme.content.text.secondary,
              borderColor:
                selectedType === "all"
                  ? rightPanelTheme.tabs.active.border
                  : rightPanelTheme.section.border,
              boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
            }}
            onMouseEnter={(e) => {
              if (selectedType !== "all") {
                e.currentTarget.style.background = rightPanelTheme.button.hover.background;
              }
            }}
            onMouseLeave={(e) => {
              if (selectedType !== "all") {
                e.currentTarget.style.background = rightPanelTheme.section.background;
              }
            }}
          >
            <div className="flex items-center gap-1">
              <span>All Tags</span>
              <span
                className="px-1 py-0.5 rounded text-[9px]"
                style={{
                  background:
                    selectedType === "all"
                      ? rightPanelTheme.tabs.active.border + "30"
                      : rightPanelTheme.section.background,
                  color:
                  selectedType === "all"
                      ? rightPanelTheme.tabs.active.text
                      : rightPanelTheme.content.text.muted,
                }}
              >
                {availableTags.length}
              </span>
            </div>
          </button>
          {tagTypes.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className="shrink-0 px-2 py-1 rounded-md text-[10px] transition-all duration-200 backdrop-blur-sm border"
              style={{
                background:
                  selectedType === type
                    ? rightPanelTheme.tabs.active.border + "20"
                    : rightPanelTheme.section.background,
                color:
                  selectedType === type
                    ? rightPanelTheme.tabs.active.text
                    : rightPanelTheme.content.text.secondary,
                borderColor:
                  selectedType === type
                    ? rightPanelTheme.tabs.active.border
                    : rightPanelTheme.section.border,
                boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
              }}
              onMouseEnter={(e) => {
                if (selectedType !== type) {
                  e.currentTarget.style.background = rightPanelTheme.button.hover.background;
                }
              }}
              onMouseLeave={(e) => {
                if (selectedType !== type) {
                  e.currentTarget.style.background = rightPanelTheme.section.background;
                }
              }}
            >
              <div className="flex items-center gap-1">
                <span>{type.charAt(0).toUpperCase() + type.slice(1)}</span>
                <span
                  className="px-1 py-0.5 rounded text-[9px]"
                  style={{
                    background:
                      selectedType === type
                        ? rightPanelTheme.tabs.active.border + "30"
                        : rightPanelTheme.section.background,
                    color:
                    selectedType === type
                        ? rightPanelTheme.tabs.active.text
                        : rightPanelTheme.content.text.muted,
                  }}
                >
                  {tagCountsByType[type] || 0}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {tags.length > 0 && (
        <div
          className="px-2.5 py-2 border-b backdrop-blur-sm"
          style={{
            borderColor: rightPanelTheme.header.border,
            background: rightPanelTheme.section.background + "40",
          }}
        >
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => {
              return (
                <div
                  key={tag.id}
                  className="group flex items-center h-6 pl-2 pr-1 rounded-md transition-all duration-200 backdrop-blur-sm border"
                  style={{
                    background: rightPanelTheme.selectionPanel.card.background,
                    borderColor: rightPanelTheme.selectionPanel.card.border,
                    boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = rightPanelTheme.button.hover.background;
                    e.currentTarget.style.borderColor = rightPanelTheme.button.hover.border;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = rightPanelTheme.selectionPanel.card.background;
                    e.currentTarget.style.borderColor = rightPanelTheme.selectionPanel.card.border;
                  }}
                >
                  <span
                    className="text-[10px]"
                    style={{ color: rightPanelTheme.content.text.primary }}
                  >
                    {tag.label}
                  </span>
                  <div className="flex items-center ml-1">
                    <Tooltip
                      content={`Importance: ${tag.metadata?.importance || 3} (Click to change)`}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();

                          const currentImportance = tag.metadata?.importance || 3;
                          const newImportance = currentImportance >= 5 ? 1 : currentImportance + 1;

                          const updatedTag = {
                            ...tag,
                            metadata: {
                              ...tag.metadata,
                              importance: newImportance,
                            },
                          };

                          onUpdateTags(tags.map((t) => (t.id === tag.id ? updatedTag : t)));
                        }}
                        className="flex items-center justify-center w-4 h-4 text-[9px] font-medium rounded mr-0.5 transition-colors"
                        style={{
                          background:
                            (tag.metadata?.importance || 3) >= 4
                              ? rightPanelTheme.tabs.active.border + "30"
                              : rightPanelTheme.section.background,
                          color:
                            (tag.metadata?.importance || 3) >= 4
                              ? rightPanelTheme.tabs.active.text
                              : rightPanelTheme.content.text.muted,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = "0.8";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = "1";
                        }}
                      >
                        {tag.metadata?.importance || 3}
                      </button>
                    </Tooltip>
                    <button
                      onClick={() => handleRemoveTag(tag.id)}
                      className="w-4 h-4 rounded flex items-center justify-center transition-colors"
                      style={{ color: rightPanelTheme.content.text.muted }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = rightPanelTheme.button.danger.background;
                        e.currentTarget.style.color = rightPanelTheme.button.danger.text;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = rightPanelTheme.content.text.muted;
                      }}
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2.5">
        <div
          className={`
          grid gap-1.5
          ${viewMode === "grid" ? "grid-cols-2 auto-rows-[100px]" : "grid-cols-1 auto-rows-auto"}
        `}
        >
          {filteredTags.map((serviceTag) => {
            const tag = serviceTagToTag(serviceTag);
            const isSelected = tags.some((t) => t.id === tag.id);
            const isFavorite = favorites.includes(tag.id);

            return (
              <div
                key={tag.id}
                onClick={() => handleTagSelect(serviceTag)}
                className={`
                  group relative backdrop-blur-sm cursor-pointer transition-all duration-200
                  ${viewMode === "list" ? "pl-4 py-2 pr-2" : "p-2"}
                  rounded-md border
                  ${viewMode === "grid" ? "flex flex-col min-h-[100px]" : "flex flex-col gap-1.5"}
                `}
                style={{
                  background: isSelected
                    ? rightPanelTheme.tabs.active.border + "20"
                    : rightPanelTheme.selectionPanel.card.background,
                  borderColor: isSelected
                    ? rightPanelTheme.tabs.active.border
                    : rightPanelTheme.selectionPanel.card.border,
                  boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = rightPanelTheme.button.hover.background;
                    e.currentTarget.style.borderColor = rightPanelTheme.button.hover.border;
                    e.currentTarget.style.boxShadow = "0 2px 8px -4px rgba(0, 0, 0, 0.2)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = rightPanelTheme.selectionPanel.card.background;
                    e.currentTarget.style.borderColor = rightPanelTheme.selectionPanel.card.border;
                    e.currentTarget.style.boxShadow = "0 1px 4px -2px rgba(0, 0, 0, 0.15)";
                    e.currentTarget.style.transform = "translateY(0)";
                  }
                }}
              >
                <div className="flex flex-col items-center absolute -left-px top-0 h-full">
                  <div
                    className="h-full w-0.5 transition-all duration-200"
                    style={{
                      background: `linear-gradient(180deg, ${tagColors[serviceTag.type].from} 0%, ${tagColors[serviceTag.type].to} 100%)`,
                    }}
                  />
                </div>

                <div
                  className={`
                  relative flex-1 min-w-0
                  ${viewMode === "grid" ? "flex flex-col h-full" : "flex flex-col gap-3"}
                `}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <Tooltip content={tag.label}>
                        <span
                          className="text-xs font-medium truncate"
                          style={{ color: rightPanelTheme.content.text.primary }}
                        >
                              {tag.label}
                            </span>
                          </Tooltip>
                      <span
                        className="shrink-0 px-1 py-0.5 rounded text-[9px] font-medium backdrop-blur-sm border"
                        style={{
                          background: rightPanelTheme.section.background,
                          borderColor: rightPanelTheme.section.border,
                          color: tagColors[serviceTag.type].from,
                        }}
                      >
                        {serviceTag.type.charAt(0).toUpperCase() + serviceTag.type.slice(1)}
                      </span>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(tag.id);
                        }}
                        className="p-0.5 rounded opacity-0 group-hover:opacity-100 transition-all duration-200"
                        style={{
                          color: isFavorite
                            ? rightPanelTheme.tabs.active.text
                            : rightPanelTheme.content.text.muted,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = rightPanelTheme.button.hover.background;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <Star className={`w-3 h-3 ${isFavorite ? "fill-current" : ""}`} />
                      </button>
                      {isSelected && (
                        <div
                          className="w-4 h-4 rounded flex items-center justify-center"
                          style={{
                            background: rightPanelTheme.tabs.active.border + "30",
                            color: rightPanelTheme.tabs.active.text,
                          }}
                        >
                          <Check className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </div>
                  </div>

                  {viewMode === "grid" ? (
                    <div className="relative flex-1 overflow-hidden mt-1">
                      <p
                        className="text-[10px] leading-relaxed line-clamp-3"
                        style={{ color: rightPanelTheme.content.text.secondary }}
                      >
                        {tag.content}
                      </p>
                    </div>
                  ) : (
                    <p
                      className="text-[10px] leading-relaxed"
                      style={{ color: rightPanelTheme.content.text.secondary }}
                    >
                      {tag.content}
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {filteredTags.length === 0 && (
            <div className="col-span-2 flex flex-col items-center justify-center py-8">
              <div
                className="w-8 h-8 rounded-md backdrop-blur-sm border flex items-center justify-center mb-2"
                style={{
                  background: rightPanelTheme.section.background,
                  borderColor: rightPanelTheme.section.border,
                }}
              >
                <Search
                  className="w-4 h-4"
                  style={{ color: rightPanelTheme.content.text.muted, opacity: 0.3 }}
                />
              </div>
              <p
                className="text-xs text-center max-w-[200px]"
                style={{ color: rightPanelTheme.content.text.muted }}
              >
                {searchQuery
                  ? `No results found for "${searchQuery}"`
                  : "No tags available for this type"}
              </p>
            </div>
          )}
        </div>
      </div>

      {isAdding && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
          style={{ background: rightPanelTheme.selectionPanel.modal.overlay }}
        >
          <div
            className="relative rounded-lg border shadow-2xl w-[360px] max-h-[85vh] overflow-hidden backdrop-blur-md"
            style={{
              background: rightPanelTheme.selectionPanel.modal.background,
              borderColor: rightPanelTheme.selectionPanel.modal.border,
              backdropFilter: rightPanelTheme.selectionPanel.modal.backdropFilter,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="h-11 px-3 border-b flex items-center justify-between backdrop-blur-sm"
              style={{
                borderColor: rightPanelTheme.header.border,
                background: "rgba(13, 13, 15, 0.3)",
              }}
            >
              <h2
                className="text-xs font-medium"
                style={{ color: rightPanelTheme.header.text.primary }}
              >
                New Tag
              </h2>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setNewTagLabel("");
                  setNewTagContent("");
                }}
                className="w-6 h-6 rounded-md flex items-center justify-center transition-colors"
                style={{ color: rightPanelTheme.content.text.muted }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = rightPanelTheme.button.hover.background;
                  e.currentTarget.style.color = rightPanelTheme.content.text.primary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = rightPanelTheme.content.text.muted;
                }}
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            <div className="p-3 space-y-2.5">
              <div>
                <label
                  className="block text-[10px] font-medium mb-1"
                  style={{ color: rightPanelTheme.content.text.secondary }}
                >
                  Type
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value as TagType)}
                  className="w-full h-7 px-2 rounded-md text-xs transition-all focus:outline-none backdrop-blur-sm"
                  style={{
                    background: rightPanelTheme.section.background,
                    color: rightPanelTheme.content.text.primary,
                    border: `1px solid ${rightPanelTheme.section.border}`,
                    boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = rightPanelTheme.tabs.active.border;
                    e.target.style.boxShadow = `0 0 0 2px ${rightPanelTheme.tabs.active.border}40`;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = rightPanelTheme.section.border;
                    e.target.style.boxShadow = "0 1px 4px -2px rgba(0, 0, 0, 0.15)";
                  }}
                >
                  {tagTypes.map((type) => (
                    <option key={type} value={type} style={{ background: rightPanelTheme.selectionPanel.modal.background }}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  className="block text-[10px] font-medium mb-1"
                  style={{ color: rightPanelTheme.content.text.secondary }}
                >
                  Label
                </label>
                <input
                  type="text"
                  value={newTagLabel}
                  onChange={(e) => setNewTagLabel(e.target.value)}
                  className="w-full h-7 px-2 rounded-md text-xs transition-all focus:outline-none backdrop-blur-sm"
                  style={{
                    background: rightPanelTheme.section.background,
                    color: rightPanelTheme.content.text.primary,
                    border: `1px solid ${rightPanelTheme.section.border}`,
                    boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = rightPanelTheme.tabs.active.border;
                    e.target.style.boxShadow = `0 0 0 2px ${rightPanelTheme.tabs.active.border}40`;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = rightPanelTheme.section.border;
                    e.target.style.boxShadow = "0 1px 4px -2px rgba(0, 0, 0, 0.15)";
                  }}
                  placeholder="Enter tag label..."
                />
              </div>

              <div>
                <label
                  className="block text-[10px] font-medium mb-1"
                  style={{ color: rightPanelTheme.content.text.secondary }}
                >
                  Content
                </label>
                <textarea
                  value={newTagContent}
                  onChange={(e) => setNewTagContent(e.target.value)}
                  className="w-full h-16 px-2 py-1.5 rounded-md text-xs transition-all focus:outline-none resize-none backdrop-blur-sm"
                  style={{
                    background: rightPanelTheme.section.background,
                    color: rightPanelTheme.content.text.primary,
                    border: `1px solid ${rightPanelTheme.section.border}`,
                    boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = rightPanelTheme.tabs.active.border;
                    e.target.style.boxShadow = `0 0 0 2px ${rightPanelTheme.tabs.active.border}40`;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = rightPanelTheme.section.border;
                    e.target.style.boxShadow = "0 1px 4px -2px rgba(0, 0, 0, 0.15)";
                  }}
                  placeholder="Enter tag content..."
                />
              </div>

              <div className="flex justify-end gap-1.5 mt-3">
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setNewTagLabel("");
                    setNewTagContent("");
                  }}
                  className="h-7 px-2.5 rounded-md text-xs transition-all duration-200 backdrop-blur-sm border"
                  style={{
                    background: rightPanelTheme.section.background,
                    color: rightPanelTheme.content.text.secondary,
                    borderColor: rightPanelTheme.section.border,
                    boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = rightPanelTheme.button.hover.background;
                    e.currentTarget.style.color = rightPanelTheme.content.text.primary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = rightPanelTheme.section.background;
                    e.currentTarget.style.color = rightPanelTheme.content.text.secondary;
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddTag}
                  disabled={!newTagLabel.trim() || !newTagContent.trim()}
                  className="h-7 px-2.5 rounded-md text-xs font-medium transition-all duration-200 backdrop-blur-sm"
                  style={{
                    background: rightPanelTheme.tabs.active.border,
                    color: rightPanelTheme.tabs.active.text,
                    opacity: !newTagLabel.trim() || !newTagContent.trim() ? 0.5 : 1,
                    cursor: !newTagLabel.trim() || !newTagContent.trim() ? "not-allowed" : "pointer",
                    boxShadow: "0 1px 4px -2px rgba(0, 0, 0, 0.15)",
                  }}
                  onMouseEnter={(e) => {
                    if (newTagLabel.trim() && newTagContent.trim()) {
                      e.currentTarget.style.opacity = "0.9";
                      e.currentTarget.style.transform = "scale(1.02)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (newTagLabel.trim() && newTagContent.trim()) {
                      e.currentTarget.style.opacity = "1";
                      e.currentTarget.style.transform = "scale(1)";
                    }
                  }}
                >
                  Create Tag
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TagSection;
