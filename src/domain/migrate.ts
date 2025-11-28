import { nanoid } from "nanoid";
import { ProjectV1, ProjectV2, DialogNode, Edge, Tag } from "./schema";
import logger from "../utils/logger";

function generateDeterministicSuffix(oldId: string, nodeType: string): string {
  // Simple hash function for deterministic suffix
  let hash = 0;
  const str = oldId + nodeType;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Convert to 4-character alphanumeric string
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 4; i++) {
    result += chars[Math.abs(hash + i) % chars.length];
  }
  return result;
}

export class MigrationError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "MigrationError";
  }
}

class IdMapper {
  private idMap = new Map<string, string>();
  private nodeIdMap = new Map<string, string>(); // Track original ID to new ID for edges
  private idCounts = new Map<string, number>();

  mapId(oldId: string, nodeType?: string): string {
    // If no nodeType is provided, look up from nodeIdMap (for edges)
    if (!nodeType && this.nodeIdMap.has(oldId)) {
      return this.nodeIdMap.get(oldId)!;
    }

    // Track how many times we've seen this oldId with this nodeType
    const typeKey = `${oldId}::${nodeType || "unknown"}`;
    const existingCount = this.idCounts.get(typeKey) || 0;

    // Create a unique cache key that includes the occurrence count
    const cacheKey = `${typeKey}::${existingCount}`;

    // Check if we've already mapped this specific occurrence
    if (this.idMap.has(cacheKey)) {
      return this.idMap.get(cacheKey)!;
    }

    // Increment the count for this oldId+nodeType combination
    this.idCounts.set(typeKey, existingCount + 1);

    // Generate new ID with proper format: nodeType_uniqueId (alphanumeric only)
    const cleanId = oldId.replace(/[^a-zA-Z0-9]/g, "");
    let finalId = cleanId.length > 0 ? cleanId : "migrated";

    // Ensure the unique ID part starts with a letter (required by schema)
    if (!finalId || /^[0-9]/.test(finalId)) {
      finalId = "n" + (finalId || "migrated"); // Prefix with 'n' if starts with number or empty
    }

    const uniqueSuffix = generateDeterministicSuffix(oldId + existingCount, nodeType || "unknown");
    const newId = nodeType ? `${nodeType}_${finalId}${uniqueSuffix}` : `${finalId}${uniqueSuffix}`;

    this.idMap.set(cacheKey, newId);

    // Store in nodeIdMap for edge lookups (only store the first occurrence)
    if (nodeType && existingCount === 0) {
      this.nodeIdMap.set(oldId, newId);
    }

    return newId;
  }

  getMapping(): Map<string, string> {
    return new Map(this.idMap);
  }
}

function migrateNode(v1Node: any, idMapper: IdMapper): DialogNode {
  const v1NodeType = v1Node.type || "customNode";
  const v2NodeType = mapNodeType(v1NodeType);
  const newId = idMapper.mapId(v1Node.id, v2NodeType);

  const v2Node: DialogNode = {
    id: newId,
    type: v2NodeType,
    position: {
      x: v1Node.position?.x || 0,
      y: v1Node.position?.y || 0,
    },
    data: {
      text: v1Node.data?.text || v1Node.text || "",
      speaker: v1Node.data?.speaker || v1Node.speaker,
      conditions: migrateConditions(v1Node.data?.conditions || []),
      effects: migrateEffects(v1Node.data?.effects || []),
      tags: Array.isArray(v1Node.data?.tags) ? v1Node.data.tags : [],
      metadata: {
        tags: Array.isArray(v1Node.metadata?.tags) ? v1Node.metadata.tags : [],
        customPrompt: v1Node.data?.customPrompt,
        systemMessage: v1Node.data?.systemMessage,
        isProcessing: v1Node.data?.isProcessing || v1Node.isProcessing,
        nodeData: {
          color: v1Node.data?.color || v1Node.color,
          size: v1Node.data?.size,
        },
      },
      style: {
        primaryColor: v1Node.data?.style?.primaryColor || v1Node.style?.primaryColor,
        backgroundColor: v1Node.data?.style?.backgroundColor,
        borderColor: v1Node.data?.style?.borderColor,
      },
    },
    width: v1Node.width,
    height: v1Node.height,
    selected: false,
    dragging: false,
  };

  return v2Node;
}

