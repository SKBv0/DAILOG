export type ProjectType = "game" | "interactive_story" | "novel";

export interface ProjectTagCategory {
  id: string;
  label: string;
  description: string;
  defaultTags: string[];
}

export interface ProjectTypeConfig {
  id: ProjectType;
  label: string;
  description: string;
  categories: ProjectTagCategory[];
}

export const PROJECT_TYPES: Record<ProjectType, ProjectTypeConfig> = {
  game: {
    id: "game",
    label: "Game",
    description: "Customized tag system for game development projects",
    categories: [
      {
        id: "character",
        label: "Character",
        description: "Tags related to game characters",
        defaultTags: ["NPC", "Player", "Enemy"],
      },
      {
        id: "mechanic",
        label: "Mechanic",
        description: "Tags related to game mechanics",
        defaultTags: [
          "Quest",
          "Side Quest",
          "Dialog Choice",
          "Item Collection",
        ],
      },
      {
        id: "state",
        label: "State",
        description: "Tags related to game states",
        defaultTags: ["Start", "Completed", "Failed"],
      },
      {
        id: "environment",
        label: "Environment",
        description: "Tags related to game environments",
        defaultTags: ["Village", "Dungeon", "City"],
      },
    ],
  },
  interactive_story: {
    id: "interactive_story",
    label: "Interactive Story",
    description: "Customized tag system for interactive stories",
    categories: [
      {
        id: "branch",
        label: "Branch",
        description: "Tags related to story branches",
        defaultTags: ["Choice", "Branch: Yes", "Branch: No"],
      },
      {
        id: "outcome",
        label: "Outcome",
        description: "Tags related to story outcomes",
        defaultTags: ["Story End", "Happy Ending", "Tragic Ending"],
      },
      {
        id: "theme",
        label: "Theme",
        description: "Tags related to story themes",
        defaultTags: ["Emotional", "Suspense", "Comedy"],
      },
      {
        id: "character_development",
        label: "Character Development",
        description: "Tags related to character development",
        defaultTags: ["Friendship", "Betrayal", "Victory"],
      },
    ],
  },
  novel: {
    id: "novel",
    label: "Novel/Script",
    description: "Customized tag system for novel and script writing",
    categories: [
      {
        id: "chapter",
        label: "Chapter",
        description: "Tags related to chapter structure",
        defaultTags: ["Chapter 1", "Introduction", "Climax", "Conclusion"],
      },
      {
        id: "character",
        label: "Character",
        description: "Tags related to character types",
        defaultTags: ["Main Character", "Supporting Character"],
      },
      {
        id: "genre",
        label: "Genre",
        description: "Tags related to literary genres",
        defaultTags: ["Drama", "Fantasy", "Realistic"],
      },
      {
        id: "scene",
        label: "Scene",
        description: "Tags related to scene types",
        defaultTags: ["Dialogue", "Inner Monologue", "Action"],
      },
    ],
  },
};
