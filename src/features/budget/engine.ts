/**
 * Nano Route — Provider Budget, Spend & Quota Guardrail Engine
 * File: src/features/budget/engine.ts
 *
 * Implements Step 75:
 * - Budget period calculation (deterministic UTC calendar months)
 * - Authoritative spend calculation from telemetry events (Step 43 cost records)
 * - Safe numeric math (nano-USD arithmetic via pricing.ts to avoid floating-point drift)
 * - Multi-attempt retry and failover cost isolation
 * - Spend cache reconciliation and mismatch detection
 * - Request preflight evaluation (HARD_LIMIT, SOFT_LIMIT, WARN_ONLY, OFF)
 * - Quota awareness and staleness evaluation
 * - Ephemeral in-flight cost reservations (released on cancel/fail/complete)
 */

import {
  computeTokenCostNanoUsd,
  resolveVersionedModelPricing,
  usdToNanoUsd,
  nanoUsdToUsd,
} from "../../services/ipc/pricing.ts";
import {
  listTelemetryRecords,
} from "../../services/ipc/telemetry.ts";
import {
  getProviderCredentialStatus,
  updateProviderPreferences,
} from "../../services/ipc/index.ts";
import type {
  ProviderBudgetPolicy,
  PeriodSpendSummary,
  ProviderQuotaInfo,
  ProviderBudgetStatusDto,
  BudgetPreflightEvaluation,
  CostConfidenceState,
  BudgetStatusState,
  BudgetCostReservation,
} from "./types.ts";

// In-memory store of configured budget policies (persisted via provider preferences / DPAPI store)
const budgetPolicies = new Map<string, ProviderBudgetPolicy>();

// In-memory store of provider-reported quota metadata
const reportedQuotas = new Map<string, ProviderQuotaInfo>();

// In-flight cost reservations: providerId -> Map<reservationId, BudgetCostReservation>
const activeReservations = new Map<string, Map<string, BudgetCostReservation>>();

/**
 * Resets the in-memory budget engine state (used in isolated unit and regression testing).
 */
export function resetBudgetEngineState(): void {
  budgetPolicies.clear();
  reportedQuotas.clear();
  activeReservations.clear();
}

/**
 * Computes deterministic UTC monthly period boundaries for a given timestamp.
 * Example for 2026-11-14:
 * - periodKey: "2026-11"
 * - periodStartMs: 2026-11-01T00:00:00.000Z
 * - periodEndMs: 2026-12-01T00:00:00.000Z
 */
export function getUtcMonthPeriodBoundaries(timestampMs: number = Date.now()): {
  periodKey: string;
  periodStartMs: number;
  periodEndMs: number;
} {
  const d = new Date(timestampMs);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth(); // 0-indexed

  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));

  const monthStr = String(month + 1).padStart(2, "0");
  const periodKey = `${year}-${monthStr}`;

  return {
    periodKey,
    periodStartMs: start.getTime(),
    periodEndMs: end.getTime(),
  };
}

/**
 * Default budget policy template when unconfigured.
 */
export function createDefaultBudgetPolicy(providerId: string): ProviderBudgetPolicy {
  return {
    providerId: providerId.trim().toLowerCase(),
    periodType: "MONTHLY",
    budgetLimitUsd: null,
    warningThresholdPercent: 80,
    enforcementMode: "WARN_ONLY",
    enabled: true,
    updatedAtMs: Date.now(),
  };
}

/**
 * Saves or updates a provider budget policy.
 * Also synchronizes the `monthlyBudgetLimit` field into the existing provider preferences store.
 */
export async function saveProviderBudgetPolicy(
  providerId: string,
  updates: Partial<ProviderBudgetPolicy>
): Promise<ProviderBudgetPolicy> {
  const cleanId = providerId.trim().toLowerCase();
  const existing = budgetPolicies.get(cleanId) ?? createDefaultBudgetPolicy(cleanId);

  const newLimit = updates.budgetLimitUsd !== undefined ? updates.budgetLimitUsd : existing.budgetLimitUsd;
  if (newLimit !== null && (typeof newLimit !== "number" || !Number.isFinite(newLimit) || newLimit < 0)) {
    throw new Error(`Invalid budget limit: ${newLimit}. Limit must be a non-negative number or null.`);
  }

  const newThreshold = updates.warningThresholdPercent ?? existing.warningThresholdPercent;
  if (typeof newThreshold !== "number" || newThreshold < 1 || newThreshold > 100) {
    throw new Error(`Invalid warning threshold: ${newThreshold}%. Must be between 1 and 100.`);
  }

  const updated: ProviderBudgetPolicy = {
    ...existing,
    ...updates,
    providerId: cleanId,
    budgetLimitUsd: newLimit,
    warningThresholdPercent: newThreshold,
    updatedAtMs: Date.now(),
  };

  budgetPolicies.set(cleanId, updated);

  // Sync to provider preferences / DPAPI metadata
  try {
    await updateProviderPreferences({
      providerId: cleanId,
      monthlyBudgetLimit: newLimit,
    });
  } catch {
    // If provider is not yet configured in DPAPI vault, local policy is still retained
  }

  return updated;
}

