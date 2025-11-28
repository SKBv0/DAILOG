import { ProjectV2, DialogNode } from './schema';
import logger from '../utils/logger';

export enum ValidationErrorType {
  EDGE_SOURCE_MISSING = 'EDGE_SOURCE_MISSING',
  EDGE_TARGET_MISSING = 'EDGE_TARGET_MISSING',
  EDGE_SELF_LOOP = 'EDGE_SELF_LOOP',
  DUPLICATE_NODE_ID = 'DUPLICATE_NODE_ID',
  DUPLICATE_EDGE_ID = 'DUPLICATE_EDGE_ID',
  UNREACHABLE_NODES = 'UNREACHABLE_NODES',
  CIRCULAR_DEPENDENCY = 'CIRCULAR_DEPENDENCY',
  INVALID_NODE_ID_FORMAT = 'INVALID_NODE_ID_FORMAT',
  ORPHANED_NODES = 'ORPHANED_NODES',
  MISSING_ROOT_NODES = 'MISSING_ROOT_NODES',
}

export interface ValidationError {
  type: ValidationErrorType;
  id: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  metadata?: Record<string, unknown>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  info: ValidationError[];
  statistics: {
    totalNodes: number;
    totalEdges: number;
    nodesByType: Record<string, number>;
    rootNodes: number;
    leafNodes: number;
    orphanedNodes: number;
    unreachableNodes: number;
  };
}

export function validateProject(project: ProjectV2): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const info: ValidationError[] = [];
  
  const { nodes, edges } = project;
  
  // Track node IDs for duplicate detection
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  
  // Statistics
  const nodesByType: Record<string, number> = {};
  
  // Validate nodes
  for (const node of nodes) {
    // Check for duplicate node IDs
    if (nodeIds.has(node.id)) {
      errors.push({
        type: ValidationErrorType.DUPLICATE_NODE_ID,
        id: node.id,
        message: `Duplicate node ID: ${node.id}`,
        severity: 'error',
      });
    }
    nodeIds.add(node.id);
    
    // Validate node ID format
    if (!isValidNodeIdFormat(node.id)) {
      errors.push({
        type: ValidationErrorType.INVALID_NODE_ID_FORMAT,
        id: node.id,
        message: `Invalid node ID format: ${node.id}. Expected format: nodeType_uniqueId`,
        severity: 'error',
      });
    }
    
    // Count nodes by type
    nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
  }
  
  // Validate edges
  const incomingEdges = new Map<string, string[]>();
  const outgoingEdges = new Map<string, string[]>();
  
  for (const edge of edges) {
    // Check for duplicate edge IDs
    if (edgeIds.has(edge.id)) {
      errors.push({
        type: ValidationErrorType.DUPLICATE_EDGE_ID,
        id: edge.id,
        message: `Duplicate edge ID: ${edge.id}`,
        severity: 'error',
      });
    }
    edgeIds.add(edge.id);
    
    // Check if source node exists
    if (!nodeIds.has(edge.source)) {
      errors.push({
        type: ValidationErrorType.EDGE_SOURCE_MISSING,
        id: edge.id,
        message: `Edge ${edge.id} references missing source node: ${edge.source}`,
        severity: 'error',
        metadata: { source: edge.source, target: edge.target },
      });
    }
    
    // Check if target node exists
    if (!nodeIds.has(edge.target)) {
      errors.push({
        type: ValidationErrorType.EDGE_TARGET_MISSING,
        id: edge.id,
        message: `Edge ${edge.id} references missing target node: ${edge.target}`,
        severity: 'error',
        metadata: { source: edge.source, target: edge.target },
      });
    }
    
    // Check for self-loops
    if (edge.source === edge.target) {
      warnings.push({
        type: ValidationErrorType.EDGE_SELF_LOOP,
        id: edge.id,
        message: `Edge ${edge.id} creates a self-loop on node: ${edge.source}`,
        severity: 'warning',
        metadata: { node: edge.source },
      });
    }
    
    // Build adjacency lists for graph analysis
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      // Outgoing edges
      if (!outgoingEdges.has(edge.source)) {
        outgoingEdges.set(edge.source, []);
      }
      outgoingEdges.get(edge.source)!.push(edge.target);
      
      // Incoming edges
      if (!incomingEdges.has(edge.target)) {
        incomingEdges.set(edge.target, []);
      }
      incomingEdges.get(edge.target)!.push(edge.source);
    }
  }
  
  // Graph analysis
  const rootNodes = findRootNodes(nodes, incomingEdges);
  const leafNodes = findLeafNodes(nodes, outgoingEdges);
  const orphanedNodes = findOrphanedNodes(nodes, incomingEdges, outgoingEdges);
  const unreachableNodes = findUnreachableNodes(nodes, rootNodes, outgoingEdges);
  const circularDependencies = detectCircularDependencies(nodes, outgoingEdges);
  
  // Report issues
  if (rootNodes.length === 0 && nodes.length > 0) {
    warnings.push({
      type: ValidationErrorType.MISSING_ROOT_NODES,
      id: 'graph',
      message: 'No root nodes found. All nodes have incoming connections.',
      severity: 'warning',
    });
  }
  
  for (const nodeId of orphanedNodes) {
    warnings.push({
      type: ValidationErrorType.ORPHANED_NODES,
      id: nodeId,
      message: `Node ${nodeId} has no connections (orphaned)`,
      severity: 'warning',
    });
  }
  
  for (const nodeId of unreachableNodes) {
    warnings.push({
      type: ValidationErrorType.UNREACHABLE_NODES,
      id: nodeId,
      message: `Node ${nodeId} is unreachable from root nodes`,
      severity: 'warning',
    });
  }
  
  for (const cycle of circularDependencies) {
    errors.push({
      type: ValidationErrorType.CIRCULAR_DEPENDENCY,
      id: cycle.join(' -> '),
      message: `Circular dependency detected: ${cycle.join(' -> ')}`,
      severity: 'error',
      metadata: { cycle },
    });
  }
  
  // Statistics
  const statistics = {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    nodesByType,
    rootNodes: rootNodes.length,
    leafNodes: leafNodes.length,
    orphanedNodes: orphanedNodes.length,
    unreachableNodes: unreachableNodes.length,
  };
  
  const result: ValidationResult = {
    isValid: errors.length === 0,
    errors,
    warnings,
    info,
    statistics,
  };
  
  logger.debug('Project validation completed:', result);
  return result;
}

