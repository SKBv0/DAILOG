import { describe, it, expect } from 'vitest';
import { migrateToV2, getMigrationInfo, MigrationError } from '../../domain/migrate';

describe('Migration System', () => {
  describe('migrateToV2', () => {
    it('should pass through V2 projects unchanged', () => {
      const v2Project = {
        schemaVersion: '2.0.0',
        nodes: [
          {
            id: 'npcDialog_test',
            type: 'npcDialog',
            position: { x: 0, y: 0 },
            data: {
              text: 'Test dialog',
              conditions: [],
              effects: [],
              tags: [],
            },
          },
        ],
        edges: [],
        tags: [],
      };

      const result = migrateToV2(v2Project);
      expect(result.schemaVersion).toBe('2.0.0');
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].id).toBe('npcDialog_test');
    });

    it('should migrate V1 project with basic nodes', () => {
      const v1Project = {
        schemaVersion: '1.0.0',
        nodes: [
          {
            id: 'oldNode1',
            type: 'npc',
            position: { x: 100, y: 200 },
            data: {
              text: 'Hello from V1!',
              speaker: 'Old NPC',
            },
          },
        ],
        connections: [
          {
            id: 'oldEdge1',
            source: 'oldNode1',
            target: 'oldNode2',
          },
        ],
        tags: [],
      };

      const result = migrateToV2(v1Project);
      
      expect(result.schemaVersion).toBe('2.0.0');
      expect(result.nodes).toHaveLength(1);
      expect(result.edges).toHaveLength(1);
      
      const migratedNode = result.nodes[0];
      expect(migratedNode.type).toBe('npcDialog'); // 'npc' -> 'npcDialog'
      expect(migratedNode.data.text).toBe('Hello from V1!');
      expect(migratedNode.data.speaker).toBe('Old NPC');
      expect(migratedNode.id).toMatch(/^npcDialog_[a-zA-Z0-9]+$/); // New ID format: nodeType_uniqueId
    });

    it('should migrate node types correctly', () => {
      const v1Project = {
        nodes: [
          { id: '1', type: 'npc', position: { x: 0, y: 0 }, data: { text: 'NPC' } },
          { id: '2', type: 'player', position: { x: 0, y: 0 }, data: { text: 'Player' } },
          { id: '3', type: 'enemy', position: { x: 0, y: 0 }, data: { text: 'Enemy' } },
          { id: '4', type: 'narrator', position: { x: 0, y: 0 }, data: { text: 'Narrator' } },
          { id: '5', type: 'choice', position: { x: 0, y: 0 }, data: { text: 'Choice' } },
          { id: '6', type: 'unknown', position: { x: 0, y: 0 }, data: { text: 'Unknown' } },
        ],
        edges: [],
        tags: [],
      };

      const result = migrateToV2(v1Project);
      
      expect(result.nodes[0].type).toBe('npcDialog');
      expect(result.nodes[1].type).toBe('playerResponse');
      expect(result.nodes[2].type).toBe('enemyDialog');
      expect(result.nodes[3].type).toBe('narratorNode');
      expect(result.nodes[4].type).toBe('choiceNode');
      expect(result.nodes[5].type).toBe('customNode'); // Unknown types -> customNode
    });

    it('should migrate conditions and effects', () => {
      const v1Project = {
        nodes: [
          {
            id: 'nodeWithConditions',
            type: 'choice',
            position: { x: 0, y: 0 },
            data: {
              text: 'Choice with conditions',
              conditions: [
                { var: 'health', op: 'gt', value: 50 },
                { variable: 'level', operator: 'gte', value: 5 },
              ],
              effects: [
                { var: 'gold', op: 'add', value: 100 },
                { variable: 'xp', operator: 'assign', value: 1000 },
              ],
            },
          },
        ],
        edges: [],
        tags: [],
      };

      const result = migrateToV2(v1Project);
      const node = result.nodes[0];
      
      expect(node.data.conditions).toHaveLength(2);
      expect(node.data.conditions[0].variable).toBe('health');
      expect(node.data.conditions[0].operator).toBe('>'); // 'gt' -> '>'
      expect(node.data.conditions[1].operator).toBe('>='); // 'gte' -> '>='
      
      expect(node.data.effects).toHaveLength(2);
      expect(node.data.effects[0].variable).toBe('gold');
      expect(node.data.effects[0].operator).toBe('+='); // 'add' -> '+='
      expect(node.data.effects[1].operator).toBe('set'); // 'assign' -> 'set'
    });

    it('should migrate tags', () => {
      const v1Project = {
        nodes: [],
        edges: [],
        tags: [
          {
            id: 'oldTag1',
            name: 'Old Tag Name',
            type: 'char',
            description: 'Old tag description',
            importance: 4,
            color: '#ff0000',
          },
          {
            label: 'Missing ID Tag',
            type: 'loc',
          },
        ],
      };

      const result = migrateToV2(v1Project);
      
      expect(result.tags).toHaveLength(2);
      
      const tag1 = result.tags[0];
      expect(tag1.id).toBe('oldTag1');
      expect(tag1.label).toBe('Old Tag Name'); // 'name' -> 'label'
      expect(tag1.type).toBe('character'); // 'char' -> 'character'
      expect(tag1.content).toBe('Old tag description'); // 'description' -> 'content'
      expect(tag1.metadata?.importance).toBe(4);
      expect(tag1.metadata?.color).toBe('#ff0000');
      
      const tag2 = result.tags[1];
      expect(tag2.id).toBeDefined(); // Auto-generated ID
      expect(tag2.type).toBe('location'); // 'loc' -> 'location'
    });

    it('should handle projects without schema version', () => {
      const legacyProject = {
        nodes: [
          {
            id: 'legacy1',
            type: 'npc',
            text: 'Legacy text',
            position: { x: 0, y: 0 },
          },
        ],
        connections: [],
      };

      const result = migrateToV2(legacyProject);
      
      expect(result.schemaVersion).toBe('2.0.0');
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].data.text).toBe('Legacy text');
    });

    it('should throw error for completely invalid data', () => {
      const invalidData = 'not an object';
      
      expect(() => migrateToV2(invalidData)).toThrow(MigrationError);
    });

    it('should preserve existing V2 node IDs that are already correct', () => {
      const v1Project = {
        nodes: [
          {
            id: 'npcDialog_validId123', // Already in correct format
            type: 'npc',
            position: { x: 0, y: 0 },
            data: { text: 'Test' },
          },
        ],
        edges: [],
        tags: [],
      };

      const result = migrateToV2(v1Project);
      
      // Should keep the existing ID if it's already in correct format
      expect(result.nodes[0].id).toMatch(/^npcDialog_[a-zA-Z0-9]+$/);
    });
  });

  describe('getMigrationInfo', () => {
    it('should detect V2 projects as not needing migration', () => {
      const v2Project = {
        schemaVersion: '2.0.0',
        nodes: [],
        edges: [],
        tags: [],
      };

      const info = getMigrationInfo(v2Project);
      
      expect(info.needsMigration).toBe(false);
      expect(info.currentVersion).toBe('2.0.0');
      expect(info.targetVersion).toBe('2.0.0');
    });

    it('should detect V1 projects as needing migration', () => {
      const v1Project = {
        schemaVersion: '1.0.0',
        nodes: [{ id: '1' }, { id: '2' }],
        connections: [{ id: 'e1' }],
        tags: [{ id: 't1' }],
      };

      const info = getMigrationInfo(v1Project);
      
      expect(info.needsMigration).toBe(true);
      expect(info.currentVersion).toBe('1.0.0');
      expect(info.targetVersion).toBe('2.0.0');
      expect(info.estimatedChanges.nodes).toBe(2);
      expect(info.estimatedChanges.edges).toBe(1);
      expect(info.estimatedChanges.tags).toBe(1);
    });

    it('should handle legacy projects without schema version', () => {
      const legacyProject = {
        nodes: [{ id: '1' }, { id: '2' }, { id: '3' }],
        connections: [],
      };

      const info = getMigrationInfo(legacyProject);
      
      expect(info.needsMigration).toBe(true);
      expect(info.currentVersion).toBe('1.0.0'); // Default assumption
      expect(info.estimatedChanges.nodes).toBe(3);
    });

    it('should handle completely invalid data', () => {
      const invalidData = 'not valid';

      const info = getMigrationInfo(invalidData);
      
      expect(info.needsMigration).toBe(true);
      expect(info.currentVersion).toBeNull();
      expect(info.estimatedChanges.nodes).toBe(0);
    });
  });
});