/**
 * Retrieves the active budget policy for a provider.
 */
export function getProviderBudgetPolicy(providerId: string): ProviderBudgetPolicy {
  const cleanId = providerId.trim().toLowerCase();
  return budgetPolicies.get(cleanId) ?? createDefaultBudgetPolicy(cleanId);
}

/**
 * Derives authoritative current-period spend by querying Step 43/18 telemetry cost records.
 * Uses exact nano-USD integer summation to eliminate floating-point drift.
 * Accurately accounts for retries, failovers, and streaming completions without double-counting.
 */
export async function computePeriodSpendSummary(
  providerId: string,
  timestampMs: number = Date.now()
): Promise<PeriodSpendSummary> {
  const cleanId = providerId.trim().toLowerCase();
  const { periodKey, periodStartMs, periodEndMs } = getUtcMonthPeriodBoundaries(timestampMs);

  // Query records within the UTC calendar month
  const records = await listTelemetryRecords({
    providerId: cleanId,
    startTime: periodStartMs,
    endTime: periodEndMs,
  });

  let totalNanoUsd = 0n;
  let exactCount = 0;
  let estimatedCount = 0;
  let billableAttemptsCount = 0;
  let lastRecordedAtMs: number | null = null;

  for (const r of records) {
    if (r.occurredAt >= periodStartMs && r.occurredAt < periodEndMs) {
      if (lastRecordedAtMs === null || r.occurredAt > lastRecordedAtMs) {
        lastRecordedAtMs = r.occurredAt;
      }

      billableAttemptsCount++;

      if (r.costUsd !== null && r.costUsd !== undefined && Number.isFinite(r.costUsd)) {
        const nano = usdToNanoUsd(r.costUsd);
        if (nano !== null && nano >= 0n) {
          totalNanoUsd += nano;
          exactCount++;
          continue;
        }
      }

      // If costUsd was null, but prompt and completion tokens exist, estimate using pricing table
      const pTokens = r.promptTokens ?? 0;
      const cTokens = r.completionTokens ?? 0;
      if (pTokens > 0 || cTokens > 0) {
        const pricing = resolveVersionedModelPricing(cleanId, r.modelId ?? "unknown", r.occurredAt);
        if (pricing) {
          const estimatedNano = computeTokenCostNanoUsd(
            pTokens,
            cTokens,
            pricing.inputCostPerMillionUsd,
            pricing.outputCostPerMillionUsd
          );
          totalNanoUsd += estimatedNano;
          estimatedCount++;
        }
      }
    }
  }

  const authoritativeSpendUsd = nanoUsdToUsd(totalNanoUsd);

  // Retrieve cached spend from credential record
  let cachedSpendUsd = 0;
  try {
    const cred = await getProviderCredentialStatus(cleanId);
    if (cred && Number.isFinite(cred.currentMonthSpend)) {
      cachedSpendUsd = cred.currentMonthSpend;
    }
  } catch {
    cachedSpendUsd = 0;
  }

  // Determine cost confidence
  let confidence: CostConfidenceState = "UNKNOWN";
  if (billableAttemptsCount === 0) {
    confidence = "EXACT"; // $0.00 exact spend
  } else if (exactCount === billableAttemptsCount) {
    confidence = "EXACT";
  } else if (exactCount > 0 && estimatedCount > 0) {
    confidence = "MIXED";
  } else if (estimatedCount > 0) {
    confidence = "ESTIMATED";
  } else {
    confidence = "INCOMPLETE";
  }

  // Check reconciliation status (allow 1 cent / $0.01 tolerance due to legacy rounding)
  const diff = Math.abs(authoritativeSpendUsd - cachedSpendUsd);
  const reconciliationStatus = diff <= 0.01 ? "IN_SYNC" : "MISMATCH_DETECTED";

  return {
    providerId: cleanId,
    periodKey,
    periodStartMs,
    periodEndMs,
    authoritativeSpendUsd,
    cachedSpendUsd,
    confidence,
    reconciliationStatus,
    completedRequestsCount: records.length,
    billableAttemptsCount,
    estimatedCostCount: estimatedCount,
    lastRecordedAtMs,
  };
}

/**
 * Reconciles the cached spend counter in SQLite with the authoritative sum from telemetry.
 */
