import type { CSSProperties } from "react";
import { Edge as ReactFlowEdge } from "reactflow";
import { DialogAnalysisData } from "../utils/dialogAnalyzer";
import { ProjectType } from "./project";
import { GenerateMode } from "../hooks/useNodeAI";

export type DialogNodeType = string;

export type TagType =
  | "all"
  | "npc"
  | "player"
  | "enemy"
  | "quest"
  | "side_quest"
  | "dialog_choice"
  | "item_collect"
  | "state_start"
  | "state_complete"
  | "state_fail"
  | "env_village"
  | "env_dungeon"
  | "env_city"
  | "choice"
  | "branch_yes"
  | "branch_no"
  | "story_end"
  | "happy_end"
  | "tragic_end"
  | "emotional"
  | "suspense"
  | "comedy"
  | "friendship"
  | "betrayal"
  | "victory"
  | "chapter"
  | "intro"
  | "climax"
  | "conclusion"
  | "main_character"
  | "supporting_character"
  | "drama"
  | "fantasy"
  | "realistic"
  | "dialogue_scene"
  | "monologue"
  | "action_scene"
  | "character"
  | "world"
  | "location"
  | "item"
  | "faction"
  | "emotion"
  | "trait"
  | "arc"
  | "theme"
  | "motif"
  | "symbol"
  | "conflict"
  | "setting"
  | "pov"
  | "voice"
  | "timeline"
  | "scene"
  | "speech_pattern"
  | "dialect"
  | "vocabulary_style"
  | "conversation_approach"
  | "emotional_tendency"
  | "character_secret"
  | "character_motivation"
  | "relationship_dynamic"
  | "tension_marker"
  | "pacing_control"
  | "emotional_beat"
  | "story_structure"
  | "thematic_element"
  | "narrative_device"
  | "subtext_layer";

export interface TagRelation {
  type: "requires" | "conflicts" | "suggests" | "enhances" | "develops" | "contradicts";
  targetTagId: string;
  description?: string;
  strength?: number; // 1-10 scale for relationship intensity
}

export interface TagMetadata {
  importance?: number;
  color?: string;
  description?: string;
  characterVoice?: {
    speechPatterns?: string[];
    emotionalRange?: Record<string, number>;
    vocabularyLevel?: "simple" | "moderate" | "complex" | "archaic";
    dialectMarkers?: string[];
    conversationStyle?: "formal" | "casual" | "aggressive" | "passive" | "sarcastic";
    conflictAvoidance?: number;
    trustLevel?: number;
    secretsKnown?: string[];
    personalMotivations?: string[];
    relationshipDynamics?: Record<
      string,
      {
        trust: number;
        tension: number;
        history: string;
      }
    >;
  };
  narrativePacing?: {
    tensionLevel?: number;
    pacingSpeed?: "slow" | "moderate" | "fast" | "climactic";
    emotionalBeat?: "setup" | "building" | "climax" | "resolution" | "transition";
    storyArc?: "exposition" | "rising_action" | "climax" | "falling_action" | "resolution";
    thematicWeight?: number;
  };
}

export interface Tag {
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

export interface DialogNodeData {
  text: string;
  type?: DialogNodeType;
  metadata?: {
    tags?: string[];
    nodeData?: Record<string, any>;
    dimensions?: {
      width: number;
      height: number;
    };
    analysisData?: DialogAnalysisData;
    customSettings?: {
      systemPrompt?: string;
      userPrompt?: string;
      ignoreConnections?: boolean;
    };
    subgraph?: {
      nodes: any[];
      edges: any[];
      inputs: Array<{
        id: string;
        label: string;
        dataType?: string;
      }>;
      outputs: Array<{
        id: string;
        label: string;
        dataType?: string;
      }>;
    };
  };
  style?: {
    primaryColor: string;
    bgBase: string;
    bgSelected: string;
    borderBase: string;
    borderSelected: string;
  };
  onGenerateDialog?: (
    mode: GenerateMode,
    options?: {
      ignoreConnections?: boolean;
      customPrompt?: string;
      systemPrompt?: string;
    }
  ) => void;
  isProcessing?: boolean;
  aiStatus?: "idle" | "generating" | "error" | "timeout";
  aiError?: string;

  [key: string]: any;
}

export interface DialogNode {
  id: string;
  type: DialogNodeType;
  position: { x: number; y: number };
  data: DialogNodeData;
  dragging?: boolean;
  selected?: boolean;
  draggable?: boolean;
  selectable?: boolean;
  connectable?: boolean;
  zIndex?: number;
  style?: CSSProperties;
}

export interface DialogConnection extends Omit<ReactFlowEdge, "source" | "target"> {
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export type Connection = DialogConnection;

export interface DialogChain {
  previous: DialogNode[];
  current: DialogNode;
  next: DialogNode[];
}
