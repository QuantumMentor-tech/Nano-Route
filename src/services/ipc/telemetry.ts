/**
//! Nano Route — Telemetry Persistence & Analytics IPC Boundary
//! File: src/services/ipc/telemetry.ts
//!
//! Responsibility:
//! - Strongly-typed frontend API for operational observation recording and aggregation.
//! - Step 42 read-only single-snapshot aggregation for Telemetry Dashboard.
//! - Non-blocking execution, correlation tracking, and safe error normalization.
//! - In-memory mock store for browser dev mode and isolated automated testing.
*/

import { isTauriContext, safeInvoke, generateRequestId } from "./client.ts";
import { IpcError } from "./errors.ts";
import {
  DEFAULT_BASELINE_MODEL_ID,
  DEFAULT_BASELINE_PROVIDER_ID,
  computeTokenCostNanoUsd,
  getActivePricingTable,
  nanoUsdToUsd,
  resetMockPricingTable,
  resolveVersionedModelPricing,
  usdToNanoUsd,
} from "./pricing.ts";
import {
  IPC_COMMANDS,
  type CostAvailabilityState,
  type RecordTelemetryInput,
  type SavingsComparisonStatus,
  type TelemetryActualCostSummary,
  type TelemetryAggregateReport,
  type TelemetryBaselineSummary,
  type TelemetryCompletenessSummary,
  type TelemetryConfidenceBucket,
  type TelemetryConfidenceDistribution,
  type TelemetryCostTrendPoint,
  type TelemetryDashboardFilters,
  type TelemetryDashboardSnapshot,
  type TelemetryDashboardSummary,
  type TelemetryEventType,
  type TelemetryFilter,
  type TelemetryFilterOptionsDto,
  type TelemetryFinancialAnalytics,
  type TelemetryFinancialCoverageSummary,
  type TelemetryFinancialExportRow,
  type TelemetryModelCostSummary,
  type TelemetryModelOption,
  type TelemetryModelSummary,
  type TelemetryModelTokenSummary,
  type TelemetryOutcome,
  type TelemetryOutcomeSummary,
  type TelemetryProviderCostSummary,
  type TelemetryProviderOption,
  type TelemetryProviderSummary,
  type TelemetryProviderTokenSummary,
  type TelemetryRecord,
  type TelemetryRetryFailoverSummary,
  type TelemetrySavingsSummary,
  type TelemetryTimeBucket,
  type TelemetryTimeSeriesPoint,
  type TelemetryTokenSummary,
  type TelemetryTokenTrendPoint,
  type TokenDataSource,
  type LatencySampleSufficiency,
  type TelemetryLatencySummary,
  type TelemetryLatencyHistogramBucket,
  type TelemetryLatencyHistogram,
  type TelemetryLatencyTrendPoint,
  type TelemetryProviderLatencySummary,
  type TelemetryModelLatencySummary,
  type TelemetryOutcomeLatencySummary,
  type TelemetryRoutingOverheadSummary,
  type TelemetryStreamingPerformanceSummary,
  type TelemetryLogicalLatencySummary,
  type TelemetryLatencyDataQualitySummary,
  type TelemetryPerformanceAnalytics,
} from "./types.ts";

// ============================================================================
// Browser In-Memory Mock Store (enables development without running Tauri native core)
// ============================================================================

const mockRecords: TelemetryRecord[] = [];
let mockCounter = 1;

export type MockTelemetryErrorTarget = "snapshot" | "list" | "aggregate" | null;

let mockTelemetryDelayMs = 0;
let mockTelemetryErrorTarget: MockTelemetryErrorTarget = null;
let mockPerQueryDelayMs: ((queryId: string | null | undefined, filters: TelemetryDashboardFilters) => number) | null = null;

export function setMockTelemetryTestHooks(options: {
  delayMs?: number;
  errorTarget?: MockTelemetryErrorTarget;
  perQueryDelayMs?: ((queryId: string | null | undefined, filters: TelemetryDashboardFilters) => number) | null;
}): void {
  if (options.delayMs !== undefined) {
    mockTelemetryDelayMs = Math.max(0, options.delayMs);
  }
  if (options.errorTarget !== undefined) {
    mockTelemetryErrorTarget = options.errorTarget;
  }
  if (options.perQueryDelayMs !== undefined) {
    mockPerQueryDelayMs = options.perQueryDelayMs;
  }
}

export function resetMockTelemetryTestHooks(): void {
  mockTelemetryDelayMs = 0;
  mockTelemetryErrorTarget = null;
  mockPerQueryDelayMs = null;
}

export function resetTelemetryMockStore(): void {
  mockRecords.length = 0;
  mockCounter = 1;
  resetMockTelemetryTestHooks();
  resetMockPricingTable();
}

/**
 * Bulk inserts synthetic telemetry records into the mock store for deterministic
 * integration and large-dataset (1k / 10k / 50k) testing.
 */
export function __internalInsertMockTelemetryBatch(
  records: TelemetryRecord[]
): void {
  for (const r of records) {
    mockRecords.push(r);
  }
}

/**
 * Shared authoritative mock telemetry store accessor for Step 45 Data Lifecycle & Audit.
 */
export function __internalGetMockTelemetryStore(): TelemetryRecord[] {
  return mockRecords;
}

/**
 * Cascades session deletion to session-linked mock telemetry records,
 * matching SQLite `FOREIGN KEY(session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE`.
 */
export function __internalDeleteMockTelemetryBySession(
  sessionId: string
): number {
  let removed = 0;
  let writeIndex = 0;
  for (let i = 0; i < mockRecords.length; i++) {
    if (mockRecords[i].sessionId === sessionId) {
      removed++;
    } else {
      mockRecords[writeIndex++] = mockRecords[i];
    }
  }
  mockRecords.length = writeIndex;
  return removed;
}

// ============================================================================
// Canonical Provider & Outcome Display Normalization
// ============================================================================

export function resolveProviderDisplayName(providerId?: string | null): {
  providerId: string;
  displayName: string;
  isHistorical: boolean;
} {
  const trimmed = providerId?.trim();
  if (!trimmed || trimmed.toLowerCase() === "unrecorded") {
    return {
      providerId: "unrecorded",
      displayName: "Not recorded",
      isHistorical: true,
    };
  }

  const lower = trimmed.toLowerCase();
  switch (lower) {
    case "openai":
      return { providerId: "openai", displayName: "OpenAI", isHistorical: false };
    case "anthropic":
      return { providerId: "anthropic", displayName: "Anthropic", isHistorical: false };
    case "gemini":
    case "google":
      return { providerId: lower, displayName: "Google Gemini", isHistorical: false };
    case "deepseek":
      return { providerId: "deepseek", displayName: "DeepSeek", isHistorical: false };
    case "groq":
      return { providerId: "groq", displayName: "Groq", isHistorical: false };
    case "mistral":
      return { providerId: "mistral", displayName: "Mistral AI", isHistorical: false };
    case "local":
    case "local_slm":
      return { providerId: lower, displayName: "Local SLM", isHistorical: false };
    default:
      return { providerId: trimmed, displayName: trimmed, isHistorical: true };
  }
}

const ALLOWED_OUTCOMES = new Set([
  "success",
  "failure",
  "cancelled",
  "timeout",
  "rate_limited",
  "unavailable",
  "fallback",
]);

export function formatOutcomeLabel(outcome?: string | null): string {
  const lower = outcome?.trim().toLowerCase() || "unknown";
  switch (lower) {
    case "success":
      return "Success";
    case "failure":
      return "Failure";
    case "cancelled":
      return "Cancelled";
    case "timeout":
      return "Timeout";
    case "rate_limited":
      return "Rate Limited";
    case "unavailable":
      return "Provider Unavailable";
    case "fallback":
      return "Fallback Transition";
    default:
      return "Unknown";
  }
}

// ============================================================================
// Input Validation Helpers
// ============================================================================

function validateConfidence(confidence?: number | null): void {
  if (confidence !== undefined && confidence !== null) {
    if (
      Number.isNaN(confidence) ||
      !Number.isFinite(confidence) ||
      confidence < 0 ||
      confidence > 1
    ) {
      throw new IpcError({
        code: "INVALID_INPUT",
        category: "InvalidInput",
        message: `Telemetry confidence must be between 0.0 and 1.0; got ${confidence}`,
        retryable: false,
        userActionRequired: true,
      });
    }
  }
}

function validateCost(cost?: number | null): void {
  if (cost !== undefined && cost !== null) {
    if (Number.isNaN(cost) || !Number.isFinite(cost) || cost < 0) {
      throw new IpcError({
        code: "INVALID_INPUT",
        category: "InvalidInput",
        message: `Telemetry cost cannot be negative or invalid number; got ${cost}`,
        retryable: false,
        userActionRequired: true,
      });
    }
  }
}

function validateRoutingReason(reason?: string | null): void {
  if (reason && reason.length > 255) {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: "Telemetry routing reason exceeds maximum length of 255 characters",
      retryable: false,
      userActionRequired: true,
    });
  }
}

function validateDashboardFilters(
  filters: TelemetryDashboardFilters = {}
): TelemetryDashboardFilters {
  const startTime =
    filters.startTime !== undefined && filters.startTime !== null
      ? filters.startTime
      : null;
  const endTime =
    filters.endTime !== undefined && filters.endTime !== null
      ? filters.endTime
      : null;

  if (
    startTime !== null &&
    (!Number.isFinite(startTime) || Number.isNaN(startTime))
  ) {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: "Invalid telemetry start time",
      retryable: false,
      userActionRequired: true,
    });
  }

  if (
    endTime !== null &&
    (!Number.isFinite(endTime) || Number.isNaN(endTime))
  ) {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: "Invalid telemetry end time",
      retryable: false,
      userActionRequired: true,
    });
  }

  if (startTime !== null && endTime !== null && startTime > endTime) {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: "Telemetry date range start cannot be after date range end",
      retryable: false,
      userActionRequired: true,
    });
  }

  const providerId = filters.providerId?.trim() || null;
  if (providerId && providerId.length > 128) {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: "Telemetry provider filter exceeds maximum length of 128 characters",
      retryable: false,
      userActionRequired: true,
    });
  }

  const modelId = filters.modelId?.trim() || null;
  if (modelId && modelId.length > 128) {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: "Telemetry model filter exceeds maximum length of 128 characters",
      retryable: false,
      userActionRequired: true,
    });
  }

  const outcome = filters.outcome?.trim().toLowerCase() || null;
  if (outcome && outcome !== "unknown" && !ALLOWED_OUTCOMES.has(outcome)) {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: `Invalid telemetry outcome filter '${outcome}'`,
      retryable: false,
      userActionRequired: true,
    });
  }

  const baselineProviderId = filters.baselineProviderId?.trim() || null;
  if (baselineProviderId && baselineProviderId.length > 128) {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: "Baseline provider filter exceeds maximum length of 128 characters",
      retryable: false,
      userActionRequired: true,
    });
  }

  const baselineModelId = filters.baselineModelId?.trim() || null;
  if (baselineModelId && baselineModelId.length > 128) {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: "Baseline model filter exceeds maximum length of 128 characters",
      retryable: false,
      userActionRequired: true,
    });
  }

  return {
    startTime,
    endTime,
    timeBucket: filters.timeBucket ?? null,
    providerId,
    modelId,
    outcome,
    eventType: filters.eventType ?? null,
    queryId: filters.queryId ?? null,
    baselineProviderId,
    baselineModelId,
  };
}

