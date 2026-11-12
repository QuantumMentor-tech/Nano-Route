# Nano Route — Latency, Execution Performance & Benchmark Analytics (Step 44)

## 1. Latency Architecture Overview
Step 44 extends Nano Route's local telemetry and analytics workspace with a deterministic, read-only **Latency, Execution Performance & Benchmark Analytics** subsystem. It builds directly on top of the local SQLite `telemetry_records` ledger (`src-tauri/src/storage/migrations/003_telemetry_foundation.sql`), `TelemetryRepository`, `TelemetryService`, and the unified `TelemetryDashboardSnapshot` pipeline established in Steps 42 and 43.

- **Rust Backend Layer:**
  - `src-tauri/src/domain/telemetry.rs`: Canonical Step 44 DTOs (`LatencyProvenanceState`, `LatencySampleSufficiency`, `TelemetryLatencySummary`, `TelemetryLatencyHistogram`, `TelemetryLatencyHistogramBucket`, `TelemetryLatencyTrendPoint`, `TelemetryProviderLatencySummary`, `TelemetryModelLatencySummary`, `TelemetryOutcomeLatencySummary`, `TelemetryRoutingOverheadSummary`, `TelemetryStreamingPerformanceSummary`, `TelemetryLogicalLatencySummary`, `TelemetryLatencyDataQualitySummary`, `TelemetryPerformanceAnalytics`).
  - `src-tauri/src/storage/repositories/telemetry_repo.rs`: `TelemetryRepository::aggregate_performance_analytics` and `compute_latency_distribution_stats`.
  - `src-tauri/src/services/telemetry.rs` & `src-tauri/src/commands/telemetry.rs`: `TelemetryService::get_performance_analytics_snapshot` and Tauri command `cmd_get_telemetry_performance_analytics_snapshot`.
- **Frontend Layer:**
  - `src/services/ipc/telemetry.ts`: `getTelemetryPerformanceAnalyticsSnapshot`, `computePerformanceAnalyticsFromRecords`, `computeLatencyDistributionStats`, and `formatLatencyMs`.
  - `src/features/telemetry/components/`:
    - `TelemetryPerformanceSummarySection.tsx`
    - `TelemetryLatencyDistributionTrendSection.tsx`
    - `TelemetryLatencyBreakdownSection.tsx`
    - `TelemetryExecutionLifecycleTimingSection.tsx`

---

## 2. Measurement Points & Audit Findings
In `src-tauri/src/services/chat_orchestrator.rs`:
- **Non-streaming execution (`submit_prompt`):** `let start_time = Instant::now();` is captured immediately prior to `provider_client.execute(provider_req, &task_context)` and `let latency_ms = start_time.elapsed().as_millis() as u64;` is captured immediately upon return. Each failover attempt measures `fb_start = Instant::now()` independently.
- **Streaming execution (`stream_prompt`):** `let start_time = Instant::now();` is captured immediately prior to `provider_client.execute_stream(...)` and `let latency_ms = start_time.elapsed().as_millis() as u64;` is captured upon stream termination.
- **Routing decision events (`routing_decision`):** When emitted by the routing/classification pipeline, `latency_ms` records the duration of the local routing decision.

---

## 3. Monotonic Clock Usage
All execution durations in `chat_orchestrator.rs` are measured via Rust's monotonic clock (`std::time::Instant::now().elapsed().as_millis() as u64`). Wall-clock epoch timestamps (`occurred_at` in milliseconds) are used strictly for historical sorting and time-series bucket assignment (`hour` / `day`), never for subtracting start/end wall-clock times.

---

## 4. Existing `latency_ms` Semantics
For `provider_execution`, `fallback_transition`, and terminal `stream_lifecycle` records, `latency_ms` represents **Observed Provider Attempt Latency** (including outbound network transit, provider queueing, and generation/streaming completion for that physical attempt). The UI and DTOs explicitly label this metric as `Observed Provider Attempt Latency (monotonic Instant duration in ms)`.

---

