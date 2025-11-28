import { ProjectType, ProjectTypeConfig, PROJECT_TYPES } from "../types/project";
import { Tag, TagType } from "../types/dialog";
import logger from "../utils/logger";

export class ProjectTagService {
  private currentProjectType: ProjectType;

  constructor(projectType: ProjectType = "game") {
    this.currentProjectType = projectType;
  }

  setProjectType(projectType: ProjectType) {
    this.currentProjectType = projectType;
  }

  getCurrentProjectType(): ProjectType {
    return this.currentProjectType;
  }

  getProjectConfig(): ProjectTypeConfig {
    return PROJECT_TYPES[this.currentProjectType];
  }

  createDefaultTags(): Tag[] {
    const config = this.getProjectConfig();
    const tags: Tag[] = [];

    config.categories.forEach((category) => {
      category.defaultTags.forEach((tagLabel) => {
        const tagType = this.getTagTypeFromLabel(tagLabel);
        if (tagType) {
          tags.push({
            id: `${category.id}_${tagLabel.toLowerCase().replace(/\s+/g, "_")}`,
            label: tagLabel,
            type: tagType,
            content: tagLabel,
          });
        }
      });
    });

    return tags;
  }

  async restoreDefaultTags(): Promise<Tag[]> {
    const config = this.getProjectConfig();
    const addedTags: Tag[] = [];

    try {
      const { tagService } = await import("./tagService");
      const existingTags = tagService.getAllTags();

      const tagContents: Record<string, string> = {
        NPC: "A wise old sage who knows the secrets of the past and guides our hero. The sadness in his eyes tells the story of his lost family.",
        Player:
          "A young hero who, while once an ordinary villager, now bears a great responsibility due to fate. Special abilities are just beginning to emerge.",
        Enemy:
          "A mysterious creature living in shadows, feeding on dark magic with glowing red eyes. Hunts villagers at night.",
        Quest:
          "Find the legendary jewel hidden deep in the ancient caves and lift the curse threatening the village. Be careful of traps waiting for you inside.",
        "Side Quest":
          "Find and bring back the wizard's missing book. The book may look simple, but it contains powerful spells.",
        "Dialog Choice":
          "Accept the old man's offer and choose the safe path, or prefer the dangerous adventure with a bigger reward?",
        "Item Collection":
          "5 pieces of crystal that match the symbols on the walls of the ancient temple. When they all come together, they will open the door to great power.",
        Start:
          "A calm morning is disrupted by sudden screams in the village square. A new adventure begins!",
        Completed:
          "Mission completed! The village is saved and you will be remembered as a hero. You've gained new skills and treasures.",
        Failed:
          "Mission failed. The townspeople are unhappy, your reputation has fallen. Perhaps you should try another way?",
        Village:
          "A small charming village surrounded by lush green forests with wooden houses lined up. Built by the river and famous for fishing.",
        Dungeon:
          "A dark dungeon from an ancient civilization, with stone walls covered in moss and moisture, dim corridors. Danger lurks at every corner.",
        City: "A large city surrounded by high walls, inhabited by various races, vibrant markets and secret underground organizations.",

        Choice:
          "You need to choose between two paths: A safe but long journey, or a fast adventure full of dangers.",
        "Branch: Yes":
          "You accept the offer. This decision will completely change the course of the story and lead you on a new path.",
        "Branch: No":
          "You reject the offer. This choice is a sign that you're entering a difficult path, but maybe you're doing the right thing.",
        "Story End":
          "The story comes to an end. The decisions you made shaped your character and brought you to this point. Although the outcome is unexpected, it's meaningful.",
        "Happy Ending":
          "You have overcome all difficulties and reached a happy ending. Your loved ones are safe, your enemies defeated, and your name will be remembered as a legend.",
        "Tragic Ending":
          "You saved others with great sacrifices, but couldn't save yourself. A tragic end, but a heroic story.",
        Emotional:
          "Your heart fills with a heavy feeling. Tears begin to gather in your eyes and you feel a lump in your throat.",
        Suspense:
          "The sounds from the end of the corridor are getting closer. Your heart beats faster, you feel cold sweat on your hands.",
        Comedy:
          "You encounter an unexpected situation and laughter rises. In this tense environment, laughing feels good.",
        Friendship:
          "A true friend who stands by you in difficult times, holds your hand in good and bad days. This bond grows stronger over time.",
        Betrayal:
          "You learn that the person you trusted most is actually an enemy. This betrayal opens a deep wound in your heart.",
        Victory:
          "After a long and difficult struggle, you finally achieve success. This victory was worth all your sacrifices.",

        "Chapter 1":
          "The beginning of the story. Characters are introduced, world-building takes shape, and the first signs of the main conflict appear.",
        Introduction:
          "As our hero spends a day in the ordinary world, the fuse of the event that will soon change his life is lit.",
        Climax:
          "The peak point of the story. All conflicts and tensions meet at this moment. The hero faces the greatest test.",
        Conclusion:
          "All knots are untied, the characters' journeys are completed, and the story reaches a meaningful closure.",
        "Main Character":
          "The character at the center of the story. A realistic hero with strengths and weaknesses that the reader can empathize with.",
        "Supporting Character":
          "An important character who stands alongside the main hero, adds depth to the story and helps develop the main character.",
        Drama:
          "A scene full of intense emotions, complex relationships and difficult choices. It provides an emotional experience for the reader.",
        Fantasy:
          "A world adorned with magic, legendary creatures and surreal elements. A story that pushes the boundaries of imagination.",
        Realistic:
          "A narrative that offers glimpses of daily life, progressing with realistic characters and situations. It mirrors the reader.",
        Dialogue:
          "A meaningful conversation between two characters that advances the story and reveals the personalities of the characters.",
        "Inner Monologue":
          "A glimpse into the inner world of the character. Thoughts, fears, hopes and conflicts are revealed.",
        Action:
          "A fast-paced, exciting scene. The reflexes and skills of the characters are tested, tension is at its peak.",
      };

      config.categories.forEach((category) => {
        category.defaultTags.forEach((tagLabel) => {
          const tagType = this.getTagTypeFromLabel(tagLabel);
          if (!tagType) return;

          const tagExists = existingTags.some(
            (tag) =>
              tag.label.toLowerCase() === tagLabel.toLowerCase() &&
              tag.type === tagType &&
              (!tag.projectType || tag.projectType === this.currentProjectType)
          );

          if (!tagExists) {
            const content = tagContents[tagLabel] || tagLabel;

            const newTag = tagService.addTag({
              label: tagLabel,
              type: tagType,
              content: content,
              projectType: this.currentProjectType,
            });
            addedTags.push(newTag);
          }
        });
      });

      return addedTags;
    } catch (error) {
      logger.error("Error occurred while adding default tags:", error);
      return [];
    }
  }

