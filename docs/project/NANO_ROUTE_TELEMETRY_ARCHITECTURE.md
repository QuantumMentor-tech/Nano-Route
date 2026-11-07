# Nano Route — Telemetry Persistence & Analytics Data Foundation (Step 18)
**Document Version:** 1.16.0  
**Phase:** Step 18 of 50 — Master Roadmap  
**Subsystem:** SQLite Telemetry Ledger, Operational Metrics & Analytics Foundation  
**Author:** MoonVerse Studios Architecture Team  
**Verification Status:** 100% Validated (121 Tests Passing Across 62 Suites, 0 Regressions)

---

## 1. Executive Summary & Telemetry Purpose
The **Telemetry Persistence & Analytics Subsystem** establishes a durable, local, structured observation ledger for **Nano Route**. Built directly on the embedded SQLite engine, telemetry records the operational facts of execution—routing decisions, provider completions, latencies, token consumption, costs, and error outcomes.

Telemetry serves as the foundational data layer for:
- Future Telemetry Dashboards & KPI tracking
- Comparative model & provider performance evaluations
- Token utilization & financial cost monitoring
- Cumulative cost-savings foundations
- Routing audits and fallback diagnostic tracing

---

## 2. Telemetry Architecture Diagram

```text
          ┌─────────────────────────────┐
          │ Routing / Provider / Task   │
          │       Execution Layer       │
          └──────────────┬──────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  Telemetry Service  │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │ Telemetry Repository│
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │   DatabaseManager   │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │       SQLite        │
              │                     │
              │ chat_sessions       │
              │ chat_messages       │
              │ telemetry_records   │
              └─────────────────────┘
```

---

## 3. Data Ownership & Separation of Concerns

```text
Chat Content
     ↓
chat_messages

Session Metadata
     ↓
chat_sessions

Operational Telemetry
     ↓
telemetry_records

Application Logs
     ↓
logging subsystem
```

---

## 4. Telemetry vs Logs vs Chat Persistence
- **Logs:** Unstructured or semi-structured diagnostic streams intended for developer inspection and ephemeral debugging. Logs are ephemeral, safe-redacted, and must never be scraped to build user analytics.
- **Chat Persistence:** Authoritative storage for conversational turns, user prompts, assistant completions, and message-level presentation metadata.
- **Telemetry Records:** Authoritative structured observations of discrete execution events (e.g. routing decisions, provider requests, fallback transitions, stream lifecycles). Telemetry NEVER stores user prompts or model responses.

---

## 5. Authoritative Fact Ownership Matrix

| Fact / Metric | Authoritative Storage Location | Telemetry Role |
|---|---|---|
| User Prompt Content | `chat_messages.content` (`sender = 'user'`) | **NEVER DUPLICATED** (Privacy Invariant) |
| Assistant Response Content | `chat_messages.content` (`sender = 'assistant'`) | **NEVER DUPLICATED** (Privacy Invariant) |
| Session Identity | `chat_sessions.id` | Optional Foreign Correlation (`session_id`) |
| Message Identity | `chat_messages.id` | Optional Correlation (`message_id`) |
| Task Identity | `TaskManager` | Optional Correlation (`task_id`) |
| Stream Identity | `StreamCoordinator` | Optional Correlation (`stream_id`) |
| Routed Provider | `telemetry_records.provider_id` | Authoritative operational fact |
| Routed Model | `telemetry_records.model_id` | Authoritative operational fact |
| Routing Reason | `telemetry_records.routing_reason` | Short, safe explanation string (<= 255 chars) |
| SLM Confidence Score | `telemetry_records.confidence` | Normalized confidence in `[0.0, 1.0]` |
| Operational Outcome | `telemetry_records.outcome` | Normalized enum (`success`, `failure`, `timeout`, etc.) |
| Normalized Error Code | `telemetry_records.error_code` | Structured code (e.g. `RATE_LIMITED`, `TIMEOUT`) |
| Request Latency | `telemetry_records.latency_ms` | Measured duration in milliseconds (`NULL` if unmeasured) |
| Prompt Token Usage | `telemetry_records.prompt_tokens` | Measured tokens consumed (`NULL` if unmeasured) |
| Completion Token Usage | `telemetry_records.completion_tokens` | Measured tokens generated (`NULL` if unmeasured) |
| Financial Cost | `telemetry_records.cost_usd` | Incurred cost in USD (`NULL` if unknown) |

---

## 6. Privacy Matrix & Security Boundaries

| Data Attribute | Persist in Chat? | Persist in Telemetry? | Standard Logged? |
|---|---|---|---|
| Prompt Text | Yes (`chat_messages`) | **No (Strict Prohibition)** | **No (Redacted)** |
| Response Text | Yes (`chat_messages`) | **No (Strict Prohibition)** | **No (Redacted)** |
| API Keys & Bearer Tokens | **Never** | **Never** | **Never (Redacted)** |
| HTTP Authorization Headers | **Never** | **Never** | **Never (Redacted)** |
| Raw Request/Response Payloads | **Never** | **Never** | **Never** |
| Provider Slug | Yes | Yes (`provider_id`) | Yes (Identifier only) |
| Model Identifier | Yes | Yes (`model_id`) | Yes (Identifier only) |
| Routing Reason | Yes | Yes (`routing_reason`) | Optional Summary |
| Confidence Score | Yes | Yes (`confidence`) | Optional Metric |
| Latency (ms) | Yes | Yes (`latency_ms`) | Numeric Duration |
| Token Counts | Yes | Yes | Numeric Metrics |
| Cost (USD) | Yes | Yes (`cost_usd`) | Numeric Value |

