/**
//! Nano Route — Telemetry Persistence & Analytics IPC Boundary
//! File: src/services/ipc/telemetry.ts
//!
//! Responsibility:
//! - Strongly-typed frontend API for operational observation recording and aggregation.
//! - Non-blocking execution, correlation tracking, and safe error normalization.
//! - In-memory mock store for browser dev mode and isolated automated testing.
*/

import { isTauriContext, safeInvoke, generateRequestId } from "./client.ts";
import { IpcError } from "./errors.ts";
import {
  IPC_COMMANDS,
  type RecordTelemetryInput,
  type TelemetryAggregateReport,
  type TelemetryEventType,
  type TelemetryFilter,
  type TelemetryOutcome,
  type TelemetryRecord,
} from "./types.ts";

// ============================================================================
// Browser In-Memory Mock Store (enables development without running Tauri native core)
// ============================================================================

const mockRecords: TelemetryRecord[] = [];
let mockCounter = 1;

export function resetTelemetryMockStore(): void {
  mockRecords.length = 0;
  mockCounter = 1;
}

// ============================================================================
// Input Validation Helpers
// ============================================================================

function validateConfidence(confidence?: number | null): void {
  if (confidence !== undefined && confidence !== null) {
    if (Number.isNaN(confidence) || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
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

// ============================================================================
// Telemetry Persistence Public API
// ============================================================================

/**
 * Records an operational telemetry observation event.
 */
export async function recordTelemetryEvent(
  input: RecordTelemetryInput
): Promise<TelemetryRecord> {
  validateConfidence(input.confidence);
  validateCost(input.costUsd);
  validateRoutingReason(input.routingReason);

  const eventType: TelemetryEventType = input.eventType || "system_event";
  const outcome: TelemetryOutcome = input.outcome || "success";

  if (!isTauriContext()) {
    const now = Date.now();
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
      routingReason: input.routingReason?.trim() || null,
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

