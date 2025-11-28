import { DialogNode } from '../types/dialog';
import { Connection } from '../types/nodes';
import logger from '../utils/logger';

export interface BundledEdge {
  id: string;
  source: string;
  target: string;
  bundleId: string;
  bundleIndex: number;
  bundleSize: number;
  path?: string;
  style?: React.CSSProperties;
  animated?: boolean;
}

export interface EdgeBundle {
  id: string;
  sourceNode: string;
  targetNode: string;
  connections: Connection[];
  mainPath: string;
  subPaths: string[];
  style: React.CSSProperties;
}

export interface SmartRoutingOptions {
  bundleThreshold: number;
  maxBundleSpacing: number;
  avoidanceRadius: number;
  cornerRadius: number;
  enableBundling: boolean;
  enableSmartRouting: boolean;
  bundleAnimated: boolean;
}

class EdgeBundlingService {
  private defaultOptions: SmartRoutingOptions = {
    bundleThreshold: 3,
    maxBundleSpacing: 20,
    avoidanceRadius: 80,
    cornerRadius: 8,
    enableBundling: true,
    enableSmartRouting: true,
    bundleAnimated: false,
  };

  processConnections(
    nodes: DialogNode[],
    connections: Connection[],
    options: Partial<SmartRoutingOptions> = {}
  ): BundledEdge[] {
    const opts = { ...this.defaultOptions, ...options };
    
    logger.debug('[EdgeBundlingService] Processing connections', {
      nodes: nodes.length,
      connections: connections.length,
      options: opts
    });

    const nodePositions = new Map<string, { x: number; y: number }>();
    nodes.forEach(node => {
      nodePositions.set(node.id, node.position);
    });

    const connectionGroups = this.groupConnectionsByPath(connections);
    const bundledEdges: BundledEdge[] = [];
    
    for (const [pathKey, groupConnections] of connectionGroups.entries()) {
      const [sourceId, targetId] = pathKey.split('->');
      const sourcePos = nodePositions.get(sourceId);
      const targetPos = nodePositions.get(targetId);
      
      if (!sourcePos || !targetPos) {
        groupConnections.forEach((conn) => {
          bundledEdges.push(this.createUnbundledEdge(conn));
        });
        continue;
      }

      if (opts.enableBundling && groupConnections.length >= opts.bundleThreshold) {
        const bundleId = `bundle-${sourceId}-${targetId}`;
        const bundle = this.createEdgeBundle(
          bundleId,
          sourceId,
          targetId,
          groupConnections,
          sourcePos,
          targetPos,
          opts
        );
        
        bundledEdges.push(...bundle.edges);
      } else {
        groupConnections.forEach((conn) => {
          const routedEdge = this.createSmartRoutedEdge(
            conn,
            sourcePos,
            targetPos,
            nodes,
            opts
          );
          bundledEdges.push(routedEdge);
        });
      }
    }

    logger.debug('[EdgeBundlingService] Processing completed', {
      originalConnections: connections.length,
      bundledEdges: bundledEdges.length,
      bundles: Array.from(connectionGroups.entries())
        .filter(([, conns]) => conns.length >= opts.bundleThreshold)
        .length
    });

    return bundledEdges;
  }

  private groupConnectionsByPath(connections: Connection[]): Map<string, Connection[]> {
    const groups = new Map<string, Connection[]>();
    
    connections.forEach(conn => {
      const pathKey = `${conn.source}->${conn.target}`;
      const existing = groups.get(pathKey) || [];
      existing.push(conn);
      groups.set(pathKey, existing);
    });
    
    return groups;
  }

  private createEdgeBundle(
    bundleId: string,
    _sourceId: string,
    _targetId: string,
    connections: Connection[],
    sourcePos: { x: number; y: number },
    targetPos: { x: number; y: number },
    options: SmartRoutingOptions
  ): { edges: BundledEdge[] } {
    const edges: BundledEdge[] = [];
    const mainPath = this.calculateBundlePath(sourcePos, targetPos);
    
    connections.forEach((conn, index) => {
      const bundleOffset = this.calculateBundleOffset(index, connections.length, options);
      
      const bundledEdge: BundledEdge = {
        id: conn.id || `${conn.source}-${conn.target}-${index}`,
        source: conn.source,
        target: conn.target,
        bundleId,
        bundleIndex: index,
        bundleSize: connections.length,
        path: this.offsetPath(mainPath, bundleOffset),
        style: this.getBundleEdgeStyle(index, connections.length),
        animated: options.bundleAnimated && index === 0,
      };
      
      edges.push(bundledEdge);
    });
    
    return { edges };
  }

  private createSmartRoutedEdge(
    connection: Connection,
    sourcePos: { x: number; y: number },
    targetPos: { x: number; y: number },
    nodes: DialogNode[],
    options: SmartRoutingOptions
  ): BundledEdge {
    let path: string | undefined;
    
    if (options.enableSmartRouting) {
      path = this.calculateSmartPath(sourcePos, targetPos, nodes);
    }
    
    return {
      id: connection.id || `${connection.source}-${connection.target}`,
      source: connection.source,
      target: connection.target,
      bundleId: `single-${connection.source}-${connection.target}`,
      bundleIndex: 0,
        bundleSize: 1,
        path,
        style: this.getSmartEdgeStyle(),
      };
  }

