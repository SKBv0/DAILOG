import { describe, it, expect } from 'vitest';
import {
  validateProject,
  validateNode,
  validateEdge,
  validateTag,
} from '../../domain/schema';

describe('Schema Validation', () => {
  describe('DialogNode validation', () => {
    it('should validate a correct node', () => {
      const validNode = {
        id: 'npcDialog_abc123',
        type: 'npcDialog',
        position: { x: 100, y: 200 },
        data: {
          text: 'Hello, traveler!',
          speaker: 'Village Elder',
          conditions: [],
          effects: [],
          tags: ['npc', 'friendly'],
        },
      };
      
      const result = validateNode(validNode);
      expect(result.success).toBe(true);
    });

    it('should reject invalid node ID format', () => {
      const invalidNode = {
        id: 'invalid-id',
        type: 'npcDialog',
        position: { x: 100, y: 200 },
        data: { text: 'Test', conditions: [], effects: [], tags: [] },
      };
      
      const result = validateNode(invalidNode);
      expect(result.success).toBe(false);
    });

    it('should reject invalid node type', () => {
      const invalidNode = {
        id: 'test_abc123',
        type: 'invalidType',
        position: { x: 100, y: 200 },
        data: { text: 'Test', conditions: [], effects: [], tags: [] },
      };
      
      const result = validateNode(invalidNode);
      expect(result.success).toBe(false);
    });

    it('should handle optional properties correctly', () => {
      const minimalNode = {
        id: 'customNode_min123',
        type: 'customNode',
        position: { x: 0, y: 0 },
        data: { text: '', conditions: [], effects: [], tags: [] },
      };
      
      const result = validateNode(minimalNode);
      expect(result.success).toBe(true);
    });

    it('should validate node conditions', () => {
      const nodeWithConditions = {
        id: 'choiceNode_choice123',
        type: 'choiceNode',
        position: { x: 100, y: 200 },
        data: {
          text: 'What will you do?',
          conditions: [
            {
              variable: 'playerLevel',
              operator: '>=' as const,
              value: 5,
              description: 'Player must be level 5 or higher',
            },
          ],
          effects: [],
          tags: [],
        },
      };
      
      const result = validateNode(nodeWithConditions);
      expect(result.success).toBe(true);
    });
  });

  describe('Edge validation', () => {
    it('should validate a correct edge', () => {
      const validEdge = {
        id: 'edge_source_target_1',
        source: 'npcDialog_abc123',
        target: 'playerResponse_def456',
        type: 'default',
      };
      
      const result = validateEdge(validEdge);
      expect(result.success).toBe(true);
    });

    it('should handle optional edge properties', () => {
      const edgeWithOptionals = {
        id: 'edge_with_label',
        source: 'node1_abc',
        target: 'node2_def',
        label: 'Player agrees',
        animated: true,
        style: { stroke: '#ff0000' },
      };
      
      const result = validateEdge(edgeWithOptionals);
      expect(result.success).toBe(true);
    });
  });

  describe('Tag validation', () => {
    it('should validate a correct tag', () => {
      const validTag = {
        id: 'tag_character_elder',
        label: 'Village Elder',
        type: 'character' as const,
        content: 'A wise old man who leads the village',
        metadata: {
          importance: 4,
          description: 'Important quest giver',
        },
      };
      
      const result = validateTag(validTag);
      expect(result.success).toBe(true);
    });

    it('should reject tag with invalid importance', () => {
      const invalidTag = {
        id: 'tag_test',
        label: 'Test Tag',
        type: 'general' as const,
        metadata: {
          importance: 10, // Invalid: should be 1-5
        },
      };
      
      const result = validateTag(invalidTag);
      expect(result.success).toBe(false);
    });

    it('should reject tag with too long label', () => {
      const invalidTag = {
        id: 'tag_long',
        label: 'x'.repeat(150), // Too long: max 100 chars
        type: 'general' as const,
      };
      
      const result = validateTag(invalidTag);
      expect(result.success).toBe(false);
    });
  });

  describe('ProjectV2 validation', () => {
    it('should validate a complete project', () => {
      const validProject = {
        schemaVersion: '2.0.0' as const,
        nodes: [
          {
            id: 'npcDialog_start',
            type: 'npcDialog' as const,
            position: { x: 100, y: 100 },
            data: {
              text: 'Welcome to our village!',
              speaker: 'Guard',
              conditions: [],
              effects: [],
              tags: [],
            },
          },
          {
            id: 'playerResponse_reply',
            type: 'playerResponse' as const,
            position: { x: 300, y: 100 },
            data: {
              text: 'Thank you for the welcome.',
              conditions: [],
              effects: [],
              tags: [],
            },
          },
        ],
        edges: [
          {
            id: 'edge_start_reply',
            source: 'npcDialog_start',
            target: 'playerResponse_reply',
          },
        ],
        tags: [],
        metadata: {
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          projectType: 'game' as const,
        },
      };
      
      const result = validateProject(validProject);
      expect(result.success).toBe(true);
    });

    it('should reject project with wrong schema version', () => {
      const invalidProject = {
        schemaVersion: '1.0.0',
        nodes: [],
        edges: [],
        tags: [],
      };
      
      const result = validateProject(invalidProject);
      expect(result.success).toBe(false);
    });

    it('should handle optional project properties', () => {
      const minimalProject = {
        schemaVersion: '2.0.0' as const,
        nodes: [],
        edges: [],
      };
      
      const result = validateProject(minimalProject);
      expect(result.success).toBe(true);
    });
  });
});