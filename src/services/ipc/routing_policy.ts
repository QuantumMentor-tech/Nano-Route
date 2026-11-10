// ============================================================================
// Nano Route - Routing Policy IPC Bridge
// File: src/services/ipc/routing_policy.ts
// ============================================================================
// Frontend IPC wrapper invoking native routing policy evaluation, manual
// model override validation, and policy configuration management.
// Strictly decoupled from provider HTTP networking and streaming execution.
// ============================================================================

import { safeInvoke, isTauriContext, generateRequestId } from "./client.ts";
import {
  IPC_COMMANDS,
  type ManualRouteOverrideDto,
  type OverrideValidationResultDto,
  type RoutingDecisionDto,
  type RoutingPolicyConfigDto,
  type RoutingPolicyRequestDto,
  type TaskAnalysisResultDto,
} from "./types.ts";

export const DEFAULT_ROUTING_POLICY_CONFIG: RoutingPolicyConfigDto = {
  policy_version: "nano-route-policy-v1",
  minimum_accepted_score: 0.35,
  tie_tolerance: 0.015,
  max_fallback_candidates: 5,
  allow_degraded_providers: true,
  enforce_strict_override_capabilities: true,
  preference_profile: "balanced",
  fallback_on_rejected_override: false,
};

let mutableMockPolicyConfig: RoutingPolicyConfigDto = {
  ...DEFAULT_ROUTING_POLICY_CONFIG,
};
let mockRoutingDecisionOverride: Partial<RoutingDecisionDto> | null = null;

export function setMockRoutingDecisionOverride(
  override: Partial<RoutingDecisionDto> | null
): void {
  mockRoutingDecisionOverride = override;
}

export function resetRoutingPolicyMocks(): void {
  mutableMockPolicyConfig = structuredClone(DEFAULT_ROUTING_POLICY_CONFIG);
  mockRoutingDecisionOverride = null;
}

/**
 * Evaluates routing policy over candidate scores, resolving the final route and ordered fallback plan.
 */
