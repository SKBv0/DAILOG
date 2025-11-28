import logger from "../utils/logger";

export const FEATURES = {
  // Enhanced validation with Zod schemas
  ENHANCED_VALIDATION: true,

  // Worker-based import for security and performance
  WORKER_IMPORT: true,

  // Worker-based layout calculation (experimental)
  WORKER_LAYOUT: false, // Will be enabled after testing

  // Edge bundling and smart routing for visual clarity
  EDGE_BUNDLING: true,

  // Panel virtualization for large lists performance
  PANEL_VIRTUALIZATION: true,

  // Performance Optimization Features - Phase 0-4
  PERFORMANCE_PROFILING: import.meta.env.DEV, // Phase 0: Baseline measurement - disabled in production
  ZUSTAND_MEMOIZATION: true, // Phase 1: Selector optimization 
  EDGE_PATH_CACHE: true, // Phase 2: React Flow edge caching 
  FUZZY_SEARCH: true, // Phase 3: Search optimization 
  RENDER_OPTIMIZATION: true, // Phase 1-3: React render optimization 

  // Performance benchmarking tools
  PERFORMANCE_TOOLS: import.meta.env.DEV,
} as const;

export type FeatureFlag = keyof typeof FEATURES;

export function isFeatureEnabled(feature: FeatureFlag): boolean {
  return FEATURES[feature];
}

export function toggleFeature(feature: FeatureFlag): void {
  if (import.meta.env.DEV) {
    // @ts-ignore - We know this is mutable in development
    FEATURES[feature] = !FEATURES[feature];
    logger.debug(`Feature ${feature} is now ${FEATURES[feature] ? "enabled" : "disabled"}`);
  } else {
    logger.warn("Feature flags can only be toggled in development mode");
  }
}

export function getFeatureFlags(): Record<FeatureFlag, boolean> {
  return { ...FEATURES };
}
