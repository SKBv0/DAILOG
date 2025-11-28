import * as Comlink from "comlink";
import dagre from "dagre";
import type { DialogNode, Connection } from "../types/editor";

interface LayoutOptions {
  nodeWidth?: number;
  rankdir?: "TB" | "LR";
  ranksep?: number;
  nodesep?: number;
  edgesep?: number;
  heightBuffer?: number;
}

interface LayoutRequest {
  nodes: DialogNode[];
  connections: Connection[];
  options?: LayoutOptions;
}

interface LayoutStats {
  lastCalculationTime: number;
  calculationCount: number;
  averageCalculationTime: number;
  lastError: string | null;
}

const AVG_CHAR_WIDTH = 7;
const LINE_HEIGHT = 20;
const VERTICAL_PADDING = 30;
const HEADER_HEIGHT = 25;
const MIN_NODE_HEIGHT = 100;

class AutoLayoutWorker {
  private layoutStats: LayoutStats = {
    lastCalculationTime: 0,
    calculationCount: 0,
    averageCalculationTime: 0,
    lastError: null,
  };

  private estimateNodeHeight(data: DialogNode["data"], width: number, buffer: number = 20): number {
    const text = data?.text || "";
    const horizontalPadding = 20;
    const effectiveWidth = width - horizontalPadding;
    const charsPerLine = Math.max(1, Math.floor(effectiveWidth / AVG_CHAR_WIDTH));
    const numLines = Math.ceil(text.length / charsPerLine) || 1;
    const textHeight = numLines * LINE_HEIGHT;
    const calculatedHeight = HEADER_HEIGHT + VERTICAL_PADDING + textHeight + buffer;

    return Math.max(MIN_NODE_HEIGHT, calculatedHeight);
  }

  async calculateLayout(request: LayoutRequest): Promise<DialogNode[]> {
    const startTime = performance.now();

    try {
      const {
        nodeWidth = 250,
        rankdir = "TB",
        ranksep = 100,
        nodesep = 100,
        edgesep = 50,
        heightBuffer = 20,
      } = request.options || {};

      const g = new dagre.graphlib.Graph();

      g.setGraph({
        rankdir,
        ranksep,
        nodesep,
        edgesep,
        marginx: 50,
        marginy: 50,
      });

      g.setDefaultEdgeLabel(() => ({}));

      request.nodes.forEach((node) => {
        const estimatedHeight = this.estimateNodeHeight(node.data, nodeWidth, heightBuffer);
        g.setNode(node.id, {
          width: nodeWidth,
          height: estimatedHeight,
          x: node.position.x,
          y: node.position.y,
        });
      });

      request.connections.forEach((conn) => {
        g.setEdge(conn.source, conn.target);
      });

      dagre.layout(g);

      const positionedNodes = request.nodes.map((node) => {
        const nodeWithPosition = g.node(node.id);
        return {
          ...node,
          position: {
            x: nodeWithPosition.x,
            y: nodeWithPosition.y,
          },
        };
      });

      const endTime = performance.now();
      const calculationTime = endTime - startTime;

      this.layoutStats.calculationCount++;
      this.layoutStats.lastCalculationTime = calculationTime;
      this.layoutStats.averageCalculationTime =
        (this.layoutStats.averageCalculationTime * (this.layoutStats.calculationCount - 1) +
          calculationTime) /
        this.layoutStats.calculationCount;
      this.layoutStats.lastError = null;

      return positionedNodes;
    } catch (error) {
      this.layoutStats.lastError = error instanceof Error ? error.message : String(error);

      return request.nodes;
    }
  }

