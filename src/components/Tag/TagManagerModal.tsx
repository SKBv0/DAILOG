import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { TagType } from "../../types/dialog";
import { safeStorage } from "../../utils/safeStorage";
import {
  Tag as TagIcon,
  X,
  Pencil,
  Trash2,
  Search,
  Plus,
  FileDown,
  Loader2,
  Star,
  Grid,
  MessageSquare,
  FileText,
  ChevronRight,
  Check,
  ChevronDown,
  Settings,
  Activity,
  Map,
  Circle,
  BookOpen,
} from "lucide-react";
import { ServiceTag } from "./TagTypes";
import { tagColors } from "./constants/tagColors";
import useDebounce from "../../hooks/useDebounce";
import { ProjectType, PROJECT_TYPES } from "../../types/project";
import { ProjectTagService } from "../../services/projectTagService";

interface TagManagerModalProps {
  show: boolean;
  onClose: () => void;
  projectType?: ProjectType;
}

interface ModalContentProps {
  projectType: ProjectType;
  showFavorites: boolean;
  setShowFavorites: (_show: boolean) => void;
  projectTagService: ProjectTagService;
  isRestoringDefaults: boolean;
  showDefaultTags: boolean;
  selectedTags: string[];
  setSelectedTags: (_tags: string[]) => void;
}

