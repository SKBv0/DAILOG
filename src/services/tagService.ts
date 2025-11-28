import { Tag, TagType, TagRelation } from "../types/dialog";
import logger from "../utils/logger";
import { safeStorage } from "../utils/safeStorage";

export class TagService {
  private tags: Tag[] = [];
  private lastId: number = 0;

  constructor() {
    this.loadTags();

    if (this.tags.length === 0) {
      this.tags = [
        {
          id: "1",
          label: "John",
          type: "npc",
          content:
            "Cold, distant, mysterious. Not very talkative. Wants to protect the town and distrusts outsiders.",
        },
        {
          id: "2",
          label: "Silent Creek",
          type: "env_village",
          content: "A small, isolated town. Strange occurrences have been reported recently.",
        },
        {
          id: "3",
          label: "Town Status",
          type: "state_start",
          content: "Strange events are occurring, townspeople are tense and worried.",
        },
        {
          id: "4",
          label: "Missing Persons",
          type: "quest",
          content:
            "Three people have disappeared in the last month. The town sheriff remains silent on the matter.",
        },
        {
          id: "5",
          label: "Suspicious",
          type: "emotional",
          content: "Feeling suspicious of the other person, experiencing distrust and unease.",
        },
        {
          id: "6",
          label: "Ancient Amulet",
          type: "item",
          content: "An ancient necklace. According to locals, it keeps evil spirits at bay.",
        },
        {
          id: "7",
          label: "The Hunters",
          type: "faction",
          content:
            "A mysterious group living outside town, hunting in the depths of the forest at night.",
        },
        {
          id: "8",
          label: "Sarah",
          type: "npc",
          content:
            "Local librarian. Knows town history well. Believes there's more to the disappearances than meets the eye.",
          metadata: {
            importance: 7,
            characterVoice: {
              speechPatterns: [
                "According to the records...",
                "I've read about this before",
                "The history suggests...",
              ],
              emotionalRange: { curious: 9, analytical: 8, concerned: 6 },
              vocabularyLevel: "complex",
              dialectMarkers: ["formal speech", "historical references"],
              conversationStyle: "formal",
              conflictAvoidance: 7,
              trustLevel: 8,
              secretsKnown: ["Historical patterns", "Old town records", "Previous similar events"],
              personalMotivations: [
                "Uncover the truth",
                "Help solve the mystery",
                "Preserve knowledge",
              ],
              relationshipDynamics: {
                researchers: { trust: 9, tension: 0, history: "Fellow seekers of knowledge" },
                town_council: {
                  trust: 4,
                  tension: 5,
                  history: "They discourage her investigations",
                },
              },
            },
          },
        },
        {
          id: "9",
          label: "Dark Forest",
          type: "location",
          content: "Dense, ancient forest surrounding Silent Creek. Strange sounds echo at night.",
        },
        {
          id: "10",
          label: "Old Mine",
          type: "location",
          content:
            "Abandoned mine shaft from the 1800s. Local legends speak of something sealed within.",
        },
        {
          id: "11",
          label: "Town Council",
          type: "faction",
          content:
            "Conservative leadership group. More concerned with maintaining order than finding truth.",
        },
        {
          id: "12",
          label: "Fearful",
          type: "emotional",
          content: "Deep sense of dread and anxiety, feeling watched or followed.",
        },
        {
          id: "13",
          label: "Ancient Ritual",
          type: "quest",
          content:
            "Old ceremony performed by original settlers. Said to protect the town from ancient evil.",
        },
        {
          id: "14",
          label: "Sheriff Badge",
          type: "item",
          content: "More than a symbol of authority - contains strange markings on the back.",
        },
        {
          id: "15",
          label: "The Watchers",
          type: "faction",
          content: "Secret society dedicated to monitoring supernatural activity in Silent Creek.",
        },
      ];
      this.lastId = 15;
      this.saveTags();
    }
  }

  private generateId(): string {
    this.lastId += 1;
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `tag_${this.lastId}_${timestamp}_${random}`;
  }

  getAllTags(): Tag[] {
    return this.tags;
  }

  getTagsByType(type: TagType): Tag[] {
    return this.tags.filter((tag) => tag.type === type);
  }

  getTagById(id: string): Tag | undefined {
    return this.tags.find((tag) => tag.id === id);
  }

  getChildTags(parentId: string): Tag[] {
    return this.tags.filter((tag) => tag.parentId === parentId);
  }

