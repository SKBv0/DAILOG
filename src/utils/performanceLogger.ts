import logger from "./logger";

interface PerformanceLog {
  timestamp: number;
  type: string;
  metric: string;
  value: number;
  unit: string;
  metadata?: Record<string, any>;
}

class PerformanceLogger {
  private logs: PerformanceLog[] = [];
  private autoLogEnabled = true;
  private longTaskObserver: PerformanceObserver | null = null;
  private lcpObserver: PerformanceObserver | null = null;
  private inpObserver: PerformanceObserver | null = null;
  private navigationObserver: PerformanceObserver | null = null;

  constructor() {
    this.initialize();
  }

  private initialize() {
    try {
      if ("PerformanceObserver" in window) {
        this.longTaskObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.entryType === "longtask") {
              const longTask = entry as PerformanceEntry & { duration: number };
              this.log("longtask", "Long Task", longTask.duration, "ms", {
                name: longTask.name,
                startTime: longTask.startTime,
              });
            }
          });
        });
        this.longTaskObserver.observe({ entryTypes: ["longtask"] });
      }

      if ("PerformanceObserver" in window) {
        this.lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;
          if (lastEntry) {
            this.log("lcp", "LCP", lastEntry.renderTime || lastEntry.loadTime, "ms", {
              size: lastEntry.size,
              type: lastEntry.element?.tagName || "unknown",
              element: lastEntry.element?.id || lastEntry.element?.className || "unknown",
            });
          }
        });
        this.lcpObserver.observe({ entryTypes: ["largest-contentful-paint"] });
      }

      if ("PerformanceObserver" in window) {
        this.inpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            const eventEntry = entry as any;
            const isHoverEvent = 
              eventEntry.name === "pointerover" ||
              eventEntry.name === "pointerout" ||
              eventEntry.name === "pointerenter" ||
              eventEntry.name === "pointerleave" ||
              eventEntry.name === "mouseover" ||
              eventEntry.name === "mouseout";
            
            if (isHoverEvent) {
              return;
            }
            
            if (
              (eventEntry.name === "click" ||
               eventEntry.name === "keydown" ||
               eventEntry.name === "pointerdown") &&
              eventEntry.duration > 200
            ) {
              this.log("inp", "INP", eventEntry.duration, "ms", {
                name: eventEntry.name,
                startTime: eventEntry.startTime,
              });
            }
          });
        });
        this.inpObserver.observe({ entryTypes: ["event"] });
      }

      if ("PerformanceObserver" in window) {
        this.navigationObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.entryType === "navigation") {
              const navEntry = entry as PerformanceNavigationTiming;
              this.logNavigationMetrics(navEntry);
            }
          });
        });
        this.navigationObserver.observe({ entryTypes: ["navigation"] });
      }

      if (performance.getEntriesByType) {
        const navEntries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
        if (navEntries.length > 0) {
          this.logNavigationMetrics(navEntries[0]);
        }
      }

      logger.info("[Performance Logger] Initialized.");
      logger.info("[Performance Logger] Commands:");
      logger.info("  - window.logPerformanceMetrics() - Log current metrics");
      logger.info("  - window.exportPerformanceLogs() - Export all logs");
      logger.info("  - window.toggleAutoLog() - Toggle auto-logging");
    } catch (error) {
      logger.error("[Performance Logger] Initialization error:", error);
    }
  }

  private logNavigationMetrics(navEntry: PerformanceNavigationTiming) {
    const total = navEntry.loadEventEnd - navEntry.fetchStart;
    const scripting = navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart;
    const rendering = navEntry.domComplete - navEntry.domInteractive;
    const loading = navEntry.loadEventEnd - navEntry.loadEventStart;

    logger.info("[Performance] Navigation Metrics:", {
      total: `${total.toFixed(2)}ms`,
      scripting: `${scripting.toFixed(2)}ms`,
      rendering: `${rendering.toFixed(2)}ms`,
      loading: `${loading.toFixed(2)}ms`,
    });
  }

  private log(
    type: string,
    metric: string,
    value: number,
    unit: string,
    metadata?: Record<string, any>
  ) {
    if (!this.autoLogEnabled) return;

    const logEntry: PerformanceLog = {
      timestamp: performance.now(),
      type,
      metric,
      value,
      unit,
      metadata,
    };

    this.logs.push(logEntry);

    if (this.logs.length > 1000) {
      this.logs.shift();
    }

    if (import.meta.env.DEV) {
      if (value > 50 || type === "lcp") {
        logger.warn(`[Performance] ${metric}: ${value.toFixed(2)}${unit}`, metadata || {});
      }
    } else {
      if ((type === "longtask" && value > 100) || type === "lcp") {
        logger.warn(`[Performance] ${metric}: ${value.toFixed(2)}${unit}`, metadata || {});
      }
    }
  }

  public logCurrentMetrics() {
    const metrics: Record<string, any> = {};

    if (performance.getEntriesByType) {
      const paintEntries = performance.getEntriesByType("paint") as PerformancePaintTiming[];
      paintEntries.forEach((entry) => {
        if (entry.name === "first-contentful-paint") {
          metrics.fcp = Math.round(entry.startTime);
          logger.info(`[Web Vitals] FCP: ${metrics.fcp}`);
        }
      });

      const navEntries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
      if (navEntries.length > 0) {
        const nav = navEntries[0];
        metrics.ttfb = Math.round(nav.responseStart - nav.requestStart);
        logger.info(`[Web Vitals] TTFB: ${metrics.ttfb}`);
      }
    }

    if (this.lcpObserver) {
      const lcpEntries = performance.getEntriesByType("largest-contentful-paint") as any[];
      if (lcpEntries.length > 0) {
        const lastLcp = lcpEntries[lcpEntries.length - 1];
        metrics.lcp = Math.round(lastLcp.renderTime || lastLcp.loadTime);
        logger.info(`[Web Vitals] LCP: ${metrics.lcp}`);
      }
    }

    return metrics;
  }

  public exportLogs(): string {
    const exportData = {
      timestamp: new Date().toISOString(),
      logs: this.logs,
      summary: this.getSummary(),
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `performance-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    return json;
  }

  private getSummary() {
    const longTasks = this.logs.filter((log) => log.type === "longtask");
    const lcpLogs = this.logs.filter((log) => log.type === "lcp");
    const inpLogs = this.logs.filter((log) => log.type === "inp");

    return {
      totalLogs: this.logs.length,
      longTasks: {
        count: longTasks.length,
        avgDuration: longTasks.length > 0
          ? longTasks.reduce((sum, log) => sum + log.value, 0) / longTasks.length
          : 0,
        maxDuration: longTasks.length > 0
          ? Math.max(...longTasks.map((log) => log.value))
          : 0,
      },
      lcp: {
        count: lcpLogs.length,
        values: lcpLogs.map((log) => log.value),
      },
      inp: {
        count: inpLogs.length,
        avgDuration: inpLogs.length > 0
          ? inpLogs.reduce((sum, log) => sum + log.value, 0) / inpLogs.length
          : 0,
      },
    };
  }

  public toggleAutoLog() {
    this.autoLogEnabled = !this.autoLogEnabled;
    logger.info(`[Performance Logger] Auto-logging ${this.autoLogEnabled ? "enabled" : "disabled"}`);
    return this.autoLogEnabled;
  }

  public cleanup() {
    if (this.longTaskObserver) {
      this.longTaskObserver.disconnect();
    }
    if (this.lcpObserver) {
      this.lcpObserver.disconnect();
    }
    if (this.inpObserver) {
      this.inpObserver.disconnect();
    }
    if (this.navigationObserver) {
      this.navigationObserver.disconnect();
    }
  }
}

const performanceLogger = new PerformanceLogger();

if (typeof window !== "undefined") {
  (window as any).logPerformanceMetrics = () => performanceLogger.logCurrentMetrics();
  (window as any).exportPerformanceLogs = () => performanceLogger.exportLogs();
  (window as any).toggleAutoLog = () => performanceLogger.toggleAutoLog();
}

export default performanceLogger;