## 5. New Latency Analytics Metrics
Step 44 derives and exposes:
- Headline attempt latency statistics (`averageLatencyMs`, `medianLatencyMs`, `p25LatencyMs`, `p50LatencyMs`, `p75LatencyMs`, `p90LatencyMs`, `p95LatencyMs`, `p99LatencyMs`, `minLatencyMs`, `maxLatencyMs`).
- 8-bin Latency Distribution Histogram (`< 100 ms`, `100–250 ms`, `250–500 ms`, `500 ms–1 s`, `1–2 s`, `2–5 s`, `5–10 s`, `10 s+`).
- Hourly and Daily Latency Trend series (`medianLatencyMs`, `averageLatencyMs`, `p95LatencyMs`, `minLatencyMs`, `maxLatencyMs`).
- Per-Provider, Per-Model, and Per-Outcome latency distributions.
- Logical Request Cumulative Execution Latency vs. Physical Attempt Latency (Initial Attempt vs. Retry/Failover Attempt).
- Local Routing Decision Overhead (`routingOverhead`) and Streaming Completion Latency (`streamingPerformance`).

---

## 6. Historical Compatibility
No destructive schema changes are made to `telemetry_records`. Historical records that lack `latency_ms` are counted in `missingLatencyCount` and excluded from latency denominators without being coerced to `0`. Sub-stage metrics not separately persisted in `003_telemetry_foundation.sql` (such as isolated SLM sub-stage inference or streaming TTFT) report `provenance: "unavailable"` with an explicit disclosure note.

---

## 7. Percentile Methodology
All percentile calculations across backend Rust and frontend TypeScript use **Inclusive Linear Interpolation (`R-7`)** on the sorted ascending sample array $x_0 \le x_1 \le \dots \le x_{n-1}$:
$$\text{pos} = q \times (n - 1), \quad \text{lo} = \lfloor \text{pos} \rfloor, \quad \text{hi} = \lceil \text{pos} \rceil, \quad \text{frac} = \text{pos} - \text{lo}$$
$$P_q = x_{\text{lo}} + \text{frac} \times (x_{\text{hi}} - x_{\text{lo}})$$
For $q = 0.50$, this yields the exact middle observation when $n$ is odd and the arithmetic mean of the two middle observations when $n$ is even.

---

## 8. Sample-Size Rules
To prevent statistical fabrication on small samples:
- `n === 0`: `sampleSufficiency = "empty"`; all statistics return `null` (`Unavailable`).
- `n >= 1`: `minLatencyMs`, `maxLatencyMs`, `averageLatencyMs`, `medianLatencyMs` (`p50LatencyMs`) are reported (`1 <= n < 5` is marked `sampleSufficiency = "limited"`).
- `n >= 3`: `p25LatencyMs` and `p75LatencyMs` (IQR) are unlocked.
- `n >= 5`: `p90LatencyMs` and `p95LatencyMs` are unlocked (`sampleSufficiency = "sufficient"`).
- `n >= 10`: `p99LatencyMs` is unlocked (`null` when $n < 10$).

---

## 9. Outlier Policy
Valid latency observations in `[0, 86_400_000]` ms (up to 24 hours) are never clipped, winsorized, or silently discarded. Outliers naturally influence `averageLatencyMs`, `maxLatencyMs`, and tail percentiles while `medianLatencyMs` (`P50`) and `IQR` (`P25–P75`) provide outlier-resistant central tendency.

---

## 10. Provider & Model Aggregation
- Grouped by canonical `provider_id` and `(provider_id, model_id)`.
- Deterministically ordered by `measuredCount DESC`, `totalEligibleCount DESC`, `providerId ASC`, `modelId ASC`.
- Deprecated or historical models remain visible and marked with `isHistoricalOrUnrecorded`.
- Every row displays sample size `n`, eligible count, coverage percentage, median, mean, P95, P99, and min/max.

---

## 11. Streaming Timing
- Streaming executions (`stream_id IS NOT NULL` or `event_type = 'stream_lifecycle'`) are aggregated in `streamingPerformance`.
- Intermediate `stream_lifecycle` events are deduplicated when a terminal `provider_execution` or `fallback_transition` record exists for the same `stream_id` / `task_id` / `message_id`.
- Because `003_telemetry_foundation.sql` does not persist a separate `first_token_ms` column, `ttftProvenance` is explicitly reported as `"unavailable"`.

---

## 12. Retry Timing
When a logical request (`task_id` / `message_id` / `stream_id`) has multiple physical execution attempts:
- Attempt index `0` (chronologically first) is recorded in `initialAttemptSamples`.
- Subsequent attempts (`index >= 1`) are recorded in `retryOrFailoverAttemptSamples`.

---

## 13. Failover Timing
Failover attempts (`fallback_transition` or secondary `provider_execution` records correlated to the same `task_id`) contribute both to their respective provider/model physical attempt latency and to the logical request's cumulative duration (`logicalCumulativeMedianLatencyMs`).