  getTagTypeFromLabel(label: string): TagType | null {
    if (!label) return null;

    const labelLower = label.toLowerCase().trim();

    if (labelLower === "npc") return "npc";
    if (labelLower === "player") return "player";
    if (labelLower === "enemy") return "enemy";
    if (labelLower === "quest") return "quest";
    if (labelLower === "side quest") return "side_quest";
    if (labelLower === "dialog choice") return "dialog_choice";
    if (labelLower === "item collection") return "item_collect";
    if (labelLower === "start") return "state_start";
    if (labelLower === "completed") return "state_complete";
    if (labelLower === "failed") return "state_fail";
    if (labelLower === "village") return "env_village";
    if (labelLower === "dungeon") return "env_dungeon";
    if (labelLower === "city") return "env_city";

    if (labelLower === "choice") return "choice";
    if (labelLower === "branch: yes") return "branch_yes";
    if (labelLower === "branch: no") return "branch_no";
    if (labelLower === "branch yes") return "branch_yes";
    if (labelLower === "branch no") return "branch_no";
    if (labelLower === "story end") return "story_end";
    if (labelLower === "happy ending") return "happy_end";
    if (labelLower === "tragic ending") return "tragic_end";
    if (labelLower === "emotional") return "emotional";
    if (labelLower === "suspense") return "suspense";
    if (labelLower === "comedy") return "comedy";
    if (labelLower === "friendship") return "friendship";
    if (labelLower === "betrayal") return "betrayal";
    if (labelLower === "victory") return "victory";

    if (labelLower === "chapter") return "chapter";
    if (labelLower === "introduction") return "intro";
    if (labelLower === "climax") return "climax";
    if (labelLower === "conclusion") return "conclusion";
    if (labelLower === "main character") return "main_character";
    if (labelLower === "supporting character") return "supporting_character";
    if (labelLower === "drama") return "drama";
    if (labelLower === "fantasy") return "fantasy";
    if (labelLower === "realistic") return "realistic";
    if (labelLower === "dialogue scene") return "dialogue_scene";
    if (labelLower === "dialogue") return "dialogue_scene";
    if (labelLower === "monologue") return "monologue";
    if (labelLower === "action scene") return "action_scene";
    if (labelLower === "action") return "action_scene";

    if (labelLower.includes("npc")) return "npc";
    if (labelLower.includes("player")) return "player";
    if (labelLower.includes("enemy")) return "enemy";
    if (labelLower.includes("quest") && !labelLower.includes("side")) return "quest";
    if (labelLower.includes("side quest")) return "side_quest";
    if (labelLower.includes("dialog choice")) return "dialog_choice";
    if (labelLower.includes("item")) return "item_collect";
    if (labelLower.includes("start")) return "state_start";
    if (labelLower.includes("complete")) return "state_complete";
    if (labelLower.includes("fail")) return "state_fail";
    if (labelLower.includes("village")) return "env_village";
    if (labelLower.includes("dungeon")) return "env_dungeon";
    if (labelLower.includes("city")) return "env_city";

    if (labelLower.includes("choice")) return "choice";
    if ((labelLower.includes("branch") && labelLower.includes("yes")) || labelLower === "yes")
      return "branch_yes";
    if ((labelLower.includes("branch") && labelLower.includes("no")) || labelLower === "no")
      return "branch_no";
    if (labelLower.includes("story end")) return "story_end";
    if (labelLower.includes("happy ending") || labelLower.includes("happy end")) return "happy_end";
    if (labelLower.includes("tragic ending") || labelLower.includes("tragic end"))
      return "tragic_end";
    if (labelLower.includes("emotional")) return "emotional";
    if (labelLower.includes("suspense")) return "suspense";
    if (labelLower.includes("comedy")) return "comedy";
    if (labelLower.includes("friendship")) return "friendship";
    if (labelLower.includes("betrayal")) return "betrayal";
    if (labelLower.includes("victory")) return "victory";

    if (labelLower.includes("chapter")) return "chapter";
    if (labelLower.includes("introduction") || labelLower.includes("intro")) return "intro";
    if (labelLower.includes("climax")) return "climax";
    if (labelLower.includes("conclusion")) return "conclusion";
    if (labelLower.includes("main character")) return "main_character";
    if (labelLower.includes("supporting character")) return "supporting_character";
    if (labelLower.includes("drama")) return "drama";
    if (labelLower.includes("fantasy")) return "fantasy";
    if (labelLower.includes("realistic")) return "realistic";
    if (labelLower.includes("dialogue scene") || labelLower.includes("dialogue"))
      return "dialogue_scene";
    if (labelLower.includes("monologue")) return "monologue";
    if (labelLower.includes("action scene") || labelLower.includes("action")) return "action_scene";

    switch (this.currentProjectType) {
      case "game":
        return "npc";
      case "interactive_story":
        return "choice";
      case "novel":
        return "chapter";
      default:
        return "trait";
    }
  }

  filterTagsByCategory(tags: Tag[], categoryId: string): Tag[] {
    return tags.filter((tag) => this.getCategoryIdForTagType(tag.type) === categoryId);
  }

  getCategoryIdForTagType(tagType: TagType): string | null {
    const config = this.getProjectConfig();

    for (const category of config.categories) {
      const defaultTags = category.defaultTags.map((t) => t.toLowerCase());
      const matchingTag = defaultTags.find((dt) => {
        const type = this.getTagTypeFromLabel(dt);
        return type === tagType;
      });

      if (matchingTag) {
        return category.id;
      }
    }

    return null;
  }
}