function matchesFilter(record: TelemetryRecord, filter: TelemetryFilter): boolean {
  if (filter.startTime !== undefined && record.occurredAt < filter.startTime) return false;
  if (filter.endTime !== undefined && record.occurredAt > filter.endTime) return false;
  if (filter.sessionId && record.sessionId !== filter.sessionId) return false;
  if (filter.providerId && record.providerId !== filter.providerId) return false;
  if (filter.modelId && record.modelId !== filter.modelId) return false;
  if (filter.eventType && record.eventType !== filter.eventType) return false;
  if (filter.outcome && record.outcome !== filter.outcome) return false;
  return true;
}

function matchesDashboardFilter(
  record: TelemetryRecord,
  filter: TelemetryDashboardFilters
): boolean {
  if (filter.startTime != null && record.occurredAt < filter.startTime) {
    return false;
  }
  if (filter.endTime != null && record.occurredAt > filter.endTime) {
    return false;
  }
  if (filter.providerId) {
    const recProv = record.providerId?.trim() || "unrecorded";
    if (filter.providerId.toLowerCase() === "unrecorded") {
      if (recProv !== "unrecorded") return false;
    } else if (recProv !== filter.providerId) {
      return false;
    }
  }
  if (filter.modelId) {
    const recModel = record.modelId?.trim() || "unrecorded";
    if (filter.modelId.toLowerCase() === "unrecorded") {
      if (recModel !== "unrecorded") return false;
    } else if (recModel !== filter.modelId) {
      return false;
    }
  }
  if (filter.outcome) {
    const recOut = record.outcome?.trim().toLowerCase() || "unknown";
    if (recOut !== filter.outcome.toLowerCase()) return false;
  }
  if (filter.eventType && record.eventType !== filter.eventType) {
    return false;
  }
  return true;
}

function computePercentage(part: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((part / total) * 1000) / 10;
}

// ============================================================================
// Telemetry Persistence Public API
// ============================================================================

/**
 * Records an operational telemetry observation event.
 */
export async function recordTelemetryEvent(
  input: RecordTelemetryInput & { occurredAt?: number; routing_reason?: string }
): Promise<TelemetryRecord> {
  validateConfidence(input.confidence);
  validateCost(input.costUsd);
  const effectiveReason = input.routingReason ?? input.routing_reason;
  validateRoutingReason(effectiveReason);

  const eventType: TelemetryEventType = input.eventType || "system_event";
  const outcome: TelemetryOutcome = input.outcome || "success";

  if (!isTauriContext()) {
    const now =
      typeof input.occurredAt === "number" && Number.isFinite(input.occurredAt)
        ? input.occurredAt
        : Date.now();
    const record: TelemetryRecord = {
      id: `mock_telem_${now}_${mockCounter++}`,
      eventType,
      occurredAt: now,
      sessionId: input.sessionId?.trim() || null,
      messageId: input.messageId?.trim() || null,
      taskId: input.taskId?.trim() || null,
      streamId: input.streamId?.trim() || null,
      providerId: input.providerId?.trim() || null,
      modelId: input.modelId?.trim() || null,
      outcome,
      errorCode: input.errorCode?.trim() || null,
      latencyMs: input.latencyMs ?? null,
      promptTokens: input.promptTokens ?? null,
      completionTokens: input.completionTokens ?? null,
      costUsd: input.costUsd ?? null,
      confidence: input.confidence ?? null,
      routingReason: effectiveReason?.trim() || null,
    };

    mockRecords.push(record);
    return record;
  }

  return await safeInvoke<TelemetryRecord>(
    IPC_COMMANDS.RECORD_TELEMETRY_EVENT,
    { input },
    { requestId: generateRequestId() }
  );
}

/**
 * Queries filtered telemetry records with pagination in reverse chronological order.
 */
export async function listTelemetryRecords(
  filter: TelemetryFilter = {},
  limit: number = 50,
  offset: number = 0
): Promise<TelemetryRecord[]> {
  if (!isTauriContext()) {
    if (mockTelemetryErrorTarget === "list") {
      throw new IpcError({
        code: "INTERNAL_ERROR",
        category: "Internal",
        message: "Failed to query local telemetry records",
        retryable: true,
      });
    }
    const filtered = mockRecords
      .filter((r) => matchesFilter(r, filter))
      .sort((a, b) => {
        if (b.occurredAt !== a.occurredAt) return b.occurredAt - a.occurredAt;
        return b.id.localeCompare(a.id);
      });
    return filtered.slice(offset, offset + limit);
  }

  return await safeInvoke<TelemetryRecord[]>(
    IPC_COMMANDS.LIST_TELEMETRY_RECORDS,
    { filter, limit, offset },
    { requestId: generateRequestId() }
  );
}

/**
 * Calculates aggregate operational metrics over filtered observations.
 */
export async function getTelemetryAggregates(
  filter: TelemetryFilter = {}
): Promise<TelemetryAggregateReport> {
  if (!isTauriContext()) {
    if (mockTelemetryErrorTarget === "aggregate") {
      throw new IpcError({
        code: "INTERNAL_ERROR",
        category: "Internal",
        message: "Failed to aggregate local telemetry metrics",
        retryable: true,
      });
    }
    const matched = mockRecords.filter((r) => matchesFilter(r, filter));
    const totalEvents = matched.length;
    let successfulEvents = 0;
    let failedEvents = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalCostUsd = 0;
    let latencySum = 0;
    let latencyCount = 0;
    let minLatency: number | null = null;
    let maxLatency: number | null = null;

    for (const r of matched) {
      if (r.outcome === "success") {
        successfulEvents++;
      } else {
        failedEvents++;
      }

      if (r.promptTokens != null) totalPromptTokens += r.promptTokens;
      if (r.completionTokens != null) totalCompletionTokens += r.completionTokens;
      if (r.costUsd != null) totalCostUsd += r.costUsd;

      if (r.latencyMs != null) {
        latencySum += r.latencyMs;
        latencyCount++;
        if (minLatency === null || r.latencyMs < minLatency) minLatency = r.latencyMs;
        if (maxLatency === null || r.latencyMs > maxLatency) maxLatency = r.latencyMs;
      }
    }

    return {
      totalEvents,
      successfulEvents,
      failedEvents,
      totalPromptTokens,
      totalCompletionTokens,
      totalCostUsd,
      avgLatencyMs: latencyCount > 0 ? latencySum / latencyCount : null,
      minLatencyMs: minLatency,
      maxLatencyMs: maxLatency,
    };
  }

  return await safeInvoke<TelemetryAggregateReport>(
    IPC_COMMANDS.GET_TELEMETRY_AGGREGATES,
    { filter },
    { requestId: generateRequestId() }
  );
}

/**
 * Computes a coherent, read-only Step 42 `TelemetryDashboardSnapshot`.
 * Mirrors the exact SQLite aggregation semantics of `TelemetryRepository::aggregate_dashboard_snapshot`.
 */