function isValidNodeIdFormat(id: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9]*_[a-zA-Z0-9]+$/.test(id);
}

function findRootNodes(nodes: DialogNode[], incomingEdges: Map<string, string[]>): string[] {
  return nodes
    .filter(node => !incomingEdges.has(node.id) || incomingEdges.get(node.id)!.length === 0)
    .map(node => node.id);
}

function findLeafNodes(nodes: DialogNode[], outgoingEdges: Map<string, string[]>): string[] {
  return nodes
    .filter(node => !outgoingEdges.has(node.id) || outgoingEdges.get(node.id)!.length === 0)
    .map(node => node.id);
}

function findOrphanedNodes(
  nodes: DialogNode[],
  incomingEdges: Map<string, string[]>,
  outgoingEdges: Map<string, string[]>
): string[] {
  return nodes
    .filter(node => {
      const hasIncoming = incomingEdges.has(node.id) && incomingEdges.get(node.id)!.length > 0;
      const hasOutgoing = outgoingEdges.has(node.id) && outgoingEdges.get(node.id)!.length > 0;
      return !hasIncoming && !hasOutgoing;
    })
    .map(node => node.id);
}

function findUnreachableNodes(
  nodes: DialogNode[],
  rootNodes: string[],
  outgoingEdges: Map<string, string[]>
): string[] {
  const visited = new Set<string>();
  
  function dfs(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    
    const children = outgoingEdges.get(nodeId) || [];
    for (const childId of children) {
      dfs(childId);
    }
  }
  
  // Start DFS from all root nodes
  for (const rootId of rootNodes) {
    dfs(rootId);
  }
  
  // Find nodes that weren't visited
  return nodes
    .filter(node => !visited.has(node.id))
    .map(node => node.id);
}

function detectCircularDependencies(
  nodes: DialogNode[],
  outgoingEdges: Map<string, string[]>
): string[][] {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles: string[][] = [];
  
  function dfs(nodeId: string, path: string[]): void {
    if (recursionStack.has(nodeId)) {
      // Found a cycle
      const cycleStart = path.indexOf(nodeId);
      if (cycleStart >= 0) {
        cycles.push([...path.slice(cycleStart), nodeId]);
      }
      return;
    }
    
    if (visited.has(nodeId)) {
      return;
    }
    
    visited.add(nodeId);
    recursionStack.add(nodeId);
    
    const children = outgoingEdges.get(nodeId) || [];
    for (const childId of children) {
      dfs(childId, [...path, nodeId]);
    }
    
    recursionStack.delete(nodeId);
  }
  
  // Check each node as potential cycle start
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id, []);
    }
  }
  
  return cycles;
}

export function quickValidate(project: ProjectV2): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  const nodeIds = new Set(project.nodes.map(n => n.id));
  
  for (const edge of project.edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push(`Edge ${edge.id} references missing source node: ${edge.source}`);
    }
    if (!nodeIds.has(edge.target)) {
      errors.push(`Edge ${edge.id} references missing target node: ${edge.target}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}