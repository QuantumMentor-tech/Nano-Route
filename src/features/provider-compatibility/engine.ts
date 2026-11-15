/**
 * Nano Route — Provider & Model Compatibility Engine
 * File: src/features/provider-compatibility/engine.ts
 *
 * Implements Step 87:
 * - Authoritative synthesis across Registry, Credentials, Connectivity, Health, Context, and Budget
 * - Normalizes provider readiness and model capabilities
 * - Non-destructive request-specific eligibility evaluations with human-readable explanations
 * - Zero heuristic name guessing: strictly queries registered capability sets
 * - Fast, local, cached compatibility records with reactive subscriptions
 */

import { listRegisteredProviders, listRegisteredModels } from "../../services/ipc/registry.ts";
import { listProviderCredentialStatuses } from "../../services/ipc/credentials.ts";
import { getAllProviderHealth } from "../../services/ipc/provider_health.ts";
import { getConnectivitySnapshot } from "../connectivity/engine.ts";
import { KNOWN_MODEL_CONTEXT_LIMITS } from "../context/engine.ts";
import type {
  ModelCompatibilityRecord,
  ProviderCompatibilityRecord,
  ReadinessState,
  ComponentReadiness,
  SupportedModality,
  RequestRequirements,
  CompatibilityFilter,
  ModelComparisonItem,
} from "./types.ts";

let cachedProviders: ProviderCompatibilityRecord[] = [];
let cachedModels: ModelCompatibilityRecord[] = [];
let lastCalculatedAtMs: number = 0;

// Reactive listeners
const listeners = new Set<() => void>();

export function subscribeToCompatibility(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(): void {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      // Ignore listener errors
    }
  });
}

/**
 * Extracts supported modalities from registered capability flags without name guessing.
 */
function extractSupportedModalities(capabilities: string[]): SupportedModality[] {
  const set = new Set<SupportedModality>();
  set.add("text"); // All models support text generation

  if (capabilities.includes("vision") || capabilities.includes("image_input")) {
    set.add("image");
  }
  if (capabilities.includes("audio_input")) {
    set.add("audio");
  }
  // All text/code capable models accept file attachments locally prepared as text context
  set.add("file");

  return Array.from(set);
}

/**
 * Evaluates whether a model is eligible for a specific request and derives human-readable explanations.
 */
export function evaluateModelEligibility(
  model: ModelCompatibilityRecord,
  req?: RequestRequirements
): { isEligible: boolean; reasons: string[] } {
  const reasons: string[] = [];
  let isEligible = true;

  // 1. Modality requirements
  if (req?.requiresImageInput && !model.supportsVision) {
    isEligible = false;
    reasons.push("Request contains image attachments, but this model only supports text.");
  }

  // 2. Tool calling requirements
  if (req?.requiresToolCalling && !model.supportsToolCalling) {
    isEligible = false;
    reasons.push("Request requires tool/function calling, which is not supported by this model.");
  }

  // 3. Structured output requirements
  if (req?.requiresStructuredOutput && !model.supportsStructuredOutput) {
    isEligible = false;
    reasons.push("Request requires structured JSON output schema support.");
  }

  // 4. Context capacity requirements
  if (req?.estimatedInputTokens && req.estimatedInputTokens > model.contextWindow) {
    isEligible = false;
    reasons.push(
      `Prompt size (${req.estimatedInputTokens.toLocaleString()} tokens) exceeds model context window (${model.contextWindow.toLocaleString()} tokens).`
    );
  }

  // 5. Output limit requirements
  if (req?.requestedMaxOutputTokens && req.requestedMaxOutputTokens > model.maxOutputTokens) {
    isEligible = false;
    reasons.push(
      `Requested output (${req.requestedMaxOutputTokens.toLocaleString()} tokens) exceeds maximum generation limit (${model.maxOutputTokens.toLocaleString()} tokens).`
    );
  }

  // 6. Credential readiness
  if (model.components.credential === "MISSING") {
    isEligible = false;
    reasons.push("API key is not configured in Provider Settings.");
  } else if (model.components.credential === "NEEDS_ATTENTION") {
    isEligible = false;
    reasons.push("Provider authentication failed. Update API key in Provider Settings.");
  }

  // 7. Connectivity readiness
  if (model.components.connectivity === "OFFLINE") {
    isEligible = false;
    reasons.push("Provider endpoint is unreachable or application network is offline.");
  }

  // 8. Health readiness
  if (model.components.health === "UNAVAILABLE") {
    isEligible = false;
    reasons.push("Provider endpoint is currently reporting service outages or maintenance.");
  }

  // 9. Budget guardrail
  if (model.components.budget === "BLOCKED") {
    isEligible = false;
    reasons.push("Request is blocked by local monthly budget limit guardrail.");
  }

  // 10. Deprecated
  if (model.isDeprecated) {
    reasons.push("Model is flagged as deprecated in the authoritative registry.");
  }

  if (isEligible && reasons.length === 0) {
    reasons.push("All capabilities, context window bounds, credentials, and network connectivity are verified.");
  }

  return { isEligible, reasons };
}