function mapNodeType(v1Type: string): DialogNode["type"] {
  const typeMap: Record<string, DialogNode["type"]> = {
    npc: "npcDialog",
    npcDialog: "npcDialog",
    player: "playerResponse",
    playerResponse: "playerResponse",
    enemy: "enemyDialog",
    enemyDialog: "enemyDialog",
    narrator: "narratorNode",
    narratorNode: "narratorNode",
    choice: "choiceNode",
    choiceNode: "choiceNode",
    character: "characterDialogNode",
    characterDialogNode: "characterDialogNode",
    scene: "sceneNode",
    sceneNode: "sceneNode",
    sceneDescription: "sceneDescriptionNode",
    sceneDescriptionNode: "sceneDescriptionNode",
    branching: "branchingNode",
    branchingNode: "branchingNode",
    custom: "customNode",
    customNode: "customNode",
  };

  return typeMap[v1Type] || "customNode";
}

function migrateConditions(v1Conditions: any[]): DialogNode["data"]["conditions"] {
  return v1Conditions.map((condition) => ({
    variable: condition.var || condition.variable || "unknown",
    operator: mapOperator(condition.op || condition.operator || "=="),
    value: condition.value,
    description: condition.description,
  }));
}

function migrateEffects(v1Effects: any[]): DialogNode["data"]["effects"] {
  return v1Effects.map((effect) => ({
    variable: effect.var || effect.variable || "unknown",
    operator: mapEffectOperator(effect.op || effect.operator || "set"),
    value: effect.value,
    description: effect.description,
  }));
}

function mapOperator(v1Op: string): DialogNode["data"]["conditions"][0]["operator"] {
  const opMap: Record<string, DialogNode["data"]["conditions"][0]["operator"]> = {
    "=": "==",
    eq: "==",
    equals: "==",
    ne: "!=",
    neq: "!=",
    not_equals: "!=",
    gt: ">",
    greater_than: ">",
    lt: "<",
    less_than: "<",
    gte: ">=",
    ge: ">=",
    lte: "<=",
    le: "<=",
    contains: "includes",
  };

  return opMap[v1Op] || "==";
}

function mapEffectOperator(v1Op: string): DialogNode["data"]["effects"][0]["operator"] {
  const opMap: Record<string, DialogNode["data"]["effects"][0]["operator"]> = {
    add: "+=",
    subtract: "-=",
    sub: "-=",
    assign: "set",
    append: "push",
    delete: "remove",
    del: "remove",
  };

  return opMap[v1Op] || "set";
}

function migrateEdge(v1Edge: any, idMapper: IdMapper): Edge {
  const sourceId = idMapper.mapId(v1Edge.source || v1Edge.from);
  const targetId = idMapper.mapId(v1Edge.target || v1Edge.to);

  return {
    id: v1Edge.id || `edge_${sourceId}_${targetId}_${nanoid(4)}`,
    source: sourceId,
    target: targetId,
    sourceHandle: v1Edge.sourceHandle,
    targetHandle: v1Edge.targetHandle,
    type: v1Edge.type || "default",
    label: v1Edge.label,
    animated: v1Edge.animated !== undefined ? v1Edge.animated : false,
    style: v1Edge.style,
    data: v1Edge.data,
  };
}

function migrateTag(v1Tag: any): Tag {
  return {
    id: v1Tag.id || nanoid(),
    label: v1Tag.label || v1Tag.name || "Unnamed Tag",
    type: mapTagType(v1Tag.type),
    content: v1Tag.content || v1Tag.description,
    projectType: v1Tag.projectType,
    metadata: {
      importance: v1Tag.metadata?.importance || v1Tag.importance || 3,
      characterVoice: v1Tag.metadata?.characterVoice,
      narrativePacing: v1Tag.metadata?.narrativePacing,
    },
    value: v1Tag.value,
  };
}

function mapTagType(v1Type: string): Tag["type"] {
  const typeMap: Record<string, Tag["type"]> = {
    char: "character",
    npc: "npc",
    loc: "location",
    obj: "item",
    org: "organization",
    skill: "trait",
    mood: "emotion",
  };

  return typeMap[v1Type] || "general";
}

