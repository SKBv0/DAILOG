import * as React from "react";
import { isFeatureEnabled } from "../config/features";
import logger from "./logger";

export interface PerformanceMeasurement {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface ProfilerReport {
  timestamp: number;
  measurements: PerformanceMeasurement[];
  memoryUsage?: Record<string, any>;
  renderMetrics?: {
    componentRenderCount: number;
    averageRenderTime: number;
    slowestComponent: string;
  };
}

class PerformanceProfiler {
  private measurements: Map<string, PerformanceMeasurement> = new Map();
  private reports: ProfilerReport[] = [];
  private componentRenderCounts: Map<string, number> = new Map();
  private enabled: boolean;
  private readonly minLogDurationMs = 2;
  private readonly sampleRate = 0.02;
  private lastLogAt: Map<string, number> = new Map();
  private readonly logCooldownMs = 1000;

  constructor() {
    this.enabled = isFeatureEnabled("PERFORMANCE_PROFILING");
    if (this.enabled && typeof window !== "undefined") {
      this.initializeWebVitals();
      this.initializeRenderTracking();
    }
  }

  startMeasurement(name: string, metadata?: Record<string, any>): void {
    if (!this.enabled) return;

    const startTime = performance.now();

    if (typeof performance.mark === "function") {
      performance.mark(`${name}-start`);
    }

    this.measurements.set(name, {
      name,
      startTime,
      metadata,
    });
  }