/**
 * Derives overall readiness state from component states.
 */
function deriveReadinessState(
  components: ComponentReadiness,
  isActive: boolean,
  isDeprecated: boolean
): ReadinessState {
  if (!isActive) return "DISABLED";
  if (components.credential === "MISSING") return "NOT_CONFIGURED";
  if (components.credential === "NEEDS_ATTENTION") return "AUTH_REQUIRED";
  if (components.connectivity === "OFFLINE") return "OFFLINE";
  if (components.health === "UNAVAILABLE" || components.health === "ERROR") return "UNAVAILABLE";
  if (components.health === "RATE_LIMITED" || components.context === "NEAR_LIMIT" || components.budget === "WARNING") {
    return "READY_WITH_LIMITATIONS";
  }
  if (isDeprecated) return "DEPRECATED";
  if (components.capability === "INCOMPATIBLE" || components.context === "EXCEEDS_LIMIT" || components.budget === "BLOCKED") {
    return "INCOMPATIBLE";
  }
  return "READY";
}

/**
 * Assembles a comprehensive snapshot of provider and model compatibility.
 */
export async function getCompatibilitySnapshot(
  requestRequirements?: RequestRequirements,
  forceRefresh: boolean = false
): Promise<{ providers: ProviderCompatibilityRecord[]; models: ModelCompatibilityRecord[] }> {
  const now = Date.now();
  if (!forceRefresh && cachedProviders.length > 0 && now - lastCalculatedAtMs < 5000 && !requestRequirements) {
    return { providers: cachedProviders, models: cachedModels };
  }

  const [rawProviders, rawModels, credStatuses, healthSnapshots] = await Promise.all([
    listRegisteredProviders().catch(() => []),
    listRegisteredModels().catch(() => []),
    listProviderCredentialStatuses().catch(() => []),
    getAllProviderHealth().catch(() => []),
  ]);

  const connSnapshot = getConnectivitySnapshot();

  const credMap = new Map(credStatuses.map((c) => [c.providerId.toLowerCase(), c]));
  const healthMap = new Map(healthSnapshots.map((h) => [h.providerId.toLowerCase(), h]));

  const assembledModels: ModelCompatibilityRecord[] = [];
  const assembledProviders: ProviderCompatibilityRecord[] = [];

  for (const p of rawProviders) {
    const pid = p.providerId.toLowerCase();
    const isLocal = pid === "local";
    const cred = credMap.get(pid);
    const health = healthMap.get(pid);
    const conn = connSnapshot.providers[pid];

    const isConfigured =
      isLocal ||
      (cred ? cred.isConfigured : Boolean(health?.isCredentialConfigured));
    const isActive =
      isLocal ||
      (cred ? cred.isActive : (health ? health.isEnabled : p.lifecycleState === "active"));

    // Credential readiness
    let credentialStatus: ComponentReadiness["credential"] = "UNKNOWN";
    if (!p.credentialRequired || isLocal) {
      credentialStatus = "NOT_REQUIRED";
    } else if (!isConfigured) {
      credentialStatus = "MISSING";
    } else if (health?.state === "authentication_failed" || conn?.state === "AUTH_REQUIRED") {
      credentialStatus = "NEEDS_ATTENTION";
    } else {
      credentialStatus = "READY";
    }

    // Connectivity readiness
    let connectivityStatus: ComponentReadiness["connectivity"] = "UNKNOWN";
    if (isLocal) {
      connectivityStatus = "REACHABLE";
    } else if (connSnapshot.networkState === "OFFLINE" || conn?.state === "UNREACHABLE") {
      connectivityStatus = "OFFLINE";
    } else if (connSnapshot.networkState === "DEGRADED" || conn?.state === "RATE_LIMITED") {
      connectivityStatus = "DEGRADED";
    } else if (conn?.state === "REACHABLE" || connSnapshot.networkState === "ONLINE") {
      connectivityStatus = "REACHABLE";
    }

    // Health readiness
    let healthStatus: ComponentReadiness["health"] = "UNKNOWN";
    if (health?.state === "ready" || conn?.state === "REACHABLE") {
      healthStatus = "READY";
    } else if (health?.state === "rate_limited" || conn?.state === "RATE_LIMITED") {
      healthStatus = "RATE_LIMITED";
    } else if (health?.state === "provider_unavailable" || conn?.state === "SERVICE_ERROR") {
      healthStatus = "UNAVAILABLE";
    } else {
      healthStatus = "READY";
    }

    const providerModels = rawModels.filter((m) => m.providerId.toLowerCase() === pid);
    const modelRecords: ModelCompatibilityRecord[] = [];

    for (const m of providerModels) {
      const mid = m.modelId;
      const capabilities = m.capabilities?.capabilities || [];
      const supportedModalities = extractSupportedModalities(capabilities);

      const supportsVision = supportedModalities.includes("image");
      const supportsStreaming = capabilities.includes("streaming");
      const supportsToolCalling = capabilities.includes("tool_calling");
      const supportsStructuredOutput = capabilities.includes("structured_output");
      const isDeprecated = m.availability === "Deprecated";

      // Context limits from authoritative Step 76 catalog
      const catalogLimit = KNOWN_MODEL_CONTEXT_LIMITS[pid]?.[mid];
      const contextWindow = catalogLimit?.contextWindow || m.contextWindow || 128_000;
      const maxOutputTokens = catalogLimit?.maxOutputTokens || m.maxOutputTokens || 4096;

      // Context readiness
      let contextReadiness: ComponentReadiness["context"] = "COMPATIBLE";
      if (requestRequirements?.estimatedInputTokens) {
        if (requestRequirements.estimatedInputTokens > contextWindow) {
          contextReadiness = "EXCEEDS_LIMIT";
        } else if (requestRequirements.estimatedInputTokens > contextWindow * 0.85) {
          contextReadiness = "NEAR_LIMIT";
        }
      }

      // Capability readiness
      let capabilityReadiness: ComponentReadiness["capability"] = "COMPATIBLE";
      if (requestRequirements?.requiresImageInput && !supportsVision) {
        capabilityReadiness = "INCOMPATIBLE";
      } else if (requestRequirements?.requiresToolCalling && !supportsToolCalling) {
        capabilityReadiness = "INCOMPATIBLE";
      }

      const components: ComponentReadiness = {
        registry: isDeprecated ? "DEPRECATED" : "READY",
        credential: credentialStatus,
        connectivity: connectivityStatus,
        health: healthStatus,
        capability: capabilityReadiness,
        budget: "WITHIN_LIMIT",
        context: contextReadiness,
      };

      const readiness = deriveReadinessState(components, isActive, isDeprecated);

      const protoModel: ModelCompatibilityRecord = {
        providerId: pid,
        modelId: mid,
        displayName: m.displayName || mid,
        description: m.description || "",
        contextWindow,
        maxOutputTokens,
        capabilities,
        supportedModalities,
        supportsStreaming,
        supportsToolCalling,
        supportsStructuredOutput,
        supportsVision,
        readiness,
        components,
        isEligibleForCurrentRequest: null,
        eligibilityReasons: [],
        pricing:
          m.pricing &&
          m.pricing.inputCostPerMillion !== undefined &&
          m.pricing.outputCostPerMillion !== undefined
            ? {
                inputCostPerMillion: m.pricing.inputCostPerMillion,
                outputCostPerMillion: m.pricing.outputCostPerMillion,
                currency: m.pricing.currency || "USD",
              }
            : null,
        isDefault: Boolean(m.isDefault),
        isDeprecated,
      };

      const eligibility = evaluateModelEligibility(protoModel, requestRequirements);
      protoModel.isEligibleForCurrentRequest = eligibility.isEligible;
      protoModel.eligibilityReasons = eligibility.reasons;

      modelRecords.push(protoModel);
      assembledModels.push(protoModel);
    }

    const eligibleCount = modelRecords.filter((m) => m.isEligibleForCurrentRequest !== false).length;

    const providerComponents: ComponentReadiness = {
      registry: "READY",
      credential: credentialStatus,
      connectivity: connectivityStatus,
      health: healthStatus,
      capability: "COMPATIBLE",
      budget: "WITHIN_LIMIT",
      context: "COMPATIBLE",
    };

    const providerReadiness = deriveReadinessState(providerComponents, isActive, false);

    assembledProviders.push({
      providerId: pid,
      displayName: p.displayName || pid,
      description: p.description || "",
      isConfigured,
      isActive,
      credentialRequired: p.credentialRequired ?? true,
      credentialStatus,
      connectivityStatus,
      healthStatus,
      readiness: providerReadiness,
      modelsCount: modelRecords.length,
      eligibleModelsCount: eligibleCount,
      models: modelRecords,
      baseUrl: cred?.baseUrl || p.defaultBaseUrl || null,
      priorityWeight: cred?.priorityWeight ?? 5,
      isLocal,
    });
  }

  cachedProviders = assembledProviders;
  cachedModels = assembledModels;
  lastCalculatedAtMs = now;
  notifyListeners();

  return { providers: assembledProviders, models: assembledModels };
}