---

## 14. Cancellation Timing
Cancelled executions (`outcome = 'cancelled'`) with valid `latency_ms` are preserved and reported in `outcomeBreakdown` under `Cancelled` so users can inspect how long cancelled requests ran prior to cancellation.

---

## 15. Error, Timeout & Rate-Limit Timing
Failed (`failure`), timed-out (`timeout`), rate-limited (`rate_limited`), and unavailable (`unavailable`) executions are broken out in `outcomeBreakdown` and can be isolated using the shared Outcome filter.

---

## 16. Data Coverage & Quality
`dataQuality` and `summary` report:
- `totalEligibleExecutions`
- `measuredExecutions` (`validLatencyRecords`)
- `missingLatencyCount`
- `invalidLatencyCount` (negative, `NaN`, `Infinity`, or `> 86_400_000` ms)
- `duplicateOrIntermediateEventsExcluded`
- `latencyCoveragePercent = (measuredExecutions / totalEligibleExecutions) * 100`

---

## 17. Database & Index Strategy
Queries leverage the existing composite indexes on `telemetry_records(occurred_at)`, `telemetry_records(session_id)`, `telemetry_records(provider_id, model_id)`, and `telemetry_records(event_type, outcome)` in a single sequential scan ordered by `occurred_at ASC, id ASC`.

---

## 18. IPC Contract
- Command: `cmd_get_telemetry_performance_analytics_snapshot` (`IPC_COMMANDS.GET_TELEMETRY_PERFORMANCE_ANALYTICS_SNAPSHOT`)
- Also embedded as `performanceAnalytics: TelemetryPerformanceAnalytics` inside `TelemetryDashboardSnapshot` (`cmd_get_telemetry_dashboard_snapshot`).

---

## 19. UI Behavior & Accessibility
- Integrated into `TelemetryDashboard.tsx` using the shared filter bar, date-range selector, time-bucket toggle, and stale-query race guard (`queryId`).
- All charts include exact millisecond/second tooltips and accessible table equivalents.
- Uses descriptive labels only—never ranks a "Best Model" or "Winner".

---

## 20. Security & Privacy
- 100% local read-only SQLite analytics.
- Zero live provider benchmarking or background network probes.
- Zero exposure of API keys, DPAPI blobs, prompts, or assistant completions.

---

## 21. Performance Limits
Single-pass grouping and in-memory sorting processes **100,000 records** in under 250ms in automated benchmarks.

---

## 22. Test Methodology
Validated in `src/features/telemetry/__tests__/latencyPerformanceAnalytics.test.ts` and `src-tauri/src/storage/repositories/telemetry_repo.rs` across deterministic fixtures (`[100, 200, 300, 400, 500]` ms), outlier fixtures (`[100, 110, 120, 130, 5000]` ms), small-sample gating (`n = 4`, `n = 5`, `n = 10`), invalid/missing rejection, retry/failover logical correlation, session deletion cascade, and 1K / 10K / 50K / 100K synthetic datasets.

---

## 23. Explicit Metric Definitions & Scope Boundaries
| Metric | Formula / Rule | Min Sample | Null Behavior |
|---|---|---|---|
| `measuredExecutions` (`n`) | Count of deduplicated execution attempts with `0 <= latency_ms <= 86_400_000` | `0` | `0` when empty |
| `averageLatencyMs` | $\sum x_i / n$ | `n >= 1` | `null` (`Unavailable`) when $n = 0$ |
| `medianLatencyMs` (`P50`) | R-7 linear interpolation at $q = 0.50$ | `n >= 1` | `null` when $n = 0$ |
| `p25LatencyMs` / `p75LatencyMs` | R-7 linear interpolation at $q = 0.25, 0.75$ | `n >= 3` | `null` when $n < 3$ |
| `p90LatencyMs` / `p95LatencyMs` | R-7 linear interpolation at $q = 0.90, 0.95$ | `n >= 5` | `null` when $n < 5$ |
| `p99LatencyMs` | R-7 linear interpolation at $q = 0.99$ | `n >= 10` | `null` when $n < 10$ |
| `minLatencyMs` / `maxLatencyMs` | $\min(x_i)$ / $\max(x_i)$ | `n >= 1` | `null` when $n = 0$ |
| `latencyCoveragePercent` | `(measuredExecutions / totalEligibleExecutions) * 100` | `eligible >= 1` | `null` when `eligible === 0` |

