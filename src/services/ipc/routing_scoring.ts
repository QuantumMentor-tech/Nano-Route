// ============================================================================
// Nano Route - Routing Scoring IPC Bridge
// File: src/services/ipc/routing_scoring.ts
// ============================================================================
// Frontend IPC wrapper invoking native candidate suitability scoring
// against Task Analysis Results. Strictly decoupled from final routing dispatch.
// ============================================================================

import { safeInvoke, isTauriContext, generateRequestId } from "./client.ts";
import {
  IPC_COMMANDS,
  type CandidateScoreDto,
  type RoutingScoreRequestDto,
  type RoutingScoreResultDto,
  type RoutingScoringStatusDto,
  type RoutingScoringWeightsDto,
} from "./types.ts";

export const DEFAULT_SCORING_WEIGHTS: RoutingScoringWeightsDto = {
  intent_weight: 0.15,
  complexity_weight: 0.15,
  domain_weight: 0.1,
  capability_weight: 0.15,
  context_weight: 0.05,
  modality_weight: 0.05,
  preference_weight: 0.1,
  cost_weight: 0.08,
  latency_weight: 0.07,
  reliability_weight: 0.05,
  profile_weight: 0.05,
};

const DEFAULT_MOCK_STATUS: RoutingScoringStatusDto = {
  is_available: true,
  registered_models_count: 14,
  configured_profiles_count: 12,
  active_weights: { ...DEFAULT_SCORING_WEIGHTS },
  last_scoring_latency_ms: 12,
};

let mutableMockStatus: RoutingScoringStatusDto = { ...DEFAULT_MOCK_STATUS };
let mutableMockWeights: RoutingScoringWeightsDto = { ...DEFAULT_SCORING_WEIGHTS };
let mockScoreResultOverride: Partial<RoutingScoreResultDto> | null = null;

export function setMockScoringResultOverride(
  override: Partial<RoutingScoreResultDto> | null
): void {
  mockScoreResultOverride = override;
}

export function resetRoutingScoringMocks(): void {
  mutableMockStatus = structuredClone(DEFAULT_MOCK_STATUS);
  mutableMockWeights = structuredClone(DEFAULT_SCORING_WEIGHTS);
  mockScoreResultOverride = null;
}

/**
 * Scores registered provider and model candidates against a Task Analysis Result.
 */
