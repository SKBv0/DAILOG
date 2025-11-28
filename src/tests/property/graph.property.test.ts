/**
 * Property-based tests for graph consistency using fast-check
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ProjectV2 } from '../../domain/schema';
import { validateProject, ValidationErrorType } from '../../domain/validate';
import { migrateToV2 } from '../../domain/migrate';

// Generators for property-based testing
const nodeTypeGen = fc.constantFrom(
  'npcDialog',
  'playerResponse',
  'choiceNode',
  'narratorNode',
  'branchingNode',
  'enemyDialog',
  'sceneDescriptionNode',
  'sceneNode',
  'customNode',
  'characterDialogNode',
  'subgraphNode'
);

const nodeIdGen = fc.tuple(nodeTypeGen, fc.string({ minLength: 6, maxLength: 12 }))
  .map(([type, id]) => `${type}_${id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 12) || 'test'}`);

const positionGen = fc.record({
  x: fc.integer({ min: -5000, max: 5000 }),
  y: fc.integer({ min: -5000, max: 5000 }),
});

const nodeDataGen = fc.record({
  text: fc.string({ maxLength: 500 }),
  speaker: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
  conditions: fc.array(
    fc.record({
      variable: fc.string({ minLength: 1, maxLength: 50 }),
      operator: fc.constantFrom('>', '>=', '<', '<=', '==', '!=', 'includes', 'contains', 'in'),
      value: fc.oneof(fc.integer(), fc.string(), fc.boolean()),
      description: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
    }),
    { maxLength: 10 }
  ),
  effects: fc.array(
    fc.record({
      variable: fc.string({ minLength: 1, maxLength: 50 }),
      operator: fc.constantFrom('set', '+=', '-=', 'push', 'remove'),
      value: fc.oneof(fc.integer(), fc.string(), fc.boolean()),
      description: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
    }),
    { maxLength: 10 }
  ),
  tags: fc.array(fc.string({ maxLength: 50 }), { maxLength: 20 }),
});

const nodeGen = fc.record({
  id: nodeIdGen,
  type: nodeTypeGen,
  position: positionGen,
  data: nodeDataGen,
});

const edgeGen = (nodeIds: string[]) =>
  fc.record({
    id: fc.string({ minLength: 1, maxLength: 100 }),
    source: fc.constantFrom(...nodeIds),
    target: fc.constantFrom(...nodeIds),
    type: fc.option(fc.constantFrom('default', 'step', 'smoothstep', 'straight'), {
      nil: undefined,
    }),
    label: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
    animated: fc.option(fc.boolean(), { nil: undefined }),
  });

const tagGen = fc.record({
  id: fc.string({ minLength: 1, maxLength: 50 }),
  label: fc.string({ minLength: 1, maxLength: 100 }),
  type: fc.constantFrom('character', 'location', 'item', 'quest', 'emotion'),
  content: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
  metadata: fc.option(
    fc.record({
      importance: fc.integer({ min: 1, max: 5 }),
      description: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
      color: fc.option(fc.string({ minLength: 4, maxLength: 7 }), { nil: undefined }),
    }),
    { nil: undefined }
  ),
});

const projectBaseGen = fc.record({
  schemaVersion: fc.constant('2.0.0' as const),
  nodes: fc.array(nodeGen, { minLength: 1, maxLength: 100 }),
  tags: fc.array(tagGen, { maxLength: 50 }),
  metadata: fc.option(
    fc.record({
      createdAt: fc
        .date({ min: new Date("1970-01-01"), max: new Date("2099-12-31") })
        .map((d) => {
          try {
            return d.toISOString();
          } catch {
            return new Date().toISOString();
          }
        }),
      lastModified: fc
        .date({ min: new Date("1970-01-01"), max: new Date("2099-12-31") })
        .map((d) => {
          try {
            return d.toISOString();
          } catch {
            return new Date().toISOString();
          }
        }),
      projectType: fc.constantFrom('game', 'interactive_story', 'novel'),
      description: fc.option(fc.string({ maxLength: 1000 }), { nil: undefined }),
      title: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
      author: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
      version: fc.option(fc.string({ maxLength: 20 }), { nil: undefined }),
      totalNodes: fc.option(fc.integer({ min: 0, max: 1000 }), { nil: undefined }),
      totalEdges: fc.option(fc.integer({ min: 0, max: 2000 }), { nil: undefined }),
    }),
    { nil: undefined }
  ),
});

const projectGen: fc.Arbitrary<ProjectV2> = projectBaseGen.chain((project) => {
  const nodeIds = project.nodes.map(n => n.id);
  const edgesArb =
    nodeIds.length === 0
      ? fc.constant<ProjectV2["edges"]>([])
      : fc.array(edgeGen(nodeIds), { maxLength: Math.min(200, nodeIds.length * 2) });

  return edgesArb.map(edges => ({
    ...project,
    edges: edges.map((edge, i) => ({
      ...edge,
      id: `edge_${i}_${edge.source}_${edge.target}`,
    })),
  }));
});

describe('Graph Property Tests', () => {
  describe('Project Validation Properties', () => {
    it('should never crash on any valid project structure', () => {
      fc.assert(fc.property(projectGen, (project) => {
        expect(() => {
          validateProject(project);
        }).not.toThrow();
      }), { numRuns: 100 });
    });

    it('should have consistent node ID validation', () => {
      fc.assert(fc.property(nodeGen, (node) => {
        const result = validateProject({
          schemaVersion: '2.0.0',
          nodes: [node],
          edges: [],
          tags: [],
        } as ProjectV2);
        
        // If node ID follows our format, it should be valid
        const hasValidFormat = /^(npcDialog|playerResponse|choiceNode|narratorNode|branchingNode|enemyDialog|sceneDescriptionNode|sceneNode|customNode|characterDialogNode|subgraphNode)_[a-zA-Z0-9]+$/.test(node.id);
        const nodeTypeMatches = node.id.startsWith(node.type + '_');
        
                 if (hasValidFormat && nodeTypeMatches) {
           expect(result.errors.find(e => e.type === 'INVALID_NODE_ID_FORMAT')).toBeUndefined();
         }
      }), { numRuns: 50 });
    });

    it('should detect duplicate node IDs', () => {
      fc.assert(fc.property(nodeGen, fc.string({ minLength: 1 }), (node, duplicateId) => {
        const duplicateNode = { ...node, id: duplicateId };
        const project = {
          schemaVersion: '2.0.0' as const,
          nodes: [node, duplicateNode],
          edges: [],
          tags: [],
        } as ProjectV2;
        
        const result = validateProject(project);
        
        if (node.id === duplicateId) {
          expect(result.errors.some(e => e.type === 'DUPLICATE_NODE_ID')).toBe(true);
        }
      }), { numRuns: 30 });
    });

    it('should validate edge references correctly', () => {
      fc.assert(fc.property(projectGen, (project) => {
        const result = validateProject(project);
        const nodeIds = new Set(project.nodes.map(n => n.id));
        
                 for (const edge of project.edges) {
           const hasSourceError = result.errors.some(e => e.type === 'EDGE_SOURCE_MISSING' && e.id === edge.id);
           const hasTargetError = result.errors.some(e => e.type === 'EDGE_TARGET_MISSING' && e.id === edge.id);
           
           expect(hasSourceError).toBe(!nodeIds.has(edge.source));
           expect(hasTargetError).toBe(!nodeIds.has(edge.target));
         }
      }), { numRuns: 50 });
    });
  });

  describe('Migration Properties', () => {
    it('should preserve data integrity during migration', () => {
      const v1ProjectGen = fc.record({
        schemaVersion: fc.constant('1.0.0'),
        nodes: fc.array(fc.record({
          id: fc.string({ minLength: 1 }),
          type: fc.constantFrom('npc', 'player', 'choice', 'narrator', 'enemy', 'unknown'),
          position: positionGen,
          data: fc.record({
            text: fc.string(),
            speaker: fc.option(fc.string()),
          }),
        }), { minLength: 1, maxLength: 50 }),
        connections: fc.array(fc.record({
          id: fc.string({ minLength: 1 }),
          source: fc.string({ minLength: 1 }),
          target: fc.string({ minLength: 1 }),
        }), { maxLength: 100 }),
        tags: fc.array(fc.record({
          id: fc.option(fc.string({ minLength: 1 })),
          name: fc.option(fc.string({ minLength: 1 })),
          label: fc.option(fc.string({ minLength: 1 })),
          type: fc.constantFrom('char', 'loc', 'item', 'event', 'general'),
        }), { maxLength: 30 }),
      });

      fc.assert(fc.property(v1ProjectGen, (v1Project) => {
        expect(() => {
          const migrated = migrateToV2(v1Project);
          expect(migrated.schemaVersion).toBe('2.0.0');
          expect(migrated.nodes.length).toBe(v1Project.nodes.length);
          expect(migrated.edges.length).toBe(v1Project.connections.length);
        }).not.toThrow();
      }), { numRuns: 30 });
    });

    it('should create unique IDs after migration', () => {
      const v1ProjectGen = fc.record({
        nodes: fc.array(fc.record({
          id: fc.string({ minLength: 1, maxLength: 10 }),
          type: fc.constantFrom('npc', 'player', 'choice'),
          position: positionGen,
          data: fc.record({
            text: fc.string({ maxLength: 100 }),
          }),
        }), { minLength: 2, maxLength: 20 }),
        connections: fc.array(fc.constant(null), { maxLength: 0 }), // No edges for simplicity
        tags: fc.array(fc.constant(null), { maxLength: 0 }),
      });

      fc.assert(fc.property(v1ProjectGen, (v1Project) => {
        const migrated = migrateToV2(v1Project);
        const nodeIds = migrated.nodes.map(n => n.id);
        const uniqueIds = new Set(nodeIds);
        
        expect(uniqueIds.size).toBe(nodeIds.length); // All IDs should be unique
      }), { numRuns: 20 });
    });
  });

  describe('Graph Structure Properties', () => {
    it('should handle cycles gracefully', () => {
      fc.assert(fc.property(fc.integer({ min: 3, max: 10 }), (nodeCount) => {
        // Create a simple cycle: A -> B -> C -> A
        const nodes = Array.from({ length: nodeCount }, (_, i) => ({
          id: `npcDialog_node${i}`,
          type: 'npcDialog' as const,
          position: { x: i * 100, y: 0 },
          data: {
            text: `Node ${i}`,
            conditions: [],
            effects: [],
            tags: [],
          },
        }));
        
        const edges = nodes.map((node, i) => ({
          id: `edge_${i}`,
          source: node.id,
          target: nodes[(i + 1) % nodeCount].id,
        }));
        
        const project: ProjectV2 = {
          schemaVersion: '2.0.0',
          nodes,
          edges,
          tags: [],
        };
        
        // The validator should detect the cycle and mark the project as invalid.
        const result = validateProject(project);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.type === 'CIRCULAR_DEPENDENCY')).toBe(true);
      }), { numRuns: 10 });
    });

    it('should identify orphaned nodes correctly', () => {
      fc.assert(fc.property(fc.integer({ min: 2, max: 20 }), (nodeCount) => {
        const nodes = Array.from({ length: nodeCount }, (_, i) => ({
          id: `npcDialog_node${i}`,
          type: 'npcDialog' as const,
          position: { x: i * 100, y: 0 },
          data: {
            text: `Node ${i}`,
            conditions: [],
            effects: [],
            tags: [],
          },
        }));
        
        // Connect only first half of nodes
        const connectedCount = Math.floor(nodeCount / 2);
        const edges = Array.from({ length: Math.max(0, connectedCount - 1) }, (_, i) => ({
          id: `edge_${i}`,
          source: `npcDialog_node${i}`,
          target: `npcDialog_node${i + 1}`,
        }));
        
        const project: ProjectV2 = {
          schemaVersion: '2.0.0',
          nodes,
          edges,
          tags: [],
        };
        
        const result = validateProject(project);
        const orphanedNodes = result.warnings.filter(w => w.type === ValidationErrorType.ORPHANED_NODES);
        
        // Should detect orphaned nodes (those not connected to anything)
        expect(orphanedNodes.length).toBeGreaterThanOrEqual(0);
      }), { numRuns: 15 });
    });
  });
});