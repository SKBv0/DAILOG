const IS_PRODUCTION = (import.meta as any).env?.PROD ?? false;
const DEBUG_MODE = !IS_PRODUCTION;
const LOG_LEVEL = (import.meta as any).env?.VITE_LOG_LEVEL || (IS_PRODUCTION ? "error" : "debug");

enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,
}

const LOG_LEVELS: Record<string, number> = {
  error: LogLevel.ERROR,
  warn: LogLevel.WARN,
  info: LogLevel.INFO,
  debug: LogLevel.DEBUG,
  trace: LogLevel.TRACE,
};

const CURRENT_LOG_LEVEL = LOG_LEVELS[LOG_LEVEL.toLowerCase()] ?? LogLevel.DEBUG;

class LogThrottler {
  private lastByKey = new Map<string, number>();
  private logCounts = new Map<string, number>();
  private readonly MIN_INTERVAL = 2000;
  private readonly MAX_LOGS_PER_KEY = 5;
  private readonly THROTTLE_DURATION = 15000;

  shouldLog(key: string): boolean {
    const now = Date.now();
    const last = this.lastByKey.get(key) || 0;
    const count = this.logCounts.get(key) || 0;

    if (count >= this.MAX_LOGS_PER_KEY) {
      const timeSinceFirst = now - last;
      if (timeSinceFirst < this.THROTTLE_DURATION) {
        return false;
      }
      this.logCounts.set(key, 0);
    }

    if (now - last < this.MIN_INTERVAL) {
      return false;
    }

    this.lastByKey.set(key, now);
    this.logCounts.set(key, count + 1);
    return true;
  }

  getThrottleInfo(key: string): string | null {
    const count = this.logCounts.get(key) || 0;
    if (count >= this.MAX_LOGS_PER_KEY) {
      return `[THROTTLED: ${count} logs in last 30s]`;
    }
    return null;
  }
}

const throttler = new LogThrottler();

const logger = {
  log: (message: string, ...data: unknown[]) => {
    if (CURRENT_LOG_LEVEL >= LogLevel.INFO) {
      console.log(message, ...data);
    }
  },

  info: (message: string, ...data: unknown[]) => {
    if (CURRENT_LOG_LEVEL >= LogLevel.INFO) {
      console.info(`[INFO] ${message}`, ...data);
    }
  },

  warn: (message: string, ...data: unknown[]) => {
    if (CURRENT_LOG_LEVEL >= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`, ...data);
    }
  },

  error: (message: string, ...data: unknown[]) => {
    if (CURRENT_LOG_LEVEL >= LogLevel.ERROR) {
      console.error(`[ERROR] ${message}`, ...data);
    }
  },

  debug: (message: string, ...data: unknown[]) => {
    // Early return for production - skip all processing
    if (IS_PRODUCTION || CURRENT_LOG_LEVEL < LogLevel.DEBUG) return;

    const key = message.includes(":")
      ? message.split(":")[0].trim()
      : message.split(" ")[0] || "debug";

    if (throttler.shouldLog(key)) {
      const throttleInfo = throttler.getThrottleInfo(key);
      const enhancedMessage = throttleInfo ? `${message} ${throttleInfo}` : message;
      console.debug(`[DEBUG] ${enhancedMessage}`, ...data);
    }
  },

  throttledLog: (category: string, message: string, ...data: unknown[]) => {
    if (CURRENT_LOG_LEVEL < LogLevel.DEBUG) return;

    if (throttler.shouldLog(category)) {
      const throttleInfo = throttler.getThrottleInfo(category);
      const enhancedMessage = throttleInfo ? `${message} ${throttleInfo}` : message;
      console.log(`[${category.toUpperCase()}] ${enhancedMessage}`, ...data);
    }
  },

  dialogLog: (subcategory: string, message: string, ...data: unknown[]) => {
    if (CURRENT_LOG_LEVEL < LogLevel.DEBUG) return;

    const key = `dialog_${subcategory}`;
    if (throttler.shouldLog(key)) {
      const throttleInfo = throttler.getThrottleInfo(key);
      const enhancedMessage = throttleInfo ? `${message} ${throttleInfo}` : message;
      console.log(`[DIALOG:${subcategory.toUpperCase()}] ${enhancedMessage}`, ...data);
    }
  },

  validationLog: (message: string, ...data: unknown[]) => {
    if (CURRENT_LOG_LEVEL < LogLevel.DEBUG) return;

    const key = "validation";
    if (throttler.shouldLog(key)) {
      const throttleInfo = throttler.getThrottleInfo(key);
      const enhancedMessage = throttleInfo ? `${message} ${throttleInfo}` : message;
      console.log(`[VALIDATION] ${enhancedMessage}`, ...data);
    }
  },

  trace: (message: string, ...data: unknown[]) => {
    if (CURRENT_LOG_LEVEL < LogLevel.TRACE) return;
    console.trace(`[TRACE] ${message}`, ...data);
  },

  group: (label: string) => {
    if (DEBUG_MODE) {
      console.group(label);
    }
  },

  groupEnd: () => {
    if (DEBUG_MODE) {
      console.groupEnd();
    }
  },

  table: (data: unknown) => {
    if (DEBUG_MODE) {
      console.table(data);
    }
  },

  time: (label: string) => {
    if (DEBUG_MODE) {
      console.time(label);
    }
  },

  timeEnd: (label: string) => {
    if (DEBUG_MODE) {
      console.timeEnd(label);
    }
  },
};

export default logger;