export async function getTelemetryDashboardSnapshot(
  rawFilters: TelemetryDashboardFilters = {}
): Promise<TelemetryDashboardSnapshot> {
  const validFilters = validateDashboardFilters(rawFilters);

  if (!isTauriContext()) {
    const delay = mockPerQueryDelayMs
      ? mockPerQueryDelayMs(validFilters.queryId, validFilters)
      : mockTelemetryDelayMs;
    if (delay > 0) {
      await new Promise((r) => setTimeout(r, delay));
    }

    if (mockTelemetryErrorTarget === "snapshot") {
      throw new IpcError({
        code: "INTERNAL_ERROR",
        category: "Internal",
        message: "Unable to load local telemetry snapshot",
        retryable: true,
      });
    }

    const generatedAtMs = Date.now();

    // 1. Discover global filter options across all stored records
    const providerOptionMap = new Map<string, TelemetryProviderOption>();
    const modelOptionMap = new Map<string, TelemetryModelOption>();
    const outcomeOptionSet = new Set<string>();

    for (const r of mockRecords) {
      const p = r.providerId?.trim();
      if (p) {
        if (!providerOptionMap.has(p)) {
          const info = resolveProviderDisplayName(p);
          providerOptionMap.set(p, {
            providerId: p,
            displayName: info.displayName,
            isHistorical: info.isHistorical,
          });
        }
      }

      const m = r.modelId?.trim();
      if (m) {
        const key = `${p ?? ""}::${m}`;
        if (!modelOptionMap.has(key)) {
          modelOptionMap.set(key, {
            providerId: p ?? null,
            modelId: m,
          });
        }
      }

      const o = r.outcome?.trim().toLowerCase();
      if (o) {
        outcomeOptionSet.add(o);
      }
    }

    const filterOptions: TelemetryFilterOptionsDto = {
      providers: Array.from(providerOptionMap.values()).sort((a, b) =>
        a.providerId.localeCompare(b.providerId)
      ),
      models: Array.from(modelOptionMap.values()).sort((a, b) => {
        const pa = a.providerId ?? "";
        const pb = b.providerId ?? "";
        if (pa !== pb) return pa.localeCompare(pb);
        return a.modelId.localeCompare(b.modelId);
      }),
      outcomes: Array.from(outcomeOptionSet).sort(),
    };

    // 2. Single-pass scan over filtered records
    let totalRecords = 0;
    let successfulExecutions = 0;
    let failedExecutions = 0;
    let cancelledExecutions = 0;
    let fallbackExecutions = 0;
    let fallbackSuccessCount = 0;
    let fallbackFailureCount = 0;
    let timeoutOutcomeCount = 0;
    let rateLimitedOutcomeCount = 0;

    let confAvailable = 0;
    let confB0 = 0;
    let confB1 = 0;
    let confB2 = 0;
    let confB3 = 0;
    let minConfidence: number | null = null;
    let maxConfidence: number | null = null;

    let providerRecordedCount = 0;
    let modelRecordedCount = 0;
    let outcomeRecordedCount = 0;
    let routingReasonRecordedCount = 0;
    let sessionCorrelationCount = 0;
    let completeMetadataCount = 0;
    let earliestRecordAtMs: number | null = null;
    let latestRecordAtMs: number | null = null;

    const providerAgg = new Map<
      string,
      { req: number; succ: number; fail: number; canc: number }
    >();
    const modelAgg = new Map<
      string,
      {
        providerId: string;
        modelId: string;
        req: number;
        succ: number;
        fail: number;
        canc: number;
      }
    >();
    const outcomeAgg = new Map<string, number>();

    const bucketMode: TelemetryTimeBucket =
      validFilters.timeBucket ??
      (validFilters.startTime != null &&
      validFilters.endTime != null &&
      validFilters.endTime - validFilters.startTime <= 48 * 3_600_000
        ? "hour"
        : "day");
    const bucketMs = bucketMode === "hour" ? 3_600_000 : 86_400_000;
    const tsAgg = new Map<
      number,
      { req: number; succ: number; fail: number; canc: number }
    >();

    for (const r of mockRecords) {
      if (!matchesDashboardFilter(r, validFilters)) continue;

      totalRecords++;

      const out = r.outcome?.trim().toLowerCase() || "unknown";
      const isSuccess = out === "success";
      const isFailure =
        out === "failure" ||
        out === "timeout" ||
        out === "rate_limited" ||
        out === "unavailable";
      const isCancelled = out === "cancelled";
      const isFallback =
        out === "fallback" ||
        r.eventType === "fallback_transition" ||
        Boolean(r.routingReason && r.routingReason.startsWith("Failover from "));

      if (isSuccess) successfulExecutions++;
      if (isFailure) failedExecutions++;
      if (isCancelled) cancelledExecutions++;
      if (isFallback) {
        fallbackExecutions++;
        if (isSuccess || out === "fallback") fallbackSuccessCount++;
        if (isFailure) fallbackFailureCount++;
      }
      if (out === "timeout") timeoutOutcomeCount++;
      if (out === "rate_limited") rateLimitedOutcomeCount++;

      // Confidence buckets
      if (
        typeof r.confidence === "number" &&
        Number.isFinite(r.confidence) &&
        r.confidence >= 0.0 &&
        r.confidence <= 1.0
      ) {
        confAvailable++;
        if (r.confidence < 0.25) confB0++;
        else if (r.confidence < 0.5) confB1++;
        else if (r.confidence < 0.75) confB2++;
        else confB3++;

        if (minConfidence === null || r.confidence < minConfidence) {
          minConfidence = r.confidence;
        }
        if (maxConfidence === null || r.confidence > maxConfidence) {
          maxConfidence = r.confidence;
        }
      }

      // Completeness
      const hasProv = Boolean(r.providerId && r.providerId.trim());
      const hasMod = Boolean(r.modelId && r.modelId.trim());
      const hasOut = Boolean(r.outcome && r.outcome.trim());
      const hasReason = Boolean(r.routingReason && r.routingReason.trim());
      const hasSess = Boolean(r.sessionId && r.sessionId.trim());

      if (hasProv) providerRecordedCount++;
      if (hasMod) modelRecordedCount++;
      if (hasOut) outcomeRecordedCount++;
      if (hasReason) routingReasonRecordedCount++;
      if (hasSess) sessionCorrelationCount++;
      if (hasProv && hasMod && hasOut && hasReason) completeMetadataCount++;

      if (Number.isFinite(r.occurredAt) && r.occurredAt > 0) {
        if (earliestRecordAtMs === null || r.occurredAt < earliestRecordAtMs) {
          earliestRecordAtMs = r.occurredAt;
        }
        if (latestRecordAtMs === null || r.occurredAt > latestRecordAtMs) {
          latestRecordAtMs = r.occurredAt;
        }
      }

      // Provider distribution
      const provKey = hasProv ? r.providerId!.trim() : "unrecorded";
      const pEntry = providerAgg.get(provKey) ?? {
        req: 0,
        succ: 0,
        fail: 0,
        canc: 0,
      };
      pEntry.req++;
      if (isSuccess) pEntry.succ++;
      if (isFailure) pEntry.fail++;
      if (isCancelled) pEntry.canc++;
      providerAgg.set(provKey, pEntry);

      // Model distribution
      const modKey = hasMod ? r.modelId!.trim() : "unrecorded";
      const pmKey = `${provKey}::${modKey}`;
      const mEntry = modelAgg.get(pmKey) ?? {
        providerId: provKey,
        modelId: modKey,
        req: 0,
        succ: 0,
        fail: 0,
        canc: 0,
      };
      mEntry.req++;
      if (isSuccess) mEntry.succ++;
      if (isFailure) mEntry.fail++;
      if (isCancelled) mEntry.canc++;
      modelAgg.set(pmKey, mEntry);

      // Outcome distribution
      outcomeAgg.set(out, (outcomeAgg.get(out) ?? 0) + 1);

      // Time-series bucket
      const safeEpoch = Number.isFinite(r.occurredAt) ? r.occurredAt : 0;
      const bucketStart = Math.floor(safeEpoch / bucketMs) * bucketMs;
      const tEntry = tsAgg.get(bucketStart) ?? {
        req: 0,
        succ: 0,
        fail: 0,
        canc: 0,
      };
      tEntry.req++;
      if (isSuccess) tEntry.succ++;
      if (isFailure) tEntry.fail++;
      if (isCancelled) tEntry.canc++;
      tsAgg.set(bucketStart, tEntry);
    }

    const terminalExecutions =
      successfulExecutions + failedExecutions + cancelledExecutions;
    const summary: TelemetryDashboardSummary = {
      totalRoutedRequests: totalRecords,
      successfulExecutions,
      failedExecutions,
      cancelledExecutions,
      fallbackExecutions,
      terminalExecutions,
      successRatePercent: computePercentage(
        successfulExecutions,
        terminalExecutions
      ),
    };

    const providerDistribution: TelemetryProviderSummary[] = Array.from(
      providerAgg.entries()
    )
      .sort((a, b) => {
        if (b[1].req !== a[1].req) return b[1].req - a[1].req;
        return a[0].localeCompare(b[0]);
      })
      .slice(0, 100)
      .map(([provId, counts]) => {
        const info =
          provId === "unrecorded"
            ? resolveProviderDisplayName(null)
            : resolveProviderDisplayName(provId);
        return {
          providerId: provId,
          displayName: info.displayName,
          isHistoricalOrUnrecorded: info.isHistorical,
          requestCount: counts.req,
          successCount: counts.succ,
          failureCount: counts.fail,
          cancelledCount: counts.canc,
          percentageOfTotal: computePercentage(counts.req, totalRecords),
        };
      });

    const modelDistribution: TelemetryModelSummary[] = Array.from(
      modelAgg.values()
    )
      .sort((a, b) => {
        if (b.req !== a.req) return b.req - a.req;
        if (a.providerId !== b.providerId) {
          return a.providerId.localeCompare(b.providerId);
        }
        return a.modelId.localeCompare(b.modelId);
      })
      .slice(0, 100)
      .map((entry) => {
        const info =
          entry.providerId === "unrecorded"
            ? resolveProviderDisplayName(null)
            : resolveProviderDisplayName(entry.providerId);
        return {
          providerId: entry.providerId,
          providerDisplayName: info.displayName,
          modelId: entry.modelId,
          isHistoricalOrUnrecorded:
            entry.modelId === "unrecorded" || info.isHistorical,
          requestCount: entry.req,
          successCount: entry.succ,
          failureCount: entry.fail,
          cancelledCount: entry.canc,
          percentageOfTotal: computePercentage(entry.req, totalRecords),
        };
      });

    const outcomeDistribution: TelemetryOutcomeSummary[] = Array.from(
      outcomeAgg.entries()
    )
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0]);
      })
      .map(([outcome, count]) => ({
        outcome,
        label: formatOutcomeLabel(outcome),
        count,
        percentageOfTotal: computePercentage(count, totalRecords),
      }));

    const timeSeries: TelemetryTimeSeriesPoint[] = Array.from(tsAgg.entries())
      .sort((a, b) => a[0] - b[0])
      .slice(-366)
      .map(([bucketStartMs, counts]) => ({
        bucketStartMs,
        bucketLabel: String(bucketStartMs),
        requestCount: counts.req,
        successCount: counts.succ,
        failureCount: counts.fail,
        cancelledCount: counts.canc,
      }));

    const confidenceBuckets: TelemetryConfidenceBucket[] = [
      {
        bucketKey: "0.00_0.25",
        label: "0.00 – 0.24",
        minInclusive: 0.0,
        maxInclusive: 0.2499,
        count: confB0,
        percentageOfAvailable: computePercentage(confB0, confAvailable),
      },
      {
        bucketKey: "0.25_0.50",
        label: "0.25 – 0.49",
        minInclusive: 0.25,
        maxInclusive: 0.4999,
        count: confB1,
        percentageOfAvailable: computePercentage(confB1, confAvailable),
      },
      {
        bucketKey: "0.50_0.75",
        label: "0.50 – 0.74",
        minInclusive: 0.5,
        maxInclusive: 0.7499,
        count: confB2,
        percentageOfAvailable: computePercentage(confB2, confAvailable),
      },
      {
        bucketKey: "0.75_1.00",
        label: "0.75 – 1.00",
        minInclusive: 0.75,
        maxInclusive: 1.0,
        count: confB3,
        percentageOfAvailable: computePercentage(confB3, confAvailable),
      },
    ];

    const confidenceDistribution: TelemetryConfidenceDistribution = {
      availableCount: confAvailable,
      missingCount: Math.max(0, totalRecords - confAvailable),
      minConfidence,
      maxConfidence,
      buckets: confidenceBuckets,
    };

    const retryFailover: TelemetryRetryFailoverSummary = {
      failoverDataAvailable: totalRecords > 0,
      failoverInvolvedCount: fallbackExecutions,
      fallbackSuccessCount,
      fallbackFailureCount,
      timeoutOutcomeCount,
      rateLimitedOutcomeCount,
      retryDataAvailable: false,
      retryExecutionCount: null,
    };

    const completeness: TelemetryCompletenessSummary = {
      totalRecords,
      providerRecordedCount,
      providerRecordedPercent: computePercentage(
        providerRecordedCount,
        totalRecords
      ),
      modelRecordedCount,
      modelRecordedPercent: computePercentage(modelRecordedCount, totalRecords),
      outcomeRecordedCount,
      outcomeRecordedPercent: computePercentage(
        outcomeRecordedCount,
        totalRecords
      ),
      routingReasonRecordedCount,
      routingReasonRecordedPercent: computePercentage(
        routingReasonRecordedCount,
        totalRecords
      ),
      confidenceRecordedCount: confAvailable,
      confidenceRecordedPercent: computePercentage(confAvailable, totalRecords),
      sessionCorrelationCount,
      sessionCorrelationPercent: computePercentage(
        sessionCorrelationCount,
        totalRecords
      ),
      completeMetadataCount,
      completeMetadataPercent: computePercentage(
        completeMetadataCount,
        totalRecords
      ),
      incompleteRecordsCount: Math.max(0, totalRecords - completeMetadataCount),
      earliestRecordAtMs,
      latestRecordAtMs,
    };

    const financialAnalytics = computeFinancialAnalyticsFromRecords(
      mockRecords,
      validFilters,
      generatedAtMs
    );

    const performanceAnalytics = computePerformanceAnalyticsFromRecords(
      mockRecords,
      validFilters,
      generatedAtMs
    );

    return {
      queryId: validFilters.queryId ?? null,
      generatedAtMs,
      appliedFilters: validFilters,
      filterOptions,
      summary,
      timeSeries,
      providerDistribution,
      modelDistribution,
      outcomeDistribution,
      retryFailover,
      confidenceDistribution,
      completeness,
      financialAnalytics,
      performanceAnalytics,
    };
  }

  return await safeInvoke<TelemetryDashboardSnapshot>(
    IPC_COMMANDS.GET_TELEMETRY_DASHBOARD_SNAPSHOT,
    { filters: validFilters },
    { requestId: generateRequestId() }
  );
}

// ============================================================================
// Step 43: Token Usage, Cost Analytics & Routing Savings Engine Aggregation
// ============================================================================

interface GroupFinancialAccumulator {
  attemptCount: number;
  logicalRequests: Set<string>;
  tokenEligibleCount: number;
  inputAvailableCount: number;
  outputAvailableCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costEligibleCount: number;
  actualCostNano: bigint;
  savingsEligibleCount: number;
  eligibleActualCostNano: bigint;
  baselineCostNano: bigint;
}

function createGroupFinancialAccumulator(): GroupFinancialAccumulator {
  return {
    attemptCount: 0,
    logicalRequests: new Set<string>(),
    tokenEligibleCount: 0,
    inputAvailableCount: 0,
    outputAvailableCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    costEligibleCount: 0,
    actualCostNano: 0n,
    savingsEligibleCount: 0,
    eligibleActualCostNano: 0n,
    baselineCostNano: 0n,
  };
}

function computeNanoSharePercent(partNano: bigint, totalNano: bigint): number | null {
  if (totalNano <= 0n) return null;
  const ratio = Number(partNano * 10000n / totalNano) / 100;
  return Math.round(ratio * 10) / 10;
}