  getParentTag(childId: string): Tag | undefined {
    const child = this.getTagById(childId);
    if (child?.parentId) {
      return this.getTagById(child.parentId);
    }
    return undefined;
  }

  getRootTags(): Tag[] {
    return this.tags.filter((tag) => !tag.parentId);
  }

  getTagHierarchy(rootId?: string): Tag[] {
    const roots = rootId ? this.tags.filter((tag) => tag.id === rootId) : this.getRootTags();

    return roots.map((root) => this.buildTagTree(root));
  }

  private buildTagTree(tag: Tag): Tag {
    const children = this.getChildTags(tag.id);
    return {
      ...tag,
      children: children.map((child) => child.id),
    };
  }

  getRelatedTags(tagId: string, relationType?: TagRelation["type"]): Tag[] {
    const tag = this.getTagById(tagId);
    if (!tag || !tag.relations || tag.relations.length === 0) {
      return [];
    }

    const relationIds = tag.relations
      .filter((relation) => !relationType || relation.type === relationType)
      .map((relation) => relation.targetTagId);

    return this.tags.filter((tag) => relationIds.includes(tag.id));
  }

  addTag(tag: Omit<Tag, "id">): Tag {
    const newTag = {
      ...tag,
      id: this.generateId(),
      metadata: {
        ...tag.metadata,
        version: 1,
        lastModified: new Date().toISOString(),
      },
    };

    if (newTag.parentId) {
      const parentIndex = this.tags.findIndex((t) => t.id === newTag.parentId);
      if (parentIndex >= 0) {
        const parent = this.tags[parentIndex];
        this.tags[parentIndex] = {
          ...parent,
          children: [...(parent.children || []), newTag.id],
        };
      }
    }

    this.tags.push(newTag);

    this.saveTags();

    return newTag;
  }

  updateTag(id: string, updates: Partial<Omit<Tag, "id">>): Tag | null {
    const index = this.tags.findIndex((tag) => tag.id === id);
    if (index === -1) return null;

    const currentTag = this.tags[index];

    if (updates.parentId !== undefined && updates.parentId !== currentTag.parentId) {
      if (currentTag.parentId) {
        const oldParentIndex = this.tags.findIndex((t) => t.id === currentTag.parentId);
        if (oldParentIndex >= 0) {
          const oldParent = this.tags[oldParentIndex];
          this.tags[oldParentIndex] = {
            ...oldParent,
            children: (oldParent.children || []).filter((childId) => childId !== id),
          };
        }
      }

      if (updates.parentId) {
        const newParentIndex = this.tags.findIndex((t) => t.id === updates.parentId);
        if (newParentIndex >= 0) {
          const newParent = this.tags[newParentIndex];
          this.tags[newParentIndex] = {
            ...newParent,
            children: [...(newParent.children || []), id],
          };
        }
      }
    }

    const updatedTag = {
      ...currentTag,
      ...updates,
      metadata: {
        ...currentTag.metadata,
        ...updates.metadata,
      },
    };

    this.tags[index] = updatedTag;

    this.saveTags();

    return updatedTag;
  }

  addTagRelation(tagId: string, relation: TagRelation): Tag | null {
    const tag = this.getTagById(tagId);
    const targetTag = this.getTagById(relation.targetTagId);

    if (!tag || !targetTag) return null;

    const updatedTag = {
      ...tag,
      relations: [...(tag.relations || []), relation],
      metadata: {
        ...tag.metadata,
      },
    };

    return this.updateTag(tagId, updatedTag);
  }

  removeTagRelation(
    tagId: string,
    targetTagId: string,
    relationType?: TagRelation["type"]
  ): Tag | null {
    const tag = this.getTagById(tagId);
    if (!tag || !tag.relations) return null;

    const updatedRelations = tag.relations.filter(
      (rel) => rel.targetTagId !== targetTagId || (relationType && rel.type !== relationType)
    );

    return this.updateTag(tagId, {
      relations: updatedRelations,
    });
  }

