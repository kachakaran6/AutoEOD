// apps/api/src/lib/observability/metrics.ts
// Real-time telemetry metrics accumulator with P50/P95/P99 latency percentiles and time-series buckets

export interface EndpointMetric {
  route: string;
  method: string;
  count: number;
  errorCount: number;
  errorRate: number;
  avgDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
  p99DurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  lastAccessedAt: string;
}

export interface TimeSeriesBucket {
  timestamp: string; // ISO timestamp
  requests: number;
  errors: number;
  p50Ms: number;
  p95Ms: number;
  aiCalls: number;
}

class MetricsEngine {
  private latencies: number[] = [];
  private maxLatenciesWindow = 5000;

  private totalRequests = 0;
  private status2xx = 0;
  private status3xx = 0;
  private status4xx = 0;
  private status5xx = 0;

  // Endpoint stats keyed by "METHOD /route"
  private endpointStats = new Map<
    string,
    {
      route: string;
      method: string;
      count: number;
      errorCount: number;
      durations: number[];
      minDurationMs: number;
      maxDurationMs: number;
      lastAccessedAt: string;
    }
  >();

  // Hourly buckets for the past 24 hours
  private hourlyBuckets = new Map<string, { requests: number; errors: number; durations: number[]; aiCalls: number }>();

  // Yesterday's totals for comparison
  private yesterdayRequests = 0;
  private yesterdayErrors = 0;
  private yesterdayAvgLatency = 0;

