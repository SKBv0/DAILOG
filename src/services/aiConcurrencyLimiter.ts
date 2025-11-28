import logger from "../utils/logger";

/**
 * AI Concurrency Limiter
 * Prevents overwhelming Ollama service with too many parallel requests
 */

interface QueueItem<T> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
  nodeId?: string;
}

class AIConcurrencyLimiter {
  private maxConcurrent: number;
  private activeRequests: number;
  private queue: QueueItem<any>[];
  private requestStats: {
    total: number;
    successful: number;
    failed: number;
    timeout: number;
  };

  constructor(maxConcurrent: number = 3) {
    this.maxConcurrent = maxConcurrent;
    this.activeRequests = 0;
    this.queue = [];
    this.requestStats = {
      total: 0,
      successful: 0,
      failed: 0,
      timeout: 0,
    };

    logger.info(`[AI_LIMITER] Initialized with max ${maxConcurrent} concurrent requests`);
  }

  /**
   * Execute a function with concurrency limit
   */
  async execute<T>(fn: () => Promise<T>, nodeId?: string): Promise<T> {
    this.requestStats.total++;

    // If we're at capacity, queue it
    if (this.activeRequests >= this.maxConcurrent) {
      logger.debug(
        `[AI_LIMITER] Queue full (${this.activeRequests}/${this.maxConcurrent}), queuing request${nodeId ? ` for node ${nodeId}` : ""}`
      );
      return this.enqueue(fn, nodeId);
    }

    // Execute immediately
    return this.executeNow(fn, nodeId);
  }

  /**
   * Execute immediately without queuing
   */
  private async executeNow<T>(fn: () => Promise<T>, nodeId?: string): Promise<T> {
    this.activeRequests++;
    logger.debug(
      `[AI_LIMITER] Starting request (${this.activeRequests}/${this.maxConcurrent})${nodeId ? ` for node ${nodeId}` : ""}`
    );

    try {
      const result = await fn();
      this.requestStats.successful++;
      return result;
    } catch (error: any) {
      // Track timeout vs other errors
      if (error?.message?.includes("timeout") || error?.message?.includes("timed out")) {
        this.requestStats.timeout++;
        logger.warn(`[AI_LIMITER] Request timeout${nodeId ? ` for node ${nodeId}` : ""}`);
      } else {
        this.requestStats.failed++;
        logger.error(`[AI_LIMITER] Request failed${nodeId ? ` for node ${nodeId}` : ""}:`, error);
      }
      throw error;
    } finally {
      this.activeRequests--;
      logger.debug(
        `[AI_LIMITER] Request completed (${this.activeRequests}/${this.maxConcurrent}), queue: ${this.queue.length}`
      );

      // Process next item in queue
      this.processQueue();
    }
  }

  /**
   * Add to queue
   */
  private enqueue<T>(fn: () => Promise<T>, nodeId?: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ fn, resolve, reject, nodeId });
      logger.debug(`[AI_LIMITER] Queued request, queue size: ${this.queue.length}`);
    });
  }

  /**
   * Process next item in queue
   */
  private processQueue(): void {
    if (this.queue.length === 0 || this.activeRequests >= this.maxConcurrent) {
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    logger.debug(
      `[AI_LIMITER] Processing queued request${item.nodeId ? ` for node ${item.nodeId}` : ""}, remaining: ${this.queue.length}`
    );

    this.executeNow(item.fn, item.nodeId)
      .then(item.resolve)
      .catch(item.reject);
  }

  /**
   * Get current stats
   */
  getStats() {
    return {
      ...this.requestStats,
      activeRequests: this.activeRequests,
      queueSize: this.queue.length,
      successRate:
        this.requestStats.total > 0
          ? ((this.requestStats.successful / this.requestStats.total) * 100).toFixed(2)
          : "0.00",
    };
  }

  /**
   * Clear queue (useful for cancellation)
   */
  clearQueue(): void {
    const cleared = this.queue.length;
    this.queue.forEach((item) => {
      item.reject(new Error("Request cancelled - queue cleared"));
    });
    this.queue = [];
    logger.info(`[AI_LIMITER] Cleared ${cleared} queued requests`);
  }

  /**
   * Update max concurrent limit
   */
  setMaxConcurrent(max: number): void {
    logger.info(`[AI_LIMITER] Changing max concurrent from ${this.maxConcurrent} to ${max}`);
    this.maxConcurrent = max;

    // Process queue if we increased the limit
    while (this.activeRequests < this.maxConcurrent && this.queue.length > 0) {
      this.processQueue();
    }
  }

  /**
   * Reset stats
   */
  resetStats(): void {
    this.requestStats = {
      total: 0,
      successful: 0,
      failed: 0,
      timeout: 0,
    };
    logger.info("[AI_LIMITER] Stats reset");
  }
}

// Singleton instance
export const aiConcurrencyLimiter = new AIConcurrencyLimiter(3);

// Dev tools - expose to window for debugging
if (import.meta.env.DEV) {
  (window as any).aiLimiter = {
    getStats: () => aiConcurrencyLimiter.getStats(),
    setMaxConcurrent: (max: number) => aiConcurrencyLimiter.setMaxConcurrent(max),
    clearQueue: () => aiConcurrencyLimiter.clearQueue(),
    resetStats: () => aiConcurrencyLimiter.resetStats(),
  };
}

export default aiConcurrencyLimiter;
