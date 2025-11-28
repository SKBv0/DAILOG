/**
 * Golden file tests for JSON snapshot validation
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ProjectV2 } from '../../domain/schema';
import { migrateToV2 } from '../../domain/migrate';
import { validateProject } from '../../domain/validate';

// Get the directory of this test file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const GOLDEN_DIR = join(__dirname, 'golden-files');

// Sample projects for golden file testing
const sampleProjects = {
  minimal: {
    schemaVersion: '2.0.0' as const,
    nodes: [],
    edges: [],
    tags: [],
  },

  simple: {
    schemaVersion: '2.0.0' as const,
    nodes: [
      {
        id: 'npcDialog_welcome',
        type: 'npcDialog' as const,
        position: { x: 100, y: 100 },
        data: {
          text: 'Welcome to our village!',
          speaker: 'Village Guard',
          conditions: [],
          effects: [],
          tags: ['intro', 'village'],
        },
      },
      {
        id: 'playerResponse_thanks',
        type: 'playerResponse' as const,
        position: { x: 300, y: 100 },
        data: {
          text: 'Thank you for the welcome!',
          conditions: [],
          effects: [],
          tags: ['polite'],
        },
      },
    ],
    edges: [
      {
        id: 'edge_welcome_thanks',
        source: 'npcDialog_welcome',
        target: 'playerResponse_thanks',
        type: 'default',
      },
    ],
    tags: [
      {
        id: 'tag_village_guard',
        label: 'Village Guard',
        type: 'character' as const,
        content: 'The friendly guard at the village entrance',
        metadata: {
          importance: 3,
          color: '#4a90e2',
        },
      },
    ],
  },

  complex: {
    schemaVersion: '2.0.0' as const,
    nodes: [
      {
        id: 'npcDialog_questGiver',
        type: 'npcDialog' as const,
        position: { x: 100, y: 100 },
        data: {
          text: 'I have a quest for you, brave adventurer!',
          speaker: 'Quest Master',
          conditions: [
            {
              variable: 'playerLevel',
              operator: '>=' as const,
              value: 5,
              description: 'Player must be at least level 5',
            },
            {
              variable: 'hasCompletedTutorial',
              operator: '==' as const,
              value: true,
            },
          ],
          effects: [
            {
              variable: 'questsOffered',
              operator: '+=' as const,
              value: 1,
            },
          ],
          tags: ['quest', 'important', 'npc'],
        },
      },
      {
        id: 'choiceNode_acceptQuest',
        type: 'choiceNode' as const,
        position: { x: 400, y: 50 },
        data: {
          text: 'Will you accept this quest?',
          conditions: [],
          effects: [],
          tags: ['choice', 'quest'],
        },
      },
      {
        id: 'playerResponse_accept',
        type: 'playerResponse' as const,
        position: { x: 700, y: 0 },
        data: {
          text: 'Yes, I accept the quest!',
          conditions: [],
          effects: [
            {
              variable: 'activeQuests',
              operator: '+=' as const,
              value: 1,
            },
            {
              variable: 'questAccepted_tutorial',
              operator: 'set' as const,
              value: true,
            },
          ],
          tags: ['accept', 'eager'],
        },
      },
      {
        id: 'playerResponse_decline',
        type: 'playerResponse' as const,
        position: { x: 700, y: 100 },
        data: {
          text: 'I\'m not ready for this quest yet.',
          conditions: [],
          effects: [
            {
              variable: 'questsDeclined',
              operator: '+=' as const,
              value: 1,
            },
          ],
          tags: ['decline', 'cautious'],
        },
      },
      {
        id: 'npcDialog_questAccepted',
        type: 'npcDialog' as const,
        position: { x: 1000, y: 0 },
        data: {
          text: 'Excellent! Go to the ancient forest and retrieve the crystal.',
          speaker: 'Quest Master',
          conditions: [],
          effects: [],
          tags: ['quest', 'instructions'],
        },
      },
      {
        id: 'npcDialog_questDeclined',
        type: 'npcDialog' as const,
        position: { x: 1000, y: 100 },
        data: {
          text: 'Come back when you feel more prepared.',
          speaker: 'Quest Master',
          conditions: [],
          effects: [],
          tags: ['quest', 'understanding'],
        },
      },
    ],
    edges: [
      {
        id: 'edge_quest_choice',
        source: 'npcDialog_questGiver',
        target: 'choiceNode_acceptQuest',
        type: 'default',
      },
      {
        id: 'edge_choice_accept',
        source: 'choiceNode_acceptQuest',
        target: 'playerResponse_accept',
        label: 'Accept',
        animated: true,
      },
      {
        id: 'edge_choice_decline',
        source: 'choiceNode_acceptQuest',
        target: 'playerResponse_decline',
        label: 'Decline',
      },
      {
        id: 'edge_accept_accepted',
        source: 'playerResponse_accept',
        target: 'npcDialog_questAccepted',
        type: 'default',
      },
      {
        id: 'edge_decline_declined',
        source: 'playerResponse_decline',
        target: 'npcDialog_questDeclined',
        type: 'default',
      },
    ],
    tags: [
      {
        id: 'tag_quest_master',
        label: 'Quest Master',
        type: 'character' as const,
        content: 'An experienced adventurer who now gives quests to newcomers',
        metadata: {
          importance: 5,
          description: 'Key NPC for quest system',
          color: '#ff6b35',
        },
      },
      {
        id: 'tag_ancient_forest',
        label: 'Ancient Forest',
        type: 'location' as const,
        content: 'A mysterious forest where ancient magic still flows',
        metadata: {
          importance: 4,
          description: 'Primary quest location',
          color: '#2ecc71',
        },
      },
      {
        id: 'tag_crystal_artifact',
        label: 'Magic Crystal',
        type: 'item' as const,
        content: 'A powerful artifact hidden deep within the ancient forest',
        metadata: {
          importance: 5,
          description: 'Quest objective item',
          color: '#9b59b6',
        },
      },
    ],
    metadata: {
      createdAt: '2024-01-01T00:00:00.000Z',
      lastModified: '2024-01-01T12:00:00.000Z',
      projectType: 'game' as const,
      description: 'Complex quest dialog with branching choices and conditions',
    },
  },
};

// Migration test cases
const v1ProjectSamples = {
  simple_v1: {
    schemaVersion: '1.0.0',
    nodes: [
      {
        id: 'old_npc_1',
        type: 'npc',
        position: { x: 100, y: 100 },
        data: {
          text: 'Hello from V1!',
          speaker: 'Old NPC',
        },
      },
      {
        id: 'old_player_1',
        type: 'player',
        position: { x: 300, y: 100 },
        data: {
          text: 'Player response',
        },
      },
    ],
    connections: [
      {
        id: 'old_edge_1',
        source: 'old_npc_1',
        target: 'old_player_1',
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
  },

  legacy_no_version: {
    nodes: [
      {
        id: 'legacy_node',
        type: 'npc',
        text: 'Legacy format without data wrapper',
        position: { x: 0, y: 0 },
      },
    ],
    connections: [],
  },
};

describe('Golden File Tests', () => {
  beforeAll(() => {
    // Ensure golden files directory exists
    if (!existsSync(GOLDEN_DIR)) {
      require('fs').mkdirSync(GOLDEN_DIR, { recursive: true });
    }
  });

  describe('Project Serialization', () => {
    Object.entries(sampleProjects).forEach(([name, project]) => {
      it(`should match golden file for ${name} project`, () => {
        const goldenFile = join(GOLDEN_DIR, `${name}.json`);
        const serialized = JSON.stringify(project, null, 2);
        
        if (existsSync(goldenFile)) {
          // Compare with existing golden file
          const golden = readFileSync(goldenFile, 'utf-8').replace(/\r\n/g, '\n');
          const normalizedSerialized = serialized.replace(/\r\n/g, '\n');
          expect(normalizedSerialized).toBe(golden);
        } else {
          // Create new golden file
          writeFileSync(goldenFile, serialized, 'utf-8');
          console.log(`Created golden file: ${goldenFile}`);
          expect(serialized).toBeTruthy(); // Just ensure we have content
        }
      });
    });
  });

  describe('Migration Golden Files', () => {
    Object.entries(v1ProjectSamples).forEach(([name, v1Project]) => {
      it(`should match migration golden file for ${name}`, () => {
        const migratedProject = migrateToV2(v1Project);
        const goldenFile = join(GOLDEN_DIR, `migrated_${name}.json`);
        const serialized = JSON.stringify(migratedProject, null, 2);
        
        if (existsSync(goldenFile)) {
          const golden = readFileSync(goldenFile, 'utf-8').replace(/\r\n/g, '\n');
          const normalizedSerialized = serialized.replace(/\r\n/g, '\n');
          expect(normalizedSerialized).toBe(golden);
        } else {
          writeFileSync(goldenFile, serialized, 'utf-8');
          console.log(`Created migration golden file: ${goldenFile}`);
          expect(migratedProject.schemaVersion).toBe('2.0.0');
        }
      });
    });
  });

  describe('Validation Results', () => {
    Object.entries(sampleProjects).forEach(([name, project]) => {
      it(`should match validation golden file for ${name} project`, () => {
        const validationResult = validateProject(project);
        const goldenFile = join(GOLDEN_DIR, `validation_${name}.json`);
        
        // Create a serializable version of the validation result
        const serializableResult = {
          isValid: validationResult.isValid,
          errors: validationResult.errors,
          warnings: validationResult.warnings,
          statistics: validationResult.statistics,
        };
        
        const serialized = JSON.stringify(serializableResult, null, 2);
        
        if (existsSync(goldenFile)) {
          const golden = readFileSync(goldenFile, 'utf-8').replace(/\r\n/g, '\n');
          const normalizedSerialized = serialized.replace(/\r\n/g, '\n');
          expect(normalizedSerialized).toBe(golden);
        } else {
          writeFileSync(goldenFile, serialized, 'utf-8');
          console.log(`Created validation golden file: ${goldenFile}`);
          expect(serializableResult).toBeTruthy();
        }
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty project consistently', () => {
      const emptyProject = {
        schemaVersion: '2.0.0' as const,
        nodes: [],
        edges: [],
        tags: [],
      };
      
      const goldenFile = join(GOLDEN_DIR, 'empty_project.json');
      const serialized = JSON.stringify(emptyProject, null, 2);
      
      if (existsSync(goldenFile)) {
        const golden = readFileSync(goldenFile, 'utf-8').replace(/\r\n/g, '\n');
        const normalizedSerialized = serialized.replace(/\r\n/g, '\n');
        expect(normalizedSerialized).toBe(golden);
      } else {
        writeFileSync(goldenFile, serialized, 'utf-8');
        console.log(`Created empty project golden file: ${goldenFile}`);
      }
    });

    it('should handle malformed data consistently', () => {
      const malformedProject = {
        schemaVersion: '2.0.0' as const,
        nodes: [
          {
            id: 'invalid_id_format', // Invalid ID format
            type: 'npcDialog' as const,
            position: { x: 0, y: 0 },
            data: {
              text: '',
              conditions: [],
              effects: [],
              tags: [],
            },
          },
        ],
        edges: [
          {
            id: 'edge_to_nowhere',
            source: 'invalid_id_format',
            target: 'nonexistent_node', // Target doesn't exist
          },
        ],
        tags: [],
      };
      
      const validationResult = validateProject(malformedProject);
      const goldenFile = join(GOLDEN_DIR, 'validation_malformed.json');
      
      const serializableResult = {
        isValid: validationResult.isValid,
        errorCount: validationResult.errors.length,
        warningCount: validationResult.warnings.length,
        errorTypes: validationResult.errors.map(e => e.type),
        warningTypes: validationResult.warnings.map(w => w.type),
      };
      
      const serialized = JSON.stringify(serializableResult, null, 2);
      
      if (existsSync(goldenFile)) {
        const golden = readFileSync(goldenFile, 'utf-8').replace(/\r\n/g, '\n');
        const normalizedSerialized = serialized.replace(/\r\n/g, '\n');
        expect(normalizedSerialized).toBe(golden);
      } else {
        writeFileSync(goldenFile, serialized, 'utf-8');
        console.log(`Created malformed validation golden file: ${goldenFile}`);
      }
      
      // Basic assertions
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Round-trip Consistency', () => {
    Object.entries(sampleProjects).forEach(([name, project]) => {
      it(`should maintain consistency after serialize-deserialize for ${name}`, () => {
        const serialized = JSON.stringify(project);
        const deserialized = JSON.parse(serialized) as ProjectV2;
        const reserialized = JSON.stringify(deserialized);
        
        expect(reserialized).toBe(serialized);
        
        // Validate both versions produce the same validation results
        const originalValidation = validateProject(project);
        const deserializedValidation = validateProject(deserialized);
        
        expect(deserializedValidation.isValid).toBe(originalValidation.isValid);
        expect(deserializedValidation.errors).toEqual(originalValidation.errors);
        expect(deserializedValidation.warnings).toEqual(originalValidation.warnings);
      });
    });
  });
});

// Helper function to update all golden files (for development)
export function updateGoldenFiles() {
  console.log('Updating golden files...');
  
  // Update project golden files
  Object.entries(sampleProjects).forEach(([name, project]) => {
    const goldenFile = join(GOLDEN_DIR, `${name}.json`);
    const serialized = JSON.stringify(project, null, 2);
    writeFileSync(goldenFile, serialized, 'utf-8');
    console.log(`Updated: ${goldenFile}`);
  });
  
  // Update migration golden files
  Object.entries(v1ProjectSamples).forEach(([name, v1Project]) => {
    const migratedProject = migrateToV2(v1Project);
    const goldenFile = join(GOLDEN_DIR, `migrated_${name}.json`);
    const serialized = JSON.stringify(migratedProject, null, 2);
    writeFileSync(goldenFile, serialized, 'utf-8');
    console.log(`Updated: ${goldenFile}`);
  });
  
  console.log('Golden files updated successfully!');
}

// Uncomment to update golden files during development
// updateGoldenFiles();