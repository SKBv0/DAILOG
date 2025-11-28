import { usePerformanceMonitor } from "../hooks/usePerformanceMonitor";

/**
 * PerformanceMonitor component - Performance monitoring for AppContent
 * Isolated from AppContent, only logs performance data, doesn't set any state
 */
export const PerformanceMonitor = (): null => {
  usePerformanceMonitor({
    componentName: "AppContent",
    trackRenders: true,
    trackMemory: true,
    reportInterval: 20000,
  });
  return null;
};