  deleteTag(id: string): boolean {
    const index = this.tags.findIndex((tag) => tag.id === id);
    if (index === -1) return false;

    const tagToDelete = this.tags[index];

    if (tagToDelete.parentId) {
      const parentIndex = this.tags.findIndex((t) => t.id === tagToDelete.parentId);
      if (parentIndex >= 0) {
        const parent = this.tags[parentIndex];
        this.tags[parentIndex] = {
          ...parent,
          children: (parent.children || []).filter((childId) => childId !== id),
        };
      }
    }

    if (tagToDelete.children && tagToDelete.children.length > 0) {
      tagToDelete.children.forEach((childId) => {
        const childIndex = this.tags.findIndex((t) => t.id === childId);
        if (childIndex >= 0) {
          this.tags[childIndex] = {
            ...this.tags[childIndex],
            parentId: undefined,
          };
        }
      });
    }

    this.tags.forEach((tag, tagIndex) => {
      if (tag.relations && tag.relations.some((rel) => rel.targetTagId === id)) {
        this.tags[tagIndex] = {
          ...tag,
          relations: tag.relations.filter((rel) => rel.targetTagId !== id),
        };
      }
    });

    this.tags.splice(index, 1);

    this.saveTags();

    return true;
  }

  private saveTags(): void {
    try {
      const ok = safeStorage.set("tags", JSON.stringify(this.tags));
      if (!ok) {
        logger.error("Failed to save tags to localStorage: storage unavailable");
      }
    } catch (err) {
      logger.error("Failed to save tags to localStorage:", err);
    }
  }

  private loadTags(): void {
    try {
      const savedTags = safeStorage.get("tags");
      if (savedTags) {
        this.tags = JSON.parse(savedTags);

        const maxId = Math.max(
          ...this.tags.map((tag) => parseInt(tag.id.replace(/^tag_(\d+).*$/, "$1"), 10) || 0)
        );
        this.lastId = maxId;
      }
    } catch (err) {
      logger.error("Failed to load tags from localStorage:", err);
    }
  }

  updateCharacterVoice(characterTagId: string, voiceProperties: Partial<any>): Tag | null {
    const tag = this.getTagById(characterTagId);
    if (!tag || !["npc", "player", "enemy", "character"].includes(tag.type)) {
      return null;
    }

    const currentMetadata = tag.metadata || {};
    const currentVoice = currentMetadata.characterVoice || {};

    const updatedVoice = {
      ...currentVoice,
      ...voiceProperties,
    };

    return this.updateTag(characterTagId, {
      metadata: {
        ...currentMetadata,
        characterVoice: updatedVoice,
      },
    });
  }

  updateNarrativePacing(tagId: string, pacingProperties: Partial<any>): Tag | null {
    const tag = this.getTagById(tagId);
    if (!tag) return null;

    const currentMetadata = tag.metadata || {};
    const currentPacing = currentMetadata.narrativePacing || {};

    const updatedPacing = {
      ...currentPacing,
      ...pacingProperties,
    };

    return this.updateTag(tagId, {
      metadata: {
        ...currentMetadata,
        narrativePacing: updatedPacing,
      },
    });
  }

  createCharacterWithVoice(
    label: string,
    content: string,
    type: "npc" | "player" | "enemy" | "character" = "npc",
    voiceProfile?: any
  ): Tag {
    const characterTag = this.addTag({
      label,
      content,
      type,
      metadata: {
        importance: 5,
        characterVoice: voiceProfile || {
          conversationStyle: "casual",
          vocabularyLevel: "moderate",
          conflictAvoidance: 5,
          trustLevel: 5,
          emotionalRange: { neutral: 5 },
          speechPatterns: [],
          personalMotivations: [],
          secretsKnown: [],
          relationshipDynamics: {},
        },
      },
    });

    return characterTag;
  }

  analyzeTensionFlow(nodeSequence: Array<{ nodeId: string; text: string; type: string }>): {
    suggestedTensionLevels: Record<string, number>;
    pacingRecommendations: Record<string, string>;
    emotionalBeats: Record<string, string>;
  } {
    const suggestions = {
      suggestedTensionLevels: {} as Record<string, number>,
      pacingRecommendations: {} as Record<string, string>,
      emotionalBeats: {} as Record<string, string>,
    };

    nodeSequence.forEach((node, index) => {
      const text = node.text.toLowerCase();
      let tensionScore = 3;

      if (text.includes("!") || text.includes("urgent") || text.includes("danger")) {
        tensionScore += 2;
      }
      if (text.includes("?") || text.includes("confused") || text.includes("uncertain")) {
        tensionScore += 1;
      }
      if (text.includes("calm") || text.includes("peaceful") || text.includes("relaxed")) {
        tensionScore -= 1;
      }

      const position = index / Math.max(1, nodeSequence.length - 1);
      if (position < 0.3) {
        suggestions.emotionalBeats[node.nodeId] = "setup";
      } else if (position < 0.7) {
        suggestions.emotionalBeats[node.nodeId] = "building";
        tensionScore += Math.floor(position * 2);
      } else {
        suggestions.emotionalBeats[node.nodeId] = "climax";
        tensionScore += 2;
      }

      suggestions.suggestedTensionLevels[node.nodeId] = Math.min(10, Math.max(1, tensionScore));

      if (tensionScore <= 3) {
        suggestions.pacingRecommendations[node.nodeId] = "slow";
      } else if (tensionScore <= 6) {
        suggestions.pacingRecommendations[node.nodeId] = "moderate";
      } else if (tensionScore <= 8) {
        suggestions.pacingRecommendations[node.nodeId] = "fast";
      } else {
        suggestions.pacingRecommendations[node.nodeId] = "climactic";
      }
    });

    return suggestions;
  }