  endMeasurement(name: string): number | null {
    if (!this.enabled) return null;

    const measurement = this.measurements.get(name);
    if (!measurement) {
      logger.warn(`No measurement found for: ${name}`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - measurement.startTime;

    if (typeof performance.measure === "function") {
      try {
        performance.measure(name, `${name}-start`);
      } catch (error) {
        logger.debug(`Could not create performance measure for ${name}:`, error);
      }
    }

    measurement.endTime = endTime;
    measurement.duration = duration;

    const now = performance.now();
    const last = this.lastLogAt.get(name) || 0;
    const allowByCooldown = now - last > this.logCooldownMs;
    const allowByDuration = duration >= this.minLogDurationMs;
    const allowBySample = Math.random() < this.sampleRate;
    if (allowByCooldown && (allowByDuration || allowBySample)) {
      logger.debug(`Performance measurement completed: ${name} - ${duration.toFixed(2)}ms`);
      this.lastLogAt.set(name, now);
    }
    return duration;
  }

  /**
   * Measure a function execution time
   */
  async measureFunction<T>(
    name: string,
    fn: () => T | Promise<T>,
    metadata?: Record<string, any>
  ): Promise<{ result: T; duration: number }> {
    if (!this.enabled) {
      return { result: await fn(), duration: 0 };
    }

    this.startMeasurement(name, metadata);
    const result = await fn();
    const duration = this.endMeasurement(name) || 0;

    return { result, duration };
  }

  /**
   * Track component render count (for React components)
   */
  trackComponentRender(componentName: string): void {
    if (!this.enabled) return;

    const currentCount = this.componentRenderCounts.get(componentName) || 0;
    this.componentRenderCounts.set(componentName, currentCount + 1);
  }

  /**
   * Record a custom metric measurement
   */
  recordCustomMetric(metricName: string, duration: number, metadata?: Record<string, any>): void {
    if (!this.enabled) return;

    this.measurements.set(metricName, {
      name: metricName,
      startTime: performance.now() - duration,
      endTime: performance.now(),
      duration,
      metadata,
    });

    const now = performance.now();
    const last = this.lastLogAt.get(metricName) || 0;
    const allowByCooldown = now - last > this.logCooldownMs;
    const allowByDuration = duration >= this.minLogDurationMs;
    const allowBySample = Math.random() < this.sampleRate;
    if (allowByCooldown && (allowByDuration || allowBySample)) {
      logger.debug(`Custom metric recorded: ${metricName} - ${duration.toFixed(2)}ms`);
      this.lastLogAt.set(metricName, now);
    }
  }

  /**
   * Get memory usage information
   */
  getMemoryUsage(): Record<string, any> | undefined {
    const perf: any = performance as any;

    if (!this.enabled || typeof perf.memory === "undefined") {
      return undefined;
    }

    return {
      used: perf.memory.usedJSHeapSize,
      total: perf.memory.totalJSHeapSize,
      heapUsed: perf.memory.usedJSHeapSize,
      heapTotal: perf.memory.totalJSHeapSize,
      limit: perf.memory.jsHeapSizeLimit,
    };
  }

  /**
   * Generate a comprehensive performance report
   */
  generateReport(): ProfilerReport {
    const completedMeasurements = Array.from(this.measurements.values()).filter(
      (m) => m.duration !== undefined
    );

    const report: ProfilerReport = {
      timestamp: Date.now(),
      measurements: completedMeasurements,
      memoryUsage: this.getMemoryUsage(),
      renderMetrics: this.getRenderMetrics(),
    };

    this.reports.push(report);
    return report;
  }

  /**
   * Get render metrics summary
   */
  private getRenderMetrics() {
    if (this.componentRenderCounts.size === 0) return undefined;

    const totalRenders = Array.from(this.componentRenderCounts.values()).reduce(
      (sum, count) => sum + count,
      0
    );

    let slowestComponent = "";
    let maxRenders = 0;

    for (const [component, count] of this.componentRenderCounts) {
      if (count > maxRenders) {
        maxRenders = count;
        slowestComponent = component;
      }
    }

    return {
      componentRenderCount: totalRenders,
      averageRenderTime: totalRenders > 0 ? totalRenders / this.componentRenderCounts.size : 0,
      slowestComponent: `${slowestComponent} (${maxRenders} renders)`,
    };
  }

  /**
   * Initialize Web Vitals tracking
   */
  private async initializeWebVitals(): Promise<void> {
    try {
      const webVitalsModule = await import("web-vitals");
      const webVitals: any = webVitalsModule;

      try {
        if (webVitals.getCLS && typeof webVitals.getCLS === "function") {
          webVitals.getCLS((metric: { value: number }) => {
            this.measurements.set("CLS", {
              name: "Cumulative Layout Shift",
              startTime: 0,
              endTime: metric.value,
              duration: metric.value,
              metadata: {
                score:
                  metric.value < 0.1 ? "good" : metric.value < 0.25 ? "needs-improvement" : "poor",
              },
            });
          });
        }
      } catch (clsError) {
        logger.debug("getCLS not available:", clsError);
      }

      try {
        if (webVitals.getFID && typeof webVitals.getFID === "function") {
          webVitals.getFID((metric: { value: number }) => {
            this.measurements.set("FID", {
              name: "First Input Delay",
              startTime: 0,
              endTime: metric.value,
              duration: metric.value,
              metadata: {
                score:
                  metric.value < 100 ? "good" : metric.value < 300 ? "needs-improvement" : "poor",
              },
            });
          });
        }
      } catch (fidError) {
        logger.debug("getFID not available:", fidError);
      }

      try {
        if (webVitals.getFCP && typeof webVitals.getFCP === "function") {
          webVitals.getFCP((metric: { value: number }) => {
            this.measurements.set("FCP", {
              name: "First Contentful Paint",
              startTime: 0,
              endTime: metric.value,
              duration: metric.value,
              metadata: {
                score:
                  metric.value < 1800 ? "good" : metric.value < 3000 ? "needs-improvement" : "poor",
              },
            });
          });
        }
      } catch (fcpError) {
        logger.debug("getFCP not available:", fcpError);
      }

      try {
        if (webVitals.getLCP && typeof webVitals.getLCP === "function") {
          webVitals.getLCP((metric: { value: number }) => {
            this.measurements.set("LCP", {
              name: "Largest Contentful Paint",
              startTime: 0,
              endTime: metric.value,
              duration: metric.value,
              metadata: {
                score:
                  metric.value < 2500 ? "good" : metric.value < 4000 ? "needs-improvement" : "poor",
              },
            });
          });
        }
      } catch (lcpError) {
        logger.debug("getLCP not available:", lcpError);
      }

      try {
        if (webVitals.getTTFB && typeof webVitals.getTTFB === "function") {
          webVitals.getTTFB((metric: { value: number }) => {
            this.measurements.set("TTFB", {
              name: "Time to First Byte",
              startTime: 0,
              endTime: metric.value,
              duration: metric.value,
              metadata: {
                score:
                  metric.value < 800 ? "good" : metric.value < 1800 ? "needs-improvement" : "poor",
              },
            });
          });
        }
      } catch (ttfbError) {
        logger.debug("getTTFB not available:", ttfbError);
      }

      logger.info("Web Vitals tracking initialized");
    } catch (error) {
      logger.warn("Failed to initialize Web Vitals:", error);
    }
  }

  private initializeRenderTracking(): void {
    logger.debug("Render tracking initialized (manual mode)");
  }

  /**
   * Clear all measurements and reset counters
   */
  reset(): void {
    this.measurements.clear();
    this.componentRenderCounts.clear();
    logger.debug("Performance profiler reset");
  }

  /**
   * Export measurements to console for debugging
   */
  exportToConsole(): void {
    if (!this.enabled) return;

    logger.group("Performance Profiler Report");

    logger.debug("Measurements:", this.measurements);
    logger.debug("Component Renders:", Object.fromEntries(this.componentRenderCounts));
    logger.debug("Memory Usage:", this.getMemoryUsage());

    if (this.reports.length > 0) {
      logger.debug("Latest Report:", this.reports[this.reports.length - 1]);
    }

    logger.groupEnd();
  }

  /**
   * Get performance entries from browser API
   */
  getBrowserPerformanceEntries(): PerformanceEntry[] {
    if (typeof performance.getEntries !== "function") {
      return [];
    }

    return performance.getEntries().filter(
      (entry) =>
        entry.name.includes("Dialog") || // Our app-specific measurements
        entry.entryType === "measure" ||
        entry.entryType === "navigation" ||
        entry.entryType === "paint"
    );
  }
}

export const performanceProfiler = new PerformanceProfiler();

export function usePerformanceTracker(componentName: string) {
  React.useEffect(() => {
    performanceProfiler.trackComponentRender(componentName);
  }, [componentName]);

  const startMeasurement = React.useCallback(
    (name: string, metadata?: Record<string, any>) =>
      performanceProfiler.startMeasurement(`${componentName}.${name}`, metadata),
    [componentName]
  );

  const endMeasurement = React.useCallback(
    (name: string) => performanceProfiler.endMeasurement(`${componentName}.${name}`),
    [componentName]
  );

  const measureFunction = React.useCallback(
    <T>(name: string, fn: () => T | Promise<T>) =>
      performanceProfiler.measureFunction(`${componentName}.${name}`, fn),
    [componentName]
  );

  return React.useMemo(
    () => ({
      startMeasurement,
      endMeasurement,
      measureFunction,
    }),
    [startMeasurement, endMeasurement, measureFunction]
  );
}

if (typeof window !== "undefined" && import.meta.env.DEV) {
  (window as any).performanceProfiler = performanceProfiler;
}

export default performanceProfiler;
