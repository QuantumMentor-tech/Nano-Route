/**
 * Nano Route — Provider Budget, Quota & Spend Guardrail Types
 * File: src/features/budget/types.ts
 *
 * Implements Step 75 domain models:
 * - Budget policies, scopes, and enforcement modes
 * - Spend tracking, cost confidence, and source classifications
 * - Provider-reported quota awareness
 * - Preflight guardrail evaluation contracts
 * - Spend reconciliation states
 */

/**
 * Budget enforcement mode configured by the user.
 */
export type BudgetEnforcementMode =
  | "OFF"         // No local budget checks
  | "WARN_ONLY"   // Always allow requests, produce notifications when thresholds reached
  | "SOFT_LIMIT"  // Allow request but show warning and require explicit confirmation when exceeded
  | "HARD_LIMIT"; // Block request preflight when local budget is reached or exceeded

/**
 * Budget accounting period.
 * Nano Route establishes monthly budget periods aligned with UTC calendar months
 * (`YYYY-MM-01T00:00:00.000Z` to next month's boundary).
 */
export type BudgetPeriodType = "MONTHLY";

/**
 * High-level spend confidence classification.
 * Strictly separates exact recorded ledger sums from estimates or incomplete data.
 */
export type CostConfidenceState =
  | "EXACT"         // Derived exclusively from completed request/telemetry records with exact cost
  | "ESTIMATED"     // Computed from pricing table and token estimates
  | "MIXED"         // Contains both exact recorded usage and token estimates
  | "INCOMPLETE"    // Telemetry or cost records partially missing/unavailable
  | "UNKNOWN";      // No reliable spend information available

/**
 * Overall budget posture for a provider.
 */
export type BudgetStatusState =
  | "NOT_CONFIGURED"           // No budget limit set by user (unbounded local guardrail)
  | "WITHIN_BUDGET"            // Current tracked spend is safely below warning threshold
  | "WARNING_THRESHOLD_REACHED"// Spend has crossed configured warning threshold (e.g. 80%)
  | "LIMIT_REACHED"            // Spend has reached or exceeded 100% of configured budget limit
  | "BLOCKED"                  // Requests are actively blocked by HARD_LIMIT
  | "DATA_INCOMPLETE"          // Cannot verify spend reliably due to missing/corrupted records
  | "UNKNOWN";                 // Indeterminate budget state

/**
 * Quota authority classification.
 * Strictly separates provider-reported quotas from local estimates.
 */
export type QuotaSource =
  | "PROVIDER_REPORTED"  // Directly received from provider response headers or metadata
  | "LOCALLY_ESTIMATED"   // Approximated by Nano Route telemetry
  | "UNKNOWN";           // No quota data available

/**
 * Configured budget policy for a provider.
 */
export interface ProviderBudgetPolicy {
  providerId: string;
  periodType: BudgetPeriodType;
  budgetLimitUsd: number | null; // null = unset / unbounded
  warningThresholdPercent: number; // e.g. 80 (meaning 80%)
  enforcementMode: BudgetEnforcementMode;
  enabled: boolean;
  updatedAtMs: number;
}

/**
 * Period spend summary derived from authoritative telemetry/cost records.
 */
export interface PeriodSpendSummary {
  providerId: string;
  periodKey: string; // e.g. "2026-11"
  periodStartMs: number;
  periodEndMs: number;
  authoritativeSpendUsd: number;
  cachedSpendUsd: number;
  confidence: CostConfidenceState;
  reconciliationStatus: "IN_SYNC" | "MISMATCH_DETECTED" | "UNKNOWN";
  completedRequestsCount: number;
  billableAttemptsCount: number;
  estimatedCostCount: number;
  lastRecordedAtMs: number | null;
}

/**
 * Authoritative provider-reported quota snapshot.
 */
export interface ProviderQuotaInfo {
  providerId: string;
  source: QuotaSource;
  requestsRemaining?: number | null;
  requestsLimit?: number | null;
  tokensRemaining?: number | null;
  tokensLimit?: number | null;
  resetAtMs?: number | null;
  observedAtMs: number;
  isStale: boolean;
  rawDetails?: string | null;
}

/**
 * Full budget and quota status for a provider, presented to UI and Preflight.
 */
export interface ProviderBudgetStatusDto {
  providerId: string;
  displayName: string;
  policy: ProviderBudgetPolicy;
  spendSummary: PeriodSpendSummary;
  quotaInfo: ProviderQuotaInfo;
  status: BudgetStatusState;
  percentUsed: number | null; // e.g. 45.8 (%)
  remainingHeadroomUsd: number | null;
  isRequestPermitted: boolean;
  warningNotice?: string | null;
}

/**
 * Preflight guardrail evaluation result.
 */
export interface BudgetPreflightEvaluation {
  providerId: string;
  allowed: boolean;
  blockReason?: "LOCAL_BUDGET_BLOCK" | "PROVIDER_QUOTA_EXHAUSTED" | "DATA_INTEGRITY_BLOCK" | null;
  warningNotice?: string | null;
  currentSpendUsd: number;
  budgetLimitUsd: number | null;
  estimatedRequestCostUsd?: number | null;
  confidence: CostConfidenceState;
  evaluatedAtMs: number;
}

/**
 * Active in-flight reservation representation.
 */
export interface BudgetCostReservation {
  reservationId: string;
  providerId: string;
  estimatedCostUsd: number;
  reservedAtMs: number;
  expiresAtMs: number;
}