  analyzeRelationshipDynamics(
    character1Id: string,
    character2Id: string,
    dialogHistory: Array<{ speaker: string; text: string }>
  ): { trust: number; tension: number; suggestedHistory: string } {
    const char1Tag = this.getTagById(character1Id);
    const char2Tag = this.getTagById(character2Id);

    if (!char1Tag || !char2Tag) {
      return { trust: 5, tension: 0, suggestedHistory: "No prior interaction recorded." };
    }

    let trustScore = 5;
    let tensionScore = 0;
    const interactions = dialogHistory.filter(
      (d) => d.speaker === character1Id || d.speaker === character2Id
    );

    interactions.forEach((dialog) => {
      const text = dialog.text.toLowerCase();

      if (text.includes("thank") || text.includes("help") || text.includes("trust")) {
        trustScore += 1;
      }
      if (text.includes("betray") || text.includes("lie") || text.includes("deceive")) {
        trustScore -= 2;
      }

      if (text.includes("angry") || text.includes("hate") || text.includes("enemy")) {
        tensionScore += 2;
      }
      if (text.includes("friend") || text.includes("ally") || text.includes("together")) {
        tensionScore -= 1;
      }
    });

    trustScore = Math.min(10, Math.max(1, trustScore));
    tensionScore = Math.min(10, Math.max(0, tensionScore));

    const suggestedHistory = this.generateRelationshipHistory(
      char1Tag.label,
      char2Tag.label,
      trustScore,
      tensionScore
    );

    return { trust: trustScore, tension: tensionScore, suggestedHistory };
  }

  private generateRelationshipHistory(
    char1Name: string,
    char2Name: string,
    trust: number,
    tension: number
  ): string {
    if (trust >= 8 && tension <= 2) {
      return `${char1Name} and ${char2Name} have a strong, trusting relationship built over shared experiences.`;
    } else if (trust <= 3 || tension >= 7) {
      return `${char1Name} and ${char2Name} have a troubled history with unresolved conflicts and mistrust.`;
    } else if (tension >= 4 && tension <= 6) {
      return `${char1Name} and ${char2Name} have a complex relationship with both cooperation and underlying tensions.`;
    } else {
      return `${char1Name} and ${char2Name} have a professional but somewhat distant relationship.`;
    }
  }

  exportTags(): string {
    return JSON.stringify(this.tags, null, 2);
  }

  importTags(tagsJson: string, mode: "replace" | "merge" = "merge"): boolean {
    try {
      const importedTags = JSON.parse(tagsJson);

      if (!Array.isArray(importedTags)) {
        logger.error("Invalid tag data: Array expected");
        return false;
      }

      if (mode === "replace") {
        this.tags = importedTags;
      } else {
        const tagMap = new Map(this.tags.map((tag) => [tag.id, tag]));

        importedTags.forEach((importedTag) => {
          if (tagMap.has(importedTag.id)) {
            const existingTag = tagMap.get(importedTag.id)!;
            tagMap.set(importedTag.id, {
              ...existingTag,
              ...importedTag,
              metadata: {
                ...existingTag.metadata,
                ...importedTag.metadata,
              },
            });
          } else {
            tagMap.set(importedTag.id, {
              ...importedTag,
              metadata: {
                ...importedTag.metadata,
              },
            });
          }
        });

        this.tags = Array.from(tagMap.values());
      }

      if (this.tags.length > 0) {
        const idNumbers = this.tags
          .map((tag) => {
            const match = tag.id.match(/tag_(\d+)_/);
            return match ? parseInt(match[1], 10) : 0;
          })
          .filter((id) => !isNaN(id));

        this.lastId = idNumbers.length > 0 ? Math.max(...idNumbers) : 0;
      }

      this.saveTags();
      return true;
    } catch (e) {
      logger.error("Failed to import tag data:", e);
      return false;
    }
  }
}

export const tagService = new TagService();