  async calculateLayoutBatched(
    request: LayoutRequest & { batchSize?: number }
  ): Promise<DialogNode[]> {
    const batchSize = request.batchSize || 200;

    if (request.nodes.length <= batchSize) {
      return this.calculateLayout(request);
    }

    const rootNodes = this.findRootNodes(request.nodes, request.connections);
    const processedNodes = new Set<string>();
    const finalNodes: DialogNode[] = [];

    let currentOffset = { x: 0, y: 0 };

    for (const rootNode of rootNodes) {
      const subtreeNodes: DialogNode[] = [];
      const subtreeConnections: Connection[] = [];

      this.collectSubtree(
        rootNode.id,
        request.nodes,
        request.connections,
        subtreeNodes,
        subtreeConnections,
        processedNodes
      );

      if (subtreeNodes.length > 0) {
        const layoutedSubtree = await this.calculateLayout({
          nodes: subtreeNodes,
          connections: subtreeConnections,
          options: request.options,
        });

        const offsetSubtree = layoutedSubtree.map((node) => ({
          ...node,
          position: {
            x: node.position.x + currentOffset.x,
            y: node.position.y + currentOffset.y,
          },
        }));

        finalNodes.push(...offsetSubtree);

        const subtreeBounds = this.calculateBounds(offsetSubtree);
        currentOffset.x = subtreeBounds.maxX + 300;
      }

      await new Promise((resolve) => setTimeout(resolve, 1));
    }

    const unprocessedNodes = request.nodes.filter((node) => !processedNodes.has(node.id));
    if (unprocessedNodes.length > 0) {
      const layoutedUnprocessed = await this.calculateLayout({
        nodes: unprocessedNodes,
        connections: request.connections.filter((conn) =>
          unprocessedNodes.some((n) => n.id === conn.source || n.id === conn.target)
        ),
        options: request.options,
      });

      const offsetUnprocessed = layoutedUnprocessed.map((node) => ({
        ...node,
        position: {
          x: node.position.x + currentOffset.x,
          y: node.position.y + currentOffset.y,
        },
      }));

      finalNodes.push(...offsetUnprocessed);
    }

    return finalNodes;
  }

  private findRootNodes(nodes: DialogNode[], connections: Connection[]): DialogNode[] {
    const nodesWithIncomingConnections = new Set(connections.map((conn) => conn.target));

    return nodes.filter((node) => !nodesWithIncomingConnections.has(node.id));
  }

  private collectSubtree(
    nodeId: string,
    allNodes: DialogNode[],
    allConnections: Connection[],
    subtreeNodes: DialogNode[],
    subtreeConnections: Connection[],
    processedNodes: Set<string>
  ): void {
    if (processedNodes.has(nodeId)) {
      return;
    }

    const node = allNodes.find((n) => n.id === nodeId);
    if (!node) {
      return;
    }

    processedNodes.add(nodeId);
    subtreeNodes.push(node);

    const outgoingConnections = allConnections.filter((conn) => conn.source === nodeId);

    for (const connection of outgoingConnections) {
      subtreeConnections.push(connection);
      this.collectSubtree(
        connection.target,
        allNodes,
        allConnections,
        subtreeNodes,
        subtreeConnections,
        processedNodes
      );
    }
  }

  private calculateBounds(nodes: DialogNode[]): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } {
    if (nodes.length === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }

    const positions = nodes.map((n) => n.position);
    const minX = Math.min(...positions.map((p) => p.x));
    const maxX = Math.max(...positions.map((p) => p.x));
    const minY = Math.min(...positions.map((p) => p.y));
    const maxY = Math.max(...positions.map((p) => p.y));

    return { minX, maxX, minY, maxY };
  }

  async calculateOptimalOptions(
    nodes: DialogNode[],
    connections: Connection[]
  ): Promise<LayoutOptions> {
    const nodeCount = nodes.length;
    const connectionCount = connections.length;
    const density = nodeCount > 0 ? connectionCount / nodeCount : 0;

    let options: LayoutOptions = {
      nodeWidth: 250,
      rankdir: "LR", // Default to left-right for dialog trees
      ranksep: 150,
      nodesep: 100,
      edgesep: 50,
      heightBuffer: 20,
    };

    if (density > 1.5) {
      options.ranksep = 200;
      options.nodesep = 120;
      options.edgesep = 60;
    }

    if (nodeCount > 50) {
      const rootNodes = this.findRootNodes(nodes, connections);
      const avgBranching = rootNodes.length > 0 ? nodeCount / rootNodes.length : 1;

      if (avgBranching > 10) {
        options.rankdir = "TB"; // Top-bottom for wide, shallow trees
        options.ranksep = 120;
        options.nodesep = 80;
      }
    }

    return options;
  }

  getLayoutStats(): LayoutStats {
    return { ...this.layoutStats };
  }

  clearStats(): void {
    this.layoutStats = {
      lastCalculationTime: 0,
      calculationCount: 0,
      averageCalculationTime: 0,
      lastError: null,
    };
  }
}

const autoLayoutWorker = new AutoLayoutWorker();
export default autoLayoutWorker;

Comlink.expose(autoLayoutWorker);
