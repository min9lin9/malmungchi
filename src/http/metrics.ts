export interface RequestMetrics {
  total: number;
  errors: number;
  durations: number[];
  statusCodes: Map<number, number>;
}

export const metrics: RequestMetrics = {
  total: 0,
  errors: 0,
  durations: [],
  statusCodes: new Map<number, number>(),
};

export function recordRequest(status: number, durationMs: number): void {
  metrics.total += 1;
  if (status >= 400) {
    metrics.errors += 1;
  }
  metrics.durations.push(durationMs);
  metrics.statusCodes.set(status, (metrics.statusCodes.get(status) ?? 0) + 1);
}

function getLatencyBuckets(durations: number[]): Record<string, number> {
  const buckets: Record<string, number> = {
    "0.01": 0,
    "0.025": 0,
    "0.05": 0,
    "0.1": 0,
    "0.25": 0,
    "0.5": 0,
    "1": 0,
    "2.5": 0,
    "5": 0,
    "10": 0,
  };
  for (const ms of durations) {
    const seconds = ms / 1000;
    for (const bucket of Object.keys(buckets).sort((a, b) => parseFloat(a) - parseFloat(b))) {
      if (seconds <= parseFloat(bucket)) {
        buckets[bucket] += 1;
      }
    }
  }
  return buckets;
}

function escapeLabel(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function renderPrometheusMetrics(): string {
  const lines: string[] = [];
  const durations = metrics.durations;
  const total = metrics.total;
  const errors = metrics.errors;

  lines.push("# HELP http_requests_total Total HTTP requests");
  lines.push("# TYPE http_requests_total counter");
  for (const [status, count] of metrics.statusCodes.entries()) {
    lines.push(`http_requests_total{status="${status}"} ${count}`);
  }
  if (metrics.statusCodes.size === 0) {
    lines.push('http_requests_total{status="none"} 0');
  }

  lines.push("# HELP http_request_errors_total Total HTTP request errors");
  lines.push("# TYPE http_request_errors_total counter");
  lines.push(`http_request_errors_total ${errors}`);

  lines.push("# HELP http_request_duration_seconds HTTP request duration histogram");
  lines.push("# TYPE http_request_duration_seconds histogram");
  const buckets = getLatencyBuckets(durations);
  for (const [bucket, count] of Object.entries(buckets)) {
    lines.push(`http_request_duration_seconds_bucket{le="${escapeLabel(bucket)}"} ${count}`);
  }
  const totalDurationSeconds = durations.reduce((sum, ms) => sum + ms / 1000, 0);
  lines.push(`http_request_duration_seconds_sum ${totalDurationSeconds.toFixed(6)}`);
  lines.push(`http_request_duration_seconds_count ${total}`);

  return `${lines.join("\n")}\n`;
}