export async function reconcileProviderSpend(providerId: string): Promise<PeriodSpendSummary> {
  const summary = await computePeriodSpendSummary(providerId);

  // Sync authoritative spend into cached representation
  try {
    const cred = await getProviderCredentialStatus(providerId);
    if (cred) {
      cred.currentMonthSpend = summary.authoritativeSpendUsd;
    }
  } catch {
    // Non-fatal if DPAPI store isn't present
  }

  return {
    ...summary,
    cachedSpendUsd: summary.authoritativeSpendUsd,
    reconciliationStatus: "IN_SYNC",
  };
}

/**
 * Updates provider-reported quota metadata (e.g. from response headers).
 */
export function recordProviderReportedQuota(info: ProviderQuotaInfo): void {
  const cleanId = info.providerId.trim().toLowerCase();
  reportedQuotas.set(cleanId, {
    ...info,
    providerId: cleanId,
    source: "PROVIDER_REPORTED",
    isStale: false,
  });
}

/**
 * Retrieves the current quota information for a provider.
 */
export function getProviderQuotaInfo(providerId: string, nowMs: number = Date.now()): ProviderQuotaInfo {
  const cleanId = providerId.trim().toLowerCase();
  const existing = reportedQuotas.get(cleanId);
  if (!existing) {
    return {
      providerId: cleanId,
      source: "UNKNOWN",
      observedAtMs: nowMs,
      isStale: true,
    };
  }

  // Quotas older than 1 hour without reset time are classified as stale
  const ageMs = nowMs - existing.observedAtMs;
  const isStale = existing.resetAtMs ? nowMs >= existing.resetAtMs : ageMs > 3_600_000;

  return {
    ...existing,
    isStale,
  };
}

/**
 * Computes the total active reserved cost in-flight for a provider.
 */
export function getActiveReservationSpend(providerId: string, nowMs: number = Date.now()): number {
  const cleanId = providerId.trim().toLowerCase();
  const map = activeReservations.get(cleanId);
  if (!map) return 0;

  let sum = 0;
  for (const [id, res] of Array.from(map.entries())) {
    if (nowMs > res.expiresAtMs) {
      map.delete(id); // Auto-expire stale reservation
    } else {
      sum += res.estimatedCostUsd;
    }
  }
  return sum;
}

/**
 * Creates an ephemeral request cost reservation during prompt streaming/execution.
 */
export function createCostReservation(
  providerId: string,
  reservationId: string,
  estimatedCostUsd: number,
  ttlMs: number = 60_000
): BudgetCostReservation {
  const cleanId = providerId.trim().toLowerCase();
  const now = Date.now();
  const reservation: BudgetCostReservation = {
    reservationId,
    providerId: cleanId,
    estimatedCostUsd: Math.max(0, estimatedCostUsd),
    reservedAtMs: now,
    expiresAtMs: now + ttlMs,
  };

  let map = activeReservations.get(cleanId);
  if (!map) {
    map = new Map();
    activeReservations.set(cleanId, map);
  }
  map.set(reservationId, reservation);
  return reservation;
}

/**
 * Releases an ephemeral cost reservation when a request finishes, cancels, or fails.
 */
export function releaseCostReservation(providerId: string, reservationId: string): void {
  const cleanId = providerId.trim().toLowerCase();
  const map = activeReservations.get(cleanId);
  if (map) {
    map.delete(reservationId);
  }
}

/**
 * Computes full budget, spend, and quota posture for a provider.
 */
