import { DialogNodeType, DialogNode, DialogChain, Tag, TagType } from "../types/dialog";
import {
  findDialogPaths as findDialogPathsUtil,
  getCharacterContext as getCharacterContextUtil,
  DialogContext as DialogContextBase,
} from "../utils/dialogAnalyzer";
import { OllamaConfig as ImportedOllamaConfig, ProjectType } from "../types/ollama";
import systemPrompts, { promptEnhancers } from "../config/systemPrompts";
import { useHistoryStore, AIHistoryItem } from "../store/historyStore";
import { TagService } from "../services/tagService";
import { STORAGE_KEYS } from "../constants";
import {
  characterVoiceValidator,
  ValidationResult as CharacterValidationResult,
  TopicContext,
} from "./characterVoiceValidator";
import {
  responseCoherenceChecker,
  CoherenceResult,
  ContextAlignment,
} from "./responseCoherenceChecker";
import logger from "../utils/logger";
import { safeStorage } from "../utils/safeStorage";
import { aiConcurrencyLimiter } from "./aiConcurrencyLimiter";

type TagData = Tag;

interface DialogGenerationOptions {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  max_tokens?: number;
  timeout?: number;
  retries?: number;
  retryDelayMs?: number;
}

enum ErrorType {
  API_ERROR = "API error",
  NETWORK_ERROR = "Network error",
  TIMEOUT_ERROR = "Timeout error",
  VALIDATION_ERROR = "Validation error",
  GENERATION_ERROR = "Generation error",
  UNKNOWN_ERROR = "Unknown error",
  SERVICE_UNAVAILABLE = "Service unavailable",
}

function ensureTags(tags: string[] | TagData[] | undefined): TagData[] {
  if (!tags || tags.length === 0) return [];

  if (typeof tags[0] !== "string") {
    return tags as TagData[];
  }

  return stringsToTags(tags as string[]);
}

function stringsToTags(tags: string[] | TagData[] | undefined): TagData[] {
  if (!tags || tags.length === 0) return [];

  if (typeof tags[0] !== "string") {
    return tags as TagData[];
  }

  const tagService = new TagService();

  return (tags as string[]).map((tagId) => {
    const realTag = tagService.getTagById(tagId);

    if (realTag) {
      return {
        id: realTag.id,
        label: realTag.label,
        type: realTag.type,
        content: realTag.content,
        metadata: realTag.metadata || { importance: 3 },
      };
    } else {
      logger.dialogLog("tag", `Real tag not found for ID: ${tagId}`);
      return {
        id: tagId,
        label: tagId,
        type: "unknown" as TagType,
        content: tagId,
        metadata: { importance: 3 },
      };
    }
  });
}

function dialogContextToDialogNode(context: DialogContextBase): DialogNode {
  return {
    id: context.id,
    type: context.type,
    position: { x: 0, y: 0 },
    data: {
      text: context.text,
      type: context.type,
      metadata: {
        tags: context.tags.map((tag) => (typeof tag === "string" ? tag : tag.id)),
      },
    },
  };
}

export interface GenerateContext {
  current?: DialogContext;
  previous?: DialogContext[];
  next?: DialogContext[];
  siblingNodes?: DialogContext[];
  conversationHistory?: string;
  characterInfo?: string;
  dialogChain?: DialogChain;
  projectType?: ProjectType;
  prompt?: string;
  ignoreConnections?: boolean;
}

export interface DialogContext {
  nodeId: string;
  id?: string;
  type: DialogNodeType;
  text: string;
  tags?: string[] | TagData[];
}

export type ContextProperties = {
  hasCurrentNode: boolean;
  hasPrevious: boolean;
  hasNext: boolean;
  hasConversationHistory: boolean;
  hasDialogChain: boolean;
  hasCharacterInfo: boolean;
  hasTags: boolean;
};

export interface PromptHistoryItem {
  id: string;
  prompt: string;
  timestamp: Date;
  result: string;
  success: boolean;
  type: "improve" | "recreate" | "custom";
  metadata?: {
    executionTime?: number;
    tokensUsed?: number;
    rating?: number;
  };
}

type HistoryCallback = (history: AIHistoryItem[]) => void;

export interface NodeValidationScores {
  characterVoice: number;
  contextCoherence: number;
  combined: number;
}

export interface NodeValidationIssue {
  type:
    | "speech_pattern"
    | "vocabulary_level"
    | "emotional_range"
    | "topic_relevance"
    | "character_motivation"
    | "context_disconnect"
    | "character_inconsistency"
    | "flow_disruption"
    | "semantic_mismatch";
  severity: "low" | "medium" | "high";
  description: string;
  suggestion: string;
}

export interface NodeValidationResult {
  scores: NodeValidationScores;
  issues: NodeValidationIssue[];
  strengths: string[];
  timestamp: number;
  isValidating?: boolean;
}

const defaultConfig: ImportedOllamaConfig = {
  baseUrl: "http://localhost:11434",
  model: "gemma3:latest",
  temperature: 0.7,
  maxTokens: 1024,
  endpoint: "http://localhost:11434",
  apiKey: "",
  systemPrompts: systemPrompts,
};

function createSafeDialogContext(
  nodeId: string,
  type: DialogNodeType,
  text: string,
  tags?: string[] | TagData[]
): DialogContext {
  return {
    nodeId,
    id: nodeId,
    type,
    text,
    tags: stringsToTags(tags),
  };
}

export function findDialogPaths(
  currentNodeId: string,
  nodes: DialogNode[],
  connections: { sourceId: string; targetId: string }[]
): DialogChain {
  const formattedNodes = nodes.map((node) => ({
    id: node.id,
    type: node.type,
    data: {
      text: node.data.text,
      type: node.data.type || node.type,
      metadata: {
        ...(node.data.metadata || {}),
        nodeData: {
          tags: node.data.metadata?.nodeData?.tags || stringsToTags(node.data.metadata?.tags),
        },
      },
    },
    position: node.position,
  }));

  const formattedConnections = connections.map((conn) => ({
    source: conn.sourceId,
    target: conn.targetId,
  }));

  const analyzerChain = findDialogPathsUtil(currentNodeId, formattedNodes, formattedConnections);

  const result: DialogChain = {
    previous: analyzerChain.previous.map((ctx) => dialogContextToDialogNode(ctx)),
    current: dialogContextToDialogNode(analyzerChain.current),
    next: analyzerChain.next.map((ctx) => dialogContextToDialogNode(ctx)),
  };

  return result;
}

export class OllamaService {
  private config: ImportedOllamaConfig;
  private lastRequestTime: number = 0;
  private isAvailable: boolean = false;
  private validationCache = new Map<
    string,
    {
      result: NodeValidationResult;
      contentHash: string;
      timestamp: number;
    }
  >();
  private validationAttemptTracker: Map<string, number> = new Map();
  private tagFormattingCache = new Map<string, string>();

  constructor(config?: Partial<ImportedOllamaConfig>) {
    const persisted = this.loadPersistedConfig();
    this.config = {
      ...defaultConfig,
      ...persisted,
      ...config,
      systemPrompts: {
        ...defaultConfig.systemPrompts,
        ...(persisted?.systemPrompts || {}),
        ...(config?.systemPrompts || {}),
      },
    };
    
    logger.debug(`[OllamaService] Config initialized:`, {
      model: this.config.model,
      baseUrl: this.config.baseUrl,
      hasPersisted: !!persisted,
      persistedModel: persisted?.model,
    });
  }

  private persistConfig(next: ImportedOllamaConfig): void {
    try {
      const data = JSON.stringify(next);
      const ok = safeStorage.set(STORAGE_KEYS.SETTINGS, data);
      if (!ok) {
        logger.error("[ollamaService] Failed to save settings to localStorage: storage unavailable");
      }
    } catch (e) {
      logger.warn("Failed to persist Ollama settings:", e);
    }
  }

  private loadPersistedConfig(): Partial<ImportedOllamaConfig> | null {
    try {
      const raw = safeStorage.get(STORAGE_KEYS.SETTINGS);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed || null;
    } catch (e) {
      logger.warn("Failed to load persisted Ollama settings:", e);
      return null;
    }
  }

  private formatTagContent(tags: string[] | TagData[] | undefined): string {
    if (!tags || tags.length === 0) return "";

    const cacheKey = JSON.stringify(
      tags.map(t => typeof t === 'string' ? t : t.id).sort()
    );

    const cached = this.tagFormattingCache.get(cacheKey);
    if (cached) {
      logger.dialogLog("tag_conversion", `Using cached formatting for ${tags.length} tag(s)`);
      return cached;
    }

    const tagDataArray = ensureTags(tags);

    logger.dialogLog(
      "tag_conversion",
      `${tags.length} tag(s) parsing result: ${tagDataArray.length} tags found`
    );
    tagDataArray.forEach((tag, idx) => {
      logger.dialogLog(
        "tag_content",
        `Tag ${idx + 1}: ID=${tag.id}, Label=${tag.label}, Type=${tag.type}, Content="${tag.content.substring(0, 50)}${tag.content.length > 50 ? "..." : ""}"`
      );
    });

    const tagsByType: Record<string, TagData[]> = {};

    tagDataArray.forEach((tag) => {
      if (!tagsByType[tag.type]) {
        tagsByType[tag.type] = [];
      }
      tagsByType[tag.type].push(tag);
    });

    let result = "CHARACTER AND WORLD INFORMATION:\n";

    const priorityTypes: TagType[] = [
      "character",
      "world",
      "location",
      "faction",
      "quest",
      "theme",
      "arc",
    ];

    priorityTypes.forEach((type) => {
      if (tagsByType[type] && tagsByType[type].length > 0) {
        const formattedType = type.charAt(0).toUpperCase() + type.slice(1);
        result += `\n${formattedType} Information:\n`;

        tagsByType[type].forEach((tag) => {
          const tagPath = tag.parentId ? this.getTagPath(tag, tagDataArray) : tag.label;
          const importance = tag.metadata?.importance || 3;

          let tagContent = tag.content;

          if (type === "character") {
            tagContent = `${tagContent}\n  **CRITICAL**: Maintain this character's unique voice, speech patterns, and personality traits in ALL their dialogue. Their dialogue should be immediately recognizable as belonging to this character.`;
          }

          if (importance >= 4) tagContent = `[IMPORTANT] ${tagContent}`;
          if (importance >= 5) tagContent = `[CRITICAL] ${tagContent}`;

          result += `- ${tagPath}: ${tagContent}\n`;

          if (tag.relations) {
            const relevantRelations = tag.relations.filter(
              (r) => r.type === "requires" || r.type === "enhances"
            );

            if (relevantRelations.length > 0) {
              result += `  Related information:\n`;
              relevantRelations.forEach((rel) => {
                const relatedTag = tagDataArray.find((t) => t.id === rel.targetTagId);
                if (relatedTag) {
                  result += `  - ${relatedTag.label}: ${relatedTag.content}\n`;
                }
              });
            }
          }
        });
      }
    });

    Object.keys(tagsByType).forEach((type) => {
      if (
        !priorityTypes.includes(type as TagType) &&
        tagsByType[type] &&
        tagsByType[type].length > 0
      ) {
        const formattedType = type.charAt(0).toUpperCase() + type.slice(1);
        result += `\n${formattedType} Information:\n`;

        tagsByType[type].forEach((tag) => {
          result += `- ${tag.label}: ${tag.content}\n`;
        });
      }
    });

    this.tagFormattingCache.set(cacheKey, result);

    return result;
  }

  private adjustTagsByDepth(
    tags: string[] | TagData[],
    conversationDepth: number,
    nodeType: DialogNodeType
  ): string {
    if (!tags || tags.length === 0) return "";

    const tagDataArray = ensureTags(tags);

    const typeMultipliers: Record<string, number> = {
      playerResponse: 2.0,
      npcDialog: 1.0,
      narratorNode: 0.8,
      choiceNode: 1.5,
      characterDialogNode: 1.0,
      enemyDialog: 1.0,
    };

    const multiplier = typeMultipliers[nodeType] || 1.0;
    const effectiveDepth = conversationDepth * multiplier;

    if (effectiveDepth > 5) {
      return ""; // Omit tags in deep conversation
    }

    let result = "\n=== BACKGROUND CONTEXT ===\n";

    tagDataArray.forEach((tag) => {
      if (effectiveDepth < 3) {
        result += `• ${tag.label}: ${tag.content}\n`;
      } else {
        result += `• ${tag.label}\n`;
      }
    });

    return result;
  }

  private getTagPath(tag: TagData, allTags: TagData[]): string {
    const path: string[] = [tag.label];
    let currentTag = tag;

    while (currentTag.parentId) {
      const parent = allTags.find((t) => t.id === currentTag.parentId);
      if (!parent) break;

      path.unshift(parent.label);
      currentTag = parent;
    }

    return path.join(" > ");
  }