const ModalContent: React.FC<ModalContentProps> = ({
  projectType,
  showFavorites,
  setShowFavorites,
  projectTagService,
  isRestoringDefaults,
  showDefaultTags,
  selectedTags,
  setSelectedTags,
}) => {
  const [currentProjectType, setCurrentProjectType] = useState<ProjectType>(projectType);
  const [serviceTags, setServiceTags] = useState<ServiceTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<TagType>("npc");
  const [editingTag, setEditingTag] = useState<ServiceTag | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("character");
  const [showAllTags, setShowAllTags] = useState(true);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const searchInputRef = useRef<HTMLInputElement>(null);

  const projectConfig = useMemo(() => projectTagService.getProjectConfig(), [projectTagService]);

  const [newTag, setNewTag] = useState({
    label: "",
    type: selectedType,
    content: "",
    projectType: projectType as ProjectType,
  });

  const filteredTagTypes = useCallback(() => {
    if (showAllTags) {
      const allTypes = new Set<TagType>();
      projectConfig.categories.forEach((category) => {
        category.defaultTags.forEach((tag) => {
          const tagType = projectTagService.getTagTypeFromLabel(tag);
          if (tagType) allTypes.add(tagType);
        });
      });
      return Array.from(allTypes);
    }

    const category = projectConfig.categories.find((c) => c.id === selectedCategoryId);
    if (!category) return [];

    return category.defaultTags.map((tag) => {
      const tagType = projectTagService.getTagTypeFromLabel(tag);
      return tagType || "npc";
    });
  }, [selectedCategoryId, projectConfig.categories, projectTagService, showAllTags]);

  const currentFilteredTypes = filteredTagTypes();

  const refreshTagData = useCallback(async () => {
    setIsLoading(true);

    try {
      const { tagService } = await import("../../services/tagService");
      const allTags = tagService.getAllTags();

      const filteredTags = allTags
        .filter((tag) => {
          if (tag.projectType) {
            return tag.projectType === currentProjectType;
          }

          const category = projectConfig.categories.find((c) =>
            c.defaultTags.some((defaultTag) => {
              const tagType = projectTagService.getTagTypeFromLabel(defaultTag);
              return tagType === tag.type;
            })
          );
          return !!category;
        })
        .map((tag) => ({
          ...tag,
          projectType: tag.projectType || currentProjectType,
        })) as ServiceTag[];

      setServiceTags(filteredTags);
    } catch (err) {
      console.error("Failed to refresh tags:", err);
    } finally {
      setIsLoading(false);
    }
  }, [currentProjectType, projectConfig.categories, projectTagService]);

  useEffect(() => {
    refreshTagData();
  }, [currentProjectType, projectConfig.categories, projectTagService, refreshTagData]);

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
    safeStorage.set("tagFavorites", JSON.stringify(favorites));
  }, [favorites]);

  const handleAddTag = useCallback(async () => {
    if (!newTag.label.trim() || !newTag.content.trim()) return;

    setIsLoading(true);

    try {
      const { tagService } = await import("../../services/tagService");
      const addedTag = tagService.addTag({
        label: newTag.label.trim(),
        type: newTag.type,
        content: newTag.content.trim(),
        projectType: currentProjectType,
      });

      if (addedTag) {
        setServiceTags((prev) => [...prev, { ...addedTag, projectType: currentProjectType }]);
        setNewTag({
          label: "",
          type: selectedType,
          content: "",
          projectType: currentProjectType,
        });
        setIsAddingNew(false);
      }
    } catch (err) {
      console.error("Error adding tag:", err);
    } finally {
      setIsLoading(false);
    }
  }, [newTag, currentProjectType, selectedType]);

  const handleCategoryChange = useCallback(
    (categoryId: string) => {
      setSelectedCategoryId(categoryId);
      const category = projectConfig.categories.find((c) => c.id === categoryId);
      if (category && category.defaultTags.length > 0) {
        const firstTagType = projectTagService.getTagTypeFromLabel(category.defaultTags[0]);
        if (firstTagType) {
          setSelectedType(firstTagType);
        }
      }
    },
    [projectConfig.categories, projectTagService]
  );

  const sortedAndFilteredTags = useMemo(() => {
    if (!Array.isArray(serviceTags)) return [];

    return serviceTags
      .filter((tag) => {
        const extendedTag = tag as ServiceTag;
        const matchesProjectType = extendedTag.projectType === currentProjectType;
        if (!matchesProjectType) return false;

        const matchesSearch =
          debouncedSearchQuery.trim() === "" ||
          tag.label.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
          tag.content.toLowerCase().includes(debouncedSearchQuery.toLowerCase());

        if (showFavorites) {
          return matchesSearch && favorites.includes(tag.id);
        }

        if (!showDefaultTags) {
          const isDefaultTag = projectConfig.categories.some((category) =>
            category.defaultTags.some((defaultTag) => {
              const tagType = projectTagService.getTagTypeFromLabel(defaultTag);
              return tagType === tag.type;
            })
          );
          if (isDefaultTag) return false;
        }

        if (showAllTags) return matchesSearch;

        return matchesSearch && tag.type === selectedType;
      })
      .sort((a, b) => {
        if (showFavorites) {
          const aIndex = favorites.indexOf(a.id);
          const bIndex = favorites.indexOf(b.id);
          if (aIndex !== bIndex) return aIndex - bIndex;
        }
        return a.label.localeCompare(b.label);
      });
  }, [
    serviceTags,
    debouncedSearchQuery,
    selectedType,
    showAllTags,
    showFavorites,
    favorites,
    currentProjectType,
    showDefaultTags,
    projectConfig.categories,
    projectTagService,
  ]);

  useEffect(() => {
    setCurrentProjectType(projectType);
  }, [projectType]);

  const tagTypeStats = useMemo(() => {
    if (!Array.isArray(serviceTags)) return {} as Record<TagType, number>;

    const stats: Record<TagType, number> = {} as Record<TagType, number>;

    currentFilteredTypes.forEach((type) => {
      stats[type] = 0;
    });

    serviceTags.forEach((tag) => {
      if (currentFilteredTypes.includes(tag.type)) {
        stats[tag.type] = (stats[tag.type] || 0) + 1;
      }
    });

    return stats;
  }, [serviceTags, currentFilteredTypes]);

  const toggleFavorite = useCallback((tagId: string) => {
    setFavorites((prev) => {
      const newFavorites = prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId];
      safeStorage.set("tagFavorites", JSON.stringify(newFavorites));
      return newFavorites;
    });
  }, []);

  const handleDeleteTag = useCallback((tagId: string, tagLabel: string) => {
    if (!window.confirm(`Are you sure you want to delete "${tagLabel}" tag?`)) {
      return;
    }

    setIsLoading(true);
    import("../../services/tagService").then(({ tagService }) => {
      try {
        const success = tagService.deleteTag(tagId);
        if (success) {
          setServiceTags((prev) => prev.filter((tag) => tag.id !== tagId));
        }
      } catch (err) {
        console.error("Error deleting tag:", err);
      } finally {
        setIsLoading(false);
      }
    });
  }, []);

  const handleEditTag = useCallback(async (tag: ServiceTag) => {
    if (!tag.label.trim() || !tag.content.trim()) return;

    setIsLoading(true);

    try {
      const { tagService } = await import("../../services/tagService");
      const updatedTag = tagService.updateTag(tag.id, {
        label: tag.label.trim(),
        type: tag.type,
        content: tag.content.trim(),
        projectType: tag.projectType,
      });

      if (updatedTag) {
        setServiceTags((prev) =>
          prev.map((t) => (t.id === tag.id ? { ...updatedTag, projectType: tag.projectType } : t))
        );
        setEditingTag(null);
      }
    } catch (err) {
      console.error("Error updating tag:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const renderEditTagModal = () => {
    if (!editingTag) return null;

    const availableTypes = filteredTagTypes();

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div
          className="relative bg-[#0D0D0F] rounded-xl border border-white/10 shadow-2xl w-[400px] max-h-[85vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-14 px-6 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-base font-medium text-white">Edit Tag</h2>
            <button
              onClick={() => setEditingTag(null)}
              className="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center text-white/40 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">Label</label>
              <input
                type="text"
                value={editingTag.label}
                onChange={(e) => setEditingTag((prev) => ({ ...prev!, label: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg bg-white/5 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">Type</label>
              <select
                value={editingTag.type}
                onChange={(e) =>
                  setEditingTag((prev) => ({
                    ...prev!,
                    type: e.target.value as TagType,
                  }))
                }
                className="w-full h-10 px-3 rounded-lg bg-white/5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500/40"
              >
                {availableTypes.map((type: TagType) => (
                  <option key={type} value={type} className="bg-[#0D0D0F] text-white">
                    {type === "npc" && "Character"}
                    {type === "quest" && "Quest"}
                    {type === "state_start" && "Start State"}
                    {type === "env_village" && "Village Environment"}
                    {!["npc", "quest", "state_start", "env_village"].includes(type) &&
                      type
                        .split("_")
                        .map(
                          (word: string) =>
                            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                        )
                        .join(" ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">Content</label>
              <textarea
                value={editingTag.content}
                onChange={(e) =>
                  setEditingTag((prev) => ({
                    ...prev!,
                    content: e.target.value,
                  }))
                }
                className="w-full h-24 px-3 py-2 rounded-lg bg-white/5 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/40 resize-none"
              />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingTag(null)}
                className="h-10 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white/60 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleEditTag(editingTag)}
                disabled={!editingTag.label.trim() || !editingTag.content.trim()}
                className="h-10 px-4 rounded-lg bg-blue-500 hover:bg-blue-600 text-sm text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderNewTagModal = () => {
    if (!isAddingNew) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div
          className="relative bg-[#0D0D0F] rounded-xl border border-white/10 shadow-2xl w-[400px] max-h-[85vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-14 px-6 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-base font-medium text-white">New Tag</h2>
            <button
              onClick={() => {
                setIsAddingNew(false);
                setNewTag({
                  label: "",
                  type: selectedType,
                  content: "",
                  projectType: currentProjectType,
                });
              }}
              className="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center text-white/40 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">Label</label>
              <input
                type="text"
                value={newTag.label}
                onChange={(e) => setNewTag((prev) => ({ ...prev, label: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg bg-white/5 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                placeholder="Enter tag label..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">Type</label>
              <select
                value={newTag.type}
                onChange={(e) =>
                  setNewTag((prev) => ({
                    ...prev,
                    type: e.target.value as TagType,
                  }))
                }
                className="w-full h-10 px-3 rounded-lg bg-white/5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500/40"
              >
                {filteredTagTypes().map((type) => (
                  <option key={type} value={type} className="bg-[#0D0D0F] text-white">
                    {type.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">Content</label>
              <textarea
                value={newTag.content}
                onChange={(e) => setNewTag((prev) => ({ ...prev, content: e.target.value }))}
                className="w-full h-24 px-3 py-2 rounded-lg bg-white/5 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/40 resize-none"
                placeholder="Enter tag content..."
              />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setIsAddingNew(false);
                  setNewTag({
                    label: "",
                    type: selectedType,
                    content: "",
                    projectType: currentProjectType,
                  });
                }}
                className="h-10 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white/60 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTag}
                disabled={!newTag.label.trim() || !newTag.content.trim()}
                className="h-10 px-4 rounded-lg bg-blue-500 hover:bg-blue-600 text-sm text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Tag
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const navigateToTagCategory = useCallback(
    (tag: ServiceTag) => {
      const categoryWithTag = projectConfig.categories.find((category) =>
        category.defaultTags.some((defaultTag) => {
          const tagType = projectTagService.getTagTypeFromLabel(defaultTag);
          return tagType === tag.type;
        })
      );

      if (categoryWithTag) {
        setShowAllTags(false);
        setShowFavorites(false);
        setSelectedCategoryId(categoryWithTag.id);
        setSelectedType(tag.type);
      }
    },
    [projectConfig.categories, projectTagService]
  );

  const [highlightedTagId, setHighlightedTagId] = useState<string | null>(null);

  useEffect(() => {
    if (highlightedTagId) {
      const timer = setTimeout(() => {
        setHighlightedTagId(null);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [highlightedTagId, showAllTags, showFavorites, selectedCategoryId]);

  const toggleSelectAll = useCallback(() => {
    if (selectedTags.length > 0) {
      setSelectedTags([]);
    } else {
      setSelectedTags(sortedAndFilteredTags.map((tag) => tag.id));
    }
  }, [selectedTags, sortedAndFilteredTags, setSelectedTags]);

  const toggleSelectTag = useCallback(
    (tagId: string) => {
      if (selectedTags.includes(tagId)) {
        setSelectedTags(selectedTags.filter((id) => id !== tagId));
      } else {
        setSelectedTags([...selectedTags, tagId]);
      }
    },
    [selectedTags, setSelectedTags]
  );

  const handleDeleteSelectedTags = useCallback(async () => {
    if (selectedTags.length === 0) return;

    if (!window.confirm(`Are you sure you want to delete ${selectedTags.length} tags?`)) {
      return;
    }

    setIsLoading(true);
    try {
      const { tagService } = await import("../../services/tagService");

      const deletePromises = selectedTags.map((tagId) => tagService.deleteTag(tagId));
      await Promise.all(deletePromises);

      setServiceTags((prev) => prev.filter((tag) => !selectedTags.includes(tag.id)));
      setSelectedTags([]);

      alert(`${selectedTags.length} tags successfully deleted.`);
    } catch (err) {
      console.error("Error deleting tags:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedTags]);

  useEffect(() => {
    if (isRestoringDefaults === false) {
      refreshTagData();
    }
  }, [isRestoringDefaults, refreshTagData]);

  return (
    <>
      <div className="flex flex-1 overflow-hidden">
        <div className="w-[230px] bg-[#0A0A10] border-r border-white/5 flex flex-col">
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-3 rounded-md text-xs bg-[#15151F] text-white/80 placeholder-white/30 border border-white/5 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500/40"
              />
            </div>
          </div>

          <div className="px-3 pt-3 pb-1">
            <h3 className="text-[11px] font-medium text-white/40 uppercase tracking-wide">
              Categories
            </h3>
          </div>

          <div className="px-2 flex-1 overflow-y-auto space-y-0.5 custom-scrollbar">
            <button
              onClick={() => {
                setShowAllTags(true);
                setSelectedCategoryId("");
                setShowFavorites(false);
              }}
              className={`
                group w-full h-8 px-2.5 rounded flex items-center justify-between
                ${
                  showAllTags
                    ? "bg-indigo-500/10 text-indigo-300"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }
              `}
            >
              <div className="flex items-center">
                <TagIcon className="w-3.5 h-3.5 mr-2.5" />
                <span className="text-xs font-medium">All Tags</span>
              </div>
              <span className="text-[11px] px-1.5 py-0.5 rounded-sm bg-white/5 text-white/50">
                {serviceTags.length}
              </span>
            </button>

            <button
              onClick={() => {
                setShowFavorites(true);
                setShowAllTags(false);
                setSelectedCategoryId("");
              }}
              className={`
                group w-full h-8 px-2.5 rounded flex items-center justify-between
                ${
                  showFavorites
                    ? "bg-amber-500/10 text-amber-300"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }
              `}
            >
              <div className="flex items-center">
                <Star className="w-3.5 h-3.5 mr-2.5" />
                <span className="text-xs font-medium">Favorites</span>
              </div>
              <span className="text-[11px] px-1.5 py-0.5 rounded-sm bg-white/5 text-white/50">
                {favorites.length}
              </span>
            </button>

            <div className="h-px bg-white/5 my-2.5 mx-1"></div>

            {!showFavorites &&
              projectConfig.categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => {
                    setShowAllTags(false);
                    setShowFavorites(false);
                    handleCategoryChange(category.id);
                  }}
                  className={`
                  group w-full h-8 px-2.5 rounded flex items-center justify-between
                  ${
                    !showAllTags && !showFavorites && selectedCategoryId === category.id
                      ? "bg-white/10 text-white"
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  }
                `}
                >
                  <div className="flex items-center">
                    {currentProjectType === "game" && (
                      <>
                        {category.id === "character" && (
                          <MessageSquare className="w-3.5 h-3.5 mr-2.5 text-blue-400" />
                        )}
                        {category.id === "mechanic" && (
                          <Settings className="w-3.5 h-3.5 mr-2.5 text-orange-400" />
                        )}
                        {category.id === "state" && (
                          <Activity className="w-3.5 h-3.5 mr-2.5 text-green-400" />
                        )}
                        {category.id === "environment" && (
                          <Map className="w-3.5 h-3.5 mr-2.5 text-violet-400" />
                        )}
                      </>
                    )}

                    {currentProjectType === "interactive_story" && (
                      <>
                        {category.id === "branch" && (
                          <ChevronRight className="w-3.5 h-3.5 mr-2.5 text-green-400" />
                        )}
                        {category.id === "outcome" && (
                          <Activity className="w-3.5 h-3.5 mr-2.5 text-orange-400" />
                        )}
                        {category.id === "theme" && (
                          <MessageSquare className="w-3.5 h-3.5 mr-2.5 text-blue-400" />
                        )}
                        {category.id === "character_development" && (
                          <Map className="w-3.5 h-3.5 mr-2.5 text-violet-400" />
                        )}
                      </>
                    )}

                    {currentProjectType === "novel" && (
                      <>
                        {category.id === "chapter" && (
                          <BookOpen className="w-3.5 h-3.5 mr-2.5 text-blue-400" />
                        )}
                        {category.id === "character" && (
                          <MessageSquare className="w-3.5 h-3.5 mr-2.5 text-green-400" />
                        )}
                        {category.id === "genre" && (
                          <Activity className="w-3.5 h-3.5 mr-2.5 text-orange-400" />
                        )}
                        {category.id === "scene" && (
                          <Map className="w-3.5 h-3.5 mr-2.5 text-violet-400" />
                        )}
                      </>
                    )}

                    {![
                      "character",
                      "mechanic",
                      "state",
                      "environment",
                      "branch",
                      "outcome",
                      "theme",
                      "character_development",
                      "chapter",
                      "genre",
                      "scene",
                    ].includes(category.id) && (
                      <Circle className="w-3.5 h-3.5 mr-2.5 text-gray-400" />
                    )}
                    <span className="text-xs font-medium">{category.label}</span>
                  </div>

                  <span className="text-[11px] px-1.5 py-0.5 rounded-sm bg-white/5 text-white/50">
                    {
                      serviceTags.filter((tag) => {
                        const categoryTags = category.defaultTags.map((dt) => {
                          const tagType = projectTagService.getTagTypeFromLabel(dt);
                          return tagType;
                        });
                        return categoryTags.includes(tag.type);
                      }).length
                    }
                  </span>
                </button>
              ))}
          </div>

          <div className="p-3 pt-2 border-t border-white/5">
            <button
              onClick={() => setIsAddingNew(true)}
              className="w-full h-9 rounded bg-indigo-500 hover:bg-indigo-600 text-white flex items-center justify-center gap-2 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Add New Tag</span>
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col bg-[#0D0D13] min-w-0">
          {!showAllTags && !showFavorites && selectedCategoryId && (
            <div className="border-b border-white/5 bg-[#0F0F17]">
              <div className="h-[46px] px-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-xs font-medium text-white">
                    {projectConfig.categories.find((c) => c.id === selectedCategoryId)?.label ||
                      "Tags"}
                  </h2>
                  <span className="text-[11px] text-white/40">
                    {sortedAndFilteredTags.length} tags
                  </span>
                </div>

                <button
                  onClick={() => {
                    setShowAllTags(true);
                    setShowFavorites(false);
                    setSelectedCategoryId("");
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-xs text-white/60 hover:text-white transition-colors"
                >
                  <ChevronRight className="w-3 h-3 transform rotate-180" />
                  <span>Back to All</span>
                </button>
              </div>

              <div className="px-4 pb-3 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-2 min-w-min">
                  {currentFilteredTypes.map((type) => (
                    <button
                      key={type}
                      onClick={() => setSelectedType(type)}
                      className={`
                        group relative shrink-0 px-2.5 h-7 rounded text-xs transition-all flex items-center
                        ${
                          selectedType === type
                            ? "bg-indigo-500/10 text-indigo-400"
                            : "text-white/60 bg-white/5 hover:bg-white/10 hover:text-white"
                        }
                      `}
                    >
                      <span className="mr-1.5">{type.replace("_", " ")}</span>
                      <span
                        className={`
                        px-1.5 py-0.5 rounded-sm text-[10px]
                        ${
                          selectedType === type
                            ? "bg-indigo-500/10 text-indigo-400"
                            : "bg-white/10 text-white/50"
                        }
                      `}
                      >
                        {tagTypeStats[type] || 0}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="px-4 h-11 flex items-center justify-between border-b border-white/5">
            <div className="flex items-center gap-3">
              <h3 className="text-xs font-medium text-white/90">
                {showFavorites
                  ? "Favorite Tags"
                  : showAllTags
                    ? "All Tags"
                    : projectConfig.categories.find((c) => c.id === selectedCategoryId)?.label ||
                      "Tags"}
              </h3>

              {sortedAndFilteredTags.length > 0 && (
                <div className="flex items-center gap-2 ml-3">
                  <button
                    onClick={toggleSelectAll}
                    className="flex items-center gap-1.5 h-6 px-2 rounded bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                  >
                    <Check className="w-3 h-3" />
                    <span className="text-[11px] font-medium">
                      {selectedTags.length > 0 ? "Clear Selection" : "Select All"}
                    </span>
                  </button>

                  {selectedTags.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-indigo-400 px-1.5 py-0.5 bg-indigo-500/10 rounded">
                        {selectedTags.length} tags selected
                      </span>

                      <button
                        onClick={handleDeleteSelectedTags}
                        className="flex items-center gap-1.5 h-6 px-2 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span className="text-[11px] font-medium">Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center rounded-md overflow-hidden border border-white/10">
              <button
                onClick={() => setViewMode("grid")}
                className={`
                  p-1.5 transition-colors
                  ${
                    viewMode === "grid"
                      ? "bg-white/10 text-white"
                      : "bg-transparent text-white/40 hover:text-white/80"
                  }
                `}
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`
                  p-1.5 transition-colors
                  ${
                    viewMode === "list"
                      ? "bg-white/10 text-white"
                      : "bg-transparent text-white/40 hover:text-white/80"
                  }
                `}
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <div
              className={`
              grid gap-3
              ${
                viewMode === "grid" ? "grid-cols-2 auto-rows-[150px]" : "grid-cols-1 auto-rows-auto"
              }
              min-h-[calc(150px*3+0.75rem*2)]
            `}
            >
              {sortedAndFilteredTags.map((tag) => (
                <div
                  key={tag.id}
                  className={`
                    group relative flex flex-col
                    ${viewMode === "list" ? "p-4 h-[180px]" : "p-3 min-h-[110px]"}
                    bg-[#121218] hover:bg-[#16161D] 
                    rounded-lg cursor-pointer transition-all
                    border ${selectedTags.includes(tag.id) ? "border-blue-500/40" : "border-white/5 hover:border-white/10"}
                  `}
                  onClick={(e) => {
                    if (e.ctrlKey || e.metaKey) {
                      e.stopPropagation();
                      toggleSelectTag(tag.id);
                    } else if (showAllTags) {
                      setHighlightedTagId(tag.id);
                      navigateToTagCategory(tag);
                    }
                  }                    }
                  >
                  <div className="absolute -left-px top-0 h-full flex flex-col items-center">
                    <div
                      className="h-full w-[3px] rounded-l transition-all"
                      style={{
                        background: tagColors[tag.type]
                          ? `linear-gradient(180deg, ${tagColors[tag.type].from} 0%, ${tagColors[tag.type].to} 100%)`
                          : "rgba(255, 255, 255, 0.1)",
                      }}
                    />
                  </div>

                  <div className="relative pl-2 flex flex-col min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      {tagColors[tag.type] && (
                        <span className="text-base" role="img" aria-label={tag.type}>
                          {tagColors[tag.type].icon}
                        </span>
                      )}

                      <h3 className="text-[15px] font-medium text-white truncate pr-16">
                        {tag.label}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className="px-2 py-0.5 rounded text-[11px] font-medium bg-white/5"
                        style={{
                          color: tagColors[tag.type]
                            ? tagColors[tag.type].from
                            : "rgba(255, 255, 255, 0.6)",
                        }}
                      >
                        {tag.type.replace("_", " ")}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-hidden mt-3 ml-1.5">
                    <p className="text-xs text-white/60 leading-relaxed line-clamp-4">
                      {tag.content}
                    </p>
                  </div>

                  <div
                    className={`
                    absolute bottom-2 right-2 flex items-center space-x-1 
                    ${selectedTags.includes(tag.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100"}
                    transition-opacity
                  `}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(tag.id);
                      }}
                      className={`
                        w-6 h-6 rounded flex items-center justify-center 
                        ${favorites.includes(tag.id) ? "text-amber-400" : "text-white/40 hover:text-amber-400"}
                        ${favorites.includes(tag.id) ? "bg-amber-500/10" : "bg-white/5 hover:bg-white/10"}
                        transition-colors
                      `}
                    >
                      <Star
                        className="w-3 h-3"
                        fill={favorites.includes(tag.id) ? "currentColor" : "none"}
                      />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTag(tag);
                      }}
                      className="w-6 h-6 rounded flex items-center justify-center text-white/40 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTag(tag.id, tag.label);
                      }}
                      className="w-6 h-6 rounded flex items-center justify-center text-white/40 hover:text-red-400 bg-white/5 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  {favorites.includes(tag.id) && (
                    <div className="absolute top-2.5 right-9 z-10">
                      <Star className="w-3 h-3 text-amber-400 fill-current" strokeWidth={2} />
                    </div>
                  )}
                </div>
              ))}

              {sortedAndFilteredTags.length === 0 && !isLoading && (
                <div className="col-span-2 flex flex-col items-center justify-center py-16">
                  <div className="w-12 h-12 rounded-xl bg-white/[0.02] flex items-center justify-center mb-3">
                    <TagIcon className="w-6 h-6 text-white/10" />
                  </div>
                  <p className="text-xs text-white/40 text-center max-w-sm">
                    {searchQuery
                      ? `No tags found matching "${searchQuery}"`
                      : "No tags created for this type yet"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {renderNewTagModal()}
      {renderEditTagModal()}
    </>
  );
};

const TagManagerModal: React.FC<TagManagerModalProps> = ({
  show,
  onClose,
  projectType = "game",
}): JSX.Element | null => {
  const [currentProjectType, setCurrentProjectType] = useState<ProjectType>(projectType);
  const [showFavorites, setShowFavorites] = useState(false);
  const [isRestoringDefaults, setIsRestoringDefaults] = useState(false);
  const [showDefaultTags, setShowDefaultTags] = useState(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const projectTagService = useMemo(
    () => new ProjectTagService(currentProjectType),
    [currentProjectType]
  );

  const handleRestoreDefaultTags = useCallback(async () => {
    if (isRestoringDefaults) return;

    try {
      setIsRestoringDefaults(true);
      const addedTags = await projectTagService.restoreDefaultTags();

      if (addedTags.length > 0) {
        alert(`${addedTags.length} default tags successfully added.`);
      } else {
        alert("All default tags are already present.");
      }
    } catch (error) {
      console.error("Error restoring default tags:", error);
      alert("An error occurred while restoring default tags.");
    } finally {
      setIsRestoringDefaults(false);
    }
  }, [projectTagService, isRestoringDefaults]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-[#0D0D0F] rounded-xl border border-white/10 shadow-2xl w-[1050px] max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-14 px-4 border-b border-white/5 flex items-center justify-between bg-[#12121A]">
          <div className="flex items-center space-x-3">
            <div className="flex items-center px-3 py-1.5 gap-2">
              <TagIcon className="w-5 h-5 text-indigo-400" />
              <h1 className="text-base font-medium text-white">Tag Manager</h1>
            </div>

            <div className="flex items-center space-x-2">
              <div className="bg-[#1A1A26] rounded-md flex items-center h-8">
                <div className="flex items-center px-2.5 space-x-1.5">
                  {currentProjectType === "game" && <Grid className="w-3.5 h-3.5 text-blue-400" />}
                  {currentProjectType === "interactive_story" && (
                    <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                  )}
                  {currentProjectType === "novel" && (
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                  )}
                  <select
                    value={currentProjectType}
                    onChange={(e) => setCurrentProjectType(e.target.value as ProjectType)}
                    className="appearance-none bg-transparent text-sm text-white/80 hover:text-white border-none focus:outline-none focus:ring-0 cursor-pointer transition-colors pr-5"
                  >
                    {Object.entries(PROJECT_TYPES).map(([id, pt]) => (
                      <option key={id} value={id} className="bg-[#1A1A26] text-white/90 py-1.5">
                        {pt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-white/40 pointer-events-none absolute right-2" />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-md text-white/40 hover:text-white hover:bg-white/5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between py-2.5 px-4 border-b border-white/5 bg-[#0F0F15]">
          <div className="flex items-center space-x-3">
            <div className="flex items-center">
              <label className="relative inline-flex items-center cursor-pointer space-x-2">
                <div className="w-8 h-4 bg-white/10 rounded-full relative">
                  <input
                    type="checkbox"
                    checked={showDefaultTags}
                    onChange={(e) => setShowDefaultTags(e.target.checked)}
                    className="sr-only peer"
                  />
                  <span
                    className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full transition-all ${showDefaultTags ? "translate-x-4 bg-indigo-500" : "bg-white/70"}`}
                  ></span>
                </div>
                <span className="text-xs text-white/70">Default Tags</span>
              </label>
            </div>
          </div>

          <div>
            <button
              onClick={handleRestoreDefaultTags}
              disabled={isRestoringDefaults}
              className="flex items-center space-x-1.5 h-7 px-3 rounded bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-300 transition-colors disabled:opacity-50"
            >
              {isRestoringDefaults ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="text-xs font-medium">Loading...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">Restore Default Tags</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex-1 h-[calc(92vh-86px)] overflow-hidden">
          <ModalContent
            projectType={currentProjectType}
            showFavorites={showFavorites}
            setShowFavorites={setShowFavorites}
            projectTagService={projectTagService}
            isRestoringDefaults={isRestoringDefaults}
            showDefaultTags={showDefaultTags}
            selectedTags={selectedTags}
            setSelectedTags={setSelectedTags}
            key={`tag-manager-${isRestoringDefaults}`}
          />
        </div>
      </div>
    </div>
  );
};

export default TagManagerModal;