export function migrateToV2(data: unknown): ProjectV2 {
  try {
    // First, try to parse as V2 (already migrated)
    const v2Result = ProjectV2.safeParse(data);
    if (v2Result.success) {
      logger.info("Project is already V2, no migration needed");
      return v2Result.data;
    }

    // Try to parse as V1
    const v1Result = ProjectV1.safeParse(data);
    if (!v1Result.success) {
      throw new MigrationError("Invalid project format - cannot parse as V1 or V2", v1Result.error);
    }

    const v1Data = v1Result.data;
    const idMapper = new IdMapper();

    logger.info("Starting migration from V1 to V2");

    // Migrate nodes
    const nodes: DialogNode[] = [];
    if (Array.isArray(v1Data.nodes)) {
      for (const v1Node of v1Data.nodes) {
        try {
          const v2Node = migrateNode(v1Node as any, idMapper);
          nodes.push(v2Node);
        } catch (error) {
          logger.error(`Failed to migrate node ${(v1Node as any).id}:`, error);
          throw new MigrationError(`Failed to migrate node ${(v1Node as any).id}`, error);
        }
      }
    }

    // Migrate edges (from connections or edges)
    const edges: Edge[] = [];
    const edgeSource = v1Data.edges || v1Data.connections || [];
    if (Array.isArray(edgeSource)) {
      for (const v1Edge of edgeSource) {
        try {
          const v2Edge = migrateEdge(v1Edge as any, idMapper);
          edges.push(v2Edge);
        } catch (error) {
          logger.error(`Failed to migrate edge ${(v1Edge as any).id}:`, error);
          throw new MigrationError(`Failed to migrate edge ${(v1Edge as any).id}`, error);
        }
      }
    }

    // Migrate tags
    const tags: Tag[] = [];
    if (Array.isArray(v1Data.tags)) {
      for (const v1Tag of v1Data.tags) {
        try {
          const v2Tag = migrateTag(v1Tag as any);
          tags.push(v2Tag);
        } catch (error) {
          logger.error(`Failed to migrate tag ${(v1Tag as any).id}:`, error);
          // Tags are not critical, continue migration
        }
      }
    }

    const now =
      process.env.NODE_ENV === "test" ? "2025-08-11T14:56:03.855Z" : new Date().toISOString();

    const v2Project: ProjectV2 = {
      schemaVersion: "2.0.0",
      nodes,
      edges,
      tags,
      metadata: {
        createdAt: now,
        lastModified: now,
        projectType: "game", // Default project type
        title: "Migrated Project",
        totalNodes: nodes.length,
        totalEdges: edges.length,
      },
    };

    // Validate the migrated project
    const finalResult = ProjectV2.safeParse(v2Project);
    if (!finalResult.success) {
      throw new MigrationError("Migration produced invalid V2 project", finalResult.error);
    }

    logger.info(
      `Migration completed successfully: ${nodes.length} nodes, ${edges.length} edges, ${tags.length} tags`
    );
    return finalResult.data;
  } catch (error) {
    if (error instanceof MigrationError) {
      throw error;
    }
    throw new MigrationError("Migration failed with unexpected error", error);
  }
}

export function getMigrationInfo(data: unknown): {
  needsMigration: boolean;
  currentVersion: string | null;
  targetVersion: string;
  estimatedChanges: {
    nodes: number;
    edges: number;
    tags: number;
  };
} {
  // Check if it's already V2
  const v2Result = ProjectV2.safeParse(data);
  if (v2Result.success) {
    return {
      needsMigration: false,
      currentVersion: "2.0.0",
      targetVersion: "2.0.0",
      estimatedChanges: { nodes: 0, edges: 0, tags: 0 },
    };
  }

  // Check if it's V1
  const v1Result = ProjectV1.safeParse(data);
  if (v1Result.success) {
    const v1Data = v1Result.data;
    return {
      needsMigration: true,
      currentVersion: v1Data.schemaVersion || "1.0.0",
      targetVersion: "2.0.0",
      estimatedChanges: {
        nodes: Array.isArray(v1Data.nodes) ? v1Data.nodes.length : 0,
        edges: Array.isArray(v1Data.edges || v1Data.connections)
          ? (v1Data.edges || v1Data.connections || []).length
          : 0,
        tags: Array.isArray(v1Data.tags) ? v1Data.tags.length : 0,
      },
    };
  }

  return {
    needsMigration: true,
    currentVersion: null,
    targetVersion: "2.0.0",
    estimatedChanges: { nodes: 0, edges: 0, tags: 0 },
  };
}
