import { z } from 'zod';

export const TagMetadata = z.object({
  importance: z.number().min(1).max(5).default(3),
  color: z.string().optional(),
  description: z.string().optional(),
  characterVoice: z.object({
    speechPatterns: z.array(z.string()).optional(),
    emotionalRange: z.record(z.string(), z.number()).optional(),
    vocabularyLevel: z.enum(["simple", "moderate", "complex", "archaic"]).optional(),
    dialectMarkers: z.array(z.string()).optional(),
    conversationStyle: z.enum(["formal", "casual", "aggressive", "passive", "sarcastic"]).optional(),
    conflictAvoidance: z.number().optional(),
    trustLevel: z.number().optional(),
    secretsKnown: z.array(z.string()).optional(),
    personalMotivations: z.array(z.string()).optional(),
    relationshipDynamics: z.record(
      z.string(),
      z.object({
        trust: z.number(),
        tension: z.number(),
        history: z.string(),
      })
    ).optional(),
  }).optional(),
  narrativePacing: z.object({
    tensionLevel: z.number().optional(),
    pacingSpeed: z.enum(["slow", "moderate", "fast", "climactic"]).optional(),
    emotionalBeat: z.enum(["setup", "building", "climax", "resolution", "transition"]).optional(),
    storyArc: z.enum(["exposition", "rising_action", "climax", "falling_action", "resolution"]).optional(),
    thematicWeight: z.number().optional(),
  }).optional(),
});

export const Tag = z.object({
  id: z.string(),
  label: z.string().min(1).max(100),
  type: z.enum([
    'character', 'player', 'enemy', 'npc',
    'quest', 'side_quest', 'main_quest',
    'item', 'weapon', 'armor', 'consumable',
    'location', 'world', 'scene',
    'emotion', 'trait', 'relationship',
    'faction', 'group', 'organization',
    'choice', 'branch_yes', 'branch_no',
    'comedy', 'drama', 'suspense', 'action',
    'chapter', 'intro', 'climax', 'ending',
    'dialogue_scene', 'monologue', 'action_scene',
    'general'
  ]),
  content: z.string().max(1000).optional(),
  projectType: z.enum(['game', 'interactive_story', 'novel']).optional(),
  metadata: TagMetadata.optional(),
  value: z.unknown().optional(), // For dynamic values
});

export const NodeCondition = z.object({
  variable: z.string().min(1),
  operator: z.enum(['==', '!=', '>', '<', '>=', '<=', 'in', 'includes', 'contains']),
  value: z.unknown(), // Can be string, number, boolean, array, etc.
  description: z.string().optional(),
});

export const NodeEffect = z.object({
  variable: z.string().min(1),
  operator: z.enum(['+=', '-=', 'set', 'push', 'remove']),
  value: z.unknown(),
  description: z.string().optional(),
});

export const NodeMetadata = z.object({
  isProcessing: z.boolean().optional(),
  customPrompt: z.string().optional(),
  systemMessage: z.string().optional(),
  speaker: z.string().optional(),
  tags: z.array(z.string()).default([]),
  nodeData: z.object({
    color: z.string().optional(),
    size: z.object({
      width: z.number().positive(),
      height: z.number().positive(),
    }).optional(),
  }).optional(),
  subgraph: z.object({
    nodes: z.array(z.any()).default([]),
    edges: z.array(z.any()).default([]),
    inputs: z.array(z.object({
      id: z.string(),
      label: z.string(),
      dataType: z.string().optional(),
    })).default([]),
    outputs: z.array(z.object({
      id: z.string(),
      label: z.string(),
      dataType: z.string().optional(),
    })).default([]),
  }).optional(),
});

export const DialogNodeData = z.object({
  text: z.string().max(5000).default(''),
  speaker: z.string().optional(),
  conditions: z.array(NodeCondition).default([]),
  effects: z.array(NodeEffect).default([]),
  tags: z.array(z.string()).default([]),
  metadata: NodeMetadata.optional(),
  // Style properties for visual customization
  style: z.object({
    primaryColor: z.string().optional(),
    backgroundColor: z.string().optional(),
    borderColor: z.string().optional(),
  }).optional(),
});

export const DialogNode = z.object({
  id: z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*_[a-zA-Z0-9]+$/, 'Node ID must follow pattern: nodeType_uniqueId'),
  type: z.enum([
    'npcDialog',
    'playerResponse', 
    'enemyDialog',
    'narratorNode',
    'choiceNode',
    'characterDialogNode',
    'sceneDescriptionNode',
    'sceneNode',
    'branchingNode',
    'customNode',
    'subgraphNode'
  ]),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  data: DialogNodeData,
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  selected: z.boolean().optional(),
  dragging: z.boolean().optional(),
  dragHandle: z.string().optional(),
});

export const Edge = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
  type: z.string().optional(),
  label: z.string().optional(),
  animated: z.boolean().optional(),
  style: z.record(z.string(), z.unknown()).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export const ProjectMetadata = z.object({
  createdAt: z.string().datetime(),
  lastModified: z.string().datetime(),
  projectType: z.enum(['game', 'interactive_story', 'novel']).default('game'),
  title: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  author: z.string().max(100).optional(),
  version: z.string().optional(),
  totalNodes: z.number().nonnegative().optional(),
  totalEdges: z.number().nonnegative().optional(),
});

export const ProjectV2 = z.object({
  schemaVersion: z.literal('2.0.0'),
  nodes: z.array(DialogNode),
  edges: z.array(Edge),
  tags: z.array(Tag).default([]),
  metadata: ProjectMetadata.optional(),
  viewport: z.object({
    x: z.number(),
    y: z.number(),
    zoom: z.number().positive(),
  }).optional(),
});

export const ProjectV1 = z.object({
  schemaVersion: z.literal('1.0.0').optional(),
  nodes: z.array(z.unknown()),
  connections: z.array(z.unknown()).optional(),
  edges: z.array(z.unknown()).optional(),
  tags: z.array(z.unknown()).default([]),
}).passthrough();

export type Tag = z.infer<typeof Tag>;
export type TagMetadata = z.infer<typeof TagMetadata>;
export type NodeCondition = z.infer<typeof NodeCondition>;
export type NodeEffect = z.infer<typeof NodeEffect>;
export type NodeMetadata = z.infer<typeof NodeMetadata>;
export type DialogNodeData = z.infer<typeof DialogNodeData>;
export type DialogNode = z.infer<typeof DialogNode>;
export type Edge = z.infer<typeof Edge>;
export type ProjectMetadata = z.infer<typeof ProjectMetadata>;
export type ProjectV2 = z.infer<typeof ProjectV2>;
export type ProjectV1 = z.infer<typeof ProjectV1>;

export const validateProject = (data: unknown) => ProjectV2.safeParse(data);
export const validateNode = (data: unknown) => DialogNode.safeParse(data);
export const validateEdge = (data: unknown) => Edge.safeParse(data);
export const validateTag = (data: unknown) => Tag.safeParse(data);