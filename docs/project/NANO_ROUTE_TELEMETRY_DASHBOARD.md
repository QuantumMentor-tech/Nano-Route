# Nano Route — Telemetry Dashboard, Operational Routing Insights & Local Analytics Workspace (Step 42)

## 1. Overview & Architectural Purpose

The **Nano Route Telemetry Dashboard** (Step 42) is a read-only local operational observability and routing analytics workspace built into the Windows desktop application. It aggregates and visualizes historical routing decisions, execution outcomes, failover signals, recorded SLM classifier confidence scores, provider/model request distributions, and metadata completeness directly from local SQLite storage (`telemetry_records`).

### Strict Layering & Single Aggregation Authority
```text
React Telemetry Dashboard UI (src/features/telemetry/*)
        ↓
useTelemetryDashboard Hook (src/features/telemetry/useTelemetryDashboard.ts)
        ↓
Typed Frontend IPC Service (src/services/ipc/telemetry.ts)
        ↓
Tauri Command Layer (src-tauri/src/commands/telemetry.rs)
        ↓
TelemetryService (src-tauri/src/services/telemetry.rs)
        ↓
TelemetryRepository (src-tauri/src/storage/repositories/telemetry_repo.rs)
        ↓
SQLite telemetry_records Table (003_telemetry_foundation.sql)
```

- **Backend Aggregation Authority:** All metric formulas, time-series buckets, provider/model distributions, confidence buckets, completeness ratios, and filter option discovery are computed in `TelemetryRepository::aggregate_dashboard_snapshot`. The React UI never re-aggregates raw rows or invents secondary formulas.
- **Zero Live Execution Side Effects:** Opening, filtering, or refreshing the Telemetry Dashboard performs strictly read-only SQLite queries. It never invokes the local SLM runtime, never runs routing scoring or policy evaluation, never calls external AI providers, and never mutates stored records.

---

## 2. Explicit Scope Boundaries (Steps 42 vs. 43 vs. 44)

| Capability | Step 42 (This Milestone) | Step 43 (Token & Cost Accounting) | Step 44 (Latency & Performance Benchmarks) |
| :--- | :--- | :--- | :--- |
| **Operational request & outcome counts** | Included | — | — |
| **Time-series routing volume (`hour` / `day`)** | Included | — | — |
| **Provider & model operational activity** | Included | — | — |
| **Recorded SLM confidence distribution** | Included | — | — |
| **Failover / timeout / rate-limit signals** | Included | — | — |
| **Metadata completeness & integrity audit** | Included | — | — |
| **Token burn, provider cost & savings vs. baseline** | **Excluded** | Assigned to Step 43 | — |
| **Latency percentiles (p50/p90/p95/p99) & speed benchmarks** | **Excluded** | — | Assigned to Step 44 |
| **"Best model" or subjective quality leaderboard** | **Forbidden** | — | — |

---

## 3. Authoritative Data Source & Index Strategy

Step 42 reads from the `telemetry_records` table established in `003_telemetry_foundation.sql`:

| Column | Type | Dashboard Usage |
| :--- | :--- | :--- |
| `id` | `TEXT PRIMARY KEY` | Unique event identifier |
| `session_id` | `TEXT NULL` | Foreign key to `chat_sessions(id)` (`ON DELETE CASCADE`) |
| `event_type` | `TEXT NOT NULL` | Event category filter (`routing_decision`, `provider_execution`, `fallback_transition`, `system_health`) |
| `provider_id` | `TEXT NULL` | Provider filter & distribution (`NULL`/empty grouped as `"unrecorded"` / `"Not recorded"`) |
| `model_id` | `TEXT NULL` | Model filter & distribution (`NULL`/empty grouped as `"unrecorded"` / `"Not recorded"`) |
| `routing_reason` | `TEXT NULL` | Completeness tracking & failover reason detection (`LIKE 'Failover from %'`) |
| `confidence_score` | `REAL NULL` | Recorded SLM classifier confidence bucket distribution (`[0.0, 1.0]`) |
| `outcome` | `TEXT NOT NULL` | Outcome filter & distribution (`succeeded`, `failed`, `cancelled`, `fallback`, `rate_limited`, `timeout`) |
| `occurred_at` | `TEXT NOT NULL` | ISO-8601 UTC timestamp for range filtering and `hour`/`day` bucketing |

### Existing Indexes Leveraged
- `idx_telemetry_occurred_at (occurred_at DESC)` — accelerates date-range scans and time-series grouping.
- `idx_telemetry_provider_time (provider_id, occurred_at DESC)` — accelerates provider-filtered range queries.
- `idx_telemetry_model_time (model_id, occurred_at DESC)` — accelerates model-filtered range queries.
- `idx_telemetry_event_outcome (event_type, outcome)` — accelerates category and outcome filtering.
- `idx_telemetry_session (session_id)` — accelerates `ON DELETE CASCADE` cleanup when sessions are deleted in Chat Studio or History Explorer.

---

## 4. Metric Definitions & Unknown-Data Honesty

Every metric displayed on the Telemetry Dashboard follows an explicit, deterministic definition:

- **Metric Name:** Total Routed Requests
  - **Source Table/Fields:** `telemetry_records(*)`
  - **Inclusion Criteria:** All rows matching active dashboard filters (`startTime`, `endTime`, `providerId`, `modelId`, `outcome`, `eventType`).
  - **Exclusion Criteria:** Rows outside the active filter bounds or deleted via session cascade.
  - **Formula:** `COUNT(*)`
  - **Null/Missing Handling:** Returns `0` when no rows match.
  - **Display Format:** Integer with locale thousands separator.

