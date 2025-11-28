import { DialogChain, Tag } from "./dialog";

export type DialogNodeType = string;

export type ProjectType = "game" | "interactive_story" | "novel";

export interface DialogContext {
  nodeId: string;
  text: string;
  type: DialogNodeType;
  tags?: Tag[];
}

export interface GenerateContext {
  previousDialog?: string;
  currentDialog?: string;
  nextDialog?: string;
  dialogChain?: DialogChain;
  characterInfo?: string;
  previous?: DialogContext[];
  current?: DialogContext;
  next?: DialogContext[];
  siblingNodes?: DialogContext[];
  projectType?: ProjectType;
  conversationHistory?: string;
  ignoreConnections?: boolean;
}

export interface OllamaModelResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  temperature: number;
  diversityBoost?: number;
  requestTimeout?: number;
  maxTokens: number;
  endpoint: string;
  apiKey: string;
  projectType?: ProjectType;
  systemPrompts?: {
    npcDialog?: string;
    playerResponse?: string;
    narratorNode?: string;
    branchNode?: string;
    choiceNode?: string;
    conditionNode?: string;
    characterDialogNode?: string;
    sceneDescriptionNode?: string;
    enemyDialog?: string;
    branchingNode?: string;
    sceneNode?: string;
    general?: string;
    isolatedNodePrompt?: string;
    dialogStartPrompt?: string;
    continuationPrompt?: string;
    improvementPrompt?: string;
    diversityPrompt?: string;
    forcedDifferentiationPrompt?: string;
    siblingAwarenessPrompt?: string;
    deadendFixPrompt?: string;
    inconsistencyFixPrompt?: string;
    contextGapFixPrompt?: string;
    questionAnswerFixPrompt?: string;
    toneShiftFixPrompt?: string;
    generalFixPrompt?: string;
    customPromptWrapper?: string;
    projectTypes?: {
      game: {
        npcDialog?: string;
        playerResponse?: string;
        narratorNode?: string;
        branchNode?: string;
        choiceNode?: string;
        conditionNode?: string;
        characterDialogNode?: string;
        sceneDescriptionNode?: string;
        enemyDialog?: string;
        branchingNode?: string;
        sceneNode?: string;
        general?: string;
      };
      interactive_story: {
        npcDialog?: string;
        playerResponse?: string;
        narratorNode?: string;
        branchNode?: string;
        choiceNode?: string;
        conditionNode?: string;
        characterDialogNode?: string;
        sceneDescriptionNode?: string;
        enemyDialog?: string;
        branchingNode?: string;
        sceneNode?: string;
        general?: string;
      };
      novel: {
        npcDialog?: string;
        playerResponse?: string;
        narratorNode?: string;
        branchNode?: string;
        choiceNode?: string;
        conditionNode?: string;
        characterDialogNode?: string;
        sceneDescriptionNode?: string;
        enemyDialog?: string;
        branchingNode?: string;
        sceneNode?: string;
        general?: string;
      };
    };
  };
}