export function computeFinancialAnalyticsFromRecords(
  records: readonly TelemetryRecord[],
  validFilters: TelemetryDashboardFilters,
  generatedAtMs: number = Date.now()
): TelemetryFinancialAnalytics {
  const pricingTable = getActivePricingTable();

  const bucketMode: TelemetryTimeBucket =
    validFilters.timeBucket ??
    (validFilters.startTime != null &&
    validFilters.endTime != null &&
    validFilters.endTime - validFilters.startTime <= 48 * 3_600_000
      ? "hour"
      : "day");
  const bucketMs = bucketMode === "hour" ? 3_600_000 : 86_400_000;

  const baselineProv = (
    validFilters.baselineProviderId?.trim() || DEFAULT_BASELINE_PROVIDER_ID
  ).toLowerCase();
  const baselineMod =
    validFilters.baselineModelId?.trim() || DEFAULT_BASELINE_MODEL_ID;
  const baselineProvInfo = resolveProviderDisplayName(baselineProv);
  const baselineModDisplay =
    pricingTable.find(
      (p) =>
        p.providerId.toLowerCase() === baselineProv &&
        p.modelId.toLowerCase() === baselineMod.toLowerCase()
    )?.displayName ?? baselineMod;

  // Filter matching rows and sort chronologically (`occurredAt ASC, id ASC`)
  const matchedRows = records
    .filter((r) => matchesDashboardFilter(r, validFilters))
    .slice()
    .sort((a, b) => {
      if (a.occurredAt !== b.occurredAt) return a.occurredAt - b.occurredAt;
      return a.id.localeCompare(b.id);
    });

  // First pass: identify execution-correlated IDs and terminal stream_lifecycle IDs
  const execTaskIds = new Set<string>();
  const execMsgIds = new Set<string>();
  const execStreamIds = new Set<string>();
  const lastStreamLifecycleIdByStream = new Map<string, string>();

  for (const r of matchedRows) {
    const tid = r.taskId?.trim() || null;
    const mid = r.messageId?.trim() || null;
    const sid = r.streamId?.trim() || null;

    if (
      r.eventType === "provider_execution" ||
      r.eventType === "fallback_transition"
    ) {
      if (tid) execTaskIds.add(tid);
      if (mid) execMsgIds.add(mid);
      if (sid) execStreamIds.add(sid);
    } else if (r.eventType === "stream_lifecycle") {
      if (sid) lastStreamLifecycleIdByStream.set(sid, r.id);
    }
  }

  let duplicateOrIntermediateEventsExcluded = 0;
  const physicalAttempts: TelemetryRecord[] = [];

  for (const r of matchedRows) {
    const tid = r.taskId?.trim() || null;
    const mid = r.messageId?.trim() || null;
    const sid = r.streamId?.trim() || null;
    let exclude = false;

    if (r.eventType === "stream_lifecycle") {
      if (
        (sid && execStreamIds.has(sid)) ||
        (tid && execTaskIds.has(tid)) ||
        (mid && execMsgIds.has(mid))
      ) {
        exclude = true;
      } else if (
        sid &&
        lastStreamLifecycleIdByStream.get(sid) !== undefined &&
        lastStreamLifecycleIdByStream.get(sid) !== r.id
      ) {
        exclude = true;
      }
    } else if (
      r.eventType === "routing_decision" ||
      r.eventType === "system_event"
    ) {
      if ((tid && execTaskIds.has(tid)) || (mid && execMsgIds.has(mid))) {
        exclude = true;
      }
    }

    if (exclude) {
      duplicateOrIntermediateEventsExcluded++;
    } else {
      physicalAttempts.push(r);
    }
  }

  const physicalAttemptCount = physicalAttempts.length;
  const logicalRequestsSet = new Set<string>();
  const costEligibleLogicalRequests = new Set<string>();

  let inputTokensAvailableCount = 0;
  let outputTokensAvailableCount = 0;
  let bothTokensAvailableCount = 0;
  let sumInputTokens = 0;
  let sumOutputTokens = 0;
  let sumBothTotalTokens = 0;

  let costEligibleAttemptCount = 0;
  let zeroCostAttemptCount = 0;
  let totalActualCostNano = 0n;

  let compatCostTokenCount = 0;
  let compatTotalTokens = 0;
  let compatCostNano = 0n;

  let savingsEligibleCount = 0;
  let missingTokenDataCount = 0;
  let missingActualCostCount = 0;
  let missingBaselinePricingCount = 0;
  let baselinePricingCoverageCount = 0;
  let eligibleActualCostNano = 0n;
  let baselineCostNano = 0n;
  const pricingVersionsSet = new Set<string>();

  const providerAcc = new Map<string, GroupFinancialAccumulator>();
  const modelAcc = new Map<string, GroupFinancialAccumulator>();
  const bucketAcc = new Map<number, GroupFinancialAccumulator>();
  const exportAcc = new Map<string, { bucketStartMs: number; providerId: string; modelId: string; acc: GroupFinancialAccumulator }>();

  for (const r of physicalAttempts) {
    const tid = r.taskId?.trim() || null;
    const mid = r.messageId?.trim() || null;
    const sid = r.streamId?.trim() || null;
    const logicalKey = tid
      ? `task:${tid}`
      : mid
      ? `msg:${mid}`
      : sid
      ? `stream:${sid}`
      : `rec:${r.id}`;
    logicalRequestsSet.add(logicalKey);

    const provKey = r.providerId?.trim() || "unrecorded";
    const modKey = r.modelId?.trim() || "unrecorded";
    const safeEpoch = Number.isFinite(r.occurredAt) ? Math.max(0, r.occurredAt) : 0;
    const bucketStart = Math.floor(safeEpoch / bucketMs) * bucketMs;

    const validIn =
      typeof r.promptTokens === "number" &&
      Number.isFinite(r.promptTokens) &&
      r.promptTokens >= 0
        ? Math.trunc(r.promptTokens)
        : null;
    const validOut =
      typeof r.completionTokens === "number" &&
      Number.isFinite(r.completionTokens) &&
      r.completionTokens >= 0
        ? Math.trunc(r.completionTokens)
        : null;
    const validBoth =
      validIn !== null && validOut !== null
        ? { inTokens: validIn, outTokens: validOut, total: validIn + validOut }
        : null;

    if (validIn !== null) {
      inputTokensAvailableCount++;
      sumInputTokens += validIn;
    }
    if (validOut !== null) {
      outputTokensAvailableCount++;
      sumOutputTokens += validOut;
    }
    if (validBoth !== null) {
      bothTokensAvailableCount++;
      sumBothTotalTokens += validBoth.total;
    } else {
      missingTokenDataCount++;
    }

    const validCostNano = usdToNanoUsd(r.costUsd);
    if (validCostNano !== null) {
      costEligibleAttemptCount++;
      costEligibleLogicalRequests.add(logicalKey);
      if (validCostNano === 0n) {
        zeroCostAttemptCount++;
      }
      totalActualCostNano += validCostNano;
    } else {
      missingActualCostCount++;
    }

    if (validCostNano !== null && validBoth !== null) {
      compatCostTokenCount++;
      compatTotalTokens += validBoth.total;
      compatCostNano += validCostNano;
    }

    const basePricing = resolveVersionedModelPricing(
      baselineProv,
      baselineMod,
      safeEpoch,
      pricingTable
    );
    if (basePricing !== null) {
      baselinePricingCoverageCount++;
    } else {
      missingBaselinePricingCount++;
    }

    let savingsTuple: { actNano: bigint; baseNano: bigint } | null = null;
    if (validBoth !== null && validCostNano !== null && basePricing !== null) {
      const bNano = computeTokenCostNanoUsd(
        validBoth.inTokens,
        validBoth.outTokens,
        basePricing.inputCostPerMillionUsd,
        basePricing.outputCostPerMillionUsd
      );
      pricingVersionsSet.add(basePricing.pricingVersion);
      savingsEligibleCount++;
      eligibleActualCostNano += validCostNano;
      baselineCostNano += bNano;
      savingsTuple = { actNano: validCostNano, baseNano: bNano };
    }

    const applyToAcc = (acc: GroupFinancialAccumulator) => {
      acc.attemptCount++;
      acc.logicalRequests.add(logicalKey);
      if (validIn !== null) {
        acc.inputAvailableCount++;
        acc.inputTokens += validIn;
      }
      if (validOut !== null) {
        acc.outputAvailableCount++;
        acc.outputTokens += validOut;
      }
      if (validBoth !== null) {
        acc.tokenEligibleCount++;
        acc.totalTokens += validBoth.total;
      }
      if (validCostNano !== null) {
        acc.costEligibleCount++;
        acc.actualCostNano += validCostNano;
      }
      if (savingsTuple !== null) {
        acc.savingsEligibleCount++;
        acc.eligibleActualCostNano += savingsTuple.actNano;
        acc.baselineCostNano += savingsTuple.baseNano;
      }
    };

    let pAcc = providerAcc.get(provKey);
    if (!pAcc) {
      pAcc = createGroupFinancialAccumulator();
      providerAcc.set(provKey, pAcc);
    }
    applyToAcc(pAcc);

    const pmKey = `${provKey}::${modKey}`;
    let mAcc = modelAcc.get(pmKey);
    if (!mAcc) {
      mAcc = createGroupFinancialAccumulator();
      modelAcc.set(pmKey, mAcc);
    }
    applyToAcc(mAcc);

    let bAcc = bucketAcc.get(bucketStart);
    if (!bAcc) {
      bAcc = createGroupFinancialAccumulator();
      bucketAcc.set(bucketStart, bAcc);
    }
    applyToAcc(bAcc);

    const expKey = `${bucketStart}::${provKey}::${modKey}`;
    let eEntry = exportAcc.get(expKey);
    if (!eEntry) {
      eEntry = {
        bucketStartMs: bucketStart,
        providerId: provKey,
        modelId: modKey,
        acc: createGroupFinancialAccumulator(),
      };
      exportAcc.set(expKey, eEntry);
    }
    applyToAcc(eEntry.acc);
  }

  const logicalRequestCount = logicalRequestsSet.size;
  const missingCostAttemptCount = Math.max(
    0,
    physicalAttemptCount - costEligibleAttemptCount
  );

  const tokenDataSource: TokenDataSource =
    bothTokensAvailableCount > 0 ||
    inputTokensAvailableCount > 0 ||
    outputTokensAvailableCount > 0
      ? "recorded"
      : "unavailable";

  const tokenSummary: TelemetryTokenSummary = {
    logicalRequestCount,
    physicalAttemptCount,
    duplicateOrIntermediateEventsExcluded,
    inputTokensAvailableCount,
    outputTokensAvailableCount,
    bothTokensAvailableCount,
    missingTokenRecordsCount: missingTokenDataCount,
    totalInputTokens: inputTokensAvailableCount > 0 ? sumInputTokens : null,
    totalOutputTokens: outputTokensAvailableCount > 0 ? sumOutputTokens : null,
    totalTokens: bothTokensAvailableCount > 0 ? sumBothTotalTokens : null,
    tokenDataSource,
  };

  const eligibleLogicalRequestCount = costEligibleLogicalRequests.size;
  const totalActualCostUsd =
    costEligibleAttemptCount > 0 ? nanoUsdToUsd(totalActualCostNano) : null;
  const averageCostPerAttemptUsd =
    costEligibleAttemptCount > 0 && totalActualCostUsd !== null
      ? totalActualCostUsd / costEligibleAttemptCount
      : null;
  const averageCostPerLogicalRequestUsd =
    eligibleLogicalRequestCount > 0 && totalActualCostUsd !== null
      ? totalActualCostUsd / eligibleLogicalRequestCount
      : null;

  let costPerThousandTokensUsd: number | null = null;
  let costPerMillionTokensUsd: number | null = null;
  if (compatCostTokenCount > 0 && compatTotalTokens > 0) {
    const perTokenUsd = nanoUsdToUsd(compatCostNano) / compatTotalTokens;
    costPerThousandTokensUsd = perTokenUsd * 1_000;
    costPerMillionTokensUsd = perTokenUsd * 1_000_000;
  }

  const costAvailabilityState: CostAvailabilityState =
    costEligibleAttemptCount > 0 ? "exact" : "unavailable";

  const actualCostSummary: TelemetryActualCostSummary = {
    currency: "USD",
    costAvailabilityState,
    eligibleAttemptCount: costEligibleAttemptCount,
    eligibleLogicalRequestCount,
    missingCostAttemptCount,
    zeroCostAttemptCount,
    totalActualCostUsd,
    averageCostPerLogicalRequestUsd,
    averageCostPerAttemptUsd,
    costPerThousandTokensUsd,
    costPerMillionTokensUsd,
    costPerTokenCompatibleRecordCount: compatCostTokenCount,
    costPerTokenCompatibleTotalTokens: compatTotalTokens,
  };

  const pricingVersionsUsed = Array.from(pricingVersionsSet).sort();
  let pricingVersionUsed: string | null = null;
  if (pricingVersionsUsed.length === 1) {
    pricingVersionUsed = pricingVersionsUsed[0]!;
  } else if (pricingVersionsUsed.length > 1) {
    pricingVersionUsed = "multiple";
  } else {
    const fallbackBp = resolveVersionedModelPricing(
      baselineProv,
      baselineMod,
      generatedAtMs,
      pricingTable
    );
    pricingVersionUsed = fallbackBp?.pricingVersion ?? null;
  }

  const baselineAvailable = pricingTable.some(
    (p) =>
      p.providerId.toLowerCase() === baselineProv &&
      p.modelId.toLowerCase() === baselineMod.toLowerCase()
  );

  const eligibleActualCostUsd =
    savingsEligibleCount > 0 ? nanoUsdToUsd(eligibleActualCostNano) : null;
  const baselineCostUsd =
    savingsEligibleCount > 0 ? nanoUsdToUsd(baselineCostNano) : null;
  const savingsNano = baselineCostNano - eligibleActualCostNano;
  const estimatedSavingsUsd =
    savingsEligibleCount > 0 ? nanoUsdToUsd(savingsNano) : null;
  const savingsPercent =
    savingsEligibleCount > 0 && baselineCostNano > 0n
      ? Math.round((Number(savingsNano) / Number(baselineCostNano)) * 1000) / 10
      : null;

  let comparisonStatus: SavingsComparisonStatus = "unavailable";
  if (savingsEligibleCount > 0) {
    if (savingsNano > 0n) comparisonStatus = "below_baseline";
    else if (savingsNano < 0n) comparisonStatus = "above_baseline";
    else comparisonStatus = "at_baseline";
  }

  const baselineSummary: TelemetryBaselineSummary = {
    baselineProviderId: baselineProv,
    baselineProviderDisplayName: baselineProvInfo.displayName,
    baselineModelId: baselineMod,
    baselineModelDisplayName: baselineModDisplay,
    methodology: "token_equivalent_baseline_estimate",
    methodologyLabel:
      "Token-equivalent baseline estimate (Method B: actual token workload × versioned baseline pricing)",
    pricingVersionUsed,
    pricingVersionsUsed,
    baselineAvailable,
    baselineCostUsd,
  };

  let allTimeEligibleRecordCount = savingsEligibleCount;
  let allTimeActualCostUsd = eligibleActualCostUsd;
  let allTimeBaselineCostUsd = baselineCostUsd;
  let allTimeEstimatedSavingsUsd = estimatedSavingsUsd;
  let allTimeSavingsPercent = savingsPercent;

  if (validFilters.startTime !== null || validFilters.endTime !== null) {
    const allTimeSnap = computeFinancialAnalyticsFromRecords(
      records,
      { ...validFilters, startTime: null, endTime: null },
      generatedAtMs
    );
    allTimeEligibleRecordCount = allTimeSnap.savingsSummary.eligibleRecordCount;
    allTimeActualCostUsd = allTimeSnap.savingsSummary.eligibleActualCostUsd;
    allTimeBaselineCostUsd = allTimeSnap.savingsSummary.baselineCostUsd;
    allTimeEstimatedSavingsUsd = allTimeSnap.savingsSummary.estimatedSavingsUsd;
    allTimeSavingsPercent = allTimeSnap.savingsSummary.savingsPercent;
  }

  const savingsSummary: TelemetrySavingsSummary = {
    savingsState: savingsEligibleCount > 0 ? "estimated" : "unavailable",
    comparisonStatus,
    eligibleRecordCount: savingsEligibleCount,
    ineligibleRecordCount: Math.max(0, physicalAttemptCount - savingsEligibleCount),
    missingTokenDataCount,
    missingActualCostCount,
    missingBaselinePricingCount,
    eligibleActualCostUsd,
    baselineCostUsd,
    estimatedSavingsUsd,
    savingsPercent,
    allTimeEligibleRecordCount,
    allTimeActualCostUsd,
    allTimeBaselineCostUsd,
    allTimeEstimatedSavingsUsd,
    allTimeSavingsPercent,
  };

  const sortedBuckets = Array.from(bucketAcc.entries()).sort((a, b) => a[0] - b[0]);
  const tokenTrend: TelemetryTokenTrendPoint[] = sortedBuckets.map(
    ([bucketStartMs, acc]) => ({
      bucketStartMs,
      bucketLabel: String(bucketStartMs),
      attemptCount: acc.attemptCount,
      tokenEligibleCount: acc.tokenEligibleCount,
      inputTokens: acc.inputAvailableCount > 0 ? acc.inputTokens : null,
      outputTokens: acc.outputAvailableCount > 0 ? acc.outputTokens : null,
      totalTokens: acc.tokenEligibleCount > 0 ? acc.totalTokens : null,
    })
  );

  const costTrend: TelemetryCostTrendPoint[] = sortedBuckets.map(
    ([bucketStartMs, acc]) => ({
      bucketStartMs,
      bucketLabel: String(bucketStartMs),
      attemptCount: acc.attemptCount,
      costEligibleCount: acc.costEligibleCount,
      actualCostUsd:
        acc.costEligibleCount > 0 ? nanoUsdToUsd(acc.actualCostNano) : null,
      savingsEligibleCount: acc.savingsEligibleCount,
      baselineCostUsd:
        acc.savingsEligibleCount > 0 ? nanoUsdToUsd(acc.baselineCostNano) : null,
      estimatedSavingsUsd:
        acc.savingsEligibleCount > 0
          ? nanoUsdToUsd(acc.baselineCostNano - acc.eligibleActualCostNano)
          : null,
    })
  );

  const providerTokenBreakdown: TelemetryProviderTokenSummary[] = [];
  const providerCostBreakdown: TelemetryProviderCostSummary[] = [];

  for (const [provId, acc] of providerAcc.entries()) {
    const info =
      provId === "unrecorded"
        ? resolveProviderDisplayName(null)
        : resolveProviderDisplayName(provId);

    providerTokenBreakdown.push({
      providerId: provId,
      displayName: info.displayName,
      isHistoricalOrUnrecorded: info.isHistorical,
      attemptCount: acc.attemptCount,
      logicalRequestCount: acc.logicalRequests.size,
      tokenEligibleCount: acc.tokenEligibleCount,
      inputTokens: acc.inputAvailableCount > 0 ? acc.inputTokens : null,
      outputTokens: acc.outputAvailableCount > 0 ? acc.outputTokens : null,
      totalTokens: acc.tokenEligibleCount > 0 ? acc.totalTokens : null,
      shareOfTotalTokensPercent:
        acc.tokenEligibleCount > 0
          ? computePercentage(acc.totalTokens, sumBothTotalTokens)
          : null,
    });

    const pSavNano = acc.baselineCostNano - acc.eligibleActualCostNano;
    providerCostBreakdown.push({
      providerId: provId,
      displayName: info.displayName,
      isHistoricalOrUnrecorded: info.isHistorical,
      attemptCount: acc.attemptCount,
      costEligibleCount: acc.costEligibleCount,
      actualCostUsd:
        acc.costEligibleCount > 0 ? nanoUsdToUsd(acc.actualCostNano) : null,
      averageCostPerEligibleAttemptUsd:
        acc.costEligibleCount > 0
          ? nanoUsdToUsd(acc.actualCostNano) / acc.costEligibleCount
          : null,
      totalTokens: acc.tokenEligibleCount > 0 ? acc.totalTokens : null,
      shareOfTotalCostPercent:
        acc.costEligibleCount > 0
          ? computeNanoSharePercent(acc.actualCostNano, totalActualCostNano)
          : null,
      savingsEligibleCount: acc.savingsEligibleCount,
      eligibleActualCostUsd:
        acc.savingsEligibleCount > 0
          ? nanoUsdToUsd(acc.eligibleActualCostNano)
          : null,
      baselineCostUsd:
        acc.savingsEligibleCount > 0
          ? nanoUsdToUsd(acc.baselineCostNano)
          : null,
      estimatedSavingsUsd:
        acc.savingsEligibleCount > 0 ? nanoUsdToUsd(pSavNano) : null,
      savingsPercent:
        acc.savingsEligibleCount > 0 && acc.baselineCostNano > 0n
          ? Math.round((Number(pSavNano) / Number(acc.baselineCostNano)) * 1000) /
            10
          : null,
    });
  }

  providerTokenBreakdown.sort((a, b) => {
    const ta = a.totalTokens ?? -1;
    const tb = b.totalTokens ?? -1;
    if (tb !== ta) return tb - ta;
    if (b.attemptCount !== a.attemptCount) return b.attemptCount - a.attemptCount;
    return a.providerId.localeCompare(b.providerId);
  });

  providerCostBreakdown.sort((a, b) => {
    const ca = a.actualCostUsd ?? -1;
    const cb = b.actualCostUsd ?? -1;
    if (cb !== ca) return cb - ca;
    if (b.attemptCount !== a.attemptCount) return b.attemptCount - a.attemptCount;
    return a.providerId.localeCompare(b.providerId);
  });

  const modelTokenBreakdown: TelemetryModelTokenSummary[] = [];
  const modelCostBreakdown: TelemetryModelCostSummary[] = [];

  for (const [pmKey, acc] of modelAcc.entries()) {
    const sepIdx = pmKey.indexOf("::");
    const provId = pmKey.slice(0, sepIdx);
    const modId = pmKey.slice(sepIdx + 2);
    const info =
      provId === "unrecorded"
        ? resolveProviderDisplayName(null)
        : resolveProviderDisplayName(provId);
    const isUnrec = modId === "unrecorded" || info.isHistorical;

    modelTokenBreakdown.push({
      providerId: provId,
      providerDisplayName: info.displayName,
      modelId: modId,
      isHistoricalOrUnrecorded: isUnrec,
      attemptCount: acc.attemptCount,
      logicalRequestCount: acc.logicalRequests.size,
      tokenEligibleCount: acc.tokenEligibleCount,
      inputTokens: acc.inputAvailableCount > 0 ? acc.inputTokens : null,
      outputTokens: acc.outputAvailableCount > 0 ? acc.outputTokens : null,
      totalTokens: acc.tokenEligibleCount > 0 ? acc.totalTokens : null,
      shareOfTotalTokensPercent:
        acc.tokenEligibleCount > 0
          ? computePercentage(acc.totalTokens, sumBothTotalTokens)
          : null,
    });

    const mSavNano = acc.baselineCostNano - acc.eligibleActualCostNano;
    modelCostBreakdown.push({
      providerId: provId,
      providerDisplayName: info.displayName,
      modelId: modId,
      isHistoricalOrUnrecorded: isUnrec,
      attemptCount: acc.attemptCount,
      costEligibleCount: acc.costEligibleCount,
      actualCostUsd:
        acc.costEligibleCount > 0 ? nanoUsdToUsd(acc.actualCostNano) : null,
      averageCostPerEligibleAttemptUsd:
        acc.costEligibleCount > 0
          ? nanoUsdToUsd(acc.actualCostNano) / acc.costEligibleCount
          : null,
      totalTokens: acc.tokenEligibleCount > 0 ? acc.totalTokens : null,
      shareOfTotalCostPercent:
        acc.costEligibleCount > 0
          ? computeNanoSharePercent(acc.actualCostNano, totalActualCostNano)
          : null,
      savingsEligibleCount: acc.savingsEligibleCount,
      eligibleActualCostUsd:
        acc.savingsEligibleCount > 0
          ? nanoUsdToUsd(acc.eligibleActualCostNano)
          : null,
      baselineCostUsd:
        acc.savingsEligibleCount > 0
          ? nanoUsdToUsd(acc.baselineCostNano)
          : null,
      estimatedSavingsUsd:
        acc.savingsEligibleCount > 0 ? nanoUsdToUsd(mSavNano) : null,
      savingsPercent:
        acc.savingsEligibleCount > 0 && acc.baselineCostNano > 0n
          ? Math.round((Number(mSavNano) / Number(acc.baselineCostNano)) * 1000) /
            10
          : null,
    });
  }

  modelTokenBreakdown.sort((a, b) => {
    const ta = a.totalTokens ?? -1;
    const tb = b.totalTokens ?? -1;
    if (tb !== ta) return tb - ta;
    if (b.attemptCount !== a.attemptCount) return b.attemptCount - a.attemptCount;
    if (a.providerId !== b.providerId) return a.providerId.localeCompare(b.providerId);
    return a.modelId.localeCompare(b.modelId);
  });

  modelCostBreakdown.sort((a, b) => {
    const ca = a.actualCostUsd ?? -1;
    const cb = b.actualCostUsd ?? -1;
    if (cb !== ca) return cb - ca;
    if (b.attemptCount !== a.attemptCount) return b.attemptCount - a.attemptCount;
    if (a.providerId !== b.providerId) return a.providerId.localeCompare(b.providerId);
    return a.modelId.localeCompare(b.modelId);
  });

  const exportRows: TelemetryFinancialExportRow[] = Array.from(exportAcc.values())
    .sort((a, b) => {
      if (a.bucketStartMs !== b.bucketStartMs) return a.bucketStartMs - b.bucketStartMs;
      if (a.providerId !== b.providerId) return a.providerId.localeCompare(b.providerId);
      return a.modelId.localeCompare(b.modelId);
    })
    .map(({ bucketStartMs, providerId, modelId, acc }) => ({
      bucketStartMs,
      providerId,
      modelId,
      attemptCount: acc.attemptCount,
      inputTokens: acc.inputAvailableCount > 0 ? acc.inputTokens : null,
      outputTokens: acc.outputAvailableCount > 0 ? acc.outputTokens : null,
      totalTokens: acc.tokenEligibleCount > 0 ? acc.totalTokens : null,
      actualCostUsd:
        acc.costEligibleCount > 0 ? nanoUsdToUsd(acc.actualCostNano) : null,
      baselineCostUsd:
        acc.savingsEligibleCount > 0 ? nanoUsdToUsd(acc.baselineCostNano) : null,
      estimatedSavingsUsd:
        acc.savingsEligibleCount > 0
          ? nanoUsdToUsd(acc.baselineCostNano - acc.eligibleActualCostNano)
          : null,
    }));

  const coverage: TelemetryFinancialCoverageSummary = {
    totalPhysicalAttempts: physicalAttemptCount,
    totalLogicalRequests: logicalRequestCount,
    tokenCoverageCount: bothTokensAvailableCount,
    tokenCoveragePercent: computePercentage(
      bothTokensAvailableCount,
      physicalAttemptCount
    ),
    costCoverageCount: costEligibleAttemptCount,
    costCoveragePercent: computePercentage(
      costEligibleAttemptCount,
      physicalAttemptCount
    ),
    baselinePricingCoverageCount,
    baselinePricingCoveragePercent: computePercentage(
      baselinePricingCoverageCount,
      physicalAttemptCount
    ),
    savingsCoverageCount: savingsEligibleCount,
    savingsCoveragePercent: computePercentage(
      savingsEligibleCount,
      physicalAttemptCount
    ),
    completeFinancialAnalyticsCount: savingsEligibleCount,
    completeFinancialAnalyticsPercent: computePercentage(
      savingsEligibleCount,
      physicalAttemptCount
    ),
  };

  return {
    queryId: validFilters.queryId ?? null,
    generatedAtMs,
    currency: "USD",
    tokenSummary,
    actualCostSummary,
    baselineSummary,
    savingsSummary,
    tokenTrend,
    costTrend,
    providerTokenBreakdown,
    modelTokenBreakdown,
    providerCostBreakdown,
    modelCostBreakdown,
    coverage,
    exportRows,
  };
}

