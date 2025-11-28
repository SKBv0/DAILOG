import { Tag, TagType, TagRelation, TagMetadata } from "../../types/dialog";
import { ProjectType } from "../../types/project";
import { tagColorHex } from "./constants/tagColors";

export interface ServiceTag {
  id: string;
  label: string;
  type: TagType;
  content: string;
  projectType?: ProjectType;
  parentId?: string;
  children?: string[];
  relations?: TagRelation[];
  metadata?: TagMetadata;
}

export interface ExtendedTag extends Omit<Tag, "label"> {
  name?: string;
  label?: string;
  type: TagType;
  content: string;
  parentId?: string;
  children?: string[];
  relations?: TagRelation[];
  metadata?: TagMetadata;
}

export const serviceTagToTag = (serviceTag: ServiceTag): Tag => ({
  id: serviceTag.id,
  label: serviceTag.label,
  type: serviceTag.type,
  content: serviceTag.content,
  parentId: serviceTag.parentId,
  children: serviceTag.children,
  relations: serviceTag.relations,
  metadata: serviceTag.metadata,
});

export const tagToServiceTag = (tag: Tag): ServiceTag => ({
  id: tag.id,
  label: tag.label,
  type: tag.type,
  content: tag.content,
  parentId: tag.parentId,
  children: tag.children,
  relations: tag.relations,
  metadata: tag.metadata,
});

export const convertToTag = (extendedTag: ExtendedTag): Tag => ({
  id: extendedTag.id,
  label: extendedTag.label || extendedTag.name || "",
  type: extendedTag.type,
  content: extendedTag.content,
  parentId: extendedTag.parentId,
  children: extendedTag.children,
  relations: extendedTag.relations,
  metadata: extendedTag.metadata,
});

export const getColorForType = (type?: TagType): string => {
  if (!type) return "#71717A";
  return tagColorHex[type] || "#71717A";
};

const labelTypeRules: Array<{ type: TagType; prefixes: string[] }> = [
  { type: "character", prefixes: ["NPC_", "CHARACTER_"] },
  { type: "quest", prefixes: ["QUEST_"] },
  { type: "world", prefixes: ["WORLD_"] },
  { type: "location", prefixes: ["LOC_", "LOCATION_"] },
  { type: "item", prefixes: ["ITEM_"] },
  { type: "faction", prefixes: ["FACTION_", "GROUP_"] },
  { type: "emotion", prefixes: ["EMOTION_", "FEEL_"] },
  { type: "arc", prefixes: ["ARC_", "STORY_"] },
  { type: "theme", prefixes: ["THEME_"] },
  { type: "motif", prefixes: ["MOTIF_"] },
  { type: "symbol", prefixes: ["SYMBOL_"] },
  { type: "conflict", prefixes: ["CONFLICT_"] },
  { type: "setting", prefixes: ["SETTING_"] },
  { type: "pov", prefixes: ["POV_"] },
  { type: "voice", prefixes: ["VOICE_"] },
  { type: "timeline", prefixes: ["TIME_", "TIMELINE_"] },
  { type: "scene", prefixes: ["SCENE_"] },
];

export const getTagTypeFromLabel = (label: string | undefined): TagType => {
  if (!label) return "trait";

  const upperLabel = label.toUpperCase();
  const matchedRule = labelTypeRules.find((rule) =>
    rule.prefixes.some((prefix) => upperLabel.startsWith(prefix)),
  );

  return matchedRule?.type ?? "trait";
};

export const getRelationTypeDescription = (
  type: TagRelation["type"],
): string => {
  switch (type) {
    case "requires":
      return "Requires";
    case "conflicts":
      return "Conflicts";
    case "suggests":
      return "Suggests";
    case "enhances":
      return "Enhances";
    default:
      return type;
  }
};

export const flattenTagTree = (tags: Tag[], rootId?: string): Tag[] => {
  const result: Tag[] = [];

  const processTag = (tag: Tag, depth = 0) => {
    const tagCopy = {
      ...tag,
      metadata: {
        ...tag.metadata,
        displayDepth: depth,
      },
    };

    result.push(tagCopy);

    if (tag.children && tag.children.length > 0) {
      tag.children.forEach((childId) => {
        const childTag = tags.find((t) => t.id === childId);
        if (childTag) {
          processTag(childTag, depth + 1);
        }
      });
    }
  };

  if (rootId) {
    const rootTag = tags.find((t) => t.id === rootId);
    if (rootTag) {
      processTag(rootTag);
    }
  } else {
    tags.filter((tag) => !tag.parentId).forEach((tag) => processTag(tag));
  }

  return result;
};

export const getTagPath = (tagId: string, allTags: Tag[]): Tag[] => {
  const result: Tag[] = [];

  const findPath = (id: string): boolean => {
    const tag = allTags.find((t) => t.id === id);
    if (!tag) return false;

    result.unshift(tag);

    if (tag.parentId) {
      return findPath(tag.parentId);
    }

    return true;
  };

  findPath(tagId);
  return result;
};

