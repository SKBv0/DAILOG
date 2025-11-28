import { useMemo, useCallback } from 'react';
import { DialogNode } from '../types/dialog';
import { Connection } from '../types/nodes';
import { 
  edgeBundlingService, 
  BundledEdge, 
  SmartRoutingOptions 
} from '../services/edgeBundlingService';
import { isFeatureEnabled } from '../config/features';
import logger from '../utils/logger';

export interface EdgeBundlingHookOptions extends Partial<SmartRoutingOptions> {
  enabled?: boolean;
  debugMode?: boolean;
}

export interface EdgeBundlingResult {
  bundledEdges: BundledEdge[];
  originalConnections: Connection[];
  stats: {
    originalCount: number;
    bundledCount: number;
    bundleCount: number;
    reductionPercentage: number;
  };
  isEnabled: boolean;
}

export function useEdgeBundling(
  nodes: DialogNode[],
  connections: Connection[],
  options: EdgeBundlingHookOptions = {}
) {
  const {
    enabled = true,
    debugMode = false,
    bundleThreshold = 3,
    maxBundleSpacing = 20,
    avoidanceRadius = 80,
    cornerRadius = 8,
    enableBundling = true,
    enableSmartRouting = true,
    bundleAnimated = false,
    ...restOptions
  } = options;

  const isFeatureActive = isFeatureEnabled('EDGE_BUNDLING') && enabled;

  const bundlingResult = useMemo((): EdgeBundlingResult => {
    if (!isFeatureActive || nodes.length === 0 || connections.length === 0) {
      return {
        bundledEdges: connections.map((conn, index) => ({
          id: conn.id || `${conn.source}-${conn.target}`,
          source: conn.source,
          target: conn.target,
          bundleId: `unbundled-${index}`,
          bundleIndex: 0,
          bundleSize: 1,
        })),
        originalConnections: connections,
        stats: {
          originalCount: connections.length,
          bundledCount: connections.length,
          bundleCount: 0,
          reductionPercentage: 0,
        },
        isEnabled: false,
      };
    }

    const startTime = performance.now();

    const bundledEdges = edgeBundlingService.processConnections(
      nodes,
      connections,
      {
        bundleThreshold,
        maxBundleSpacing,
        avoidanceRadius,
        cornerRadius,
        enableBundling,
        enableSmartRouting,
        bundleAnimated,
        ...restOptions,
      }
    );

    const stats = edgeBundlingService.getBundlingStats(connections, bundledEdges);
    const processingTime = performance.now() - startTime;

    if (debugMode) {
      logger.debug('[useEdgeBundling] Processing completed', {
        processingTime: `${processingTime.toFixed(2)}ms`,
        stats,
        options: {
          bundleThreshold,
          maxBundleSpacing,
          avoidanceRadius,
          enableBundling,
          enableSmartRouting,
        }
      });
    }

    return {
      bundledEdges,
      originalConnections: connections,
      stats,
      isEnabled: true,
    };
  }, [
    nodes, 
    connections, 
    isFeatureActive,
    bundleThreshold,
    maxBundleSpacing,
    avoidanceRadius,
    cornerRadius,
    enableBundling,
    enableSmartRouting,
    bundleAnimated,
    debugMode,
    restOptions
  ]);

  const reactFlowEdges = useMemo(() => {
    return bundlingResult.bundledEdges.map(bundledEdge => ({
      id: bundledEdge.id,
      source: bundledEdge.source,
      target: bundledEdge.target,
      type: bundledEdge.path ? 'custom' : 'default',
      data: {
        bundleId: bundledEdge.bundleId,
        bundleIndex: bundledEdge.bundleIndex,
        bundleSize: bundledEdge.bundleSize,
        customPath: bundledEdge.path,
      },
      style: bundledEdge.style,
      animated: bundledEdge.animated || false,
      className: bundledEdge.bundleSize > 1 ? 'bundled-edge' : 'single-edge',
    }));
  }, [bundlingResult.bundledEdges]);

  const toggleBundling = useCallback(() => {
    logger.debug('[useEdgeBundling] Toggling bundling feature');
  }, []);

  const updateOptions = useCallback((newOptions: Partial<SmartRoutingOptions>) => {
    logger.debug('[useEdgeBundling] Updating bundling options', newOptions);
  }, []);

  const getBundleInfo = useCallback((edgeId: string) => {
    const bundledEdge = bundlingResult.bundledEdges.find(edge => edge.id === edgeId);
    if (!bundledEdge) return null;

    const bundleEdges = bundlingResult.bundledEdges.filter(
      edge => edge.bundleId === bundledEdge.bundleId
    );

    return {
      bundleId: bundledEdge.bundleId,
      bundleSize: bundledEdge.bundleSize,
      bundleIndex: bundledEdge.bundleIndex,
      isMainEdge: bundledEdge.bundleIndex === 0,
      bundleEdges,
    };
  }, [bundlingResult.bundledEdges]);

  const getBundleEdges = useCallback((bundleId: string) => {
    return bundlingResult.bundledEdges.filter(edge => edge.bundleId === bundleId);
  }, [bundlingResult.bundledEdges]);

  const shouldUseBundling = useMemo(() => {
    const complexity = connections.length / Math.max(nodes.length, 1);
    const hasMultipleConnections = connections.length > 10;
    const hasDenseConnections = complexity > 1.5;
    
    return isFeatureActive && (hasMultipleConnections || hasDenseConnections);
  }, [connections.length, nodes.length, isFeatureActive]);

  return {
    bundledEdges: bundlingResult.bundledEdges,
    reactFlowEdges,
    stats: bundlingResult.stats,
    isEnabled: bundlingResult.isEnabled,
    shouldUseBundling,
    toggleBundling,
    updateOptions,
    getBundleInfo,
    getBundleEdges,
    currentOptions: {
      bundleThreshold,
      maxBundleSpacing,
      avoidanceRadius,
      cornerRadius,
      enableBundling,
      enableSmartRouting,
      bundleAnimated,
    },
  };
}