export async function scoreRoutingCandidates(
  request: RoutingScoreRequestDto,
  requestId?: string
): Promise<RoutingScoreResultDto> {
  const reqId = requestId || `req_score_${generateRequestId()}`;

  if (!isTauriContext()) {
    const isCode = request.task_analysis.primaryDomain.domain === "software_engineering";
    const isMath = request.task_analysis.primaryDomain.domain === "mathematics";

    const defaultCandidates: CandidateScoreDto[] = [
      {
        provider_id: "anthropic",
        model_id: "claude-3-5-sonnet-20241022",
        display_name: "Claude 3.5 Sonnet",
        is_eligible: true,
        ineligibility_reasons: [],
        total_score: isCode ? 0.925 : 0.885,
        breakdown: {
          intent_fit: isCode ? 0.98 : 0.9,
          complexity_fit: 0.95,
          domain_fit: isCode ? 0.99 : 0.92,
          capability_fit: 0.92,
          context_fit: 0.95,
          modality_fit: 0.9,
          preference_fit: 0.8,
          cost_fit: 0.75,
          latency_fit: 0.85,
          reliability_fit: 1.0,
          profile_fit: 0.9,
        },
        adjustments: [
          {
            dimension: "domain_fit",
            delta: 0.1,
            reason: "High domain specialization for Software Engineering",
          },
        ],
        explanation: "Claude 3.5 Sonnet: Eligible (score: 0.925). Strong complexity fit.",
        context_window: 200000,
        pricing_known: true,
        latency_known: true,
      },
      {
        provider_id: "openai",
        model_id: "gpt-4o",
        display_name: "GPT-4o",
        is_eligible: true,
        ineligibility_reasons: [],
        total_score: isMath ? 0.915 : 0.895,
        breakdown: {
          intent_fit: 0.92,
          complexity_fit: 0.92,
          domain_fit: 0.92,
          capability_fit: 0.92,
          context_fit: 0.95,
          modality_fit: 0.95,
          preference_fit: 0.8,
          cost_fit: 0.75,
          latency_fit: 0.85,
          reliability_fit: 1.0,
          profile_fit: 0.88,
        },
        adjustments: [],
        explanation: "GPT-4o: Eligible (score: 0.895). Strong complexity fit.",
        context_window: 128000,
        pricing_known: true,
        latency_known: true,
      },
      {
        provider_id: "deepseek",
        model_id: "deepseek-chat",
        display_name: "DeepSeek Chat",
        is_eligible: true,
        ineligibility_reasons: [],
        total_score: 0.875,
        breakdown: {
          intent_fit: 0.9,
          complexity_fit: 0.88,
          domain_fit: 0.9,
          capability_fit: 0.85,
          context_fit: 0.9,
          modality_fit: 0.9,
          preference_fit: 0.7,
          cost_fit: 0.98,
          latency_fit: 0.85,
          reliability_fit: 1.0,
          profile_fit: 0.85,
        },
        adjustments: [
          {
            dimension: "cost_fit",
            delta: 0.1,
            reason: "Economical token pricing",
          },
        ],
        explanation: "DeepSeek Chat: Eligible (score: 0.875). Economical pricing.",
        context_window: 64000,
        pricing_known: true,
        latency_known: true,
      },
      {
        provider_id: "openai",
        model_id: "gpt-4o-mini",
        display_name: "GPT-4o mini",
        is_eligible: true,
        ineligibility_reasons: [],
        total_score: 0.825,
        breakdown: {
          intent_fit: 0.88,
          complexity_fit: 0.75,
          domain_fit: 0.82,
          capability_fit: 0.85,
          context_fit: 0.95,
          modality_fit: 0.9,
          preference_fit: 0.8,
          cost_fit: 0.98,
          latency_fit: 0.95,
          reliability_fit: 1.0,
          profile_fit: 0.8,
        },
        adjustments: [],
        explanation: "GPT-4o mini: Eligible (score: 0.825). Economical pricing.",
        context_window: 128000,
        pricing_known: true,
        latency_known: true,
      },
      {
        provider_id: "groq",
        model_id: "llama-3.3-70b-versatile",
        display_name: "Llama 3.3 70B Versatile",
        is_eligible: false,
        ineligibility_reasons: [
          { credential_missing: { provider_id: "groq" } },
        ],
        total_score: null,
        breakdown: null,
        adjustments: [],
        explanation: "Ineligible for routing: API credential for provider 'groq' is not configured",
        context_window: 128000,
        pricing_known: true,
        latency_known: true,
      },
    ];

    // Sort mock candidates deterministically
    defaultCandidates.sort((a, b) => {
      if (a.is_eligible && !b.is_eligible) return -1;
      if (!a.is_eligible && b.is_eligible) return 1;
      if (a.total_score !== null && b.total_score !== null) {
        if (b.total_score !== a.total_score) {
          return b.total_score - a.total_score;
        }
      }
      if (a.provider_id !== b.provider_id) {
        return a.provider_id.localeCompare(b.provider_id);
      }
      return a.model_id.localeCompare(b.model_id);
    });

    const eligibleCount = defaultCandidates.filter((c) => c.is_eligible).length;
    const defaultResult: RoutingScoreResultDto = {
      request_id: request.request_id || reqId,
      candidates: defaultCandidates,
      eligible_count: eligibleCount,
      ineligible_count: defaultCandidates.length - eligibleCount,
      evaluated_candidates_count: defaultCandidates.length,
      weights_applied: structuredClone(mutableMockWeights),
      scoring_latency_ms: 14,
      explanation_summary: `Evaluated ${defaultCandidates.length} candidates (${eligibleCount} eligible, ${defaultCandidates.length - eligibleCount} ineligible). Top candidate: '${defaultCandidates[0].display_name}' (${defaultCandidates[0].provider_id}/${defaultCandidates[0].model_id}) with suitability score ${defaultCandidates[0].total_score?.toFixed(3)}.`,
    };

    return { ...defaultResult, ...mockScoreResultOverride };
  }

  return await safeInvoke<RoutingScoreResultDto>(
    IPC_COMMANDS.SCORE_ROUTING_CANDIDATES,
    { request: { ...request, request_id: reqId } },
    { requestId: reqId }
  );
}

/**
 * Queries current diagnostic status and registered candidate counts of the scoring engine.
 */
export async function getRoutingScoringStatus(
  requestId?: string
): Promise<RoutingScoringStatusDto> {
  const reqId = requestId || `req_score_st_${generateRequestId()}`;

  if (!isTauriContext()) {
    return structuredClone(mutableMockStatus);
  }

  return await safeInvoke<RoutingScoringStatusDto>(
    IPC_COMMANDS.GET_ROUTING_SCORING_STATUS,
    undefined,
    { requestId: reqId }
  );
}

/**
 * Retrieves the active scoring weights applied during candidate evaluation.
 */
export async function getScoringWeights(
  requestId?: string
): Promise<RoutingScoringWeightsDto> {
  const reqId = requestId || `req_score_wt_${generateRequestId()}`;

  if (!isTauriContext()) {
    return structuredClone(mutableMockWeights);
  }

  return await safeInvoke<RoutingScoringWeightsDto>(
    IPC_COMMANDS.GET_SCORING_WEIGHTS,
    undefined,
    { requestId: reqId }
  );
}

/**
 * Updates the scoring weights after enforcing strict validation invariants.
 */
export async function updateScoringWeights(
  weights: RoutingScoringWeightsDto,
  requestId?: string
): Promise<void> {
  const reqId = requestId || `req_score_up_${generateRequestId()}`;

  // Validate in mock
  const sum =
    weights.intent_weight +
    weights.complexity_weight +
    weights.domain_weight +
    weights.capability_weight +
    weights.context_weight +
    weights.modality_weight +
    weights.preference_weight +
    weights.cost_weight +
    weights.latency_weight +
    weights.reliability_weight +
    weights.profile_weight;

  if (Math.abs(sum - 1.0) > 1e-4) {
    throw new Error(`Scoring weights must sum to 1.0 (+/- 0.0001); got ${sum.toFixed(4)}`);
  }

  if (!isTauriContext()) {
    mutableMockWeights = structuredClone(weights);
    mutableMockStatus.active_weights = structuredClone(weights);
    return;
  }

  await safeInvoke<void>(
    IPC_COMMANDS.UPDATE_SCORING_WEIGHTS,
    { weights },
    { requestId: reqId }
  );
}