/**
 * Computes a coherent read-only Step 43 Token Usage, Cost Analytics & Routing Savings snapshot.
 */
export async function getTelemetryCostAnalyticsSnapshot(
  filters: TelemetryDashboardFilters = {}
): Promise<TelemetryFinancialAnalytics> {
  const validFilters = validateDashboardFilters(filters);

  if (!isTauriContext()) {
    const delay = mockPerQueryDelayMs
      ? mockPerQueryDelayMs(validFilters.queryId, validFilters)
      : mockTelemetryDelayMs;
    if (delay > 0) {
      await new Promise((r) => setTimeout(r, delay));
    }

    if (mockTelemetryErrorTarget === "snapshot") {
      throw new IpcError({
        code: "INTERNAL_ERROR",
        category: "Internal",
        message: "Unable to load local telemetry financial snapshot",
        retryable: true,
      });
    }

    const generatedAtMs = Date.now();
    return computeFinancialAnalyticsFromRecords(
      mockRecords,
      validFilters,
      generatedAtMs
    );
  }

  return await safeInvoke<TelemetryFinancialAnalytics>(
    IPC_COMMANDS.GET_TELEMETRY_COST_ANALYTICS_SNAPSHOT,
    { filters: validFilters },
    { requestId: generateRequestId() }
  );
}