  private createUnbundledEdge(connection: Connection): BundledEdge {
    return {
      id: connection.id || `${connection.source}-${connection.target}`,
      source: connection.source,
      target: connection.target,
      bundleId: `unbundled-${connection.source}-${connection.target}`,
      bundleIndex: 0,
      bundleSize: 1,
      style: this.getDefaultEdgeStyle(),
    };
  }

  private calculateBundlePath(
    sourcePos: { x: number; y: number },
    targetPos: { x: number; y: number }
  ): string {
    const dx = targetPos.x - sourcePos.x;
    const dy = targetPos.y - sourcePos.y;
    
    if (Math.abs(dx) > 200 || Math.abs(dy) > 100) {
      const controlPoint1 = {
        x: sourcePos.x + dx * 0.3,
        y: sourcePos.y
      };
      const controlPoint2 = {
        x: targetPos.x - dx * 0.3,
        y: targetPos.y
      };
      
      return `M ${sourcePos.x},${sourcePos.y} C ${controlPoint1.x},${controlPoint1.y} ${controlPoint2.x},${controlPoint2.y} ${targetPos.x},${targetPos.y}`;
    }
    
    return `M ${sourcePos.x},${sourcePos.y} L ${targetPos.x},${targetPos.y}`;
  }

  private calculateSmartPath(
    sourcePos: { x: number; y: number },
    targetPos: { x: number; y: number },
    nodes: DialogNode[]
  ): string {
    const dx = targetPos.x - sourcePos.x;
    const dy = targetPos.y - sourcePos.y;
    
    const obstacles = nodes.filter(node => 
      node.position.x !== sourcePos.x && 
      node.position.y !== sourcePos.y &&
      this.isNodeInPath(sourcePos, targetPos, node.position, 80)
    );
    
    if (obstacles.length === 0) {
      return `M ${sourcePos.x},${sourcePos.y} L ${targetPos.x},${targetPos.y}`;
    }
    
    const midPoint = {
      x: sourcePos.x + dx / 2,
      y: sourcePos.y + dy / 2
    };
    
    const avoidanceOffset = obstacles.length * 30;
    const offsetMidPoint = {
      x: midPoint.x + (dy > 0 ? avoidanceOffset : -avoidanceOffset),
      y: midPoint.y + (dx > 0 ? -avoidanceOffset : avoidanceOffset)
    };
    
    return `M ${sourcePos.x},${sourcePos.y} Q ${offsetMidPoint.x},${offsetMidPoint.y} ${targetPos.x},${targetPos.y}`;
  }

  private isNodeInPath(
    start: { x: number; y: number },
    end: { x: number; y: number },
    nodePos: { x: number; y: number },
    radius: number
  ): boolean {
    const A = end.y - start.y;
    const B = start.x - end.x;
    const C = end.x * start.y - start.x * end.y;
    
    const distance = Math.abs(A * nodePos.x + B * nodePos.y + C) / Math.sqrt(A * A + B * B);
    
    return distance < radius;
  }

  private calculateBundleOffset(
    index: number,
    totalCount: number,
    options: SmartRoutingOptions
  ): { x: number; y: number } {
    const maxSpacing = options.maxBundleSpacing;
    const spacing = Math.min(maxSpacing, maxSpacing * (totalCount - 1) / Math.max(totalCount - 1, 1));
    const startOffset = -(spacing * (totalCount - 1)) / 2;
    
    return {
      x: 0,
      y: startOffset + index * spacing
    };
  }

  private offsetPath(path: string, offset: { x: number; y: number }): string {
    if (offset.x === 0 && offset.y === 0) {
      return path;
    }
    
    return path.replace(/(\d+),(\d+)/g, (_match, x, y) => {
      const newX = parseFloat(x) + offset.x;
      const newY = parseFloat(y) + offset.y;
      return `${newX},${newY}`;
    });
  }

  private getBundleEdgeStyle(
    index: number,
    totalCount: number
  ): React.CSSProperties {
    const isMainEdge = index === 0;
    const opacity = isMainEdge ? 0.8 : 0.4 + (0.4 / totalCount) * (totalCount - index);
    
    return {
      stroke: isMainEdge ? '#3b82f6' : '#6b7280',
      strokeWidth: isMainEdge ? 3 : 2,
      opacity,
      strokeDasharray: isMainEdge ? undefined : '5,5',
    };
  }

  private getSmartEdgeStyle(): React.CSSProperties {
    return {
      stroke: '#4b5563',
      strokeWidth: 2.5,
      opacity: 0.7,
    };
  }

  private getDefaultEdgeStyle(): React.CSSProperties {
    return {
      stroke: '#6b7280',
      strokeWidth: 2,
      opacity: 0.6,
    };
  }

  getBundlingStats(
    connections: Connection[],
    bundledEdges: BundledEdge[]
  ): {
    originalCount: number;
    bundledCount: number;
    bundleCount: number;
    reductionPercentage: number;
  } {
    const bundleIds = new Set(bundledEdges.map(edge => edge.bundleId));
    const bundleCount = Array.from(bundleIds).filter(id => id.startsWith('bundle-')).length;
    
    return {
      originalCount: connections.length,
      bundledCount: bundledEdges.length,
      bundleCount,
      reductionPercentage: bundleCount > 0 ? 
        Math.round(((connections.length - bundleCount) / connections.length) * 100) : 0
    };
  }
}

export const edgeBundlingService = new EdgeBundlingService();