export async function evaluateRoutingPolicy(
  request: RoutingPolicyRequestDto,
  requestId?: string
): Promise<RoutingDecisionDto> {
  const reqId = requestId || `req_pol_${generateRequestId()}`;

  if (!isTauriContext()) {
    // Mock simulation for browser or unit test runner
    const nowMs = Date.now();
    const isOverride = !!(request.manual_override && request.manual_override.enabled);

    if (isOverride) {
      const override = request.manual_override!;
      const isKnownProvider = ["openai", "anthropic", "google_gemini", "deepseek", "groq", "mistral"].includes(
        override.provider_id
      );

      // Capability validation simulation
      const requiresImage =
        request.task_analysis?.capabilities.some(
          (c) => c.capability === "image_input" && c.strength === "required"
        ) ?? false;
      const modelLacksImage =
        override.model_id.includes("deepseek") || override.model_id.includes("llama");

      if (!isKnownProvider || (requiresImage && modelLacksImage)) {
        const rejectionMsg = !isKnownProvider
          ? `Provider '${override.provider_id}' is not registered in the catalog`
          : `Task requires capability 'image_input' which the selected model does not support`;

        const rejectedDecision: RoutingDecisionDto = {
          decision_id: `dec_${generateRequestId()}`,
          request_id: request.request_id || reqId,
          policy_version: mutableMockPolicyConfig.policy_version,
          scoring_algorithm_version: "nano-route-scoring-v1",
          selection_mode: "override_rejected",
          selected_candidate: null,
          fallback_candidates: [],
          candidate_ranking: [
            {
              rank: 1,
              provider_id: override.provider_id,
              model_id: override.model_id,
              display_name: override.model_id,
              score: null,
              status: "override_rejected_conflict",
              rejection_reasons: [rejectionMsg],
            },
          ],
          decision_reason: `Manual route override for '${override.provider_id}/${override.model_id}' rejected: ${rejectionMsg}`,
          structured_explanation: {
            mode: "override_rejected",
            summary: `Manual route override was rejected by policy safeguards`,
            primary_reason: rejectionMsg,
            score_reason: null,
            policy_reason: "Override rejected due to hard capability/health violation",
            override_reason: `Override rejected: ${rejectionMsg}`,
            eligibility_reason: rejectionMsg,
            fallback_reason: "Automatic fallback on rejected override is disabled",
          },
          override_metadata: {
            requested_provider_id: override.provider_id,
            requested_model_id: override.model_id,
            state: "rejected",
            reason: rejectionMsg,
          },
          confidence_metadata: {
            slm_analysis_confidence: request.task_analysis?.complexity.confidence ?? null,
            selected_score: null,
            selection_margin: null,
            is_ambiguous: false,
          },
          diagnostics: {
            total_candidates_evaluated: 5,
            eligible_candidates_count: 4,
            policy_filtered_count: 0,
            decision_duration_ms: 3,
            policy_version: mutableMockPolicyConfig.policy_version,
          },
          generated_at_ms: nowMs,
        };

        return { ...rejectedDecision, ...mockRoutingDecisionOverride };
      }

      // Accepted override simulation
      const acceptedDecision: RoutingDecisionDto = {
        decision_id: `dec_${generateRequestId()}`,
        request_id: request.request_id || reqId,
        policy_version: mutableMockPolicyConfig.policy_version,
        scoring_algorithm_version: "nano-route-scoring-v1",
        selection_mode: "manual_override",
        selected_candidate: {
          provider_id: override.provider_id,
          model_id: override.model_id,
          display_name: override.model_id.toUpperCase(),
          score: 0.9,
          selection_margin: null,
          context_window: 128000,
        },
        fallback_candidates: [
          {
            rank: 1,
            provider_id: "openai",
            model_id: "gpt-4o",
            display_name: "GPT-4o",
            score: 0.88,
            reason: "Eligible fallback candidate #1 under manual override",
          },
        ],
        candidate_ranking: [
          {
            rank: 1,
            provider_id: override.provider_id,
            model_id: override.model_id,
            display_name: override.model_id.toUpperCase(),
            score: 0.9,
            status: "selected_primary",
            rejection_reasons: [],
          },
        ],
        decision_reason: `Manually routed to '${override.model_id}' per explicit user override`,
        structured_explanation: {
          mode: "manual_override",
          summary: `Selected '${override.model_id}' via accepted explicit manual override`,
          primary_reason: "User explicitly configured route override",
          score_reason: "Candidate suitability score: 0.900",
          policy_reason: "Manual override permitted by policy",
          override_reason: override.reason || "Explicit user selection from UI control",
          eligibility_reason: "Passed manual override safety validation",
          fallback_reason: "Prepared 1 fallback candidate",
        },
        override_metadata: {
          requested_provider_id: override.provider_id,
          requested_model_id: override.model_id,
          state: "accepted",
          reason: "Manual route override validated and applied",
        },
        confidence_metadata: {
          slm_analysis_confidence: request.task_analysis?.complexity.confidence ?? null,
          selected_score: 0.9,
          selection_margin: null,
          is_ambiguous: false,
        },
        diagnostics: {
          total_candidates_evaluated: 5,
          eligible_candidates_count: 4,
          policy_filtered_count: 0,
          decision_duration_ms: 2,
          policy_version: mutableMockPolicyConfig.policy_version,
        },
        generated_at_ms: nowMs,
      };

      return { ...acceptedDecision, ...mockRoutingDecisionOverride };
    }

    // Automatic selection simulation
    const defaultAutoDecision: RoutingDecisionDto = {
      decision_id: `dec_${generateRequestId()}`,
      request_id: request.request_id || reqId,
      policy_version: mutableMockPolicyConfig.policy_version,
      scoring_algorithm_version: "nano-route-scoring-v1",
      selection_mode: "automatic",
      selected_candidate: {
        provider_id: "anthropic",
        model_id: "claude-3-5-sonnet-20241022",
        display_name: "Claude 3.5 Sonnet",
        score: 0.925,
        selection_margin: 0.03,
        context_window: 200000,
      },
      fallback_candidates: [
        {
          rank: 1,
          provider_id: "openai",
          model_id: "gpt-4o",
          display_name: "GPT-4o",
          score: 0.895,
          reason: "Eligible fallback candidate #1 (suitability score: 0.895)",
        },
        {
          rank: 2,
          provider_id: "deepseek",
          model_id: "deepseek-chat",
          display_name: "DeepSeek Chat",
          score: 0.875,
          reason: "Eligible fallback candidate #2 (suitability score: 0.875)",
        },
      ],
      candidate_ranking: [
        {
          rank: 1,
          provider_id: "anthropic",
          model_id: "claude-3-5-sonnet-20241022",
          display_name: "Claude 3.5 Sonnet",
          score: 0.925,
          status: "selected_primary",
          rejection_reasons: [],
        },
        {
          rank: 2,
          provider_id: "openai",
          model_id: "gpt-4o",
          display_name: "GPT-4o",
          score: 0.895,
          status: "eligible_fallback",
          rejection_reasons: [],
        },
        {
          rank: 3,
          provider_id: "deepseek",
          model_id: "deepseek-chat",
          display_name: "DeepSeek Chat",
          score: 0.875,
          status: "eligible_fallback",
          rejection_reasons: [],
        },
        {
          rank: 4,
          provider_id: "groq",
          model_id: "llama-3.3-70b-versatile",
          display_name: "Llama 3.3 70B Versatile",
          score: null,
          status: "disqualified_hard_constraint",
          rejection_reasons: [
            "API credential for provider 'groq' is not configured",
          ],
        },
      ],
      decision_reason:
        "Automatically selected 'Claude 3.5 Sonnet' (anthropic/claude-3-5-sonnet-20241022) with suitability score 0.925 under 'balanced' policy",
      structured_explanation: {
        mode: "automatic",
        summary:
          "Selected 'Claude 3.5 Sonnet' as primary route from 3 eligible candidates",
        primary_reason:
          "Highest policy-valid suitability score (0.925) satisfying task constraints",
        score_reason: "Score: 0.925 (margin: +0.030)",
        policy_reason: "Routing preference: balanced",
        override_reason: null,
        eligibility_reason: "Passed all hard capability and health checks",
        fallback_reason: "Prepared 2 fallback candidates",
      },
      override_metadata: null,
      confidence_metadata: {
        slm_analysis_confidence: request.task_analysis?.complexity.confidence ?? null,
        selected_score: 0.925,
        selection_margin: 0.03,
        is_ambiguous: false,
      },
      diagnostics: {
        total_candidates_evaluated: 4,
        eligible_candidates_count: 3,
        policy_filtered_count: 0,
        decision_duration_ms: 4,
        policy_version: mutableMockPolicyConfig.policy_version,
      },
      generated_at_ms: nowMs,
    };

    return { ...defaultAutoDecision, ...mockRoutingDecisionOverride };
  }

  return await safeInvoke<RoutingDecisionDto>(
    IPC_COMMANDS.EVALUATE_ROUTING_POLICY,
    { request: { ...request, request_id: reqId } },
    { requestId: reqId }
  );
}