  // AI Telemetry counters
  private aiMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    fallbackCount: 0,
    totalTokens: 0,
    modelDurations: new Map<string, number[]>(),
  };

  // Job Telemetry counters
  private jobMetrics = {
    totalJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    durations: [] as number[],
  };

  constructor() {
    // Reset/rotate day comparison periodically
    this.initBuckets();
  }

  private initBuckets() {
    const now = new Date();
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 3600000);
      const hourKey = d.toISOString().slice(0, 13) + ':00:00.000Z';
      this.hourlyBuckets.set(hourKey, { requests: 0, errors: 0, durations: [], aiCalls: 0 });
    }
  }

  private getHourKey(date = new Date()): string {
    return date.toISOString().slice(0, 13) + ':00:00.000Z';
  }

  public recordHttpRequest(params: {
    method: string;
    route: string;
    statusCode: number;
    durationMs: number;
  }): void {
    try {
      const { method, route, statusCode, durationMs } = params;
      this.totalRequests++;

      if (statusCode >= 500) {
        this.status5xx++;
      } else if (statusCode >= 400) {
        this.status4xx++;
      } else if (statusCode >= 300) {
        this.status3xx++;
      } else {
        this.status2xx++;
      }

      // Latency window
      if (this.latencies.length >= this.maxLatenciesWindow) {
        this.latencies.shift();
      }
      this.latencies.push(durationMs);

      // Endpoint stats
      const endpointKey = `${method.toUpperCase()} ${route}`;
      let stat = this.endpointStats.get(endpointKey);
      if (!stat) {
        stat = {
          route,
          method: method.toUpperCase(),
          count: 0,
          errorCount: 0,
          durations: [],
          minDurationMs: durationMs,
          maxDurationMs: durationMs,
          lastAccessedAt: new Date().toISOString(),
        };
        this.endpointStats.set(endpointKey, stat);
      }

      stat.count++;
      if (statusCode >= 400) stat.errorCount++;
      if (stat.durations.length >= 200) stat.durations.shift();
      stat.durations.push(durationMs);
      stat.minDurationMs = Math.min(stat.minDurationMs, durationMs);
      stat.maxDurationMs = Math.max(stat.maxDurationMs, durationMs);
      stat.lastAccessedAt = new Date().toISOString();

      // Hourly time series
      const hourKey = this.getHourKey();
      let hourBucket = this.hourlyBuckets.get(hourKey);
      if (!hourBucket) {
        hourBucket = { requests: 0, errors: 0, durations: [], aiCalls: 0 };
        this.hourlyBuckets.set(hourKey, hourBucket);
      }
      hourBucket.requests++;
      if (statusCode >= 400) hourBucket.errors++;
      if (hourBucket.durations.length < 500) hourBucket.durations.push(durationMs);
    } catch {
      // Fail-safe
    }
  }

  public recordAiRequest(params: {
    model: string;
    success: boolean;
    isFallback: boolean;
    durationMs: number;
    tokens?: number;
  }): void {
    try {
      this.aiMetrics.totalRequests++;
      if (params.success) {
        this.aiMetrics.successfulRequests++;
      } else {
        this.aiMetrics.failedRequests++;
      }
      if (params.isFallback) {
        this.aiMetrics.fallbackCount++;
      }
      if (params.tokens) {
        this.aiMetrics.totalTokens += params.tokens;
      }

      let durations = this.aiMetrics.modelDurations.get(params.model);
      if (!durations) {
        durations = [];
        this.aiMetrics.modelDurations.set(params.model, durations);
      }
      if (durations.length >= 100) durations.shift();
      durations.push(params.durationMs);

      const hourKey = this.getHourKey();
      const hourBucket = this.hourlyBuckets.get(hourKey);
      if (hourBucket) {
        hourBucket.aiCalls++;
      }
    } catch {
      // Fail-safe
    }
  }

  public recordJobExecution(params: { durationMs: number; success: boolean }): void {
    try {
      this.jobMetrics.totalJobs++;
      if (params.success) {
        this.jobMetrics.completedJobs++;
      } else {
        this.jobMetrics.failedJobs++;
      }
      if (this.jobMetrics.durations.length >= 200) this.jobMetrics.durations.shift();
      this.jobMetrics.durations.push(params.durationMs);
    } catch {
      // Fail-safe
    }
  }

  private calculatePercentiles(values: number[]): { p50: number; p75: number; p90: number; p95: number; p99: number; avg: number } {
    if (values.length === 0) return { p50: 0, p75: 0, p90: 0, p95: 0, p99: 0, avg: 0 };
    const sorted = [...values].sort((a, b) => a - b);
    const getPercentile = (p: number) => {
      const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
      return sorted[idx];
    };
    const sum = sorted.reduce((acc, v) => acc + v, 0);
    return {
      p50: getPercentile(50),
      p75: getPercentile(75),
      p90: getPercentile(90),
      p95: getPercentile(95),
      p99: getPercentile(99),
      avg: Math.round(sum / sorted.length),
    };
  }

  public getSnapshot() {
    const latStats = this.calculatePercentiles(this.latencies);
    const totalErrors = this.status4xx + this.status5xx;
    const errorRate = this.totalRequests > 0 ? Number(((totalErrors / this.totalRequests) * 100).toFixed(2)) : 0;
    const failure5xxRate = this.totalRequests > 0 ? Number(((this.status5xx / this.totalRequests) * 100).toFixed(2)) : 0;

    // Build endpoint performance table
    const endpoints: EndpointMetric[] = [];
    for (const [, stat] of this.endpointStats.entries()) {
      const p = this.calculatePercentiles(stat.durations);
      endpoints.push({
        route: stat.route,
        method: stat.method,
        count: stat.count,
        errorCount: stat.errorCount,
        errorRate: stat.count > 0 ? Number(((stat.errorCount / stat.count) * 100).toFixed(2)) : 0,
        avgDurationMs: p.avg,
        p50DurationMs: p.p50,
        p95DurationMs: p.p95,
        p99DurationMs: p.p99,
        minDurationMs: stat.minDurationMs,
        maxDurationMs: stat.maxDurationMs,
        lastAccessedAt: stat.lastAccessedAt,
      });
    }

    endpoints.sort((a, b) => b.count - a.count);

    // Build 24h time-series
    const timeSeries: TimeSeriesBucket[] = [];
    for (const [timestamp, bucket] of this.hourlyBuckets.entries()) {
      const p = this.calculatePercentiles(bucket.durations);
      timeSeries.push({
        timestamp,
        requests: bucket.requests,
        errors: bucket.errors,
        p50Ms: p.p50,
        p95Ms: p.p95,
        aiCalls: bucket.aiCalls,
      });
    }

    // AI model breakdown
    const aiModelStats: Array<{ model: string; count: number; avgLatencyMs: number }> = [];
    for (const [model, durations] of this.aiMetrics.modelDurations.entries()) {
      const p = this.calculatePercentiles(durations);
      aiModelStats.push({
        model,
        count: durations.length,
        avgLatencyMs: p.avg,
      });
    }

    return {
      requests: {
        total: this.totalRequests,
        status2xx: this.status2xx,
        status3xx: this.status3xx,
        status4xx: this.status4xx,
        status5xx: this.status5xx,
        errorRate,
        failure5xxRate,
        requestsPerMinute: Math.round(this.totalRequests / Math.max(1, process.uptime() / 60)),
      },
      latency: {
        avg: latStats.avg,
        p50: latStats.p50,
        p75: latStats.p75,
        p90: latStats.p90,
        p95: latStats.p95,
        p99: latStats.p99,
      },
      comparison: {
        requestsVsYesterday: this.totalRequests - this.yesterdayRequests,
        errorsVsYesterday: totalErrors - this.yesterdayErrors,
        latencyVsYesterday: latStats.avg - this.yesterdayAvgLatency,
      },
      ai: {
        total: this.aiMetrics.totalRequests,
        success: this.aiMetrics.successfulRequests,
        failed: this.aiMetrics.failedRequests,
        fallbacks: this.aiMetrics.fallbackCount,
        fallbackRate:
          this.aiMetrics.totalRequests > 0
            ? Number(((this.aiMetrics.fallbackCount / this.aiMetrics.totalRequests) * 100).toFixed(2))
            : 0,
        tokens: this.aiMetrics.totalTokens,
        models: aiModelStats,
      },
      jobs: {
        total: this.jobMetrics.totalJobs,
        completed: this.jobMetrics.completedJobs,
        failed: this.jobMetrics.failedJobs,
        avgDurationMs: this.calculatePercentiles(this.jobMetrics.durations).avg,
      },
      endpoints,
      timeSeries,
    };
  }
}

export const metricsEngine = new MetricsEngine();
