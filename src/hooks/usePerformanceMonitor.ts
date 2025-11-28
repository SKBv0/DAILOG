import { useEffect, useRef, useCallback } from "react";
import { performanceProfiler } from "../utils/performanceProfiler";
import { isFeatureEnabled } from "../config/features";
import logger from "../utils/logger";

export interface PerformanceMonitorOptions {
  trackRenders?: boolean;
  trackMemory?: boolean;
  reportInterval?: number; // ms
  componentName?: string;
  // Memory warning tuning
  memoryThresholdMB?: number; // default 150MB
  consecutiveBreachesForWarn?: number; // default 3
  smoothingWindowSize?: number; // default 5
  logCooldownMs?: number; // default 60000
}

export interface PerformanceReport {
  renders: number;
  averageRenderTime: number;
  memoryUsage: number;
  bundleSize?: number;
  recommendations: string[];
  timestamp: number;
}

export function usePerformanceMonitor(options: PerformanceMonitorOptions = {}) {
  const {
    trackRenders = true,
    trackMemory = true,
    reportInterval = 30000, // 30 seconds
    componentName = "Component",
    memoryThresholdMB = 150,
    consecutiveBreachesForWarn = 3,
    smoothingWindowSize = 5,
    logCooldownMs = 60000,
  } = options;

  const renderCount = useRef(0);
  const renderTimes = useRef<number[]>([]);
  const lastReportTime = useRef(Date.now());
  const enabled = useRef(isFeatureEnabled("PERFORMANCE_PROFILING") && import.meta.env.DEV);
  const memoryHistory = useRef<number[]>([]);
  const memoryBreachStreak = useRef(0);
  const lastMemoryWarnAt = useRef(0);

  useEffect(() => {
    if (!enabled.current || !trackRenders || import.meta.env.PROD) return;

    const startTime = performance.now();
    renderCount.current++;

    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      renderTimes.current.push(renderTime);

      // Keep only last 100 render times to prevent memory leak
      if (renderTimes.current.length > 100) {
        renderTimes.current = renderTimes.current.slice(-100);
      }

      performanceProfiler.trackComponentRender(componentName);
    };
  });

  const generateReport = useCallback((): PerformanceReport | null => {
    if (!enabled.current) return null;

    const averageRenderTime =
      renderTimes.current.length > 0
        ? renderTimes.current.reduce((sum, time) => sum + time, 0) / renderTimes.current.length
        : 0;

    const rawMemoryUsed = trackMemory ? performanceProfiler.getMemoryUsage()?.used || 0 : 0;

    // Smoothing: maintain short moving window to avoid noisy spikes
    if (trackMemory && rawMemoryUsed > 0) {
      memoryHistory.current.push(rawMemoryUsed);
      if (memoryHistory.current.length > smoothingWindowSize) {
        memoryHistory.current = memoryHistory.current.slice(-smoothingWindowSize);
      }
    }

    const memoryUsedAvg =
      memoryHistory.current.length > 0
        ? memoryHistory.current.reduce((s, v) => s + v, 0) / memoryHistory.current.length
        : rawMemoryUsed;

    const recommendations: string[] = [];

    if (renderCount.current > 50 && averageRenderTime > 16) {
      recommendations.push(
        `${componentName} renders frequently (${renderCount.current}) and slowly (${averageRenderTime.toFixed(2)}ms avg)`
      );
    }

    if (trackMemory && memoryUsedAvg > 0) {
      const thresholdBytes = memoryThresholdMB * 1024 * 1024;
      const now = Date.now();
      if (memoryUsedAvg > thresholdBytes) {
        memoryBreachStreak.current += 1;
      } else {
        memoryBreachStreak.current = 0;
      }

      const cooldownOk = now - lastMemoryWarnAt.current > logCooldownMs;
      if (memoryBreachStreak.current >= consecutiveBreachesForWarn && cooldownOk) {
        recommendations.push(
          `${componentName} using significant memory: ${(memoryUsedAvg / 1024 / 1024).toFixed(2)}MB`
        );
        lastMemoryWarnAt.current = now;
      }
    }

    return {
      renders: renderCount.current,
      averageRenderTime,
      memoryUsage: memoryUsedAvg,
      recommendations,
      timestamp: Date.now(),
    };
  }, [
    componentName,
    trackMemory,
    memoryThresholdMB,
    smoothingWindowSize,
    consecutiveBreachesForWarn,
    logCooldownMs,
  ]);

  useEffect(() => {
    if (!enabled.current || reportInterval <= 0) return;

    const interval = setInterval(
      () => {
        const now = Date.now();
        if (now - lastReportTime.current >= reportInterval) {
          const report = generateReport();
          if (report && (report.renders > 0 || report.recommendations.length > 0)) {
            logger.debug(`Performance Report for ${componentName}:`, report);

            if (report.recommendations.length > 0 && import.meta.env.DEV) {
              logger.warn(
                `Performance recommendations for ${componentName}:`,
                report.recommendations
              );
            }
          }
          lastReportTime.current = now;
        }
      },
      Math.max(reportInterval / 10, 1000)
    ); // Check every 1/10th of report interval, min 1s

    return () => clearInterval(interval);
  }, [reportInterval, generateReport, componentName]);

  const measureFunction = useCallback(
    async <T>(name: string, fn: () => T | Promise<T>): Promise<{ result: T; duration: number }> => {
      if (!enabled.current) {
        return { result: await fn(), duration: 0 };
      }

      return performanceProfiler.measureFunction(`${componentName}.${name}`, fn);
    },
    [componentName]
  );

  const startMeasurement = useCallback(
    (name: string, metadata?: Record<string, any>) => {
      if (!enabled.current) return;
      performanceProfiler.startMeasurement(`${componentName}.${name}`, metadata);
    },
    [componentName]
  );

  const endMeasurement = useCallback(
    (name: string) => {
      if (!enabled.current) return null;
      return performanceProfiler.endMeasurement(`${componentName}.${name}`);
    },
    [componentName]
  );

  const onRenderCallback = useCallback(
    (
      _id: string,
      phase: "mount" | "update",
      actualDuration: number,
      baseDuration: number,
      startTime: number,
      commitTime: number
    ) => {
      if (!enabled.current) return;

      performanceProfiler.startMeasurement(`${componentName}.render.${phase}`);

      if (actualDuration > 16) {
        logger.warn(`Slow ${phase} render in ${componentName}:`, {
          actualDuration,
          baseDuration,
          startTime,
          commitTime,
        });
      }

      performanceProfiler.endMeasurement(`${componentName}.render.${phase}`);
    },
    [componentName]
  );

  useEffect(() => {
    if (!enabled.current || !trackMemory) return;

    const checkMemoryLeak = () => {
      const currentMemory = performanceProfiler.getMemoryUsage()?.used || 0;
      const previousMemory = (performance as any).memory?.usedJSHeapSize || 0;

      if (currentMemory > previousMemory * 1.5) {
        // 50% increase
        logger.warn(
          `Potential memory leak in ${componentName}. Memory usage: ${(currentMemory / 1024 / 1024).toFixed(2)}MB`
        );
      }
    };

    // Check for memory leaks every 60 seconds
    const memoryCheckInterval = setInterval(checkMemoryLeak, 60000);

    return () => clearInterval(memoryCheckInterval);
  }, [componentName, trackMemory]);

  return {
    renderCount: renderCount.current,
    averageRenderTime:
      renderTimes.current.length > 0
        ? renderTimes.current.reduce((sum, time) => sum + time, 0) / renderTimes.current.length
        : 0,

    measureFunction,
    startMeasurement,
    endMeasurement,
    generateReport,
    onRenderCallback,

    enabled: enabled.current,

    reset: () => {
      renderCount.current = 0;
      renderTimes.current = [];
      lastReportTime.current = Date.now();
    },
  };
}

if (typeof window !== "undefined" && import.meta.env.DEV) {
  (window as any).generatePerformanceReport = () => {
    const report = performanceProfiler.generateReport();
    logger.debug("Complete Performance Report", report);
    return report;
  };
}

export default usePerformanceMonitor;