- **Metric Name:** Operational Success Ratio (`successRatePercent`)
  - **Source Table/Fields:** `telemetry_records.outcome`
  - **Inclusion Criteria:** Terminal execution rows where `outcome IN ('succeeded', 'fallback', 'failed', 'rate_limited', 'timeout')`.
  - **Exclusion Criteria:** `cancelled` rows are excluded from `terminalExecutions` so user-initiated cancellations do not artificially deflate operational reliability.
  - **Formula:** `ROUND(((succeeded + fallback) * 100.0) / terminalExecutions, 1)`
  - **Null/Missing Handling:** When `terminalExecutions === 0`, `successRatePercent` is `null` and the UI displays `"No completed executions"` (never `0%` or `NaN`).
  - **Display Format:** Percentage to 1 decimal place (`e.g., 94.2%`) or `"No completed executions"`.

- **Metric Name:** Recorded SLM Classifier Confidence Distribution
  - **Source Table/Fields:** `telemetry_records.confidence_score`
  - **Inclusion Criteria:** Matching rows where `confidence_score IS NOT NULL AND confidence_score >= 0.0 AND confidence_score <= 1.0`.
  - **Exclusion Criteria:** Rows with `NULL` or out-of-range `confidence_score` are counted in `missingCount`.
  - **Formula:** Bucketed into 4 fixed ranges:
    - `0.00_0.24` (`0.00 <= score < 0.25`)
    - `0.25_0.49` (`0.25 <= score < 0.50`)
    - `0.50_0.74` (`0.50 <= score < 0.75`)
    - `0.75_1.00` (`0.75 <= score <= 1.00`)
  - **Null/Missing Handling:** When `availableCount === 0`, the UI explicitly displays `"Confidence unavailable"`.
  - **Display Format:** Per-bucket count, share of available confidence records, and explicit missing-confidence count.

- **Metric Name:** Retry & Failover Operational Signals
  - **Source Table/Fields:** `telemetry_records.outcome`, `telemetry_records.event_type`, `telemetry_records.routing_reason`
  - **Inclusion Criteria:** Matching rows in the selected filter window.
  - **Formula:**
    - `failoverEventCount`: rows where `outcome = 'fallback' OR event_type = 'fallback_transition' OR routing_reason LIKE 'Failover from %'`
    - `timeoutExecutionCount`: rows where `outcome = 'timeout'`
    - `rateLimitedExecutionCount`: rows where `outcome = 'rate_limited'`
    - `retryDataAvailable`: `false` (`retryExecutionCount: null`) because `telemetry_records` does not store a per-attempt retry counter column.
  - **Null/Missing Handling:** Displays `"Retry data unavailable"` rather than fabricating `Retries: 0`.

- **Metric Name:** Routing Metadata Coverage (`completeMetadataPercent`)
  - **Source Table/Fields:** `provider_id`, `model_id`, `confidence_score`, `routing_reason`
  - **Inclusion Criteria:** Matching rows where all four metadata fields are non-null and non-empty (`completeMetadataCount`).
  - **Exclusion Criteria:** Rows missing one or more of the four fields (`partialMetadataCount`).
  - **Formula:** `ROUND((completeMetadataCount * 100.0) / totalRoutedRequests, 1)`
  - **Null/Missing Handling:** When `totalRoutedRequests === 0`, `completeMetadataPercent` is `null` and the UI displays `"No records in range"`.

---

## 5. Chart Sum Invariants & Deterministic Ordering

Every `TelemetryDashboardSnapshot` satisfies the following mathematical invariants:
1. `SUM(providerDistribution.requestCount) === summary.totalRoutedRequests`
2. `SUM(modelDistribution.requestCount) === summary.totalRoutedRequests`
3. `SUM(outcomeDistribution.requestCount) === summary.totalRoutedRequests`
4. `SUM(timeSeries.totalRequests) === summary.totalRoutedRequests`
5. `confidenceDistribution.availableCount + confidenceDistribution.missingCount === summary.totalRoutedRequests`
6. `SUM(confidenceDistribution.buckets.requestCount) === confidenceDistribution.availableCount`
7. `completeness.completeMetadataCount + completeness.partialMetadataCount === summary.totalRoutedRequests`

### Deterministic Tie-Breaking
- **Providers:** Ordered by `request_count DESC, provider_id ASC`.
- **Models:** Ordered by `request_count DESC, provider_id ASC, model_id ASC`.
- **Outcomes:** Ordered by `request_count DESC, outcome ASC`.
- **Time-Series:** Ordered chronologically by `bucket_start ASC`.

---

## 6. Freshness, Concurrency, Accessibility & Privacy

- **Freshness Indicator:** Tracks the timestamp of the last successful snapshot (`Updated <time> (<relative>)`) and transitions cleanly across `fresh` (`< 1 min`), `aging` (`1–5 min`), and `stale` (`> 5 min`), with a manual **Refresh** button.
- **Stale Response Protection:** `useTelemetryDashboard` increments a monotonic `queryIdRef` counter on every filter change or manual refresh; out-of-order responses from earlier queries are discarded.
- **Refresh Failure Retention:** If a manual refresh or filter query fails while a previous snapshot is already displayed, the dashboard retains the last valid snapshot and displays a non-destructive error banner with a **Retry** action.
- **Accessibility:** Includes keyboard-operable filter controls, explicit labels, non-color-only outcome badges, and a screen-reader-accessible tabular alternative (`<details>`) for the time-series chart.
- **Cross-View Navigation to History Explorer:** Every row in the Model Operational Activity table includes a **View History** link that navigates to `/history?provider=<providerId>&model=<modelId>`, automatically pre-filtering the Step 41 History Explorer.
- **Privacy & Security:** No prompt text, assistant response text, file paths, or DPAPI credentials ever enter `telemetry_records` or `TelemetryDashboardSnapshot`.

