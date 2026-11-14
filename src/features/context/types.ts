/**
 * Nano Route — Context Window Management & Token Guardrail Types
 * File: src/features/context/types.ts
 *
 * Implements Step 76:
 * - Authoritative context window limits model
 * - Token estimation models and confidence classifications
 * - Preflight context evaluations and headroom calculations
 * - Context reduction planning (without historical data deletion)
 * - Normalized context-length error codes
 */

export type ContextLimitSource =
  | "REGISTRY"
  | "PROVIDER_REPORTED"
  | "REQUEST_VALIDATED"
  | "UNKNOWN"
  | "STALE";

export type ContextLimitConfidence =
  | "AUTHORITATIVE"
  | "DERIVED"
  | "UNVERIFIED"
  | "UNKNOWN";

/**
 * Normalized, authoritative context constraints for a specific provider model.
 */
export interface ModelContextLimits {
  providerId: string;
  modelId: string;
  displayName: string;
  contextWindow: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  combinedLimit: boolean;
  source: ContextLimitSource;
  confidence: ContextLimitConfidence;
  lastVerifiedAtMs: number;
}

export type TokenEstimationConfidence =
  | "EXACT"
  | "HIGH_CONFIDENCE_ESTIMATE"
  | "APPROXIMATE"
  | "UNAVAILABLE";

/**
 * Breakdown of estimated token requirements for a conversation or prompt.
 */
export interface EstimatedTokenCounts {
  promptTokens: number;
  systemTokens: number;
  historyTokens: number;
  totalInputTokens: number;
  estimatedCompletionTokens: number;
  totalEstimatedTokens: number;
  confidence: TokenEstimationConfidence;
  tokenizerSource: string;
  calculatedAtMs: number;
}

export type ContextPreflightClassification =
  | "SAFE"
  | "NEAR_LIMIT"
  | "LIKELY_TO_EXCEED"
  | "EXCEEDS_LIMIT"
  | "UNKNOWN";

/**
 * Complete preflight evaluation result for a proposed request before network transmission.
 */
export interface ContextPreflightEvaluation {
  providerId: string;
  modelId: string;
  classification: ContextPreflightClassification;
  allowed: boolean;
  limits: ModelContextLimits;
  estimatedInputTokens: number;
  requestedOutputTokens: number;
  totalRequiredTokens: number;
  safetyMarginTokens: number;
  availableHeadroomTokens: number;
  availableOutputCapacity: number;
  percentUsed: number;
  blockReason: string | null;
  warningNotice: string | null;
  confidence: TokenEstimationConfidence;
  evaluatedAtMs: number;
}

export type ContextReductionMode =
  | "FULL_HISTORY"
  | "RECENT_WINDOW"
  | "PROTECTED_ONLY";

/**
 * Non-destructive plan detailing which messages will be transmitted in the active request.
 * Crucial invariant: Messages omitted from the request REMAIN in local SQLite chat history!
 */
export interface ContextReductionPlan {
  mode: ContextReductionMode;
  totalHistoryMessages: number;
  includedMessagesCount: number;
  excludedMessagesCount: number;
  includedEstimatedTokens: number;
  excludedEstimatedTokens: number;
  systemPromptProtected: boolean;
  currentPromptProtected: boolean;
  explanation: string;
}

export type ContextErrorCode =
  | "CONTEXT_LIMIT_EXCEEDED"
  | "INPUT_TOKEN_LIMIT"
  | "OUTPUT_TOKEN_LIMIT"
  | "REQUEST_TOO_LARGE"
  | "TOKEN_ESTIMATION_UNAVAILABLE"
  | "CONTEXT_LIMIT_UNKNOWN";

export interface ContextErrorDetails {
  code: ContextErrorCode;
  message: string;
  providerId?: string;
  modelId?: string;
  requestedTokens?: number;
  limitTokens?: number;
  suggestedActions: string[];
}