  private async makeOllamaRequest(
    prompt: string,
    options: DialogGenerationOptions = {},
    nodeId?: string
  ): Promise<string> {
    const {
      temperature = 0.7,
      top_p = 0.9,
      top_k = 40,
      max_tokens = 256,
      timeout = this.config.requestTimeout || 30000, // Use config or default 30s
      retries = 1, // Reduced from 2 to 1 retry
      retryDelayMs = 300,
    } = options;

    if (!this.config.baseUrl || !this.config.model) {
      logger.error(
        `[makeOllamaRequest] Invalid configuration: baseUrl=${this.config.baseUrl}, model=${this.config.model}`
      );
      return this.formatError(ErrorType.API_ERROR, "Ollama service not properly configured");
    }

    logger.throttledLog(
      "ollama",
      `Making request to ${this.config.baseUrl}/api/generate with model ${this.config.model}`
    );
    logger.throttledLog(
      "ollama",
      `Options: temp=${temperature}, top_p=${top_p}, max_tokens=${max_tokens}`
    );

    this.lastRequestTime = Date.now();

    const attemptOnce = async (): Promise<string> => {
      const requestBody = {
        model: this.config.model,
        prompt,
        stream: false,
        options: {
          temperature,
          top_p,
          top_k,
          max_tokens,
        },
      };

      logger.throttledLog(
        "ollama",
        `Request: ${prompt.length} chars, ${prompt.split("\n").length} lines`
      );

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await aiConcurrencyLimiter.execute(
          () => fetch(this.config.baseUrl + "/api/generate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          }),
          nodeId
        );
        clearTimeout(timeoutId);

        logger.throttledLog("ollama", `Response status: ${response.status}`);

        if (!response.ok) {
          const errorText = await response.text();
          logger.error(`[DIALOG] API error response: ${errorText}`);
          return this.formatError(ErrorType.API_ERROR, `${response.status} - ${errorText}`);
        }

        const data = await response.json();

        const firstSentence = data.response ? data.response.split(".")[0] + "." : "[No response]";
        logger.throttledLog("ollama", `Response: ${firstSentence}`);

        if (!data || !data.response) {
          logger.error(`[DIALOG] Invalid API response format: ${JSON.stringify(data)}`);
          return this.formatError(
            ErrorType.API_ERROR,
            `Invalid API response: ${JSON.stringify(data)}`
          );
        }

        const generatedText = data.response
          .trim()
          .replace(/^["']|["']$/g, "")
          .replace(/^"|"$/g, "")
          .replace(/^'|'$/g, "")
          .trim();

        const cleanedText = this.cleanGeneratedText(generatedText);

        if (!cleanedText) {
          logger.warn(
            `[makeOllamaRequest] Generated text was empty after cleaning. Raw: "${generatedText}"`
          );
          return this.formatError(
            ErrorType.GENERATION_ERROR,
            `Generated text is empty after cleaning`
          );
        }

        return cleanedText;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof DOMException && error.name === "AbortError") {
          logger.error(`[makeOllamaRequest] Connection timed out after ${timeout}ms`);
          return this.formatError(
            ErrorType.TIMEOUT_ERROR,
            `Connection timed out after ${timeout}ms`
          );
        }

        if (error instanceof TypeError && String(error.message || "").includes("network")) {
          logger.error(
            `[makeOllamaRequest] Network error - Ollama server might not be running at ${this.config.baseUrl}`
          );
          return this.formatError(
            ErrorType.NETWORK_ERROR,
            `Ollama server might not be running at ${this.config.baseUrl}`
          );
        }

        logger.error(`[makeOllamaRequest] Unexpected error:`, error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error(`[makeOllamaRequest] Error details: ${errorMessage}`);
        return this.formatError(ErrorType.UNKNOWN_ERROR, errorMessage);
      }
    };

    let attempt = 0;
    let lastResult = "";
    while (attempt <= retries) {
      lastResult = await attemptOnce();
      const isTimeout =
        lastResult.startsWith("[ERROR] Timeout error") || lastResult.includes("timed out");
      const isNetwork = lastResult.startsWith("[ERROR] Network error");
      const isServiceUnavailable =
        lastResult.includes("503") || lastResult.toLowerCase().includes("unavailable");
      if (!isTimeout && !isNetwork && !isServiceUnavailable) {
        return lastResult;
      }
      if (attempt === retries) break;
      const backoff = retryDelayMs * Math.pow(2, attempt);
      await new Promise((res) => setTimeout(res, backoff));
      attempt++;
    }
    return lastResult;
  }

  private formatError(type: ErrorType, message: string): string {
    return `[ERROR] ${type}: ${message}`;
  }

  private buildPromptForContext(
    nodeType: DialogNodeType,
    context: GenerateContext,
    customSystemPrompt?: string
  ): string {
    const systemPrompt = this.getSystemPrompt(nodeType, context.projectType, customSystemPrompt);

    const contextAnalysis = this.buildContextAnalysis(context);

    let siblingPrompt = "";
    if (context.siblingNodes && context.siblingNodes.length > 0 && !context.dialogChain) {
      siblingPrompt = this.buildSiblingAwarenessPrompt(context.siblingNodes);
    }

    let tagRequirement = "";
    if (context.current?.tags && context.current.tags.length > 0) {
      const tags = ensureTags(context.current.tags);
      const requiredTagCount = Math.max(1, Math.min(2, tags.length));
      const questTags = tags.filter((tag) =>
        ["quest", "objective", "mission", "task"].includes(tag.type)
      );
      const characterTags = tags.filter((tag) =>
        ["npc", "player", "character", "enemy"].includes(tag.type)
      );
      const locationTags = tags.filter((tag) =>
        ["location", "env_village", "env_forest", "env_dungeon", "environment"].includes(tag.type)
      );

      const questTag = questTags[0];
      const characterTag = characterTags[0];
      const locationTag = locationTags[0];

      const allTagSummaries = tags
        .slice(0, 6)
        .map((tag) => `[${tag.type}] ${tag.label}: ${tag.content}`)
        .join(" | ");

      const avoidedOpeners =
        '"According to the records", "According to the archives", "From the records", "Based on the records"';
      const avoidedConstructions = '"isn’t just a [thing] — it’s [other]" or similar contrast cliches';

      const checklist: string[] = [
        `Use at least ${requiredTagCount} distinct tag detail(s) in this line; skipping tags will trigger regeneration.`,
        `Weave the tags naturally (no list dumps). Current tag set: ${allTagSummaries || "[no tags parsed]"}.`,
        "Avoid generic helper/service language; speak diegetically.",
        `Vary your opening phrasing; do NOT start with ${avoidedOpeners}.`,
        `Avoid the cliché pattern ${avoidedConstructions}; describe with a new angle.`,
      ];

      if (characterTag) {
        checklist.unshift(`Stay in ${characterTag.label}'s voice (use their speech patterns and motives).`);
      }

      if (locationTag) {
        checklist.unshift(
          `Ground the line in the current location/environment ${locationTag.label}: ${locationTag.content}`
        );
      }

      if (questTag) {
        checklist.unshift(
          `Directly address the current quest/objective ${questTag.label}: ${questTag.content}`
        );
      }
      tagRequirement = `

TAG CONTEXT (OPTIONAL):
- Consider these tags as background context, not requirements
- Use tag details only if they naturally fit the conversation
- ${checklist.join("\n- ")}`;
    }

    let nodeTypeRules = "";
    const projectType = context.projectType || this.config.projectType || "game";
    const enforceGameStyle = projectType === "game";

    if (enforceGameStyle && nodeType === "playerResponse") {
      nodeTypeRules = `
PLAYER VARIETY REQUIREMENTS:
- Responses MUST represent different attitudes (accept, reject/skeptical, inquire/neutral, aggressive/direct). Do not collapse into the same tone.
- DO NOT start with: "According to the records", "According to the archives", "From the records", "Based on the records". Rephrase with a fresh lead-in.
- Avoid repeating the NPC's wording; use a new angle or question.
- Avoid the cliché pattern "isn’t just a [thing] — it’s [other]"; pick distinct phrasing.`;
    } else if (enforceGameStyle && (nodeType === "npcDialog" || nodeType === "enemyDialog")) {
      nodeTypeRules = `
NPC/ENEMY VOICE SAFEGUARDS:
- Avoid starting with: "According to the records", "According to the archives", "From the records", "Based on the records". Use a varied opening in the character's own voice.
- Avoid the cliché pattern "isn’t just a [thing] — it’s [other]"; use fresh, specific wording.
- Enemy lines must carry tension/hostility; avoid helpful or neutral service language.`;
    }

    let enhancedGuidance = "";
    if (context.current?.tags && context.current.tags.length > 0) {
      const characterVoiceTags = context.current.tags.filter(
        (tag: any) => typeof tag === "object" && tag.type === "characterVoice"
      );
      const narrativePacingTags = context.current.tags.filter(
        (tag: any) => typeof tag === "object" && tag.type === "narrativePacing"
      );

      if (characterVoiceTags.length > 0) {
        const tag = characterVoiceTags[0];
        if (typeof tag === "object" && "content" in tag) {
          enhancedGuidance += promptEnhancers.buildCharacterVoicePrompt(tag.content);
        }
      }

      if (narrativePacingTags.length > 0) {
        const tag = narrativePacingTags[0];
        if (typeof tag === "object" && "content" in tag) {
          enhancedGuidance += promptEnhancers.buildNarrativePacingPrompt(tag.content);
        }
      }
    }

    return `
${systemPrompt}

${contextAnalysis}

${enhancedGuidance}

${siblingPrompt}
${tagRequirement}
${nodeTypeRules}
RESPONSE:`;
  }

  private getSystemPrompt(
    nodeType: DialogNodeType,
    projectType?: ProjectType,
    customSystemPrompt?: string
  ): string {
    if (customSystemPrompt) {
      return customSystemPrompt;
    }

    return this.getSystemPromptForNodeType(nodeType, projectType);
  }

  private buildContextAnalysis(context: GenerateContext): string {
    if (!context.current) {
      return "";
    }

    const shouldIgnoreConnections = context.ignoreConnections === true;
    const conversationDepth = shouldIgnoreConnections ? 0 : (context.previous?.length || 0);
    const tagContent =
      context.current.tags && context.current.tags.length > 0
        ? this.adjustTagsByDepth(context.current.tags, conversationDepth, context.current.type)
        : "";

    const characterInfo = context.characterInfo || "";

    const importantWords =
      shouldIgnoreConnections || !context.previous || context.previous.length === 0
        ? []
        : this.extractImportantWords(context.previous);

    const enhancedContext = this.buildEnhancedContextAnalysis(context);

    const isIsolatedNode =
      shouldIgnoreConnections ||
      ((!context.previous || context.previous.length === 0) &&
        (!context.next || context.next.length === 0));
    const isDialogStart = shouldIgnoreConnections || !context.previous || context.previous.length === 0;

    let baseContext = "";
    if (isIsolatedNode) {
      baseContext = this.buildIsolatedNodeContext(tagContent, characterInfo);
    } else if (isDialogStart) {
      baseContext = this.buildDialogStartContext(
        tagContent,
        characterInfo,
        shouldIgnoreConnections ? [] : (context.next || []),
        importantWords
      );
    } else {
      baseContext = this.buildContinuationContext(
        tagContent,
        characterInfo,
        shouldIgnoreConnections ? [] : (context.previous || []),
        shouldIgnoreConnections ? [] : (context.next || []),
        importantWords
      );
    }

    return baseContext + enhancedContext;
  }


  private buildEnhancedContextAnalysis(context: GenerateContext): string {
    if (!context.current) return "";

    if (context.ignoreConnections === true) {
      return "";
    }

    let enhancedContext = "";

    const prioritizedContext = this.buildPrioritizedContext(context);
    if (prioritizedContext) {
      enhancedContext += prioritizedContext;
    }

    if (context.previous && context.previous.length > 0) {
      const emotionalArc = this.analyzeEmotionalArc(context.previous);
      if (emotionalArc.trend !== "neutral") {
        enhancedContext += `\n=== EMOTIONAL CONTINUITY ===\n`;
        enhancedContext += `Emotional trend: ${emotionalArc.trend} (intensity: ${emotionalArc.intensity}/10)\n`;
        enhancedContext += `Key emotional markers: ${emotionalArc.markers.join(", ")}\n`;
        enhancedContext += `Suggested emotional response: Continue this ${emotionalArc.trend} trend with appropriate intensity.\n`;
      }
    }

    if (context.previous && context.previous.length >= 3) {
      const characterEvolution = this.analyzeCharacterEvolution(context.previous);
      if (characterEvolution.hasGrowth) {
        enhancedContext += `\n=== CHARACTER DEVELOPMENT ===\n`;
        enhancedContext += `Character growth detected: ${characterEvolution.growthType}\n`;
        enhancedContext += `Evolution summary: ${characterEvolution.summary}\n`;
        enhancedContext += `Continue this character development naturally in your response.\n`;
      }
    }

    if (context.current.tags && context.current.tags.length > 0) {
      const thematicElements = this.extractThematicElements(context.current.tags, context.previous);
      if (thematicElements.length > 0) {
        enhancedContext += `\n=== THEMATIC ELEMENTS ===\n`;
        enhancedContext += `Active themes: ${thematicElements.join(", ")}\n`;
        enhancedContext += `Weave these themes subtly into your response without being heavy-handed.\n`;
      }
    }

    if (context.previous && context.previous.length >= 5) {
      const conversationPattern = this.analyzeConversationPattern(context.previous);
      enhancedContext += `\n=== CONVERSATION DYNAMICS ===\n`;
      enhancedContext += `Pattern: ${conversationPattern.type}\n`;
      enhancedContext += `Recommended next move: ${conversationPattern.suggestion}\n`;
    }

    return enhancedContext;
  }

  private analyzeEmotionalArc(previousMessages: DialogContext[]): {
    trend: "building" | "declining" | "stable" | "volatile" | "neutral";
    intensity: number;
    markers: string[];
  } {
    const emotionalMarkers = {
      positive: ["happy", "joy", "excited", "pleased", "glad", "satisfied", "hopeful"],
      negative: ["sad", "angry", "frustrated", "disappointed", "worried", "fearful", "upset"],
      intense: ["!", "very", "extremely", "absolutely", "completely", "totally"],
      questioning: ["?", "confused", "uncertain", "wondering", "curious"],
    };

    let emotionScores = previousMessages.map((msg, index) => {
      const text = msg.text.toLowerCase();
      let score = 0;
      const foundMarkers: string[] = [];

      emotionalMarkers.positive.forEach((marker) => {
        if (text.includes(marker)) {
          score += 1;
          foundMarkers.push(marker);
        }
      });
      emotionalMarkers.negative.forEach((marker) => {
        if (text.includes(marker)) {
          score -= 1;
          foundMarkers.push(marker);
        }
      });
      emotionalMarkers.intense.forEach((marker) => {
        if (text.includes(marker)) {
          score = score * 1.5;
        }
      });

      return { score, markers: foundMarkers, index };
    });

    const scores = emotionScores.map((e) => e.score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const intensity = Math.min(10, Math.abs(avgScore) * 3);

    let trend: "building" | "declining" | "stable" | "volatile" | "neutral" = "neutral";

    if (scores.length >= 3) {
      const recent = scores.slice(-3);
      const isIncreasing = recent[2] > recent[1] && recent[1] > recent[0];
      const isDecreasing = recent[2] < recent[1] && recent[1] < recent[0];
      const variance = this.calculateVariance(scores);

      if (variance > 2) trend = "volatile";
      else if (isIncreasing) trend = "building";
      else if (isDecreasing) trend = "declining";
      else if (Math.abs(avgScore) < 0.5) trend = "neutral";
      else trend = "stable";
    }

    const allMarkers = emotionScores.flatMap((e) => e.markers);

    return { trend, intensity: Math.round(intensity), markers: [...new Set(allMarkers)] };
  }

  private analyzeCharacterEvolution(previousMessages: DialogContext[]): {
    hasGrowth: boolean;
    growthType: string;
    summary: string;
  } {
    const growthIndicators = {
      realization: ["realize", "understand", "see now", "get it", "makes sense"],
      confidence: ["sure", "certain", "confident", "believe", "know"],
      vulnerability: ["admit", "confess", "share", "open up", "trust"],
      change: ["different", "changed", "new", "transform", "become"],
    };

    const firstHalf = previousMessages.slice(0, Math.floor(previousMessages.length / 2));
    const secondHalf = previousMessages.slice(Math.floor(previousMessages.length / 2));

    let growthDetected = false;
    let growthTypes: string[] = [];

    for (const [type, indicators] of Object.entries(growthIndicators)) {
      const firstHalfCount = firstHalf.reduce(
        (count, msg) =>
          count + indicators.filter((ind) => msg.text.toLowerCase().includes(ind)).length,
        0
      );
      const secondHalfCount = secondHalf.reduce(
        (count, msg) =>
          count + indicators.filter((ind) => msg.text.toLowerCase().includes(ind)).length,
        0
      );

      if (secondHalfCount > firstHalfCount + 1) {
        growthDetected = true;
        growthTypes.push(type);
      }
    }

    return {
      hasGrowth: growthDetected,
      growthType: growthTypes.join(" and ") || "general development",
      summary: growthDetected
        ? `Character shows ${growthTypes.join(" and ")} development through the conversation`
        : "No significant character evolution detected",
    };
  }

  private extractThematicElements(
    tags: (string | TagData)[],
    previousMessages?: DialogContext[]
  ): string[] {
    const thematicTags = ["theme", "motif", "symbol", "conflict", "arc"];
    const themes: string[] = [];

    tags.forEach((tag) => {
      const tagObj = typeof tag === "string" ? null : tag;
      if (tagObj && thematicTags.includes(tagObj.type)) {
        themes.push(tagObj.label);
      }
    });

    if (previousMessages && previousMessages.length > 0) {
      const conversationText = previousMessages
        .map((msg) => msg.text)
        .join(" ")
        .toLowerCase();
      const themeKeywords = {
        redemption: ["redeem", "second chance", "forgive", "make up", "atone"],
        betrayal: ["betray", "deceive", "lie", "backstab", "trust broken"],
        sacrifice: ["sacrifice", "give up", "lose", "for others", "greater good"],
        discovery: ["discover", "find out", "reveal", "uncover", "learn"],
      };

      for (const [theme, keywords] of Object.entries(themeKeywords)) {
        if (keywords.some((keyword) => conversationText.includes(keyword))) {
          if (!themes.includes(theme)) themes.push(theme);
        }
      }
    }

    return themes;
  }


  private buildPrioritizedContext(context: GenerateContext): string {
    if (!context.current?.tags || context.current.tags.length === 0) {
      return "";
    }

    const tags = ensureTags(context.current.tags);
    let prioritizedContext = "";

    const questTags = tags.filter((tag) =>
      ["quest", "objective", "mission", "task"].includes(tag.type)
    );

    if (questTags.length > 0) {
      prioritizedContext += `\n=== [CRITICAL PRIORITY] CURRENT QUEST/OBJECTIVE ===\n`;
      questTags.forEach((tag) => {
        prioritizedContext += `🎯 ACTIVE QUEST: ${tag.label}\n`;
        prioritizedContext += `   Details: ${tag.content}\n`;
        if (tag.metadata?.importance && tag.metadata.importance >= 7) {
          prioritizedContext += `   ⚠️  HIGH IMPORTANCE - This MUST be directly addressed in your response\n`;
        }
      });
      prioritizedContext += `\n*** Your response MUST relate to and advance these objectives ***\n`;
    }

    const characterTags = tags.filter(
      (tag) =>
        ["npc", "player", "character", "enemy"].includes(tag.type) && tag.metadata?.characterVoice
    );

    if (characterTags.length > 0) {
      prioritizedContext += `\n=== [HIGH PRIORITY] CHARACTER VOICE REQUIREMENTS ===\n`;
      characterTags.forEach((tag) => {
        const voice = tag.metadata?.characterVoice;
        if (voice) {
          prioritizedContext += `👤 CHARACTER: ${tag.label}\n`;

          if (voice.conversationStyle) {
            prioritizedContext += `   Communication Style: ${voice.conversationStyle}\n`;
          }

          if (voice.trustLevel !== undefined) {
            prioritizedContext += `   Trust Level: ${voice.trustLevel}/10\n`;
          }

          if (voice.personalMotivations && voice.personalMotivations.length > 0) {
            prioritizedContext += `   Core Motivations: ${voice.personalMotivations.slice(0, 2).join(", ")}\n`;
          }

          if (voice.speechPatterns && voice.speechPatterns.length > 0) {
            prioritizedContext += `   Speech Patterns: Use phrases like "${voice.speechPatterns[0]}"\n`;
          }
        }
      });
      prioritizedContext += `\n*** Maintain strict character consistency throughout response ***\n`;
    }

    const locationTags = tags.filter((tag) =>
      ["location", "env_village", "env_dungeon", "env_forest", "environment"].includes(tag.type)
    );

    if (locationTags.length > 0) {
      prioritizedContext += `\n=== [MEDIUM PRIORITY] LOCATION CONTEXT ===\n`;
      locationTags.forEach((tag) => {
        prioritizedContext += `📍 LOCATION: ${tag.label} - ${tag.content}\n`;
      });
    }

    const emotionalTags = tags.filter((tag) =>
      ["emotional", "relationship", "mood"].includes(tag.type)
    );

    if (emotionalTags.length > 0 && context.previous && context.previous.length > 0) {
      prioritizedContext += `\n=== [MEDIUM PRIORITY] EMOTIONAL CONTEXT ===\n`;
      emotionalTags.forEach((tag) => {
        prioritizedContext += `💭 ${tag.label}: ${tag.content}\n`;
      });
    }

    return prioritizedContext;
  }

  /**
   * ENHANCEMENT: Response validation and refinement pipeline
   * Validates AI responses for character consistency and topic relevance
   */
  private async validateAndRefineResponse(
    response: string,
    context: GenerateContext,
    nodeType: DialogNodeType,
    maxRetries: number = 2
  ): Promise<string> {
    // CRITICAL FIX: Circuit breaker to prevent infinite validation loops
    const validationKey = `${context.current?.nodeId}-${response.substring(0, 50)}`;
    const now = Date.now();

    const lastAttempt = this.validationAttemptTracker.get(validationKey);
    if (lastAttempt && now - lastAttempt < 5000) {
      logger.warn('[VALIDATION:CIRCUIT_BREAKER] Loop detected, accepting response');
      return response;
    }

    this.validationAttemptTracker.set(validationKey, now);

    for (const [key, timestamp] of this.validationAttemptTracker) {
      if (now - timestamp > 30000) {
        this.validationAttemptTracker.delete(key);
      }
    }

    const topicContext: TopicContext = {
      questTags: context.current?.tags
        ? ensureTags(context.current.tags).filter((tag) =>
            ["quest", "objective", "mission", "task"].includes(tag.type)
          )
        : [],
      locationTags: context.current?.tags
        ? ensureTags(context.current.tags).filter((tag) =>
            ["location", "env_village", "env_dungeon", "env_forest", "environment"].includes(
              tag.type
            )
          )
        : [],
      importantContext: context.previous ? context.previous.map((prev) => prev.text).slice(-7) : [],
      currentObjective: context.current?.tags
        ? ensureTags(context.current.tags).find((tag) => tag.type === "quest")?.content
        : undefined,
    };

    if (context.characterInfo && typeof context.characterInfo === "string") {
      topicContext.importantContext = [
        ...topicContext.importantContext,
        context.characterInfo,
      ];
    }

    const characterTag = context.current?.tags
      ? ensureTags(context.current.tags).find(
          (tag) =>
            ["npc", "player", "character", "enemy"].includes(tag.type) &&
            tag.metadata?.characterVoice
        )
      : undefined;

    const validation = characterVoiceValidator.validateResponse(
      characterTag,
      topicContext,
      response,
      context.previous ? context.previous.map((p) => p.text) : undefined
    );

    const coherenceContext: ContextAlignment = {
      previousContext: context.previous ? context.previous.map((p) => p.text) : [],
      questContext: topicContext.questTags.map((tag) => tag.content || ""),
      characterContext: characterTag ? [characterTag.content || ""] : [],
      locationContext: topicContext.locationTags.map((tag) => tag.content || ""),
    };

    const coherenceResult = responseCoherenceChecker.checkContextAlignment(
      coherenceContext,
      response,
      characterTag
    );

    const projectType = context.projectType || this.config.projectType || "game";
    const styleGuardsEnabled = projectType === "game";

    const bannedOpeners = styleGuardsEnabled
      ? [
          /^according to the records/i,
          /^according to the archives/i,
          /^from the records/i,
          /^based on the records/i,
        ]
      : [];
    const startsWithBanned = bannedOpeners.some((rx) => rx.test(response.trim()));

    const bannedConstructions = styleGuardsEnabled
      ? [/isn[’']t just a .*?—\s*it[’']?s/i, /isn[’']t just .*?\sit[’']?s/i]
      : [];
    const usesBannedConstruction = bannedConstructions.some((rx) => rx.test(response));

    const combinedScore = validation.score * 0.6 + coherenceResult.score * 0.4;
      const combinedIssues = [
        ...validation.issues,
        ...coherenceResult.issues.map((ci) => ({
          type: ci.type,
          severity: ci.severity,
          description: ci.description,
          suggestion: ci.suggestion,
        })),
      ...(startsWithBanned
        ? [
            {
              type: "banned_opener",
              severity: "high",
              description: "Response starts with a banned opener (e.g., 'According to the records').",
              suggestion: "Use a fresh opening that fits the character voice without that phrase.",
            },
          ]
        : []),
      ...(usesBannedConstruction
        ? [
            {
              type: "banned_cliche",
              severity: "medium",
              description: 'Response uses the cliché pattern "isn’t just a [thing] — it’s [other]".',
              suggestion: "Rephrase with a fresh, specific description that fits the tags.",
            },
          ]
        : []),
    ];

    const shouldRegenerate =
      !validation.valid ||
      !coherenceResult.isCoherent ||
      combinedScore < 0.4 ||
      startsWithBanned ||
      usesBannedConstruction;

    if (context.current?.nodeId) {
      logger.validationLog(
        `[QUALITY] node=${context.current.nodeId} type=${nodeType} score=${combinedScore.toFixed(
          2
        )} (char=${validation.score.toFixed(2)}, coh=${coherenceResult.score.toFixed(2)}) issues=${
          combinedIssues.length
        }`
      );
    } else if (shouldRegenerate || combinedScore < 0.5) {
      logger.validationLog(
        `Score: ${combinedScore.toFixed(2)} (char: ${validation.score.toFixed(
          2
        )}, coh: ${coherenceResult.score.toFixed(2)})`
      );
    }

    if (shouldRegenerate && maxRetries > 0) {
      logger.validationLog(`Regenerating (score: ${combinedScore.toFixed(2)})`);

      const enhancedPrompt = this.buildComprehensiveValidationFeedbackPrompt(
        context,
        nodeType,
        validation,
        coherenceResult,
        response
      );

      try {
        const retriedResponse = await this.makeOllamaRequest(enhancedPrompt, {
          temperature: 0.8,
          top_p: 0.9,
          top_k: 50,
          max_tokens: 256,
        }, context.current?.nodeId);

        return await this.validateAndRefineResponse(
          retriedResponse,
          context,
          nodeType,
          maxRetries - 1
        );
      } catch (error) {
        logger.warn(`[DIALOG:VALIDATION] Retry failed, using original response:`, error);
        return response;
      }
    }

    if (maxRetries === 0 && shouldRegenerate) {
      logger.validationLog(
        `Using response (max retries reached, score: ${combinedScore.toFixed(2)})`
      );
    }

    this.cacheValidationResult(context.current?.nodeId || "", response, {
      scores: {
        characterVoice: validation.score,
        contextCoherence: coherenceResult.score,
        combined: combinedScore,
      },
      issues: [
        ...validation.issues,
        ...coherenceResult.issues.map((ci) => ({
          type: ci.type,
          severity: ci.severity,
          description: ci.description,
          suggestion: ci.suggestion,
        })),
      ],
      strengths: coherenceResult.strengths,
      timestamp: Date.now(),
    });

    return response;
  }

  private cacheValidationResult(
    nodeId: string,
    content: string,
    result: NodeValidationResult
  ): void {
    if (!nodeId) return;

    const contentHash = this.createContentHash(content);
    this.validationCache.set(nodeId, {
      result,
      contentHash,
      timestamp: Date.now(),
    });

    this.cleanOldValidationCache();
  }

  public getValidationResult(nodeId: string, content: string): NodeValidationResult | null {
    const cached = this.validationCache.get(nodeId);
    if (!cached) return null;

    const contentHash = this.createContentHash(content);
    if (cached.contentHash !== contentHash) {
      this.validationCache.delete(nodeId);
      return null;
    }

    if (Date.now() - cached.timestamp < 3600000) {
      return cached.result;
    }

    this.validationCache.delete(nodeId);
    return null;
  }

  public async evaluateNodeQuality(
    text: string,
    context: GenerateContext,
    nodeType: DialogNodeType
  ): Promise<NodeValidationResult | null> {
    try {
      await this.validateAndRefineResponse(text, context, nodeType, 0);

      const nodeId = context.current?.nodeId;
      if (!nodeId) return null;

      return this.getValidationResult(nodeId, text);
    } catch (error) {
      logger.error("[DIALOG:VALIDATION] Failed to evaluate node quality:", error);
      return null;
    }
  }

  private createContentHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
  }

  private cleanOldValidationCache(): void {
    const now = Date.now();
    for (const [key, value] of this.validationCache) {
      if (now - value.timestamp > 3600000) {
        this.validationCache.delete(key);
      }
    }
  }

  private buildComprehensiveValidationFeedbackPrompt(
    context: GenerateContext,
    nodeType: DialogNodeType,
    characterValidation: CharacterValidationResult,
    coherenceResult: CoherenceResult,
    originalResponse: string
  ): string {
    const basePrompt = this.buildPromptForContext(nodeType, context);

    let feedbackPrompt = `${basePrompt}\n\n=== COMPREHENSIVE RESPONSE REFINEMENT REQUIRED ===\n`;
    feedbackPrompt += `The previous response failed quality validation and must be improved.\n\n`;
    feedbackPrompt += `PREVIOUS RESPONSE (REJECTED):\n"${originalResponse}"\n\n`;

    if (characterValidation.issues.length > 0) {
      feedbackPrompt += `🎭 CHARACTER VOICE ISSUES TO FIX:\n`;
      characterValidation.issues.forEach((issue, index) => {
        feedbackPrompt += `${index + 1}. ${issue.description}\n`;
        feedbackPrompt += `   ➜ Fix: ${issue.suggestion}\n`;
      });
      feedbackPrompt += `\n`;
    }

    if (coherenceResult.issues.length > 0) {
      feedbackPrompt += `🔗 CONTEXT COHERENCE ISSUES TO FIX:\n`;
      coherenceResult.issues.forEach((issue, index) => {
        feedbackPrompt += `${index + 1}. ${issue.description}\n`;
        feedbackPrompt += `   ➜ Fix: ${issue.suggestion}\n`;
      });
      feedbackPrompt += `\n`;
    }

    if (coherenceResult.strengths.length > 0) {
      feedbackPrompt += `✅ KEEP THESE ASPECTS (they worked well):\n`;
      coherenceResult.strengths.forEach((strength, index) => {
        feedbackPrompt += `${index + 1}. ${strength}\n`;
      });
      feedbackPrompt += `\n`;
    }

    feedbackPrompt += `🎯 CRITICAL REQUIREMENTS FOR NEW RESPONSE:\n`;
    feedbackPrompt += `1. Address ALL character voice issues listed above\n`;
    feedbackPrompt += `2. Fix ALL context coherence problems\n`;
    feedbackPrompt += `3. Maintain the same core intent as the original response\n`;
    feedbackPrompt += `4. Ensure response directly relates to current quest/context\n`;
    feedbackPrompt += `5. Stay consistent with character personality and motivations\n\n`;

    feedbackPrompt += `Generate a NEW, IMPROVED response that passes both character voice and coherence validation:\n\nRESPONSE:`;

    return feedbackPrompt;
  }

  private analyzeConversationPattern(previousMessages: DialogContext[]): {
    type: string;
    suggestion: string;
  } {
    const messageTypes = previousMessages.map((msg) => {
      const text = msg.text.toLowerCase();
      if (text.includes("?")) return "question";
      if (text.includes("!")) return "exclamation";
      if (text.length > 100) return "exposition";
      if (text.split(" ").length <= 5) return "short_response";
      return "statement";
    });

    const recentPattern = messageTypes.slice(-3).join("-");

    const patternSuggestions: Record<string, string> = {
      "question-question-question": "Provide a definitive answer to break the questioning cycle",
      "short_response-short_response-short_response":
        "Add more detail and depth to move conversation forward",
      "exposition-exposition-exposition": "Use a shorter, more direct response to vary pacing",
      "statement-statement-statement": "Ask a question to re-engage and create interaction",
      "exclamation-exclamation-exclamation": "Lower the intensity with a calmer response",
    };

    const suggestion = patternSuggestions[recentPattern] || "Respond naturally based on content";
    const dominantType = this.getMostFrequent(messageTypes);

    return {
      type: `${dominantType}-heavy conversation with recent pattern: ${recentPattern}`,
      suggestion,
    };
  }

  private calculateVariance(numbers: number[]): number {
    const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
    const squaredDiffs = numbers.map((n) => Math.pow(n - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;
  }

  private getMostFrequent(array: string[]): string {
    const frequency: Record<string, number> = {};
    array.forEach((item) => (frequency[item] = (frequency[item] || 0) + 1));
    return Object.keys(frequency).reduce((a, b) => (frequency[a] > frequency[b] ? a : b));
  }

  private buildIsolatedNodeContext(tagContent: string, characterInfo: string): string {
    const isolatedNodePrompt =
      this.config.systemPrompts?.isolatedNodePrompt ||
      "Create a completely original opening line for a brand new conversation.";

    return `
${tagContent}

${characterInfo}

DIALOG START - ${isolatedNodePrompt}

THIS IS A STANDALONE NODE WITH NO CONNECTIONS.
`;
  }

  private buildDialogStartContext(
    tagContent: string,
    characterInfo: string,
    next?: DialogContext[],
    importantWords?: string[]
  ): string {
    const nextMessages = next ? next.map((msg) => `→ ${msg.text}`).join("\n") : "";

    const dialogStartPrompt =
      this.config.systemPrompts?.dialogStartPrompt ||
      "Create an opening line for a new conversation.";

    return `
${tagContent}

${characterInfo}

DIALOG START - ${dialogStartPrompt}

NEXT POSSIBLE RESPONSES:
${nextMessages || "[Open ended response]"}

IMPORTANT WORDS TO NATURALLY INCLUDE (if appropriate):
${importantWords?.join(", ") || ""}
`;
  }

  private buildContinuationContext(
    tagContent: string,
    characterInfo: string,
    previous?: DialogContext[],
    next?: DialogContext[],
    importantWords?: string[]
  ): string {
    const previousMessage =
      previous && previous.length > 0 ? previous[previous.length - 1].text : "";


    const contextWindow = previous ? Math.min(7, Math.max(3, previous.length >= 7 ? 7 : 5)) : 0;
    const previousContext =
      previous && previous.length > 0
        ? previous
            .slice(-contextWindow)
            .map((msg) => `[${msg.type.toUpperCase()}]: ${msg.text}`)
            .join("\n")
        : "";

    const nextMessages = next ? next.map((msg) => `→ ${msg.text}`).join("\n") : "";

    const continuationPrompt =
      this.config.systemPrompts?.continuationPrompt ||
      "Respond directly to the last message and create a natural transition to one of the next responses.";

    return `
${tagContent}

${characterInfo}

CONVERSATION CONTEXT:

PREVIOUS MESSAGES:
${previousContext}

LAST MESSAGE: ${previousMessage}
↓
YOU ARE CREATING A RESPONSE
↓
NEXT POSSIBLE RESPONSES:
${nextMessages || "[Open ended response]"}

IMPORTANT WORDS TO NATURALLY INCLUDE (if appropriate):
${importantWords?.join(", ") || ""}

${continuationPrompt}
`;
  }

  async generateDialog(
    type: DialogNodeType,
    context: GenerateContext,
    forceValidation: boolean = false,
    customSystemPrompt?: string,
    ignoreConnections?: boolean
  ): Promise<string> {
    const nodeType = context.current?.type || type;

    if (nodeType === "subgraphNode") {
      logger.warn("[DIALOG:SUBGRAPH] AI generation is not supported for subgraph nodes");
      throw new Error(
        "AI generation is not supported for subgraph nodes. Subgraphs are containers that group other nodes."
      );
    }

    logger.dialogLog(
      "params",
      `generateDialog called - type: ${type}, nodeType: ${nodeType}, ignoreConnections: ${ignoreConnections}`
    );
    logger.dialogLog(
      "context",
      `Context current: ${context.current?.nodeId}, text: ${context.current?.text?.substring(0, 20)}...`
    );
    logger.dialogLog(
      "context",
      `Previous nodes: ${context.previous?.length || 0}, Next nodes: ${context.next?.length || 0}`
    );

    if (context.current?.tags) {
      const tags = Array.isArray(context.current.tags) ? context.current.tags : [];
      logger.dialogLog("tags", `Node tags (${tags.length}): ${JSON.stringify(tags)}`);

      if (tags.length > 0) {
        logger.dialogLog("tags", `Detailed tag information:`);
        tags.forEach((tag, index) => {
          if (typeof tag === "string") {
            logger.dialogLog("tags", `  - Tag ${index + 1}: ${tag} (string)`);
          } else {
            logger.dialogLog(
              "tags",
              `  - Tag ${index + 1}: id=${tag.id}, label=${tag.label}, type=${tag.type}`
            );
          }
        });

        const tagContent = this.formatTagContent(tags);
        logger.dialogLog("tags", `Tag content to be added to prompt:\n${tagContent}`);
      }
    } else {
      logger.dialogLog("tags", `No tags found for this node.`);
    }

    if (ignoreConnections !== undefined) {
      logger.dialogLog(
        "trace",
        `Transferring ignoreConnections parameter to context: ${ignoreConnections}`
      );
      context.ignoreConnections = ignoreConnections;

      logger.dialogLog(
        "trace",
        `Called generateDialog - NodeID: ${context.current?.nodeId}, NodeType: ${nodeType}, IgnoreConnections: ${ignoreConnections}`
      );

      const connectedMsg = ignoreConnections
        ? "Isolated (no connections)"
        : "Connected (with context)";
      const sourceMsg = context.current?.nodeId ? `Node: ${context.current.nodeId}` : "Panel";

      logger.dialogLog("trace", `Generation mode: ${connectedMsg}, Source: ${sourceMsg}`);

      if (ignoreConnections) {
        logger.dialogLog(
          "generation",
          `IgnoreConnections ON - Content-based generation only for node type ${nodeType}: ${context.current?.nodeId}`
        );
      } else {
        if (context.current?.nodeId && ignoreConnections === false) {
          logger.dialogLog(
            "generation",
            `Generation for node ${context.current.nodeId} with regenerateFromHere mode (connected))`
          );
        } else {
          logger.dialogLog(
            "generation",
            `Generation source: ${ignoreConnections ? "Panel (Isolated)" : "Node (Connected)"}`
          );
        }
      }
    }

    logger.dialogLog(
      "stack",
      `Dialog generation requested through: ${new Error().stack?.split("\n").slice(2, 5).join("\n    ")}`
    );

    const hasSufficientContext = forceValidation || this.validateContext(nodeType, context);
    if (!hasSufficientContext) {
      logger.warn("Insufficient context for dialog generation");
      return this.formatError(
        ErrorType.VALIDATION_ERROR,
        `Insufficient context: Missing required context information for node type ${nodeType}`
      );
    }

    const isIsolatedNode =
      (!context.previous || context.previous.length === 0) &&
      (!context.next || context.next.length === 0);

    let basicPrompt = this.buildPromptForContext(nodeType, context, customSystemPrompt);

    let relatedResponses: string[] = [];

    if (!context.ignoreConnections) {
    if (context.siblingNodes && context.siblingNodes.length > 0) {
      relatedResponses = context.siblingNodes
        .filter((node) => node.text && typeof node.text === 'string')
        .map((node) => node.text);
    }

    if (context.dialogChain) {
      const dialogChainSiblings = context.dialogChain.next
        .filter((node) => node.type === nodeType && node.id !== (context.current?.nodeId || ""))
        .filter((node) => node.data.text && typeof node.data.text === 'string')
        .map((node) => node.data.text);

      const previousSimilarResponses = context.dialogChain.previous
        .filter((node) => node.type === nodeType)
        .filter((node) => node.data.text && typeof node.data.text === 'string')
        .map((node) => node.data.text);

      relatedResponses = [
        ...new Set([...relatedResponses, ...dialogChainSiblings, ...previousSimilarResponses]),
      ];
      }
    }

    if (relatedResponses.length > 0) {
      logger.dialogLog(
        "diversity",
        `Found ${relatedResponses.length} related responses to avoid duplication`
      );

      const diversityPrompt = this.config.systemPrompts?.diversityPrompt;

      if (!diversityPrompt) {
        logger.error("DIVERSITY", "CRITICAL: No diversity prompt found in config - this should never happen!");
        throw new Error("Diversity prompt missing from config");
      }

      logger.dialogLog("diversity", "Using strong 17-point config diversity prompt");

      basicPrompt += `

EXISTING RESPONSES (FOR CONTEXT):
${relatedResponses.map((text, i) => `${i + 1}. "${text}"`).join("\n")}

DIVERSITY GUIDANCE (these are guidelines, natural in-character dialog is still the priority):
${diversityPrompt}

Your response should feel clearly distinct in wording, tone, and approach when placed next to these, while remaining consistent with the story and character.
`;

      const existingStartWords = new Set<string>();
      relatedResponses.forEach((text) => {
        if (!text || typeof text !== 'string') return; // SAFETY: Skip undefined/invalid
        const firstWord = text.trim().split(" ")[0];
        if (firstWord) existingStartWords.add(firstWord.toLowerCase());
      });

      if (existingStartWords.size > 0) {
        basicPrompt += `\nTry not to start your response with these exact opening words: ${Array.from(
          existingStartWords
        ).join(", ")}`;
      }
    }

    try {
      const promptFirstLine = basicPrompt.split("\n")[0];
      const promptLines = basicPrompt.split("\n").length;
      logger.dialogLog("generation", `Generating: ${promptFirstLine}... (${promptLines} lines)`);

      logger.dialogLog(
        "api",
        `API: ${this.config.baseUrl}/api/generate | Model: ${this.config.model}`
      );

      const options: DialogGenerationOptions = (() => {
        const baseTemp = parseFloat(String(this.config.temperature || 0.7));

        if (isIsolatedNode) {
          return {
            temperature: Math.max(baseTemp, 0.8), // At least 0.8 for isolated nodes
            top_p: 0.9,
            top_k: 70,
            max_tokens: 256,
          };
        } else if (nodeType === "playerResponse") {
          const diversityBoost = relatedResponses.length > 0 ? 0.1 : 0;
          return {
            temperature: Math.min(baseTemp + 0.1, baseTemp - 0.05 + diversityBoost),
            top_p: 0.9,
            top_k: Math.min(160, 80 + relatedResponses.length * 20),
            max_tokens: 256,
          };
        } else {
          const isEnemy = nodeType === "enemyDialog";
          return {
            temperature: isEnemy ? baseTemp * 0.85 : baseTemp,
            top_p: 0.9,
            top_k: isEnemy ? 30 : 40,
            max_tokens: 256,
          };
        }
      })();

      logger.dialogLog(
        "parameters",
        `Parameters: temp=${options.temperature}, top_p=${options.top_p}, tokens=${options.max_tokens}`
      );

      const result = await this.makeOllamaRequest(basicPrompt, options, context.current?.nodeId);

      const validatedResult = await this.validateAndRefineResponse(result, context, nodeType);

      if (context.dialogChain) {
        if (isIsolatedNode) {
          const modifiedChain = {
            ...context.dialogChain,
            current: {
              ...context.dialogChain.current,
              data: {
                ...context.dialogChain.current.data,
                text: "[Content hidden for recreation]",
              },
            },
          };
          this.logDialogGeneration(modifiedChain, result);
        } else {
          this.logDialogGeneration(context.dialogChain, result);
        }
      }

      let finalText = validatedResult
        .replace(/^["']|["']$/g, "")
        .replace(/^"|"$/g, "")
        .replace(/^'|'$/g, "")
        .trim();

      if (
        (nodeType === "playerResponse" ||
          nodeType === "npcDialog" ||
          nodeType === "characterDialogNode") &&
        relatedResponses.length > 0
      ) {
        if (this.isTextSimilarToExisting(finalText, relatedResponses)) {
          logger.dialogLog(
            "diversity",
            `Similar to existing ${nodeType} - forcing differentiation`
          );

          const forcedDifferentiationPrompt =
            this.config.systemPrompts?.forcedDifferentiationPrompt ||
            `Generate a COMPLETELY DIFFERENT response with a TOTALLY DIFFERENT approach and tone.
Use different vocabulary, sentence structure, and perspective.
Avoid ANY phrasing, structure or vocabulary that exists in these responses:`;

          const enhancedPrompt = `
${basicPrompt}

CRITICAL: Your previous response was too similar to existing ones! 
${forcedDifferentiationPrompt}
${relatedResponses.join("\n")}

GENERATE A FRESH, UNIQUE RESPONSE WITH DIFFERENT TONE AND STRUCTURE:`;

          const baseTemp = parseFloat(String(this.config.temperature || 0.7));
          const diversityBoost = parseFloat(String(this.config.diversityBoost || 0.5));
          const diversityTemp = Math.min(2.0, baseTemp + diversityBoost);

          const enhancedResult = await this.makeOllamaRequest(enhancedPrompt, {
            ...options,
            temperature: diversityTemp,
            top_p: 0.95,
            top_k: 100,
          }, context.current?.nodeId);

          const enhancedText = enhancedResult
            .replace(/^["']|["']$/g, "")
            .replace(/^"|"$/g, "")
            .replace(/^'|'$/g, "")
            .trim();

          this.addToHistory(
            enhancedPrompt,
            "recreate",
            enhancedText,
            !enhancedText.includes("[ERROR]"),
            context.current?.nodeId || "unknown"
          );
          return enhancedText;
        }
      }

      this.addToHistory(
        basicPrompt,
        "recreate",
        finalText,
        !finalText.includes("[ERROR]"),
        context.current?.nodeId || "unknown"
      );
      if (!finalText || finalText.trim().length < 3) {
        logger.warn(
          `[generateDialog] Empty or too short response received (length: ${finalText?.length || 0}). Retrying...`
        );
        
        try {
          const retryOptions: DialogGenerationOptions = {
            ...options,
            temperature: Math.min(0.9, (options.temperature || 0.8) + 0.1),
          };

          const retryResult = await this.makeOllamaRequest(basicPrompt, retryOptions, context.current?.nodeId);
          const retryValidated = await this.validateAndRefineResponse(retryResult, context, nodeType);
          
          finalText = retryValidated
            .replace(/^["']|["']$/g, "")
            .replace(/^"|"$/g, "")
            .replace(/^'|'$/g, "")
            .trim();
          
          if (!finalText || finalText.trim().length < 3) {
            logger.error("[generateDialog] Retry also failed - returning error message");
            return this.formatError(
              ErrorType.GENERATION_ERROR,
              "Failed to generate dialog content. Please try again."
            );
          }
        } catch (retryError) {
          logger.error("[generateDialog] Retry failed:", retryError);
          return this.formatError(
            ErrorType.GENERATION_ERROR,
            "Failed to generate dialog content. Please try again."
          );
        }
      }

      return finalText;
    } catch (error) {
      logger.error("Error generating dialog:", error);
      return this.formatError(
        ErrorType.GENERATION_ERROR,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  private isTextSimilarToExisting(generatedText: string, existingTexts: string[]): boolean {
    if (!generatedText) return false;

    const normalizedGenerated = generatedText.toLowerCase().trim();
    const normalizedExisting = existingTexts
      .filter((text) => text && typeof text === 'string')
      .map((text) => text.toLowerCase().trim());

    const firstWords = normalizedGenerated.split(" ").slice(0, 3).join(" ");
    if (normalizedExisting.some((text) => text.startsWith(firstWords) && firstWords.length > 8)) {
      return true;
    }

    for (const existingText of normalizedExisting) {
      const generatedWords = new Set(normalizedGenerated.split(/\s+/));
      const existingWords = new Set(existingText.split(/\s+/));

      let commonWords = 0;
      for (const word of generatedWords) {
        if (word.length > 3 && existingWords.has(word)) {
          commonWords++;
        }
      }

      const similarityRatio = commonWords / Math.min(generatedWords.size, existingWords.size);

      if (similarityRatio > 0.3) {
        return true;
      }

      const generatedPhrases = this.extractPhrases(normalizedGenerated);
      const existingPhrases = this.extractPhrases(existingText);

      for (const phrase of generatedPhrases) {
        if (phrase.length > 6 && existingPhrases.includes(phrase)) {
          return true;
        }
      }
    }

    return false;
  }

  private extractPhrases(text: string): string[] {
    const words = text.split(/\s+/);
    const phrases: string[] = [];

    for (let i = 0; i < words.length - 1; i++) {
      phrases.push(`${words[i]} ${words[i + 1]}`);
    }

    for (let i = 0; i < words.length - 2; i++) {
      phrases.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    }

    return phrases;
  }

  updateConfig(newConfig: Partial<ImportedOllamaConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
      systemPrompts: {
        ...this.config.systemPrompts,
        ...(newConfig.systemPrompts || {}),
      },
    };
    this.persistConfig(this.config);
  }

  getConfig(): ImportedOllamaConfig {
    return { ...this.config };
  }

  private validateContext(nodeType: DialogNodeType, context: GenerateContext): boolean {
    logger.validationLog(`Validating context for nodeType: ${nodeType}`);

    const contextProps: ContextProperties = {
      hasCurrentNode: !!context.current,
      hasPrevious: !!context.previous && context.previous.length > 0,
      hasNext: !!context.next && context.next.length > 0,
      hasConversationHistory: !!context.conversationHistory,
      hasDialogChain: !!context.dialogChain,
      hasCharacterInfo: !!context.characterInfo,
      hasTags: !!context.current?.tags && context.current.tags.length > 0,
    };

    logger.validationLog(`Context properties: ${JSON.stringify(contextProps)}`);

    const isLikelyStartingNode = !contextProps.hasPrevious && !contextProps.hasConversationHistory;

    switch (nodeType) {
      case "npcDialog":
        if (!contextProps.hasCurrentNode) {
          logger.warn("[DIALOG] Invalid npcDialog context: missing current node");
          return false;
        }
        if (!contextProps.hasPrevious && !isLikelyStartingNode) {
          logger.warn("[DIALOG] Warning: npcDialog without previous context (not a starting node)");
        }
        break;
      case "playerResponse":
        if (!contextProps.hasCurrentNode) {
          logger.warn("[DIALOG] Invalid playerResponse context: missing current node");
          return false;
        }
        if (!contextProps.hasPrevious && !isLikelyStartingNode) {
          logger.warn("[DIALOG] Warning: playerResponse without previous context");
        }
        break;
      case "narratorNode":
        if (!contextProps.hasCurrentNode) {
          logger.warn("[DIALOG] Invalid narratorNode context: missing current node data");
          return false;
        }
        break;
      case "characterDialogNode":
        if (!contextProps.hasCurrentNode) {
          logger.warn("[DIALOG] Invalid characterDialogNode context: missing current node");
          return false;
        }
        if (!contextProps.hasPrevious && !isLikelyStartingNode) {
          logger.warn("[DIALOG] Warning: characterDialogNode without previous context");
        }
        break;
      default:
        logger.dialogLog("validation", `No specific context validation for node type: ${nodeType}`);
        break;
    }

    logger.dialogLog("validation", `Context validation passed for ${nodeType}`);
    return true;
  }

  private cleanQuotes(text: string): string {
    if (!text) return "";

    return text
      .trim()
      .replace(/^["']|["']$/g, "")
      .replace(/^"|"$/g, "")
      .replace(/^'|'$/g, "")
      .replace(/^["""]|["""]$/g, "")
      .replace(/^['']|['']$/g, "")
      .trim();
  }

  private containsErrorPattern(text: string): boolean {
    const actualErrorPatterns = [
      /I need (more|additional) context/i,
      /I don't have (enough|sufficient) (context|information)/i,
      /Please provide (me with )?(the|more) context/i,
      /I can't (generate|create|provide) (a|an) (response|answer)/i,
      /I apologize, but I (need|require)/i,
      /As an AI language model/i,
      /I am an AI/i,
    ];

    if (actualErrorPatterns.some((pattern) => pattern.test(text))) {
      return true;
    }

    if (text.includes("?")) {
      return false;
    }

    if (/^[A-Z][^.!?]*[.!]$/.test(text)) {
      return false;
    }

    if (/^(Yes|No)\.?$/.test(text.trim())) {
      return false;
    }

    if (text.length < 2) {
      return true;
    }

    return false;
  }

  private cleanGeneratedText(text: string): string {
    if (!text) return "";

    let cleaned = this.cleanQuotes(text);

    cleaned = this.cleanAIFormattingTags(cleaned);

    cleaned = this.cleanQuotes(cleaned);

    if (this.containsErrorPattern(cleaned)) {
      logger.warn("Generated text contains error pattern:", cleaned);
      return this.formatError(ErrorType.GENERATION_ERROR, cleaned);
    }

    return this.cleanQuotes(cleaned);
  }

  private cleanAIFormattingTags(text: string): string {
    if (!text) return text;

    let cleaned = text
      .replace(/\[NPCDIALOG\]\s*/gi, "")
      .replace(/\[PLAYERDIALOG\]\s*/gi, "")
      .replace(/\[CHARACTERDIALOG\]\s*/gi, "")
      .replace(/\[NARRATORDIALOG\]\s*/gi, "")
      .replace(/\[SCENEDESCRIPTION\]\s*/gi, "")
      .replace(/\[PLAYERCHOICE\]\s*/gi, "")
      .replace(/\[ENEMYDIALOG\]\s*/gi, "")
      .trim();

    return cleaned;
  }

  private cleanCustomPromptText(text: string): string {
    if (!text) return "";

    let cleaned = this.cleanQuotes(text)
      .replace(/^```[\s\n]*|```[\s\n]*$/g, "")
      .replace(/^CHARACTER:?\s*/i, "")
      .replace(/^\[.*?\]:\s*/i, "")
      .trim();

    const sentences = cleaned.match(/[^.!?]+[.!?]+/g) || [cleaned];
    if (sentences.length > 2) {
      cleaned = sentences.slice(0, 2).join(" ").trim();
    }

    if (!cleaned) {
      return this.formatError(ErrorType.GENERATION_ERROR, `Generated text is empty`);
    }

    return cleaned;
  }

  private extractImportantWords(messages: DialogContext[]): string[] {
    const allText = messages.map((msg) => msg.text).join(" ");

    const resultSet = new Set<string>();

    const capitalizedWords = allText.match(/\b[A-Z][a-zA-Z]*\b/g) || [];
    capitalizedWords.forEach((word) => resultSet.add(word));

    const importantKeywords = [
      "trouble",
      "problem",
      "danger",
      "secret",
      "mission",
      "quest",
      "key",
      "important",
      "critical",
      "urgent",
      "help",
      "fear",
    ];

    importantKeywords.forEach((word) => {
      if (allText.toLowerCase().includes(word)) {
        resultSet.add(word);
      }
    });

    return Array.from(resultSet);
  }

  private getSystemPromptForNodeType(nodeType: string, projectType?: ProjectType): string {
    if (!this.config.systemPrompts) {
      return "";
    }

    if (
      projectType &&
      this.config.systemPrompts.projectTypes &&
      this.config.systemPrompts.projectTypes[projectType]
    ) {
      const projectPrompts = this.config.systemPrompts.projectTypes[projectType];
      if (projectPrompts && nodeType in projectPrompts) {
        const prompt = (projectPrompts as any)[nodeType];
        if (prompt) return prompt;
      }

      if (projectPrompts.general) {
        return projectPrompts.general;
      }
    }

    if (nodeType in this.config.systemPrompts) {
      const prompt = (this.config.systemPrompts as any)[nodeType];
      if (prompt) return prompt;
    }

    return this.config.systemPrompts.general || "";
  }

  async improveDialog(
    nodeType: DialogNodeType,
    context: GenerateContext,
    currentText: string,
    ignoreConnections?: boolean
  ): Promise<string> {
    try {
      if (ignoreConnections !== undefined) {
        context.ignoreConnections = ignoreConnections;
        logger.dialogLog(
          "improvement",
          `Improvement source: ${ignoreConnections ? "Panel (Isolated)" : "Node (Connected)"}`
        );
      }

      logger.dialogLog("improvement", "Improving existing dialog:", currentText);

      const hasSufficientContext = this.validateContext(nodeType, context);
      if (!hasSufficientContext) {
        logger.warn("Insufficient context for dialog improvement");
        return this.formatError(
          ErrorType.VALIDATION_ERROR,
          `Insufficient context: Missing required context for dialog improvement of node type ${nodeType}`
        );
      }

      const prompt = this.buildImprovePrompt(nodeType, context, currentText);

      const result = await this.makeOllamaRequest(prompt, {
        temperature: 0.75,
        timeout: 20000, // Increased for large models in improve mode
      }, context.current?.nodeId);

      if (!result || result.includes("[HATA]")) {
        logger.warn("Improved text had errors");
        return this.formatError(ErrorType.GENERATION_ERROR, `Error in generated text`);
      }

      logger.dialogLog("improvement", "Improved text:", result);

      this.addToHistory(
        prompt,
        "improve",
        result,
        !result.includes("[HATA]"),
        context.current?.nodeId || "unknown"
      );
      return result;
    } catch (error) {
      logger.error("Error improving dialog:", error);
      return this.formatError(
        ErrorType.GENERATION_ERROR,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  private buildImprovePrompt(
    nodeType: DialogNodeType,
    context: GenerateContext,
    currentText: string
  ): string {
    const systemPrompt = this.getSystemPromptForNodeType(nodeType, context.projectType);
    let contextInfo = "";

    if (context.current) {
      const previousContext =
        context.previous && context.previous.length > 0
          ? context.previous
              .slice(-3)
              .map((msg) => `[${msg.type.toUpperCase()}]: ${msg.text}`)
              .join("\n")
          : "No previous messages";

      const nextMessages =
        context.next && context.next.length > 0
          ? context.next.map((msg) => `→ ${msg.text}`).join("\n")
          : "No next messages";

      const tagContent =
        context.current.tags && context.current.tags.length > 0
          ? this.formatTagContent(context.current.tags)
          : "";

      contextInfo = `
CONVERSATION CONTEXT:

PREVIOUS MESSAGES:
${previousContext}

CURRENT NODE (${nodeType.toUpperCase()}): "${currentText}"

NEXT POSSIBLE RESPONSES:
${nextMessages}

${tagContent}

CHARACTER INFO:
${context.characterInfo || "No character info available"}
`;
    }

    const improvementPrompt =
      this.config.systemPrompts?.improvementPrompt ||
      "Improve the text while maintaining the same meaning and intent.";

    return `
${systemPrompt}

${contextInfo}

INSTRUCTIONS:
${improvementPrompt}`;
  }

  async regenerateNodeText(
    node: DialogNode,
    allNodes: DialogNode[],
    connections: any[],
    ignoreConnections: boolean = false
  ): Promise<string> {
    try {
      const normalizedConnections = this.normalizeConnections(connections);
      const { previousNodes, nextNodes, siblingNodes } = ignoreConnections
        ? { previousNodes: [], nextNodes: [], siblingNodes: [] }
        : this.buildNodeContext(node, allNodes, normalizedConnections);

      const characterInfo = this.buildCharacterInfo(node, previousNodes, nextNodes);
      const context: GenerateContext = {
        current: {
          nodeId: node.id,
          type: node.type,
          text: node.data.text,
          tags: node.data.metadata?.nodeData?.tags || [],
        },
        previous: previousNodes,
        next: nextNodes,
        siblingNodes,
        characterInfo,
        ignoreConnections,
      };

      return await this.generateDialog(node.type, context);
    } catch (error) {
      logger.error("Error regenerating node text:", error);
      throw error;
    }
  }

  private normalizeConnections(connections: any[]): { source: string; target: string }[] {
    return connections.map((conn) => {
      if ("sourceId" in conn && "targetId" in conn) {
        return { source: conn.sourceId, target: conn.targetId };
      }
      return conn;
    });
  }

  private buildNodeContext(
    node: DialogNode,
    allNodes: DialogNode[],
    connections: { source: string; target: string }[]
  ): {
    previousNodes: DialogContext[];
    nextNodes: DialogContext[];
    siblingNodes: DialogContext[];
  } {
    const previousNodes: DialogContext[] = [];
    const nextNodes: DialogContext[] = [];
    const siblingNodes: DialogContext[] = [];
    const visitedPrev = new Set<string>();
    const visitedNext = new Set<string>();

    this.findPreviousNodes(node.id, allNodes, connections, previousNodes, visitedPrev);

    this.findNextNodes(node.id, allNodes, connections, nextNodes, visitedNext);

    this.findSiblingNodes(node, allNodes, connections, siblingNodes);

    return { previousNodes, nextNodes, siblingNodes };
  }

  private findPreviousNodes(
    nodeId: string,
    allNodes: DialogNode[],
    connections: { source: string; target: string }[],
    result: DialogContext[],
    visited: Set<string>
  ): void {
    const queue: { id: string; depth: number }[] = [{ id: nodeId, depth: 0 }];

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;

      if (depth === 0) {
        visited.add(id);

        connections
          .filter((conn) => conn.target === id)
          .forEach((conn) => {
            if (!visited.has(conn.source)) {
              queue.push({ id: conn.source, depth: depth + 1 });
            }
          });

        continue;
      }

      if (depth > 3 || result.length >= 5) break;
      visited.add(id);

      const prevNode = allNodes.find((n) => n.id === id);
      if (prevNode) {
        result.unshift(
          createSafeDialogContext(
            prevNode.id,
            prevNode.type,
            prevNode.data.text,
            prevNode.data.metadata?.tags
          )
        );

        connections
          .filter((conn) => conn.target === id)
          .forEach((conn) => {
            if (!visited.has(conn.source)) {
              queue.push({ id: conn.source, depth: depth + 1 });
            }
          });
      }
    }
  }

  private findNextNodes(
    nodeId: string,
    allNodes: DialogNode[],
    connections: { source: string; target: string }[],
    result: DialogContext[],
    visited: Set<string>
  ): void {
    const queue: { id: string; depth: number }[] = [{ id: nodeId, depth: 0 }];

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;

      if (depth === 0) {
        visited.add(id);

        connections
          .filter((conn) => conn.source === id)
          .forEach((conn) => {
            if (!visited.has(conn.target)) {
              queue.push({ id: conn.target, depth: depth + 1 });
            }
          });

        continue;
      }

      if (depth > 3 || result.length >= 5) break;
      visited.add(id);

      const nextNode = allNodes.find((n) => n.id === id);
      if (nextNode) {
        result.push(
          createSafeDialogContext(
            nextNode.id,
            nextNode.type,
            nextNode.data.text,
            nextNode.data.metadata?.tags
          )
        );

        connections
          .filter((conn) => conn.source === id)
          .forEach((conn) => {
            if (!visited.has(conn.target)) {
              queue.push({ id: conn.target, depth: depth + 1 });
            }
          });
      }
    }
  }

  private buildCharacterInfo(
    node: DialogNode,
    previousNodes: DialogContext[],
    nextNodes: DialogContext[]
  ): string {
    if (
      previousNodes.length === 0 &&
      (!node.data.metadata?.tags || node.data.metadata.tags.length === 0)
    ) {
      return "";
    }

    try {
      const dialogChainForContext = {
        previous: previousNodes.map((n) => ({
          id: n.nodeId,
          type: n.type,
          text: n.text,
          tags: stringsToTags(n.tags),
        })),
        current: {
          id: node.id,
          type: node.type,
          text: node.data.text,
          tags: stringsToTags(node.data.metadata?.tags),
        },
        next: nextNodes.map((n) => ({
          id: n.nodeId,
          type: n.type,
          text: n.text,
          tags: stringsToTags(n.tags),
        })),
      };

      return getCharacterContextUtil(dialogChainForContext);
    } catch (error) {
      logger.warn("Error getting character context:", error);
      return "";
    }
  }

  private logDialogGeneration(chain: DialogChain | undefined, generatedText: string): void {
    if (!chain) return;

    const { previous, current, next } = chain;
    const cleanedGeneratedText = this.cleanGeneratedText(generatedText);
    const firstSentence = cleanedGeneratedText.split(".")[0] + ".";

    logger.dialogLog("generation", `${current.type}: ${firstSentence}`);

    if (previous.length > 0) {
      logger.dialogLog(
        "context",
        `Previous: ${previous.map((p) => `[${p.type}] ${p.data.text.split(".")[0]}.`).join(", ")}`
      );
    }

    if (next.length > 0) {
      logger.dialogLog(
        "context",
        `Next: ${next.map((n) => `[${n.type}] ${n.data.text.split(".")[0]}.`).join(", ")}`
      );
    }

    try {
      const nodeType = current.type;
      const projectType = "game" as ProjectType;

      const systemPrompt = this.getSystemPromptForNodeType(nodeType, projectType);

      let promptType = `${projectType}/${nodeType}`;

      if (systemPrompt && typeof systemPrompt === "string") {
        const summaryLines = systemPrompt.split("\n").slice(0, 3);
        const summaryPrompt = summaryLines.join("\n");
        logger.dialogLog("system", `System [${promptType}]:\n${summaryPrompt}...`);
      } else {
        logger.dialogLog("system", `System [${promptType}]: No prompt found`);
      }
    } catch (error) {
      logger.dialogLog("system", `Error retrieving prompt for ${current.type}`);
    }
  }

  private addToHistory(
    prompt: string,
    type: "improve" | "recreate" | "custom",
    result: string,
    success: boolean,
    nodeId: string
  ): void {
    const tokensUsed = this.estimateTokenCount(prompt) + this.estimateTokenCount(result);

    const newItem: AIHistoryItem = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      nodeId,
      prompt,
      timestamp: Date.now(),
      result,
      success,
      type,
      metadata: {
        executionTime: Date.now() - this.lastRequestTime,
        tokensUsed,
      },
    };

    useHistoryStore.getState().addAIHistory(newItem);
  }

  private estimateTokenCount(text: string): number {
    if (!text) return 0;

    return Math.ceil(text.split(/\s+/).length * 1.3);
  }

  subscribeToHistory(callback: HistoryCallback): () => void {
    logger.throttledLog("history", "History subscription using historyStore");
    return useHistoryStore.getState().subscribeToAIHistory(callback);
  }

  clearHistory(): void {
    logger.throttledLog("history", "Clearing all AI history via historyStore");
    useHistoryStore.getState().clearAIHistory();
  }

  async generateWithCustomPrompt(
    nodeType: DialogNodeType,
    context: GenerateContext,
    customPrompt: string,
    customSystemPrompt?: string,
    ignoreConnections?: boolean,
    skipContextValidation?: boolean
  ): Promise<string> {
    logger.debug(`[DIALOG] generateWithCustomPrompt called with:`, {
      nodeType,
      customPrompt: customPrompt.substring(0, 100) + "...",
      customSystemPrompt: customSystemPrompt
        ? customSystemPrompt.substring(0, 100) + "..."
        : undefined,
      ignoreConnections,
      skipContextValidation,
    });
    
    logger.debug(`[DIALOG] Current config:`, {
      model: this.config.model,
      baseUrl: this.config.baseUrl,
      hasModel: !!this.config.model,
      hasBaseUrl: !!this.config.baseUrl,
    });
    
    try {
      if (!this.config.model || !this.config.baseUrl) {
        logger.error(`[DIALOG] Missing configuration: model=${this.config.model}, baseUrl=${this.config.baseUrl}`);
        return this.formatError(
          ErrorType.API_ERROR,
          `Ollama service not properly configured. Please select a model in Settings.`
        );
      }
      
      logger.debug(`[DIALOG] isAvailable: ${this.isAvailable}, proceeding anyway`);

      logger.dialogLog("custom", `Generating with custom prompt for ${nodeType}`);

      if (!skipContextValidation) {
        const hasValidContext = this.validateContext(nodeType, context);
        if (!hasValidContext) {
          logger.dialogLog(
            "validation",
            `Insufficient context for dialog generation with custom prompt`
          );
          return this.formatError(
            ErrorType.VALIDATION_ERROR,
            `Insufficient context: Missing required context information for node type ${nodeType}`
          );
        }
      } else {
        logger.dialogLog("validation", "Skipping context validation as requested.");
      }

      let systemPromptToUse: string;
      
      try {
        if (customSystemPrompt) {
          systemPromptToUse = customSystemPrompt;
        } else {
          logger.debug(`[DIALOG] Getting system prompt for ${nodeType}, projectType: ${context.projectType}`);
          systemPromptToUse = this.getSystemPromptForNodeType(nodeType, context.projectType);
          logger.debug(`[DIALOG] getSystemPromptForNodeType returned:`, {
            hasResult: !!systemPromptToUse,
            length: systemPromptToUse?.length || 0,
          });
        }
      } catch (error) {
        logger.error(`[DIALOG] Error getting system prompt for ${nodeType}:`, error);
        systemPromptToUse = "";
      }
      
      logger.debug(`[DIALOG] System prompt for ${nodeType}:`, {
        hasCustomSystemPrompt: !!customSystemPrompt,
        hasSystemPrompt: !!systemPromptToUse,
        systemPromptLength: systemPromptToUse?.length || 0,
      });
      
      if (!systemPromptToUse && nodeType !== "customNode") {
        systemPromptToUse = this.config.systemPrompts?.general || 
          "You are a creative assistant generating content for a dialog system. Generate natural, engaging content that fits the context.";
        logger.dialogLog("custom", `Using fallback system prompt for node type: ${nodeType}`);
      }
      
      if (!systemPromptToUse) {
        logger.error(`[DIALOG] No system prompt available for node type: ${nodeType}`);
        return this.formatError(
          ErrorType.VALIDATION_ERROR,
          `No system prompt configured for node type: ${nodeType}`
        );
      }

      let contextInfo = "";

      if (nodeType === "customNode") {
        logger.dialogLog("context", "Using simplified context for customNode");

        contextInfo = `
CONTEXT INFORMATION:
--------------------------${
          context.previous && context.previous.length > 0
            ? `
PREVIOUS CONTEXT:
${context.previous
  .slice(-2)
  .map((msg) => msg.text)
  .join("\n")}`
            : ""
        }${
          context.next && context.next.length > 0
            ? `
POTENTIAL RELATED CONTENT:
${context.next
  .slice(0, 2)
  .map((msg) => msg.text)
  .join("\n")}`
            : ""
        }
`;
      } else {
        contextInfo = this.buildContextInfo(context);
      }

      let wrapperTemplate = "";

      if (nodeType === "customNode") {
        wrapperTemplate = `USER'S CUSTOM INSTRUCTIONS:
--------------------------
${customPrompt}

IMPORTANT:
1. Write EXACTLY what was requested in the instructions above
2. DO NOT add meta-commentary like "Okay" or "Let's do this"
3. DO NOT ask questions or add explanations
4. START IMMEDIATELY with the content specified in the instructions

YOUR RESPONSE:`;
      } else {
        wrapperTemplate =
          this.config.systemPrompts?.customPromptWrapper ||
          `USER'S CUSTOM INSTRUCTIONS:
--------------------------
{customPrompt}

IMPORTANT: Follow the custom instructions above precisely.
Generate ONLY the content requested, without any explanations or meta-commentary.
If instructed to create a song, story, or other creative content, focus on that specific format.
If instructed to create dialog, keep it concise and in the character's voice.

RESPONSE:`;
      }

      const customPromptSection =
        nodeType === "customNode"
          ? wrapperTemplate
          : wrapperTemplate.replace("{customPrompt}", customPrompt);

      logger.dialogLog("custom", "Custom prompt applied to wrapper template");

      if (nodeType === "customNode") {
        const fullPrompt = `${systemPromptToUse}\n\n${contextInfo}\n\n${customPromptSection}`;
        logger.dialogLog(
          "custom",
          `Full prompt for CustomNode (first 200 chars): ${fullPrompt.substring(0, 200)}...`
        );
      }

      const prompt = `
${systemPromptToUse}

${contextInfo}

${customPromptSection}`;

      logger.throttledLog("customPrompt", `Making Ollama request for ${nodeType}...`);
      logger.throttledLog("customPrompt", `Prompt length: ${prompt.length} chars`);
      logger.throttledLog("customPrompt", `Custom prompt: ${customPrompt.substring(0, 150)}...`);
      logger.debug(`[DIALOG] Request config:`, {
        model: this.config.model,
        baseUrl: this.config.baseUrl,
        timeout: nodeType === "customNode" ? 25000 : 20000,
      });

      let result: string;
      try {
        logger.debug(`[DIALOG] Calling makeOllamaRequest for ${nodeType}...`);
        result = await this.makeOllamaRequest(prompt, {
          temperature: 0.8,
          top_p: 0.95,
          top_k: 50,
          timeout: nodeType === "customNode" ? 25000 : 20000,
        }, context.current?.nodeId);
        logger.debug(`[DIALOG] makeOllamaRequest completed for ${nodeType}, result length: ${result?.length || 0}`);
      } catch (error) {
        logger.error(`[DIALOG] makeOllamaRequest failed for ${nodeType}:`, error);
        logger.error(`[DIALOG] Error details:`, {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        return this.formatError(
          ErrorType.GENERATION_ERROR,
          `Failed to generate content: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }

      if (!result) {
        logger.error(`[DIALOG] Empty result from makeOllamaRequest for ${nodeType}`);
        return this.formatError(
          ErrorType.GENERATION_ERROR,
          "Received empty response from AI service"
        );
      }

      logger.throttledLog("customPrompt", `Raw result: ${result.substring(0, 100)}...`);

      const cleanedText = this.cleanCustomPromptText(result);
      logger.throttledLog("customPrompt", `Cleaned result: ${cleanedText.substring(0, 100)}...`);

      const resultFirstSentence = cleanedText.split(".")[0] + ".";
      logger.throttledLog("customPrompt", `Final result: ${resultFirstSentence}`);

      this.addToHistory(prompt, "custom", cleanedText, true, context.current?.nodeId || "unknown");
      return cleanedText;
    } catch (error) {
      logger.error(`[generateWithCustomPrompt] Error for ${nodeType}:`, error);
      logger.error(
        `[generateWithCustomPrompt] Custom prompt was: ${customPrompt.substring(0, 200)}...`
      );
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error(`[generateWithCustomPrompt] Error message: ${errorMessage}`);
      return this.formatError(
        ErrorType.GENERATION_ERROR,
        `Custom prompt generation failed: ${errorMessage}`
      );
    }
  }

  async fixValidationIssue(
    issue: any,
    nodes: DialogNode[],
    connections: { sourceId: string; targetId: string }[]
  ): Promise<string> {
    try {
      logger.validationLog(
        `Fixing validation issue of type: ${issue.type} for node: ${issue.nodeId}`
      );

      const node = nodes.find((n) => n.id === issue.nodeId);
      if (!node) {
        throw new Error(`Node with ID ${issue.nodeId} not found`);
      }

      const dialogChain = findDialogPaths(issue.nodeId, nodes, connections);

      const previousNodeId =
        issue.previousNodeId ||
        (dialogChain.previous.length > 0
          ? dialogChain.previous[dialogChain.previous.length - 1].id
          : null);
      const previousNode = previousNodeId ? nodes.find((n) => n.id === previousNodeId) : null;
      const previousText = previousNode ? previousNode.data.text : "";

      if (previousNodeId && !issue.relatedNodeIds) {
        issue.relatedNodeIds = [previousNodeId];
      }

      let isQuestionUnanswered = false;
      if (issue.type === "contextGap" && previousText) {
        isQuestionUnanswered =
          this.isTextAQuestion(previousText) &&
          !this.doesTextAnswerQuestion(node.data.text, previousText);
      }

      let customPrompt = "";

      switch (issue.type) {
        case "deadend":
          customPrompt = (this.config.systemPrompts?.deadendFixPrompt || "").replace(
            "{playerText}",
            node.data.text
          );
          break;

        case "inconsistency":
          if (issue.message?.includes("Non-fluent text")) {
            logger.validationLog(`Using special Non-fluent text prompt for node ${issue.nodeId}`);
            customPrompt = `Rewrite the following text to be more natural and fluent while preserving its meaning:

Current text: "${node.data.text}"
${previousText ? `Previous context: "${previousText}"` : ""}

Requirements:
1. Make the text sound more natural and conversational
2. Preserve the original meaning and intent
3. Ensure proper grammar and flow
4. Keep the same tone and character voice
5. Make it appropriate for the dialog context

Provide ONLY the improved text without explanations.`;
          } else {
            logger.validationLog(`Using standard inconsistency prompt for node ${issue.nodeId}`);
            customPrompt = (this.config.systemPrompts?.inconsistencyFixPrompt || "")
              .replace("{message}", issue.message || "")
              .replace("{currentText}", node.data.text)
              .replace("{previousText}", previousText);
          }
          break;

        case "contextGap":
          if (isQuestionUnanswered) {
            customPrompt = (this.config.systemPrompts?.questionAnswerFixPrompt || "")
              .replace("{previousText}", previousText)
              .replace("{currentText}", node.data.text);
          } else {
            customPrompt = (this.config.systemPrompts?.contextGapFixPrompt || "")
              .replace("{message}", issue.message || "")
              .replace("{previousText}", previousText)
              .replace("{currentText}", node.data.text);
          }
          break;

        case "toneShift":
          customPrompt = (this.config.systemPrompts?.toneShiftFixPrompt || "")
            .replace("{message}", issue.message || "")
            .replace("{currentText}", node.data.text)
            .replace("{previousText}", previousText);
          break;

        default:
          customPrompt = (this.config.systemPrompts?.generalFixPrompt || "")
            .replace("{message}", issue.message || "")
            .replace("{currentText}", node.data.text)
            .replace("{previousText}", previousText);
      }

      const previousNodes =
        dialogChain.previous && dialogChain.previous.length > 0
          ? dialogChain.previous.map((prevNode) => ({
              nodeId: prevNode.id,
              type: prevNode.type as DialogNodeType,
              text: prevNode.data.text,
              tags: prevNode.data.metadata?.tags || [],
            }))
          : [];

      const nextNodes =
        dialogChain.next && dialogChain.next.length > 0
          ? dialogChain.next.map((nextNode) => ({
              nodeId: nextNode.id,
              type: nextNode.type as DialogNodeType,
              text: nextNode.data.text,
              tags: nextNode.data.metadata?.tags || [],
            }))
          : [];

      let fixedText = "";

      if (issue.type === "deadend") {
        fixedText = await this.generateWithCustomPrompt(
          "npcDialog",
          {
            previous: [{ nodeId: node.id, type: node.type, text: node.data.text }],
            dialogChain,
          },
          customPrompt
        );
      } else {
        let systemPrompt = "";
        if (issue.type === "contextGap" && isQuestionUnanswered) {
          systemPrompt = `You are an expert dialog writer specializing in conversational flow.
When given a question, you ALWAYS provide a direct answer first, then add context.
NEVER respond with a question unless explicitly instructed to do so.
NEVER evade or ignore the question being asked.`;
        }

        const isPreviousNodeEmptyProblem =
          issue.type === "contextGap" &&
          issue.message?.includes("Previous node is empty") &&
          previousNode;

        if (isPreviousNodeEmptyProblem) {
          logger.debug(
            `Context gap due to empty previous node (${previousNodeId}). Attempting to fix previous node first.`
          );

          const previousNodeChain = findDialogPaths(previousNodeId, nodes, connections);
          const previousNodePreviousNodes =
            previousNodeChain.previous && previousNodeChain.previous.length > 0
              ? previousNodeChain.previous.map((prevNode) => ({
                  nodeId: prevNode.id,
                  type: prevNode.type as DialogNodeType,
                  text: prevNode.data.text,
                  tags: prevNode.data.metadata?.tags || [],
                }))
              : [];

          const fillPreviousNodePrompt = `The node following this one has content, but this node is currently empty. 
Please generate appropriate content for this dialog node based on the preceding conversation.
Your generated text should provide a logical and natural transition to the next node's content: "${node.data.text}".
Focus on creating a smooth flow.`;

          const fixedPreviousText = await this.generateWithCustomPrompt(
            previousNode.type,
            {
              current: {
                nodeId: previousNode.id,
                type: previousNode.type,
                text: "", // Explicitly mark empty state
                tags: previousNode.data.metadata?.tags || [],
              },
              previous: previousNodePreviousNodes,
              next: [
                {
                  nodeId: node.id,
                  type: node.type,
                  text: node.data.text,
                },
              ],
              dialogChain: previousNodeChain,
            },
            fillPreviousNodePrompt,
            undefined,
            false,
            true 
          );

          if (
            fixedPreviousText &&
            !fixedPreviousText.startsWith("[ERROR]") &&
            fixedPreviousText.trim().length > 0
          ) {
            logger.debug(
              `Successfully filled previous node (${previousNodeId}). Returning update for both nodes.`
            );
            return `${node.data.text}previousNodeUpdate:${fixedPreviousText}`;
          } else {
            logger.debug(
              `Failed to fill empty previous node (${previousNodeId}). Falling back to standard fix attempt for the current node.`
            );
            fixedText = "";
          }
        }

        if (!isPreviousNodeEmptyProblem || fixedText === "") {
          fixedText = await this.generateWithCustomPrompt(
            node.type,
            {
              current: {
                nodeId: node.id,
                type: node.type,
                text: node.data.text,
                tags: node.data.metadata?.tags || [],
              },
              previous: previousNodes,
              next: nextNodes,
              dialogChain,
            },
            customPrompt,
            systemPrompt,
            false,
            true
          );
        }

        if (
          (fixedText.startsWith("[ERROR]") || fixedText.trim() === "") &&
          issue.type === "contextGap" &&
          previousNode &&
            !isPreviousNodeEmptyProblem
        ) {
          console.log(
            `AI could not fix contextGap for node ${issue.nodeId}. Checking if previous node ${previousNodeId} is problematic...`
          );

          const isPreviousNodeProblematic =
            previousText.startsWith("[ERROR]") || previousText.length < 10;

          if (isPreviousNodeProblematic) {
            const previousNodeChain = findDialogPaths(previousNodeId, nodes, connections);
            const previousNodePreviousNodes =
              previousNodeChain.previous && previousNodeChain.previous.length > 0
                ? previousNodeChain.previous.map((prevNode) => ({
                    nodeId: prevNode.id,
                    type: prevNode.type as DialogNodeType,
                    text: prevNode.data.text,
                    tags: prevNode.data.metadata?.tags || [],
                  }))
                : [];

            const fixPreviousNodePrompt = `This node has problematic content: "${previousText}"
This is causing a context gap in the next node.
Please generate appropriate content for this dialog that provides enough context for the following node.
The content should relate to the preceding conversation and set up context for what follows.
Make it natural, conversational, and focused on establishing clear context.`;

            const fixedPreviousText = await this.generateWithCustomPrompt(
              previousNode.type,
              {
                current: {
                  nodeId: previousNode.id,
                  type: previousNode.type,
                  text: previousNode.data.text,
                  tags: previousNode.data.metadata?.tags || [],
                },
                previous: previousNodePreviousNodes,
                next: [
                  {
                    nodeId: node.id,
                    type: node.type,
                    text: node.data.text,
                  },
                ],
                dialogChain: previousNodeChain,
              },
              fixPreviousNodePrompt,
              undefined,
              false,
              true
            );

            if (
              fixedPreviousText &&
              !fixedPreviousText.startsWith("[ERROR]") &&
              fixedPreviousText.trim().length > 0
            ) {
              logger.debug(`Successfully fixed problematic previous node. Retrying original fix...`);

              const enhancedCustomPrompt = `${customPrompt}
                
ADDITIONAL CONTEXT: The previous node has been updated to:
"${fixedPreviousText}"

Your response should now be consistent with this updated previous dialog.`;

              fixedText = await this.generateWithCustomPrompt(
                node.type,
                {
                  current: {
                    nodeId: node.id,
                    type: node.type,
                    text: node.data.text,
                    tags: node.data.metadata?.tags || [],
                  },
                  previous: [
                    ...previousNodes.slice(0, -1),
                    {
                      nodeId: previousNodeId,
                      type: previousNode.type as DialogNodeType,
                      text: fixedPreviousText,
                      tags: previousNode.data.metadata?.tags || [],
                    },
                  ],
                  next: nextNodes,
                  dialogChain,
                },
                enhancedCustomPrompt,
                systemPrompt,
                false,
                true
              );

              if (fixedText && !fixedText.startsWith("[ERROR]") && fixedText.trim().length > 0) {
                logger.debug(`Successfully fixed both nodes (problematic previous + current)!`);
                return `${fixedText}previousNodeUpdate:${fixedPreviousText}`;
              } else {
                logger.debug(`Fixed previous node, but failed to fix current node subsequently.`);
                fixedText = "";
              }
            } else {
              logger.debug(
                `Failed to fix problematic previous node. Proceeding with other fix attempts for current node.`
              );
              fixedText = "";
            }
          } else {
            logger.debug(
              `Previous node (${previousNodeId}) not identified as problematic (non-empty case). Skipping recursive previous fix.`
            );
          }
        }
      }

      if (
        fixedText === node.data.text &&
        !fixedText.startsWith("[ERROR]") &&
        fixedText.trim() !== ""
      ) {
        logger.debug("All attempts returned identical text, making forced modification");

        if (issue.type === "contextGap" && isQuestionUnanswered) {
          const isYesNoQuestion = this.isYesNoQuestion(previousText);
          if (isYesNoQuestion) {
            fixedText = (Math.random() > 0.5 ? "Yes, " : "No, ") + fixedText;
          } else {
            const answerPrefix = this.getAnswerPrefix();
            fixedText = answerPrefix + fixedText;
          }
        } else {
          const npcFallbacks = [
            "", // No prefix - let the content speak
            "Let me see... ",
            "Well, ",
            "You know, ",
            "Listen, ",
            "Actually, ",
          ];

          const playerFallbacks = [
            "",
            "I think ",
            "Maybe ",
            "Well, ",
            "To be honest, ",
            "From what I can tell, ",
          ];

          const fallbackOptions = node.type === "npcDialog" ? npcFallbacks : playerFallbacks;
          const randomFallback = fallbackOptions[Math.floor(Math.random() * fallbackOptions.length)];
          fixedText = randomFallback + fixedText;
        }
      }

      if (!fixedText || fixedText.trim() === "" || fixedText.startsWith("[ERROR]")) {
        logger.debug(
          `Final check failed - fix attempt was unsuccessful for ${issue.type} on node ${issue.nodeId}`
        );
        return "";
      }

      logger.debug(`Generated fix for ${issue.type}:`, fixedText);
      return fixedText;
    } catch (error) {
      logger.error("Error fixing validation issue:", error);
      return this.formatError(
        ErrorType.VALIDATION_ERROR,
        error instanceof Error ? error.message : "Error occurred while fixing validation issue"
      );
    }
  }

  private isTextAQuestion(text: string): boolean {
    return text.includes("?");
  }

  private doesTextAnswerQuestion(answerText: string, questionText: string): boolean {
    if (!this.isTextAQuestion(questionText)) return true;

    return answerText.trim().length > 0;
  }

  private isYesNoQuestion(text: string): boolean {
    return text.includes("?");
  }

  private getAnswerPrefix(): string {
    return "";
  }

  async regeneratePath(
    path: any[],
    allNodes: DialogNode[],
    connections: { sourceId: string; targetId: string }[],
    ignoreConnections: boolean = false
  ): Promise<Array<{ nodeId: string; newText: string }>> {
    const results: Array<{ nodeId: string; newText: string }> = [];

    for (let i = 0; i < path.length; i++) {
      const node = path[i];
      try {
        const existingNode = allNodes.find((n) => n.id === node.id);
        if (!existingNode) {
          logger.warn(`Node with id ${node.id} not found in nodes array`);
          continue;
        }

        const newText = await this.regenerateNodeText(
          node,
          allNodes,
          connections,
          ignoreConnections
        );

        results.push({
          nodeId: node.id,
          newText: newText,
        });

        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        logger.error(`Error regenerating node ${node.id}:`, error);
      }
    }

    return results;
  }

  async regeneratePathGroup(
    pathGroup: any[][],
    allNodes: DialogNode[],
    connections: { sourceId: string; targetId: string }[],
    ignoreConnections: boolean = false
  ): Promise<Array<{ nodeId: string; newText: string }>> {
    const results: Array<{ nodeId: string; newText: string }> = [];

    for (let i = 0; i < pathGroup.length; i++) {
      const path = pathGroup[i];

      const pathResults = await this.regeneratePath(path, allNodes, connections, ignoreConnections);

      results.push(...pathResults);
    }

    return results;
  }

  async regenerateSubsequentNodes(
    subsequentNodes: DialogNode[],
    allNodes: DialogNode[],
    connections: { sourceId: string; targetId: string }[],
    ignoreConnections: boolean = false
  ): Promise<Array<{ nodeId: string; newText: string }>> {
    const formattedConnections = connections.map((conn) => ({
      source: conn.sourceId,
      target: conn.targetId,
    }));

    const generatedTexts = new Map<string, string>();

    const results: Array<{ nodeId: string; newText: string }> = [];

    const dependencies = new Map<string, Set<string>>();
    const dependents = new Map<string, Set<string>>();

    subsequentNodes.forEach((node) => {
      dependencies.set(node.id, new Set());
      dependents.set(node.id, new Set());
    });

    formattedConnections.forEach((conn) => {
      if (dependencies.has(conn.target) && dependents.has(conn.source)) {
        dependencies.get(conn.target)?.add(conn.source);
        dependents.get(conn.source)?.add(conn.target);
      }
    });

    const processOrder: string[] = [];
    const processed = new Set<string>();

    const findSourceNodes = () => {
      return subsequentNodes
        .filter((node) => !processed.has(node.id))
        .filter((node) => {
          const deps = dependencies.get(node.id);
          return deps && Array.from(deps).every((dep) => processed.has(dep));
        })
        .map((node) => node.id);
    };

    while (processed.size < subsequentNodes.length) {
      const sourceNodes = findSourceNodes();
      if (sourceNodes.length === 0) {
        logger.warn("Cyclic dependency detected");
        break;
      }

      processOrder.push(...sourceNodes);
      sourceNodes.forEach((id) => processed.add(id));
    }

    for (const nodeId of processOrder) {
      const node = subsequentNodes.find((n) => n.id === nodeId);
      if (!node) continue;

      try {
        const newText = await this.regenerateNodeText(
          node,
          allNodes,
          formattedConnections,
          ignoreConnections
        );

        generatedTexts.set(nodeId, newText);
        results.push({ nodeId, newText });

        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        logger.error(`Error regenerating node ${nodeId}:`, error);
        results.push({
          nodeId,
          newText: this.formatError(
            ErrorType.GENERATION_ERROR,
            error instanceof Error ? error.message : "Unknown error"
          ),
        });
      }
    }

    return results;
  }

  private findSiblingNodes(
    node: DialogNode,
    allNodes: DialogNode[],
    connections: { source: string; target: string }[],
    result: DialogContext[]
  ): void {
    const visited = new Set<string>();
    visited.add(node.id);

    const incomingConnections = connections.filter((conn) => conn.target === node.id);

    incomingConnections.forEach((inConn) => {
      const siblingConnections = connections.filter(
        (conn) => conn.source === inConn.source && conn.target !== node.id
      );

      siblingConnections.forEach((sibConn) => {
        if (!visited.has(sibConn.target)) {
          visited.add(sibConn.target);
          const siblingNode = allNodes.find((n) => n.id === sibConn.target);
          if (siblingNode && siblingNode.type === node.type) {
            result.push(
              createSafeDialogContext(
                siblingNode.id,
                siblingNode.type,
                siblingNode.data.text,
                siblingNode.data.metadata?.tags
              )
            );
          }
        }
      });
    });

    const outgoingConnections = connections.filter((conn) => conn.source === node.id);

    outgoingConnections.forEach((outConn) => {
      const siblingConnections = connections.filter(
        (conn) => conn.target === outConn.target && conn.source !== node.id
      );

      siblingConnections.forEach((sibConn) => {
        if (!visited.has(sibConn.source)) {
          visited.add(sibConn.source);
          const siblingNode = allNodes.find((n) => n.id === sibConn.source);
          if (siblingNode && siblingNode.type === node.type) {
            result.push(
              createSafeDialogContext(
                siblingNode.id,
                siblingNode.type,
                siblingNode.data.text,
                siblingNode.data.metadata?.tags
              )
            );
          }
        }
      });
    });
  }

  private buildSiblingAwarenessPrompt(siblingNodes: DialogContext[]): string {
    if (!siblingNodes || siblingNodes.length === 0) return "";

    const siblingTexts = siblingNodes.map((node) => `"${node.text}"`).join("\n- ");

    const siblingAwarenessPrompt =
      this.config.systemPrompts?.siblingAwarenessPrompt ||
      `Your response MUST be SIGNIFICANTLY DIFFERENT from these existing texts`;

    return `
SIMILAR NODE AWARENESS:
The following nodes are connected to the same parent/target nodes as the current one:
- ${siblingTexts}

${siblingAwarenessPrompt}`;
  }

  private buildContextInfo(context: GenerateContext): string {
    let contextInfo = "";

    if (context.current) {
      const previousContext =
        context.previous && context.previous.length > 0
          ? context.previous
              .slice(-3)
              .map((msg) => `[${msg.type.toUpperCase()}]: ${msg.text}`)
              .join("\n")
          : "No previous messages";

      const nextMessages =
        context.next && context.next.length > 0
          ? context.next.map((msg) => `→ ${msg.text}`).join("\n")
          : "No next messages";

      const tagContent =
        context.current.tags && context.current.tags.length > 0
          ? this.formatTagContent(context.current.tags)
          : "";

      const conversationHistoryContent = context.conversationHistory
        ? `\n${context.conversationHistory}\n`
        : "";

      contextInfo = `
CURRENT CONVERSATION STATE:
--------------------------
PREVIOUS MESSAGES:
${previousContext}

CURRENT CHARACTER: ${context.current.type.toUpperCase()}
CURRENT TEXT: "${context.current.text}"

POSSIBLE NEXT RESPONSES:
${nextMessages}
${conversationHistoryContent}
${tagContent}

CHARACTER INFO:
${context.characterInfo || "No character info available"}
`;
    }

    return contextInfo;
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await aiConcurrencyLimiter.execute(
        () => fetch(`${this.config.baseUrl}/api/tags`)
      );
      if (!response.ok) {
        logger.error("Failed to fetch models from Ollama", response.statusText);
        return [];
      }

      this.isAvailable = true;
      const data = await response.json();
      if (Array.isArray(data.models)) {
        return data.models.map((model: any) => model.name);
      }

      return [];
    } catch (error) {
      logger.error("Error fetching models from Ollama:", error);
      this.isAvailable = false;
      return [];
    }
  }
}

export const ollamaService = new OllamaService();
export type { ImportedOllamaConfig as OllamaConfig };

export { getCharacterContextUtil as getCharacterContext };
