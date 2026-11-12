# Nano Route — Token Usage, Cost Analytics & Routing Savings Engine (Step 43)

## 1. Architecture Overview
Step 43 extends the Nano Route local telemetry and analytics workspace with a read-only **Token Usage, Cost Analytics & Routing Savings Engine**. It integrates directly into the existing SQLite `telemetry_records` repository, Tauri v2 IPC command pipeline, and React/TypeScript Telemetry Dashboard without altering live routing policies or introducing external cloud telemetry.

- **Rust Backend Layer:**
  - `src-tauri/src/providers/pricing.rs`: Authoritative versioned model pricing registry (`VersionedModelPricingEntry`, `builtin_versioned_pricing_table`, `resolve_versioned_model_pricing`) and integer nano-dollar (`1 USD = 1_000_000_000 nano-USD`, `i128`) arithmetic helpers.
  - `src-tauri/src/domain/telemetry.rs`: Canonical financial analytics domain models (`TelemetryTokenSummary`, `TelemetryActualCostSummary`, `TelemetryBaselineSummary`, `TelemetrySavingsSummary`, `TelemetryProviderTokenSummary`, `TelemetryModelTokenSummary`, `TelemetryProviderCostSummary`, `TelemetryModelCostSummary`, `TelemetryTokenTrendPoint`, `TelemetryCostTrendPoint`, `TelemetryFinancialCoverageSummary`, `TelemetryFinancialExportRow`, `TelemetryFinancialAnalytics`).
  - `src-tauri/src/storage/repositories/telemetry_repo.rs`: `TelemetryRepository::aggregate_financial_analytics` and `aggregate_financial_analytics_with_pricing`.
  - `src-tauri/src/services/telemetry.rs` & `src-tauri/src/commands/telemetry.rs`: `TelemetryService::get_cost_analytics_snapshot` and Tauri command `cmd_get_telemetry_cost_analytics_snapshot`, plus embedded `financial_analytics` inside `TelemetryDashboardSnapshot`.
- **Frontend Layer:**
  - `src/services/ipc/pricing.ts` & `src/services/ipc/telemetry.ts`: Frontend pricing mirror, `BigInt` nano-dollar arithmetic, and `getTelemetryCostAnalyticsSnapshot` / `computeFinancialAnalyticsFromRecords`.
  - `src/features/telemetry/components/`:
    - `TelemetryFinancialSummarySection.tsx`
    - `TelemetryTokenCostTrendsSection.tsx`
    - `TelemetryFinancialBreakdownSection.tsx`
    - `TelemetryFinancialMethodologySection.tsx`

---

## 2. Token Data Sources & Schema Mapping
Token metrics are read from the local SQLite `telemetry_records` table (`src-tauri/src/storage/migrations/003_telemetry_foundation.sql`):
- `prompt_tokens` (`INTEGER NULL`) $\rightarrow$ `inputTokens`
- `completion_tokens` (`INTEGER NULL`) $\rightarrow$ `outputTokens`
- `routed_provider` (`TEXT NULL`) $\rightarrow$ `providerId`
- `routed_model` (`TEXT NULL`) $\rightarrow$ `modelId`
- `timestamp_ms` (`INTEGER NOT NULL`) $\rightarrow$ `timestampMs`

---

## 3. Input / Output / Total Token Rules
- **Input Tokens (`inputTokens`):** Recorded prompt/input token count (`>= 0`) or `null` if unknown.
- **Output Tokens (`outputTokens`):** Recorded completion/output token count (`>= 0`) or `null` if unknown.
- **Total Tokens (`totalTokens`):** Computed as `inputTokens + outputTokens` **only** when both `inputTokens !== null` and `outputTokens !== null`. If either is `null`, `totalTokens` for that record is `null` (classified as partial token coverage) so incomplete records never masquerade as zero-output or zero-input completions.

---

## 4. Actual Cost Sources & Calculation Rules
For each physical execution attempt:
1. **Recorded Exact Cost (`recorded_exact`):** If `cost_usd` is recorded in `telemetry_records` (`cost_usd IS NOT NULL` and finite `>= 0`), its exact value is converted to integer nano-dollars (`round(cost_usd * 1_000_000_000)`).
2. **Catalog-Estimated Cost (`catalog_estimated`):** If `cost_usd IS NULL`, and both `prompt_tokens` and `completion_tokens` are present, the engine resolves the versioned model pricing active at `timestamp_ms` via `resolve_versioned_model_pricing(provider, model, timestamp_ms)` and computes:
   $$\text{cost}_{\text{nano}} = \text{inputTokens} \times \text{round}(\text{inputCostPerMillion} \times 1000) + \text{outputTokens} \times \text{round}(\text{outputCostPerMillion} \times 1000)$$
3. **Unavailable Cost (`unavailable`):** If neither recorded `cost_usd` nor complete tokens + catalog pricing exist, cost is `null` (`Unavailable`). In `chat_orchestrator.rs`, unpriced models record `cost_usd: None` rather than `0.0`.

---

