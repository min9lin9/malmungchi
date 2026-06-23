import { describe, expect, it } from "bun:test";
import { metrics, recordRequest, renderPrometheusMetrics } from "../src/http/metrics";

describe("metrics", () => {
  it("records request counts and status codes", () => {
    metrics.total = 0;
    metrics.errors = 0;
    metrics.durations = [];
    metrics.statusCodes.clear();

    recordRequest(200, 10);
    recordRequest(200, 20);
    recordRequest(500, 5);

    expect(metrics.total).toBe(3);
    expect(metrics.errors).toBe(1);
    expect(metrics.statusCodes.get(200)).toBe(2);
    expect(metrics.statusCodes.get(500)).toBe(1);
    expect(metrics.durations).toEqual([10, 20, 5]);
  });

  it("renders prometheus format", () => {
    metrics.total = 0;
    metrics.errors = 0;
    metrics.durations = [];
    metrics.statusCodes.clear();

    recordRequest(200, 10);
    recordRequest(404, 50);

    const output = renderPrometheusMetrics();
    expect(output).toContain("# HELP http_requests_total");
    expect(output).toContain('http_requests_total{status="200"} 1');
    expect(output).toContain('http_requests_total{status="404"} 1');
    expect(output).toContain("# HELP http_request_duration_seconds");
    expect(output).toContain("http_request_duration_seconds_count 2");
    expect(output).toContain("http_request_duration_seconds_sum 0.060000");
  });
});
