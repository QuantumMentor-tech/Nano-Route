// ============================================================================
// Nano Route - Provider Health & Capability Intelligence IPC Bridge
// File: src/services/ipc/provider_health.ts
// ============================================================================
// Frontend IPC wrappers querying native runtime health snapshots, effective
// capabilities, preflight request validation, and explicit health checks.
// Contains zero secret credentials, auth headers, prompts, or completion tokens.
// ============================================================================

import { safeInvoke, isTauriContext, generateRequestId } from "./client.ts";
import {
  IPC_COMMANDS,
  type ProviderHealthSnapshotDto,
  type RequestRequirementsDto,
  type PreflightEvaluationDto,
  type CheckProviderHealthResultDto,
  type ProviderCapabilitiesDto,
} from "./types.ts";

/**
 * Built-in mock provider health snapshots for browser-mode development and tests.
 */
const BUILTIN_MOCK_HEALTH_SNAPSHOTS: Record<string, ProviderHealthSnapshotDto> = {
  openai: {
    providerId: "openai",
    displayName: "OpenAI",
    state: "unknown",
    isEnabled: true,
    isCredentialConfigured: true,
    isAdapterImplemented: true,
    rateLimitInfo: { isLimited: false },
    models: [
      { providerId: "openai", modelId: "gpt-4o", state: "unknown" },
      { providerId: "openai", modelId: "gpt-4o-mini", state: "unknown" },
      { providerId: "openai", modelId: "o1", state: "unknown" },
    ],
  },
  anthropic: {
    providerId: "anthropic",
    displayName: "Anthropic",
    state: "unknown",
    isEnabled: true,
    isCredentialConfigured: true,
    isAdapterImplemented: true,
    rateLimitInfo: { isLimited: false },
    models: [
      { providerId: "anthropic", modelId: "claude-3-5-sonnet-20241022", state: "unknown" },
      { providerId: "anthropic", modelId: "claude-3-5-haiku-20241022", state: "unknown" },
    ],
  },
  gemini: {
    providerId: "gemini",
    displayName: "Google Gemini",
    state: "unknown",
    isEnabled: true,
    isCredentialConfigured: true,
    isAdapterImplemented: true,
    rateLimitInfo: { isLimited: false },
    models: [
      { providerId: "gemini", modelId: "gemini-1.5-pro", state: "unknown" },
      { providerId: "gemini", modelId: "gemini-1.5-flash", state: "unknown" },
    ],
  },
  deepseek: {
    providerId: "deepseek",
    displayName: "DeepSeek",
    state: "unknown",
    isEnabled: true,
    isCredentialConfigured: true,
    isAdapterImplemented: true,
    rateLimitInfo: { isLimited: false },
    models: [
      { providerId: "deepseek", modelId: "deepseek-chat", state: "unknown" },
      { providerId: "deepseek", modelId: "deepseek-reasoner", state: "unknown" },
    ],
  },
  groq: {
    providerId: "groq",
    displayName: "Groq",
    state: "unknown",
    isEnabled: true,
    isCredentialConfigured: true,
    isAdapterImplemented: true,
    rateLimitInfo: { isLimited: false },
    models: [
      { providerId: "groq", modelId: "llama-3.3-70b-versatile", state: "unknown" },
      { providerId: "groq", modelId: "llama-3.1-8b-instant", state: "unknown" },
    ],
  },
  mistral: {
    providerId: "mistral",
    displayName: "Mistral AI",
    state: "unknown",
    isEnabled: true,
    isCredentialConfigured: true,
    isAdapterImplemented: true,
    rateLimitInfo: { isLimited: false },
    models: [
      { providerId: "mistral", modelId: "mistral-large-latest", state: "unknown" },
      { providerId: "mistral", modelId: "codestral-latest", state: "unknown" },
    ],
  },
};

let mutableMockHealthSnapshots = structuredClone(BUILTIN_MOCK_HEALTH_SNAPSHOTS);

/**
 * Resets the in-memory mock health snapshots to baseline unknown state.
 */
export function resetMockHealth(): void {
  mutableMockHealthSnapshots = structuredClone(BUILTIN_MOCK_HEALTH_SNAPSHOTS);
}

/**
 * Updates a mock provider health snapshot in browser mode.
 */
export function setMockProviderHealth(snapshot: ProviderHealthSnapshotDto): void {
  mutableMockHealthSnapshots[snapshot.providerId] = structuredClone(snapshot);
}

/**
 * Queries the runtime health snapshot of a specific provider.
 */
export async function getProviderHealth(
  providerId: string,
  requestId?: string
): Promise<ProviderHealthSnapshotDto | null> {
  const reqId = requestId || generateRequestId();

  if (!isTauriContext()) {
    const snap = mutableMockHealthSnapshots[providerId.toLowerCase()];
    return snap ? structuredClone(snap) : null;
  }

  return await safeInvoke<ProviderHealthSnapshotDto | null>(
    IPC_COMMANDS.GET_PROVIDER_HEALTH,
    { providerId },
    { requestId: reqId }
  );
}