## 5. Pricing Registry & Versioned Rate Source
`src-tauri/src/providers/pricing.rs` and `src/services/ipc/pricing.ts` maintain a single authoritative versioned pricing table (`VersionedModelPricingEntry`):
- Each entry specifies `provider_id`, `model_id`, `pricing_version`, `effective_from_ms`, `effective_until_ms`, `input_cost_per_million`, and `output_cost_per_million`.
- Historical rate changes (e.g., `openai / gpt-4o` `2024.05-v1` at $\$5.00 / \$15.00$ per 1M tokens prior to `2024-08-07T00:00:00Z` vs. `2024.08-v2` at $\$2.50 / \$10.00$ per 1M tokens from `2024-08-07T00:00:00Z` onward) are resolved deterministically using each record's `timestamp_ms`.

---

## 6. Baseline Methodology (Method B — Token-Equivalent Baseline Estimate)
Nano Route uses **Method B: Token-Equivalent Baseline Estimate** against a configurable reference model (default: `anthropic / claude-3-5-sonnet-20241022`):
- For each eligible logical request, the engine takes the request's terminal execution `inputTokens` and `outputTokens` and prices them at the reference baseline model's rate active at `timestamp_ms`.
- All baseline metrics are explicitly labeled in the UI and DTOs as `Token-Equivalent Baseline Estimate (Method B)`.

---

## 7. Savings Calculation Formula
For each logical request $r$:
- **Eligibility:** $r$ is eligible for savings comparison if and only if:
  1. All physical execution attempts for $r$ have a known actual cost (`actualCostNano !== null`).
  2. The representative execution for $r$ has complete token counts (`inputTokens !== null` and `outputTokens !== null`).
  3. The baseline model has a valid pricing entry at `r.timestampMs`.
- **Per-Request Savings:**
  $$\text{estimatedSavings}(r) = \text{baselineCost}(r) - \sum_{a \in \text{attempts}(r)} \text{actualCost}(a)$$
- **Aggregate Savings:**
  $$\text{estimatedSavingsUsd} = \sum_{r \in \text{eligible}} \text{estimatedSavings}(r)$$
  $$\text{estimatedSavingsPercent} = \frac{\text{estimatedSavingsUsd}}{\text{totalBaselineCostUsd}} \times 100$$

---

## 8. Negative Savings Handling
Routing may intentionally select a higher-cost reasoning or specialist model (e.g., `openai / o1` or `anthropic / claude-3-opus-20240229`) that costs more than the baseline model.
- Negative savings ($\text{actualCost} > \text{baselineCost}$) are **never** clamped to zero or hidden.
- They are preserved with a minus sign (e.g., `-$4.20`, `-400.0%`) and `comparisonStatus = "above_baseline"`, rendered in the UI with an amber `Above baseline` badge.

---

## 9. Retry, Failover & Stream Deduplication Rules
- **Correlation:** Telemetry records are grouped into logical requests by `taskId` (or `messageId` / `streamId` / `id` fallback).
- **Non-Execution Exclusion:** `routing_decision` records are excluded from token and cost summation when physical execution attempts (`provider_execution` or `fallback_transition`) exist for that logical request.
- **Stream Lifecycle Deduplication:** Intermediate `stream_lifecycle` events are excluded when `provider_execution` or `fallback_transition` records exist; if a logical request only has `stream_lifecycle` events, only the latest terminal event is counted.
- **Retry & Failover Accounting:** Every physical execution attempt (`provider_execution`, `fallback_transition`) that actually ran is counted in `totalExecutionAttempts` and contributes to actual token burn and actual spend, while `totalLogicalRequests` counts the user-initiated logical request once.

---

## 10. Streaming Usage Reconciliation
Streaming responses emit lifecycle events (`stream_lifecycle`) and a final `provider_execution` event upon stream completion or cancellation. Deduplicating `stream_lifecycle` events when `provider_execution` exists guarantees that streaming chunks are never double-billed.

---

## 11. Partial & Missing Data Rules
- Missing `prompt_tokens` or `completion_tokens` remain `null` (`Unavailable`).
- Missing `cost_usd` without catalog pricing remains `null` (`Cost unavailable`).
- Known `$0.00` cost (e.g. local ONNX SLM execution) is counted in `attemptsWithKnownZeroCost` and displayed as `$0.00`.
- Every summary card and coverage indicator displays its explicit denominator (`X of Y attempts` or `X of Y logical requests`).

---

## 12. Time-Bucket Aggregation Rules
- **Hourly (`hour`):** `bucketStartMs = floor(timestampMs / 3_600_000) * 3_600_000`
- **Daily (`day`):** `bucketStartMs = floor(timestampMs / 86_400_000) * 86_400_000`
- Trend buckets are sorted chronologically ascending (`bucketStartMs ASC`) and expose `inputTokens`, `outputTokens`, `totalTokens`, `actualCostUsd`, `baselineCostUsd`, `estimatedSavingsUsd`, and coverage counts per bucket.

---