---

## 7. Relational Schema Specification (`003_telemetry_foundation.sql`)

```sql
-- Table: telemetry_records
CREATE TABLE IF NOT EXISTS telemetry_records (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    occurred_at INTEGER NOT NULL,
    session_id TEXT NULL,
    message_id TEXT NULL,
    task_id TEXT NULL,
    stream_id TEXT NULL,
    provider_id TEXT NULL,
    model_id TEXT NULL,
    outcome TEXT NOT NULL,
    error_code TEXT NULL,
    latency_ms INTEGER NULL,
    prompt_tokens INTEGER NULL,
    completion_tokens INTEGER NULL,
    cost_usd REAL NULL,
    confidence REAL NULL,
    routing_reason TEXT NULL,
    FOREIGN KEY(session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

-- Strategic Indexes
CREATE INDEX IF NOT EXISTS idx_telemetry_occurred_at 
    ON telemetry_records(occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_provider_time 
    ON telemetry_records(provider_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_model_time 
    ON telemetry_records(model_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_event_outcome 
    ON telemetry_records(event_type, outcome);

CREATE INDEX IF NOT EXISTS idx_telemetry_session 
    ON telemetry_records(session_id);
```

---

## 8. Telemetry Domain Model (`src-tauri/src/domain/telemetry.rs`)
- **`TelemetryEventType`**: Closed enumeration: `routing_decision`, `provider_execution`, `stream_lifecycle`, `fallback_transition`, `system_event`.
- **`TelemetryOutcome`**: Closed enumeration: `success`, `failure`, `cancelled`, `timeout`, `rate_limited`, `unavailable`, `fallback`.
- **`TelemetryRecord`**: Pure entity capturing operational facts, correlation IDs, and metrics.
- **`TelemetryFilter`**: Multi-dimensional search parameters (`start_time`, `end_time`, `session_id`, `provider_id`, `model_id`, `event_type`, `outcome`).
- **`TelemetryAggregateReport`**: Strong aggregate structure (`total_events`, `successful_events`, `failed_events`, `total_prompt_tokens`, `total_completion_tokens`, `total_cost_usd`, `avg_latency_ms`, `min_latency_ms`, `max_latency_ms`).

---

## 9. Telemetry Repository (`src-tauri/src/storage/repositories/telemetry_repo.rs`)
Provides strictly parameterized data access without string concatenations:
- `insert`: Appends single observation.
- `get_by_id`: Fetches record by primary key.
- `list`: Dynamic parameterized filtering and pagination ordered by `occurred_at DESC, id DESC`.
- `aggregate`: Computes sums, counts, and latency averages (`AVG`, `MIN`, `MAX`) directly in SQLite.
- `delete`: Deletes a single record.
- `delete_by_session`: Deletes records associated with a given session.
- `delete_before`: Supports historical retention pruning.
- `clear_all`: Supports local privacy data wipe.

---

## 10. Telemetry Service & Lifecycle (`src-tauri/src/services/telemetry.rs`)
- **Validation**: Enforces `confidence in [0.0, 1.0]`, `cost >= 0.0`, bounded strings (`routing_reason <= 255`, `provider_id <= 64`, `model_id <= 128`).
- **Transaction Policy**: Single events execute atomic single-row inserts; batch events execute inside an immediate SQLite transaction.
- **Non-Fatal Failure Isolation**: Telemetry recording failures return structured `AppError::Internal` without crashing the process or aborting user-facing conversations.
- **Shutdown Protocol**: Safe flush and connection release via `DatabaseManager`.

---

## 11. Cost & Savings Accounting Semantics
- **Actual Cost (`cost_usd`)**: Directly persisted numeric value resulting from normalized model pricing.
- **Cost Savings Calculation**: **DEFERRED**. Nano Route does not fabricate baseline frontier model pricing (e.g., hypothetical GPT-4o pricing). Cumulative cost savings will be calculated in subsequent roadmap steps once an authoritative baseline pricing catalog is implemented.
- **Distinction between NULL and ZERO**:
  - `cost_usd = 0.0`: A known free execution (e.g. local quantized SLM inference).
  - `cost_usd = NULL`: Cost was unknown or pricing metadata was unconfigured.
  - `latency_ms = 0`: Measured near-instant execution.
  - `latency_ms = NULL`: Execution latency was unmeasured.

---

## 12. Deletion & Retention Policy
- **Chat Deletion Cascade**: When a user deletes a `chat_session`, all session-linked telemetry records are purged automatically via `FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE`.
- **Standalone Records**: Global system telemetry not tied to any user chat session (`session_id IS NULL`) remains available for application-level health and reliability diagnostics.
- **Data Wipe Compatibility**: `clear_all()` or database file deletion completely purges all telemetry records, guaranteeing zero residual tracking traces.