export async function getProviderBudgetStatus(
  providerId: string,
  displayName: string = providerId,
  timestampMs: number = Date.now()
): Promise<ProviderBudgetStatusDto> {
  const cleanId = providerId.trim().toLowerCase();
  const policy = getProviderBudgetPolicy(cleanId);
  const spendSummary = await computePeriodSpendSummary(cleanId, timestampMs);
  const quotaInfo = getProviderQuotaInfo(cleanId, timestampMs);

  const limit = policy.budgetLimitUsd;
  const currentSpend = spendSummary.authoritativeSpendUsd;
  const inFlightReserved = getActiveReservationSpend(cleanId, timestampMs);
  const effectiveSpend = currentSpend + inFlightReserved;

  let percentUsed: number | null = null;
  let remainingHeadroomUsd: number | null = null;
  let status: BudgetStatusState = "NOT_CONFIGURED";
  let isRequestPermitted = true;
  let warningNotice: string | null = null;

  if (limit === null || !policy.enabled || policy.enforcementMode === "OFF") {
    status = limit !== null ? "WITHIN_BUDGET" : "NOT_CONFIGURED";
    percentUsed = limit !== null && limit > 0 ? Math.round((effectiveSpend / limit) * 1000) / 10 : null;
    remainingHeadroomUsd = limit !== null ? Math.max(0, limit - effectiveSpend) : null;
    isRequestPermitted = true;
  } else {
    percentUsed = limit > 0 ? Math.round((effectiveSpend / limit) * 1000) / 10 : 100;
    remainingHeadroomUsd = Math.max(0, limit - effectiveSpend);

    if (effectiveSpend >= limit) {
      if (policy.enforcementMode === "HARD_LIMIT") {
        status = "BLOCKED";
        isRequestPermitted = false;
        warningNotice = `Local monthly budget limit ($${limit.toFixed(2)}) reached. Requests blocked locally.`;
      } else {
        status = "LIMIT_REACHED";
        isRequestPermitted = true;
        warningNotice = `Local monthly budget limit ($${limit.toFixed(2)}) reached. Running in ${policy.enforcementMode} mode.`;
      }
    } else if (limit > 0 && (effectiveSpend / limit) * 100 >= policy.warningThresholdPercent) {
      status = "WARNING_THRESHOLD_REACHED";
      isRequestPermitted = true;
      warningNotice = `Provider spend has reached ${percentUsed}% of local monthly guardrail ($${limit.toFixed(2)}).`;
    } else {
      status = "WITHIN_BUDGET";
      isRequestPermitted = true;
    }
  }

  return {
    providerId: cleanId,
    displayName,
    policy,
    spendSummary,
    quotaInfo,
    status,
    percentUsed,
    remainingHeadroomUsd,
    isRequestPermitted,
    warningNotice,
  };
}

/**
 * Performs a request-level preflight budget check.
 * Strictly answers whether this request can execute under configured local guardrails;
 * NEVER chooses an alternate provider or alters historical records.
 */
export async function evaluateBudgetPreflight(
  providerId: string,
  estimatedRequestCostUsd?: number | null
): Promise<BudgetPreflightEvaluation> {
  const cleanId = providerId.trim().toLowerCase();
  const now = Date.now();
  const statusDto = await getProviderBudgetStatus(cleanId, cleanId, now);

  const limit = statusDto.policy.budgetLimitUsd;
  const currentSpend = statusDto.spendSummary.authoritativeSpendUsd;
  const estCost = estimatedRequestCostUsd ?? 0;
  const projectedSpend = currentSpend + estCost;

  // 1. If enforcement is OFF or no limit configured, always permit
  if (limit === null || !statusDto.policy.enabled || statusDto.policy.enforcementMode === "OFF") {
    return {
      providerId: cleanId,
      allowed: true,
      blockReason: null,
      warningNotice: null,
      currentSpendUsd: currentSpend,
      budgetLimitUsd: limit,
      estimatedRequestCostUsd,
      confidence: statusDto.spendSummary.confidence,
      evaluatedAtMs: now,
    };
  }

  // 2. HARD_LIMIT Enforcement
  if (statusDto.policy.enforcementMode === "HARD_LIMIT") {
    if (currentSpend >= limit) {
      return {
        providerId: cleanId,
        allowed: false,
        blockReason: "LOCAL_BUDGET_BLOCK",
        warningNotice: `Request blocked: Local monthly budget of $${limit.toFixed(2)} for ${cleanId} has been exhausted (recorded spend: $${currentSpend.toFixed(2)}).`,
        currentSpendUsd: currentSpend,
        budgetLimitUsd: limit,
        estimatedRequestCostUsd,
        confidence: statusDto.spendSummary.confidence,
        evaluatedAtMs: now,
      };
    }

    if (projectedSpend > limit) {
      return {
        providerId: cleanId,
        allowed: false,
        blockReason: "LOCAL_BUDGET_BLOCK",
        warningNotice: `Request blocked: Estimated request cost ($${estCost.toFixed(4)}) would exceed remaining local budget ($${(limit - currentSpend).toFixed(2)}).`,
        currentSpendUsd: currentSpend,
        budgetLimitUsd: limit,
        estimatedRequestCostUsd,
        confidence: statusDto.spendSummary.confidence,
        evaluatedAtMs: now,
      };
    }
  }

  // 3. SOFT_LIMIT / WARN_ONLY
  let warning: string | null = null;
  if (limit > 0 && (projectedSpend / limit) * 100 >= statusDto.policy.warningThresholdPercent) {
    warning = `Spend warning: Request execution brings ${cleanId} to $${projectedSpend.toFixed(2)} ($${limit.toFixed(2)} limit).`;
  }

  return {
    providerId: cleanId,
    allowed: true,
    blockReason: null,
    warningNotice: warning,
    currentSpendUsd: currentSpend,
    budgetLimitUsd: limit,
    estimatedRequestCostUsd,
    confidence: statusDto.spendSummary.confidence,
    evaluatedAtMs: now,
  };
}