## 13. Filter Dimension Support
All financial metrics, charts, and breakdowns respect the unified `TelemetryDashboardFilters`:
- `startTimeMs` / `endTimeMs` (1h, 24h, 7d, 30d, All-Time)
- `providerId`
- `modelId`
- `intentCategory`
- `outcome`
- `sessionId`
- `onlyFallback`
- `baselineProviderId` & `baselineModelId`

---

## 14. Provider & Model Breakdown Definitions
- **Provider Token & Cost Breakdowns:** Grouped by `routedProvider` (normalized; missing mapped to `"unassigned"`). Sorted by primary metric descending (`totalTokens DESC` / `actualCostUsd DESC`) with deterministic tie-breaking by `providerId ASC`.
- **Model Token & Cost Breakdowns:** Grouped by `(routedProvider, routedModel)`. Sorted by `totalTokens DESC` / `actualCostUsd DESC` with deterministic tie-breaking by `modelId ASC`.
- **Reconciliation Invariant:** The sum of provider breakdown totals and the sum of model breakdown totals equal the top-level summary totals to the exact nano-dollar and token.

---

## 15. UI Component Structure
- `TelemetryFinancialSummarySection`: 4 KPI cards (`Total Token Burn`, `Recorded Actual Cost`, `Baseline Estimate (Method B)`, `Estimated Routing Savings`) with positive/negative/neutral badges and all-time cumulative savings footer.
- `TelemetryTokenCostTrendsSection`: Dual SVG bar charts (`Token Usage Trend` stacked Input + Output tokens, and `Actual Cost vs. Baseline Cost Trend` paired bars with savings tooltips).
- `TelemetryFinancialBreakdownSection`: 4 responsive tables (`Cost & Savings by Provider`, `Cost & Savings by Model`, `Token Burn by Provider`, `Token Burn by Model`) with one-click History Explorer deep links.
- `TelemetryFinancialMethodologySection`: 4 coverage cards (`Complete Token Coverage`, `Known Cost Coverage`, `Savings Comparison Coverage`, `Execution Event Deduplication`) + `Methodology & Certainty Disclosure` panel.

---

## 16. Performance & Indexing Strategy
- Uses existing composite B-Tree indexes on `telemetry_records(timestamp_ms)`, `telemetry_records(session_id)`, `telemetry_records(routed_provider, routed_model)`, and `telemetry_records(event_type, outcome)`.
- Single-pass $O(N)$ logical-request correlation and integer nano-dollar summation processes **100,000 records** in under 250ms in memory.

---

## 17. Privacy & Security Guarantees
- **100% Local:** No external network requests, cloud analytics beacons, or remote pricing fetches.
- **Zero Secret / Prompt Leakage:** Financial DTOs and `exportRows` contain only timestamps, IDs, provider/model identifiers, token counts, and USD amounts—never DPAPI credentials, API keys, or prompt/completion text.

---

## 18. Explicit Metric Formulas Reference
- `totalInputTokens`: $\sum \text{inputTokens}$ across deduplicated execution attempts with known input tokens (`null` if 0 attempts have input tokens).
- `totalOutputTokens`: $\sum \text{outputTokens}$ across deduplicated execution attempts with known output tokens (`null` if 0 attempts have output tokens).
- `totalTokens`: $\sum (\text{inputTokens} + \text{outputTokens})$ across attempts where **both** are present (`null` if 0 attempts have complete tokens).
- `averageTokensPerRequest`: $\text{totalTokens} / \text{logicalRequestsWithCompleteTokens}$ (`null` if denominator is 0).
- `totalActualCostUsd`: $\sum \text{actualCostNano} / 10^9$ across attempts with known cost (`null` if 0 attempts have known cost).
- `averageCostPerLogicalRequestUsd`: $\text{totalActualCostUsd} / \text{logicalRequestsWithKnownCost}$ (`null` if denominator is 0).
- `costPerThousandTokensUsd`: $(\text{compatibleActualCostUsd} / \text{compatibleTotalTokens}) \times 1000$ across attempts that have **both** known cost and complete tokens (`null` if compatible tokens $= 0$).
- `costPerMillionTokensUsd`: $(\text{compatibleActualCostUsd} / \text{compatibleTotalTokens}) \times 1{,}000{,}000$.
- `baselineCostUsd`: $\sum_{r \in \text{eligible}} \text{price}_{\text{baseline}}(r.\text{inputTokens}, r.\text{outputTokens}, r.\text{timestampMs})$.
- `estimatedSavingsUsd`: $\text{baselineCostUsd} - \text{actualEligibleCostUsd}$.
- `estimatedSavingsPercent`: $(\text{estimatedSavingsUsd} / \text{baselineCostUsd}) \times 100$ (`null` if $\text{baselineCostUsd} \le 0$).

---

## 19. Deferrals & Future Roadmap Boundaries
- **Step 44 (Deferred):** Latency percentiles (`p50`, `p90`, `p95`, `p99`), first-token latency distributions, tokens/sec speed leaderboards, and performance regression detection.
- **Step 45+ (Deferred):** Active budget hard-stop enforcement, automated spending alerts, and invoice reconciliation.