/**
 * Queries runtime health snapshots for all registered providers.
 */
export async function getAllProviderHealth(
  requestId?: string
): Promise<ProviderHealthSnapshotDto[]> {
  const reqId = requestId || generateRequestId();

  if (!isTauriContext()) {
    return Object.values(mutableMockHealthSnapshots).map((s) => structuredClone(s));
  }

  return await safeInvoke<ProviderHealthSnapshotDto[]>(
    IPC_COMMANDS.GET_ALL_PROVIDER_HEALTH,
    undefined,
    { requestId: reqId }
  );
}

/**
 * Queries effective capabilities for a specific provider.
 */
export async function getProviderCapabilities(
  providerId: string,
  requestId?: string
): Promise<ProviderCapabilitiesDto | null> {
  const reqId = requestId || generateRequestId();

  if (!isTauriContext()) {
    return {
      capabilities: [
        "text_generation",
        "streaming",
        "system_messages",
      ],
    };
  }

  return await safeInvoke<ProviderCapabilitiesDto>(
    IPC_COMMANDS.GET_PROVIDER_CAPABILITIES,
    { providerId },
    { requestId: reqId }
  );
}

/**
 * Queries effective capabilities for a specific model under a provider.
 */
export async function getModelCapabilities(
  providerId: string,
  modelId: string,
  requestId?: string
): Promise<ProviderCapabilitiesDto | null> {
  const reqId = requestId || generateRequestId();

  if (!isTauriContext()) {
    return {
      capabilities: [
        "text_generation",
        "streaming",
        "system_messages",
      ],
    };
  }

  return await safeInvoke<ProviderCapabilitiesDto>(
    IPC_COMMANDS.GET_MODEL_CAPABILITIES,
    { providerId, modelId },
    { requestId: reqId }
  );
}

/**
 * Performs local preflight validation on a proposed provider/model request.
 * Returns { allowed: true } or { allowed: false, blockReason, message }.
 * Strictly answers whether this pair can execute; NEVER returns another provider.
 */
export async function preflightProviderRequest(
  providerId: string,
  modelId: string,
  requirements: RequestRequirementsDto,
  requestId?: string
): Promise<PreflightEvaluationDto> {
  const reqId = requestId || generateRequestId();

  if (!isTauriContext()) {
    const snap = mutableMockHealthSnapshots[providerId.toLowerCase()];
    if (!snap) {
      return {
        allowed: false,
        blockReason: "provider_not_found",
        message: `Provider '${providerId}' not found`,
        evaluatedAtMs: Date.now(),
      };
    }
    if (!snap.isEnabled) {
      return {
        allowed: false,
        blockReason: "provider_disabled",
        message: `Provider '${providerId}' is disabled`,
        evaluatedAtMs: Date.now(),
      };
    }
    if (!snap.isCredentialConfigured) {
      return {
        allowed: false,
        blockReason: "credential_missing",
        message: `API key for '${providerId}' is missing`,
        evaluatedAtMs: Date.now(),
      };
    }
    if (requirements.requiresTools) {
      return {
        allowed: false,
        blockReason: "capability_unsupported",
        message: "ToolCalling is not implemented in current adapter baseline",
        evaluatedAtMs: Date.now(),
      };
    }
    if (snap.state === "authentication_failed") {
      return {
        allowed: false,
        blockReason: "authentication_failed",
        message: `Provider '${providerId}' authentication failed`,
        evaluatedAtMs: Date.now(),
      };
    }
    if (snap.state === "rate_limited" && !snap.rateLimitInfo.retryAfterAtMs) {
      return {
        allowed: false,
        blockReason: "rate_limited",
        message: `Provider '${providerId}' is currently rate-limited`,
        evaluatedAtMs: Date.now(),
      };
    }

    return {
      allowed: true,
      blockReason: null,
      message: "Request permitted by preflight validation",
      evaluatedAtMs: Date.now(),
    };
  }

  return await safeInvoke<PreflightEvaluationDto>(
    IPC_COMMANDS.PREFLIGHT_PROVIDER_REQUEST,
    { providerId, modelId, requirements },
    { requestId: reqId }
  );
}

/**
 * Triggers an explicit, opt-in health check for a provider.
 * Does NOT send conversational prompt text.
 */
export async function checkProviderHealth(
  providerId: string,
  requestId?: string
): Promise<CheckProviderHealthResultDto> {
  const reqId = requestId || generateRequestId();

  if (!isTauriContext()) {
    const snap = mutableMockHealthSnapshots[providerId.toLowerCase()];
    if (snap) {
      snap.state = "ready";
      snap.lastObservedAtMs = Date.now();
      snap.lastSuccessAtMs = Date.now();
      snap.lastLatencyMs = 42;
    }
    return {
      providerId,
      status: "ready",
      latencyMs: 42,
      httpStatus: 200,
      errorCategory: null,
      checkedAtMs: Date.now(),
    };
  }

  return await safeInvoke<CheckProviderHealthResultDto>(
    IPC_COMMANDS.CHECK_PROVIDER_HEALTH,
    { providerId },
    { requestId: reqId }
  );
}
