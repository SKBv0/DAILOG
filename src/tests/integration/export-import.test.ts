/**
 * Integration tests for export→import cycle integrity
 */
import { describe, it, expect } from 'vitest';
import { ProjectV2 } from '../../domain/schema';
import { importService } from '../../services/importService';
import { validateProject } from '../../domain/validate';

describe('Export-Import Integration', () => {
  const sampleProject: ProjectV2 = {
    schemaVersion: '2.0.0',
    nodes: [
      {
        id: 'npcDialog_start',
        type: 'npcDialog',
        position: { x: 100, y: 100 },
        data: {
          text: 'Welcome to our village, traveler!',
          speaker: 'Village Guard',
          conditions: [
            {
              variable: 'playerLevel',
              operator: '>=',
              value: 1,
              description: 'Player must be at least level 1',
            },
          ],
          effects: [
            {
              variable: 'visitedVillage',
              operator: 'set',
              value: true,
            },
          ],
          tags: ['intro', 'village', 'guard'],
        },
      },
      {
        id: 'playerResponse_greet',
        type: 'playerResponse',
        position: { x: 300, y: 100 },
        data: {
          text: 'Thank you for the warm welcome!',
          conditions: [],
          effects: [],
          tags: ['polite'],
        },
      },
      {
        id: 'choiceNode_whatToDo',
        type: 'choiceNode',
        position: { x: 500, y: 100 },
        data: {
          text: 'What would you like to do?',
          conditions: [],
          effects: [],
          tags: ['choice', 'hub'],
        },
      },
    ],
    edges: [
      {
        id: 'edge_start_greet',
        source: 'npcDialog_start',
        target: 'playerResponse_greet',
        type: 'default',
      },
      {
        id: 'edge_greet_choice',
        source: 'playerResponse_greet',
        target: 'choiceNode_whatToDo',
        label: 'Continue conversation',
        animated: true,
      },
    ],
    tags: [
      {
        id: 'tag_village_guard',
        label: 'Village Guard',
        type: 'character',
        content: 'A friendly guard who welcomes visitors to the village',
        metadata: {
          importance: 3,
          description: 'Key NPC for village introduction',
          color: '#4a90e2',
        },
      },
      {
        id: 'tag_village_location',
        label: 'Village Square',
        type: 'location',
        content: 'The main square where travelers enter the village',
        metadata: {
          importance: 4,
          description: 'Central hub location',
          color: '#7ed321',
        },
      },
    ],
    metadata: {
      createdAt: '2024-01-01T00:00:00.000Z',
      lastModified: '2024-01-01T12:00:00.000Z',
      projectType: 'game',
      description: 'Sample village introduction dialog',
    },
  };

  describe('JSON Export-Import Cycle', () => {
    it('should preserve project data through JSON export-import', async () => {
      // Export project to JSON
      const exported = JSON.stringify(sampleProject, null, 2);
      
      // Import back from JSON
      const importResult = await importService.importProject(exported, 'test.json');
      
      expect(importResult.success).toBe(true);
      if (!importResult.success) return;
      
      const imported = importResult.project;
      
      // Verify schema version
      expect(imported.schemaVersion).toBe('2.0.0');
      
      // Verify nodes
      expect(imported.nodes).toHaveLength(sampleProject.nodes.length);
      for (let i = 0; i < sampleProject.nodes.length; i++) {
        const original = sampleProject.nodes[i];
        const restored = imported.nodes[i];
        
        expect(restored.id).toBe(original.id);
        expect(restored.type).toBe(original.type);
        expect(restored.position).toEqual(original.position);
        expect(restored.data.text).toBe(original.data.text);
        expect(restored.data.speaker).toBe(original.data.speaker);
        expect(restored.data.conditions).toEqual(original.data.conditions);
        expect(restored.data.effects).toEqual(original.data.effects);
        expect(restored.data.tags).toEqual(original.data.tags);
      }
      
      // Verify edges
      expect(imported.edges).toHaveLength(sampleProject.edges.length);
      for (let i = 0; i < sampleProject.edges.length; i++) {
        const original = sampleProject.edges[i];
        const restored = imported.edges[i];
        
        expect(restored.id).toBe(original.id);
        expect(restored.source).toBe(original.source);
        expect(restored.target).toBe(original.target);
        expect(restored.type).toBe(original.type);
        expect(restored.label).toBe(original.label);
        expect(restored.animated).toBe(original.animated);
      }
      
      // Verify tags
      expect(imported.tags).toHaveLength(sampleProject.tags.length);
      for (let i = 0; i < sampleProject.tags.length; i++) {
        const original = sampleProject.tags[i];
        const restored = imported.tags[i];
        
        expect(restored.id).toBe(original.id);
        expect(restored.label).toBe(original.label);
        expect(restored.type).toBe(original.type);
        expect(restored.content).toBe(original.content);
        expect(restored.metadata).toEqual(original.metadata);
      }
      
      // Verify metadata
      expect(imported.metadata).toEqual(sampleProject.metadata);
    });

    it('should handle migration during import correctly', async () => {
      const v1Project = {
        schemaVersion: '1.0.0',
        nodes: [
          {
            id: 'old_node_1',
            type: 'npc',
            position: { x: 100, y: 200 },
            data: {
              text: 'Hello from V1!',
              speaker: 'Old NPC',
            },
          },
          {
            id: 'old_node_2',
            type: 'player',
            position: { x: 300, y: 200 },
            data: {
              text: 'Player response',
            },
          },
        ],
        connections: [
          {
            id: 'old_edge_1',
            source: 'old_node_1',
            target: 'old_node_2',
          },
        ],
        tags: [
          {
            id: 'old_tag_1',
            name: 'Old Character',
            type: 'char',
            description: 'A character from V1',
            importance: 3,
            color: '#ff0000',
          },
        ],
      };
      
      const exported = JSON.stringify(v1Project);
      const importResult = await importService.importProject(exported, 'v1_project.json');
      
      expect(importResult.success).toBe(true);
      if (!importResult.success) return;
      
      // Check migration info
      expect(importResult.migrationInfo).toBeDefined();
      expect(importResult.migrationInfo?.wasMigrated).toBe(true);
      expect(importResult.migrationInfo?.fromVersion).toBe('1.0.0');
      expect(importResult.migrationInfo?.toVersion).toBe('2.0.0');
      
      const imported = importResult.project;
      
      // Verify migrated project structure
      expect(imported.schemaVersion).toBe('2.0.0');
      expect(imported.nodes).toHaveLength(2);
      expect(imported.edges).toHaveLength(1);
      expect(imported.tags).toHaveLength(1);
      
      // Verify node type migration
      expect(imported.nodes[0].type).toBe('npcDialog'); // 'npc' -> 'npcDialog'
      expect(imported.nodes[1].type).toBe('playerResponse'); // 'player' -> 'playerResponse'
      
      // Verify ID format
      expect(imported.nodes[0].id).toMatch(/^npcDialog_/);
      expect(imported.nodes[1].id).toMatch(/^playerResponse_/);
      
      // Verify tag migration
      expect(imported.tags[0].label).toBe('Old Character'); // 'name' -> 'label'
      expect(imported.tags[0].type).toBe('character'); // 'char' -> 'character'
      expect(imported.tags[0].content).toBe('A character from V1'); // 'description' -> 'content'
      expect(imported.tags[0].metadata?.importance).toBe(3);
      expect(imported.tags[0].metadata?.color).toBe('#ff0000');
    });

    it('should maintain validation integrity after import', async () => {
      const exported = JSON.stringify(sampleProject);
      const importResult = await importService.importProject(exported);
      
      expect(importResult.success).toBe(true);
      if (!importResult.success) return;
      
      // Validate the imported project
      const validationResult = validateProject(importResult.project);
      
      expect(validationResult.isValid).toBe(true);
      expect(validationResult.errors).toHaveLength(0);
      
      // Check validation summary from import
      expect(importResult.validationSummary.isValid).toBe(true);
      expect(importResult.validationSummary.errors).toBe(0);
    });

    it('should handle edge cases gracefully', async () => {
      // Test with minimal project
      const minimalProject: ProjectV2 = {
        schemaVersion: '2.0.0',
        nodes: [],
        edges: [],
        tags: [],
      };
      
      const exported = JSON.stringify(minimalProject);
      const importResult = await importService.importProject(exported);
      
      expect(importResult.success).toBe(true);
      if (!importResult.success) return;
      
      expect(importResult.project.nodes).toHaveLength(0);
      expect(importResult.project.edges).toHaveLength(0);
      expect(importResult.project.tags).toHaveLength(0);
      expect(importResult.validationSummary.isValid).toBe(true);
    });

    it('should preserve Unicode and special characters', async () => {
      const unicodeProject: ProjectV2 = {
        schemaVersion: '2.0.0',
        nodes: [
          {
            id: 'npcDialog_unicode',
            type: 'npcDialog',
            position: { x: 0, y: 0 },
            data: {
              text: '¡Hola! Καλησπέρα! こんにちは! 🌟✨',
              speaker: 'Multilingual NPC 😊',
              conditions: [],
              effects: [],
              tags: ['unicode', '多言語', 'émojis'],
            },
          },
        ],
        edges: [],
        tags: [
          {
            id: 'tag_unicode',
            label: 'Unicode Test ™️',
            type: 'general',
            content: 'Testing unicode: αβγδε 中文 العربية',
          },
        ],
      };
      
      const exported = JSON.stringify(unicodeProject);
      const importResult = await importService.importProject(exported);
      
      expect(importResult.success).toBe(true);
      if (!importResult.success) return;
      
      const imported = importResult.project;
      expect(imported.nodes[0].data.text).toBe('¡Hola! Καλησπέρα! こんにちは! 🌟✨');
      expect(imported.nodes[0].data.speaker).toBe('Multilingual NPC 😊');
      expect(imported.nodes[0].data.tags).toEqual(['unicode', '多言語', 'émojis']);
      expect(imported.tags[0].label).toBe('Unicode Test ™️');
      expect(imported.tags[0].content).toBe('Testing unicode: αβγδε 中文 العربية');
    });
  });

  describe('Error Handling', () => {
    it('should reject invalid JSON gracefully', async () => {
      const invalidJson = '{ "nodes": [invalid json';
      
      const importResult = await importService.importProject(invalidJson);
      
      expect(importResult.success).toBe(false);
      if (importResult.success) return;
      
      expect(importResult.errorCode).toBe('INVALID_JSON');
      expect(importResult.userMessage).toContain('valid JSON');
    });

    it('should reject oversized files', async () => {
      // Create a large string (> 15MB)
      const largeData = 'x'.repeat(16 * 1024 * 1024);
      
      const importResult = await importService.importProject(largeData);
      
      expect(importResult.success).toBe(false);
      if (importResult.success) return;
      
      expect(importResult.errorCode).toBe('FILE_TOO_LARGE');
      expect(importResult.userMessage).toContain('15MB');
    });

    it('should handle projects with broken references', async () => {
      const brokenProject = {
        schemaVersion: '2.0.0',
        nodes: [
          {
            id: 'npcDialog_existing',
            type: 'npcDialog',
            position: { x: 0, y: 0 },
            data: {
              text: 'I exist',
              conditions: [],
              effects: [],
              tags: [],
            },
          },
        ],
        edges: [
          {
            id: 'edge_broken',
            source: 'npcDialog_existing',
            target: 'npcDialog_nonexistent', // This node doesn't exist
          },
        ],
        tags: [],
      };
      
      const exported = JSON.stringify(brokenProject);
      const importResult = await importService.importProject(exported);
      
      expect(importResult.success).toBe(false);
      if (importResult.success) return;
      
      expect(importResult.errorCode).toBe('VALIDATION_FAILED');
    });
  });

  describe('Performance', () => {
    it('should handle reasonably large projects efficiently', async () => {
      // Generate a project with many nodes and edges
      const nodeCount = 500;
      const nodes = Array.from({ length: nodeCount }, (_, i) => ({
        id: `npcDialog_node${i}`,
        type: 'npcDialog' as const,
        position: { x: (i % 20) * 100, y: Math.floor(i / 20) * 100 },
        data: {
          text: `Node ${i} text`,
          conditions: [],
          effects: [],
          tags: [`tag${i % 10}`],
        },
      }));
      
      const edges = Array.from({ length: Math.min(1000, nodeCount - 1) }, (_, i) => ({
        id: `edge_${i}`,
        source: `npcDialog_node${i}`,
        target: `npcDialog_node${(i + 1) % nodeCount}`,
      }));
      
      const largeProject: ProjectV2 = {
        schemaVersion: '2.0.0',
        nodes,
        edges,
        tags: [],
      };
      
      const startTime = Date.now();
      const exported = JSON.stringify(largeProject);
      const exportTime = Date.now() - startTime;
      
      const importStartTime = Date.now();
      const importResult = await importService.importProject(exported);
      const importTime = Date.now() - importStartTime;
      
      expect(importResult.success).toBe(true);
      
      // Performance expectations (these are generous)
      expect(exportTime).toBeLessThan(1000); // Export should take < 1s
      expect(importTime).toBeLessThan(5000);  // Import should take < 5s
      
      if (!importResult.success) return;
      expect(importResult.project.nodes).toHaveLength(nodeCount);
      expect(importResult.project.edges).toHaveLength(edges.length);
    });
  });
});