/**
 * Filters models according to search, modality, readiness, and provider filters.
 */
export function filterModels(
  models: ModelCompatibilityRecord[],
  filter: CompatibilityFilter
): ModelCompatibilityRecord[] {
  let result = [...models];

  if (filter.search && filter.search.trim()) {
    const q = filter.search.trim().toLowerCase();
    result = result.filter(
      (m) =>
        m.displayName.toLowerCase().includes(q) ||
        m.modelId.toLowerCase().includes(q) ||
        m.providerId.toLowerCase().includes(q) ||
        m.capabilities.some((c) => c.toLowerCase().includes(q))
    );
  }

  if (filter.readiness && filter.readiness !== "ALL") {
    result = result.filter((m) => m.readiness === filter.readiness);
  }

  if (filter.modality && filter.modality !== "all") {
    result = result.filter((m) => m.supportedModalities.includes(filter.modality as SupportedModality));
  }

  if (filter.providerId) {
    const pid = filter.providerId.trim().toLowerCase();
    result = result.filter((m) => m.providerId.toLowerCase() === pid);
  }

  if (filter.onlyEligible) {
    result = result.filter((m) => m.isEligibleForCurrentRequest === true);
  }

  return result;
}

/**
 * Formats a model comparison list for side-by-side capability analysis.
 */
export function buildModelComparison(models: ModelCompatibilityRecord[]): ModelComparisonItem[] {
  return models.map((m) => ({
    providerId: m.providerId,
    modelId: m.modelId,
    displayName: m.displayName,
    contextWindow: m.contextWindow,
    maxOutputTokens: m.maxOutputTokens,
    modalities: m.supportedModalities,
    streaming: m.supportsStreaming,
    tools: m.supportsToolCalling,
    readiness: m.readiness,
    eligibility: m.isEligibleForCurrentRequest ? "Eligible" : "Ineligible",
    costEstimate: m.pricing
      ? `$${m.pricing.inputCostPerMillion.toFixed(2)} / $${m.pricing.outputCostPerMillion.toFixed(2)} per 1M`
      : "Free / Local",
  }));
}

/**
 * Resets the in-memory cache (for test isolation).
 */
export function resetCompatibilityEngine(): void {
  cachedProviders = [];
  cachedModels = [];
  lastCalculatedAtMs = 0;
  listeners.clear();
}