/**
 * Retrieves the active routing policy configuration snapshot.
 */
export async function getRoutingPolicyConfig(
  requestId?: string
): Promise<RoutingPolicyConfigDto> {
  const reqId = requestId || `req_pol_cfg_${generateRequestId()}`;

  if (!isTauriContext()) {
    return structuredClone(mutableMockPolicyConfig);
  }

  return await safeInvoke<RoutingPolicyConfigDto>(
    IPC_COMMANDS.GET_ROUTING_POLICY_CONFIG,
    undefined,
    { requestId: reqId }
  );
}

/**
 * Updates the routing policy configuration parameters after strict validation.
 */
export async function updateRoutingPolicyConfig(
  config: RoutingPolicyConfigDto,
  requestId?: string
): Promise<void> {
  const reqId = requestId || `req_pol_upd_${generateRequestId()}`;

  if (config.minimum_accepted_score < 0 || config.minimum_accepted_score > 1) {
    throw new Error(
      `minimum_accepted_score must be between 0 and 1; got ${config.minimum_accepted_score}`
    );
  }

  if (config.tie_tolerance < 0 || config.tie_tolerance > 0.5) {
    throw new Error(`tie_tolerance must be between 0 and 0.5; got ${config.tie_tolerance}`);
  }

  if (config.max_fallback_candidates === 0 || config.max_fallback_candidates > 50) {
    throw new Error(
      `max_fallback_candidates must be between 1 and 50; got ${config.max_fallback_candidates}`
    );
  }

  if (!isTauriContext()) {
    mutableMockPolicyConfig = structuredClone(config);
    return;
  }

  await safeInvoke<void>(
    IPC_COMMANDS.UPDATE_ROUTING_POLICY_CONFIG,
    { config },
    { requestId: reqId }
  );
}

/**
 * Directly validates a proposed manual route override against catalog and capability constraints.
 */
export async function validateManualOverride(
  overrideRequest: ManualRouteOverrideDto,
  taskAnalysis?: TaskAnalysisResultDto,
  requestId?: string
): Promise<OverrideValidationResultDto> {
  const reqId = requestId || `req_ovr_val_${generateRequestId()}`;

  if (!isTauriContext()) {
    const isKnown = ["openai", "anthropic", "google_gemini", "deepseek", "groq", "mistral"].includes(
      overrideRequest.provider_id
    );

    if (!isKnown) {
      return {
        is_valid: false,
        rejection_reason: { provider_not_found: { provider_id: overrideRequest.provider_id } },
        message: `Provider '${overrideRequest.provider_id}' is not registered in the catalog`,
      };
    }

    const requiresImage =
      taskAnalysis?.capabilities.some(
        (c) => c.capability === "image_input" && c.strength === "required"
      ) ?? false;
    const modelLacksImage =
      overrideRequest.model_id.includes("deepseek") || overrideRequest.model_id.includes("llama");

    if (requiresImage && modelLacksImage) {
      return {
        is_valid: false,
        rejection_reason: { missing_required_capability: { capability: "image_input" } },
        message: `Task requires capability 'image_input' which the selected model does not support`,
      };
    }

    return {
      is_valid: true,
      message: `Manual route override for '${overrideRequest.provider_id}/${overrideRequest.model_id}' accepted and validated`,
    };
  }

  return await safeInvoke<OverrideValidationResultDto>(
    IPC_COMMANDS.VALIDATE_MANUAL_OVERRIDE,
    { override_request: overrideRequest, task_analysis: taskAnalysis },
    { requestId: reqId }
  );
}