/**
 * Clears all persisted telemetry records (supports complete local data wipe).
 */
export async function clearTelemetry(): Promise<number> {
  if (!isTauriContext()) {
    const count = mockRecords.length;
    mockRecords.length = 0;
    return count;
  }

  return await safeInvoke<number>(
    IPC_COMMANDS.CLEAR_TELEMETRY,
    undefined,
    { requestId: generateRequestId() }
  );
}

// ============================================================================
// Step 44: Latency, Execution Performance & Benchmark Analytics Aggregation
// ============================================================================

const MAX_VALID_LATENCY_MS = 86_400_000;

/**
 * Formats a latency measurement in milliseconds according to Step 44 thresholds:
 * - null / undefined / NaN -> "Unavailable"
 * - < 1000 ms -> milliseconds (e.g., "245 ms" or "245.5 ms")
 * - >= 1000 ms -> seconds (e.g., "1.42 s")
 */
export function formatLatencyMs(
  ms: number | null | undefined,
  options?: { exactMs?: boolean }
): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) {
    return "Unavailable";
  }
  if (options?.exactMs) {
    const rounded = Math.round(ms * 100) / 100;
    return `${rounded.toLocaleString("en-US")} ms`;
  }
  if (ms < 1_000) {
    const rounded = Math.round(ms * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded} ms` : `${rounded.toFixed(1)} ms`;
  }
  const seconds = ms / 1_000;
  return `${seconds.toFixed(2)} s`;
}

export interface LatencyDistributionStats {
  sampleSufficiency: LatencySampleSufficiency;
  averageMs: number | null;
  medianMs: number | null;
  p25Ms: number | null;
  p50Ms: number | null;
  p75Ms: number | null;
  p90Ms: number | null;
  p95Ms: number | null;
  p99Ms: number | null;
  minMs: number | null;
  maxMs: number | null;
}

/**
 * Deterministic percentile & summary calculator using inclusive linear interpolation (R-7).
 * Enforces sample-size thresholds (Section 22):
 * - n >= 1: min, max, average, median (P50)
 * - n >= 3: P25, P75
 * - n >= 5: P90, P95
 * - n >= 10: P99
 */
export function computeLatencyDistributionStats(
  samples: readonly number[]
): LatencyDistributionStats {
  const n = samples.length;
  if (n === 0) {
    return {
      sampleSufficiency: "empty",
      averageMs: null,
      medianMs: null,
      p25Ms: null,
      p50Ms: null,
      p75Ms: null,
      p90Ms: null,
      p95Ms: null,
      p99Ms: null,
      minMs: null,
      maxMs: null,
    };
  }

  const sorted = samples.slice().sort((a, b) => a - b);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += sorted[i]!;
  }
  const avg = Math.round((sum / n) * 100) / 100;
  const minMs = sorted[0]!;
  const maxMs = sorted[n - 1]!;

  const interp = (q: number): number => {
    if (n === 1) return sorted[0]!;
    const pos = q * (n - 1);
    const lo = Math.floor(pos);
    const hi = Math.min(n - 1, Math.ceil(pos));
    const frac = pos - lo;
    const val = sorted[lo]! + frac * (sorted[hi]! - sorted[lo]!);
    return Math.round(val * 100) / 100;
  };

  const medianMs = interp(0.5);
  const p25Ms = n >= 3 ? interp(0.25) : null;
  const p75Ms = n >= 3 ? interp(0.75) : null;
  const p90Ms = n >= 5 ? interp(0.9) : null;
  const p95Ms = n >= 5 ? interp(0.95) : null;
  const p99Ms = n >= 10 ? interp(0.99) : null;

  return {
    sampleSufficiency: n < 5 ? "limited" : "sufficient",
    averageMs: avg,
    medianMs,
    p25Ms,
    p50Ms: medianMs,
    p75Ms,
    p90Ms,
    p95Ms,
    p99Ms,
    minMs,
    maxMs,
  };
}

interface PerfGroupAccumulator {
  eligibleCount: number;
  samples: number[];
}

export function computePerformanceAnalyticsFromRecords(
  records: readonly TelemetryRecord[],
  validFilters: TelemetryDashboardFilters = {},
  generatedAtMs: number = Date.now()
): TelemetryPerformanceAnalytics {
  const bucketMode: TelemetryTimeBucket =
    validFilters.timeBucket ??
    (validFilters.startTime != null &&
    validFilters.endTime != null &&
    validFilters.endTime - validFilters.startTime <= 48 * 3_600_000
      ? "hour"
      : "day");
  const bucketMs = bucketMode === "hour" ? 3_600_000 : 86_400_000;

  const matchedRows = records
    .filter((r) => matchesDashboardFilter(r, validFilters))
    .slice()
    .sort((a, b) => {
      if (a.occurredAt !== b.occurredAt) return a.occurredAt - b.occurredAt;
      return a.id.localeCompare(b.id);
    });

  const execTaskIds = new Set<string>();
  const execMsgIds = new Set<string>();
  const execStreamIds = new Set<string>();
  const lastStreamLifecycleIdByStream = new Map<string, string>();

  let totalRoutingEvents = 0;
  const routingLatencySamples: number[] = [];

  for (const r of matchedRows) {
    const tid = r.taskId?.trim() || null;
    const mid = r.messageId?.trim() || null;
    const sid = r.streamId?.trim() || null;

    if (r.eventType === "routing_decision") {
      totalRoutingEvents++;
      if (
        typeof r.latencyMs === "number" &&
        Number.isFinite(r.latencyMs) &&
        r.latencyMs >= 0 &&
        r.latencyMs <= MAX_VALID_LATENCY_MS
      ) {
        routingLatencySamples.push(r.latencyMs);
      }
    }

    if (
      r.eventType === "provider_execution" ||
      r.eventType === "fallback_transition"
    ) {
      if (tid) execTaskIds.add(tid);
      if (mid) execMsgIds.add(mid);
      if (sid) execStreamIds.add(sid);
    } else if (r.eventType === "stream_lifecycle") {
      if (sid) lastStreamLifecycleIdByStream.set(sid, r.id);
    }
  }

  let duplicateOrIntermediateEventsExcluded = 0;
  const eligibleAttempts: TelemetryRecord[] = [];

  for (const r of matchedRows) {
    const tid = r.taskId?.trim() || null;
    const mid = r.messageId?.trim() || null;
    const sid = r.streamId?.trim() || null;
    let exclude = false;

    if (r.eventType === "stream_lifecycle") {
      if (
        (sid && execStreamIds.has(sid)) ||
        (tid && execTaskIds.has(tid)) ||
        (mid && execMsgIds.has(mid))
      ) {
        exclude = true;
      } else if (
        sid &&
        lastStreamLifecycleIdByStream.get(sid) !== undefined &&
        lastStreamLifecycleIdByStream.get(sid) !== r.id
      ) {
        exclude = true;
      }
    } else if (
      r.eventType === "routing_decision" ||
      r.eventType === "system_event"
    ) {
      if (
        (tid && execTaskIds.has(tid)) ||
        (mid && execMsgIds.has(mid)) ||
        r.eventType === "system_event"
      ) {
        exclude = true;
      }
    }

    if (exclude) {
      duplicateOrIntermediateEventsExcluded++;
    } else {
      eligibleAttempts.push(r);
    }
  }

  const totalEligibleExecutions = eligibleAttempts.length;
  const allValidSamples: number[] = [];
  let missingLatencyCount = 0;
  let invalidLatencyCount = 0;
  let earliestMeasuredAtMs: number | null = null;
  let latestMeasuredAtMs: number | null = null;

  const providerAcc = new Map<string, PerfGroupAccumulator>();
  const modelAcc = new Map<string, PerfGroupAccumulator>();
  const outcomeAcc = new Map<string, PerfGroupAccumulator>();
  const bucketAcc = new Map<number, PerfGroupAccumulator>();
  const logicalAttemptsMap = new Map<string, Array<number | null>>();

  let totalStreamingExecutions = 0;
  const streamingCompletionSamples: number[] = [];
  const distinctProviders = new Set<string>();
  const distinctModels = new Set<string>();

  const histCounts = [0, 0, 0, 0, 0, 0, 0, 0];

  for (const r of eligibleAttempts) {
    const tid = r.taskId?.trim() || null;
    const mid = r.messageId?.trim() || null;
    const sid = r.streamId?.trim() || null;
    const logicalKey = tid
      ? `task:${tid}`
      : mid
        ? `msg:${mid}`
        : sid
          ? `stream:${sid}`
          : `rec:${r.id}`;

    const provKey = r.providerId?.trim() || "unrecorded";
    const modKey = r.modelId?.trim() || "unrecorded";
    distinctProviders.add(provKey);
    distinctModels.add(`${provKey}::${modKey}`);

    const safeEpoch = Number.isFinite(r.occurredAt)
      ? Math.max(0, r.occurredAt)
      : 0;
    const bucketStart = Math.floor(safeEpoch / bucketMs) * bucketMs;

    const isStreaming = Boolean(sid) || r.eventType === "stream_lifecycle";
    if (isStreaming) {
      totalStreamingExecutions++;
    }

    let validLat: number | null = null;
    if (r.latencyMs === undefined || r.latencyMs === null) {
      missingLatencyCount++;
    } else if (
      typeof r.latencyMs === "number" &&
      Number.isFinite(r.latencyMs) &&
      r.latencyMs >= 0 &&
      r.latencyMs <= MAX_VALID_LATENCY_MS
    ) {
      validLat = r.latencyMs;
    } else {
      invalidLatencyCount++;
    }

    let lList = logicalAttemptsMap.get(logicalKey);
    if (!lList) {
      lList = [];
      logicalAttemptsMap.set(logicalKey, lList);
    }
    lList.push(validLat);

    let pEntry = providerAcc.get(provKey);
    if (!pEntry) {
      pEntry = { eligibleCount: 0, samples: [] };
      providerAcc.set(provKey, pEntry);
    }
    pEntry.eligibleCount++;

    const pmKey = `${provKey}::${modKey}`;
    let mEntry = modelAcc.get(pmKey);
    if (!mEntry) {
      mEntry = { eligibleCount: 0, samples: [] };
      modelAcc.set(pmKey, mEntry);
    }
    mEntry.eligibleCount++;

    const outKey = (r.outcome || "unknown").toLowerCase();
    let oEntry = outcomeAcc.get(outKey);
    if (!oEntry) {
      oEntry = { eligibleCount: 0, samples: [] };
      outcomeAcc.set(outKey, oEntry);
    }
    oEntry.eligibleCount++;

    let bEntry = bucketAcc.get(bucketStart);
    if (!bEntry) {
      bEntry = { eligibleCount: 0, samples: [] };
      bucketAcc.set(bucketStart, bEntry);
    }
    bEntry.eligibleCount++;

    if (validLat !== null) {
      allValidSamples.push(validLat);
      pEntry.samples.push(validLat);
      mEntry.samples.push(validLat);
      oEntry.samples.push(validLat);
      bEntry.samples.push(validLat);

      if (isStreaming) {
        streamingCompletionSamples.push(validLat);
      }

      if (earliestMeasuredAtMs === null || r.occurredAt < earliestMeasuredAtMs) {
        earliestMeasuredAtMs = r.occurredAt;
      }
      if (latestMeasuredAtMs === null || r.occurredAt > latestMeasuredAtMs) {
        latestMeasuredAtMs = r.occurredAt;
      }

      const binIdx =
        validLat < 100
          ? 0
          : validLat < 250
            ? 1
            : validLat < 500
              ? 2
              : validLat < 1_000
                ? 3
                : validLat < 2_000
                  ? 4
                  : validLat < 5_000
                    ? 5
                    : validLat < 10_000
                      ? 6
                      : 7;
      histCounts[binIdx] = (histCounts[binIdx] ?? 0) + 1;
    }
  }

  const measuredExecutions = allValidSamples.length;
  const globalStats = computeLatencyDistributionStats(allValidSamples);

  const populationLabel = validFilters.outcome?.trim()
    ? `Filtered execution attempts (Outcome: ${validFilters.outcome.trim()})`
    : "All valid provider execution attempts";

  const summary: TelemetryLatencySummary = {
    populationLabel,
    metricSemanticsLabel:
      "Observed Provider Attempt Latency (monotonic Instant duration in ms)",
    percentileMethodology:
      "Linear interpolation (inclusive R-7), exact midpoint median",
    totalEligibleExecutions,
    measuredExecutions,
    missingLatencyCount,
    invalidLatencyCount,
    latencyCoveragePercent: computePercentage(
      measuredExecutions,
      totalEligibleExecutions
    ),
    sampleSufficiency: globalStats.sampleSufficiency,
    provenance: measuredExecutions > 0 ? "recorded" : "unavailable",
    averageLatencyMs: globalStats.averageMs,
    medianLatencyMs: globalStats.medianMs,
    p25LatencyMs: globalStats.p25Ms,
    p50LatencyMs: globalStats.p50Ms,
    p75LatencyMs: globalStats.p75Ms,
    p90LatencyMs: globalStats.p90Ms,
    p95LatencyMs: globalStats.p95Ms,
    p99LatencyMs: globalStats.p99Ms,
    minLatencyMs: globalStats.minMs,
    maxLatencyMs: globalStats.maxMs,
  };

  const binDefs: Array<{
    bucketKey: string;
    label: string;
    minBoundMs: number;
    maxBoundMs: number | null;
  }> = [
    { bucketKey: "lt_100ms", label: "< 100 ms", minBoundMs: 0, maxBoundMs: 100 },
    {
      bucketKey: "100_250ms",
      label: "100–250 ms",
      minBoundMs: 100,
      maxBoundMs: 250,
    },
    {
      bucketKey: "250_500ms",
      label: "250–500 ms",
      minBoundMs: 250,
      maxBoundMs: 500,
    },
    {
      bucketKey: "500_1000ms",
      label: "500 ms–1 s",
      minBoundMs: 500,
      maxBoundMs: 1_000,
    },
    {
      bucketKey: "1000_2000ms",
      label: "1–2 s",
      minBoundMs: 1_000,
      maxBoundMs: 2_000,
    },
    {
      bucketKey: "2000_5000ms",
      label: "2–5 s",
      minBoundMs: 2_000,
      maxBoundMs: 5_000,
    },
    {
      bucketKey: "5000_10000ms",
      label: "5–10 s",
      minBoundMs: 5_000,
      maxBoundMs: 10_000,
    },
    {
      bucketKey: "gte_10000ms",
      label: "10 s+",
      minBoundMs: 10_000,
      maxBoundMs: null,
    },
  ];

  const buckets: TelemetryLatencyHistogramBucket[] = binDefs.map((b, idx) => {
    const c = histCounts[idx] ?? 0;
    return {
      bucketKey: b.bucketKey,
      label: b.label,
      minBoundMs: b.minBoundMs,
      maxBoundMs: b.maxBoundMs,
      count: c,
      percentage: computePercentage(c, measuredExecutions),
    };
  });

  const distribution: TelemetryLatencyHistogram = {
    measuredSampleCount: measuredExecutions,
    buckets,
  };

  const sortedBucketKeys = Array.from(bucketAcc.keys()).sort((a, b) => a - b);
  const timeSeries: TelemetryLatencyTrendPoint[] = sortedBucketKeys.map(
    (bucketStartMs) => {
      const acc = bucketAcc.get(bucketStartMs)!;
      const bStats = computeLatencyDistributionStats(acc.samples);
      return {
        bucketStartMs,
        bucketLabel: String(bucketStartMs),
        eligibleCount: acc.eligibleCount,
        measuredCount: acc.samples.length,
        averageLatencyMs: bStats.averageMs,
        medianLatencyMs: bStats.medianMs,
        p95LatencyMs: bStats.p95Ms,
        minLatencyMs: bStats.minMs,
        maxLatencyMs: bStats.maxMs,
      };
    }
  );

  const providerBreakdown: TelemetryProviderLatencySummary[] = [];
  for (const [rawProv, acc] of providerAcc.entries()) {
    const provInfo =
      rawProv === "unrecorded"
        ? {
            providerId: "unrecorded",
            displayName: "Not recorded",
            isHistorical: true,
          }
        : resolveProviderDisplayName(rawProv);
    const mCnt = acc.samples.length;
    const pStats = computeLatencyDistributionStats(acc.samples);
    providerBreakdown.push({
      providerId: provInfo.providerId,
      displayName: provInfo.displayName,
      isHistoricalOrUnrecorded: provInfo.isHistorical,
      totalEligibleCount: acc.eligibleCount,
      measuredCount: mCnt,
      coveragePercent: computePercentage(mCnt, acc.eligibleCount),
      sampleSufficiency: pStats.sampleSufficiency,
      averageLatencyMs: pStats.averageMs,
      medianLatencyMs: pStats.medianMs,
      p25LatencyMs: pStats.p25Ms,
      p75LatencyMs: pStats.p75Ms,
      p90LatencyMs: pStats.p90Ms,
      p95LatencyMs: pStats.p95Ms,
      p99LatencyMs: pStats.p99Ms,
      minLatencyMs: pStats.minMs,
      maxLatencyMs: pStats.maxMs,
    });
  }
  providerBreakdown.sort((a, b) => {
    if (b.measuredCount !== a.measuredCount) {
      return b.measuredCount - a.measuredCount;
    }
    if (b.totalEligibleCount !== a.totalEligibleCount) {
      return b.totalEligibleCount - a.totalEligibleCount;
    }
    return a.providerId.localeCompare(b.providerId);
  });

  const modelBreakdown: TelemetryModelLatencySummary[] = [];
  for (const [pmKey, acc] of modelAcc.entries()) {
    const sepIdx = pmKey.indexOf("::");
    const rawProv = sepIdx >= 0 ? pmKey.slice(0, sepIdx) : pmKey;
    const rawMod = sepIdx >= 0 ? pmKey.slice(sepIdx + 2) : "unrecorded";
    const provInfo =
      rawProv === "unrecorded"
        ? {
            providerId: "unrecorded",
            displayName: "Not recorded",
            isHistorical: true,
          }
        : resolveProviderDisplayName(rawProv);
    const isModUnrec = rawMod === "unrecorded";
    const modId = isModUnrec ? "Not recorded" : rawMod;
    const mCnt = acc.samples.length;
    const mStats = computeLatencyDistributionStats(acc.samples);
    modelBreakdown.push({
      providerId: provInfo.providerId,
      providerDisplayName: provInfo.displayName,
      modelId: modId,
      isHistoricalOrUnrecorded: provInfo.isHistorical || isModUnrec,
      totalEligibleCount: acc.eligibleCount,
      measuredCount: mCnt,
      coveragePercent: computePercentage(mCnt, acc.eligibleCount),
      sampleSufficiency: mStats.sampleSufficiency,
      averageLatencyMs: mStats.averageMs,
      medianLatencyMs: mStats.medianMs,
      p25LatencyMs: mStats.p25Ms,
      p75LatencyMs: mStats.p75Ms,
      p90LatencyMs: mStats.p90Ms,
      p95LatencyMs: mStats.p95Ms,
      p99LatencyMs: mStats.p99Ms,
      minLatencyMs: mStats.minMs,
      maxLatencyMs: mStats.maxMs,
    });
  }
  modelBreakdown.sort((a, b) => {
    if (b.measuredCount !== a.measuredCount) {
      return b.measuredCount - a.measuredCount;
    }
    if (b.totalEligibleCount !== a.totalEligibleCount) {
      return b.totalEligibleCount - a.totalEligibleCount;
    }
    const pCmp = a.providerId.localeCompare(b.providerId);
    if (pCmp !== 0) return pCmp;
    return a.modelId.localeCompare(b.modelId);
  });

  const outcomeBreakdown: TelemetryOutcomeLatencySummary[] = [];
  for (const [rawOut, acc] of outcomeAcc.entries()) {
    const mCnt = acc.samples.length;
    const oStats = computeLatencyDistributionStats(acc.samples);
    outcomeBreakdown.push({
      outcome: rawOut,
      displayLabel: formatOutcomeLabel(rawOut),
      totalCount: acc.eligibleCount,
      measuredCount: mCnt,
      averageLatencyMs: oStats.averageMs,
      medianLatencyMs: oStats.medianMs,
      p95LatencyMs: oStats.p95Ms,
      minLatencyMs: oStats.minMs,
      maxLatencyMs: oStats.maxMs,
    });
  }
  outcomeBreakdown.sort((a, b) => {
    if (b.measuredCount !== a.measuredCount) {
      return b.measuredCount - a.measuredCount;
    }
    if (b.totalCount !== a.totalCount) {
      return b.totalCount - a.totalCount;
    }
    return a.outcome.localeCompare(b.outcome);
  });

  const rStats = computeLatencyDistributionStats(routingLatencySamples);
  const routingOverhead: TelemetryRoutingOverheadSummary = {
    totalRoutingEvents,
    measuredRoutingEvents: routingLatencySamples.length,
    provenance: routingLatencySamples.length > 0 ? "recorded" : "unavailable",
    averageRoutingLatencyMs: rStats.averageMs,
    medianRoutingLatencyMs: rStats.medianMs,
    p95RoutingLatencyMs: rStats.p95Ms,
    minRoutingLatencyMs: rStats.minMs,
    maxRoutingLatencyMs: rStats.maxMs,
    slmClassificationProvenance: "unavailable",
    slmClassificationNote:
      "Isolated local SLM classification sub-stage duration is not separately persisted in historical telemetry_records.",
  };

  const sStats = computeLatencyDistributionStats(streamingCompletionSamples);
  const streamingPerformance: TelemetryStreamingPerformanceSummary = {
    totalStreamingExecutions,
    measuredStreamingCompletionCount: streamingCompletionSamples.length,
    completionProvenance:
      streamingCompletionSamples.length > 0 ? "recorded" : "unavailable",
    averageStreamCompletionLatencyMs: sStats.averageMs,
    medianStreamCompletionLatencyMs: sStats.medianMs,
    p95StreamCompletionLatencyMs: sStats.p95Ms,
    minStreamCompletionLatencyMs: sStats.minMs,
    maxStreamCompletionLatencyMs: sStats.maxMs,
    ttftMeasuredCount: 0,
    averageTtftMs: null,
    medianTtftMs: null,
    ttftProvenance: "unavailable",
    ttftMethodologyNote:
      "Time-to-First-Token (TTFT) is not separately persisted in historical telemetry_records; only terminal stream completion latency is reported.",
  };

  const totalLogicalRequests = logicalAttemptsMap.size;
  let singleAttemptLogicalRequests = 0;
  let multiAttemptLogicalRequests = 0;
  const singleAttemptSamples: number[] = [];
  const multiAttemptSamples: number[] = [];
  const logicalCumulativeSamples: number[] = [];
  const initialAttemptSamples: number[] = [];
  const retryFailoverAttemptSamples: number[] = [];

  for (const attempts of logicalAttemptsMap.values()) {
    if (attempts.length <= 1) {
      singleAttemptLogicalRequests++;
    } else {
      multiAttemptLogicalRequests++;
    }

    for (let i = 0; i < attempts.length; i++) {
      const lat = attempts[i];
      if (lat !== null && lat !== undefined) {
        if (i === 0) {
          initialAttemptSamples.push(lat);
        } else {
          retryFailoverAttemptSamples.push(lat);
        }
      }
    }

    if (attempts.length > 0 && attempts.every((x) => x !== null)) {
      let sumLat = 0;
      for (const x of attempts) {
        sumLat += x ?? 0;
      }
      logicalCumulativeSamples.push(sumLat);
      if (attempts.length <= 1) {
        singleAttemptSamples.push(sumLat);
      } else {
        multiAttemptSamples.push(sumLat);
      }
    }
  }

  const saStats = computeLatencyDistributionStats(singleAttemptSamples);
  const maStats = computeLatencyDistributionStats(multiAttemptSamples);
  const lcStats = computeLatencyDistributionStats(logicalCumulativeSamples);
  const iaStats = computeLatencyDistributionStats(initialAttemptSamples);
  const rfStats = computeLatencyDistributionStats(retryFailoverAttemptSamples);

  const logicalVsPhysical: TelemetryLogicalLatencySummary = {
    totalLogicalRequests,
    measuredLogicalRequests: logicalCumulativeSamples.length,
    singleAttemptLogicalRequests,
    multiAttemptLogicalRequests,
    singleAttemptMedianLatencyMs: saStats.medianMs,
    singleAttemptAverageLatencyMs: saStats.averageMs,
    singleAttemptP95LatencyMs: saStats.p95Ms,
    multiAttemptMedianLatencyMs: maStats.medianMs,
    multiAttemptAverageLatencyMs: maStats.averageMs,
    multiAttemptP95LatencyMs: maStats.p95Ms,
    logicalCumulativeMedianLatencyMs: lcStats.medianMs,
    logicalCumulativeAverageLatencyMs: lcStats.averageMs,
    logicalCumulativeP95LatencyMs: lcStats.p95Ms,
    logicalCumulativeMinLatencyMs: lcStats.minMs,
    logicalCumulativeMaxLatencyMs: lcStats.maxMs,
    initialAttemptMeasuredCount: initialAttemptSamples.length,
    initialAttemptMedianLatencyMs: iaStats.medianMs,
    initialAttemptAverageLatencyMs: iaStats.averageMs,
    retryOrFailoverAttemptMeasuredCount: retryFailoverAttemptSamples.length,
    retryOrFailoverAttemptMedianLatencyMs: rfStats.medianMs,
    retryOrFailoverAttemptAverageLatencyMs: rfStats.averageMs,
  };

  const dataQuality: TelemetryLatencyDataQualitySummary = {
    totalEligibleRecords: totalEligibleExecutions,
    validLatencyRecords: measuredExecutions,
    missingLatencyRecords: missingLatencyCount,
    invalidLatencyRecords: invalidLatencyCount,
    duplicateOrIntermediateEventsExcluded,
    coveragePercent: computePercentage(
      measuredExecutions,
      totalEligibleExecutions
    ),
    distinctProvidersCount: distinctProviders.size,
    distinctModelsCount: distinctModels.size,
    earliestMeasuredAtMs,
    latestMeasuredAtMs,
  };

  return {
    queryId: validFilters.queryId ?? null,
    generatedAtMs,
    summary,
    distribution,
    timeSeries,
    providerBreakdown,
    modelBreakdown,
    outcomeBreakdown,
    routingOverhead,
    streamingPerformance,
    logicalVsPhysical,
    dataQuality,
  };
}

/**
 * Computes a coherent read-only Step 44 Latency, Execution Performance & Benchmark Analytics snapshot.
 */
export async function getTelemetryPerformanceAnalyticsSnapshot(
  filters: TelemetryDashboardFilters = {}
): Promise<TelemetryPerformanceAnalytics> {
  const validFilters = validateDashboardFilters(filters);

  if (!isTauriContext()) {
    const delay = mockPerQueryDelayMs
      ? mockPerQueryDelayMs(validFilters.queryId, validFilters)
      : mockTelemetryDelayMs;
    if (delay > 0) {
      await new Promise((r) => setTimeout(r, delay));
    }

    if (mockTelemetryErrorTarget === "snapshot") {
      throw new IpcError({
        code: "INTERNAL_ERROR",
        category: "Internal",
        message: "Unable to load local telemetry performance snapshot",
        retryable: true,
      });
    }

    const generatedAtMs = Date.now();
    return computePerformanceAnalyticsFromRecords(
      mockRecords,
      validFilters,
      generatedAtMs
    );
  }

  return await safeInvoke<TelemetryPerformanceAnalytics>(
    IPC_COMMANDS.GET_TELEMETRY_PERFORMANCE_ANALYTICS_SNAPSHOT,
    { filters: validFilters },
    { requestId: generateRequestId() }
  );
}
