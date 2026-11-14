/**
 * Nano Route — Credential Lifecycle Engine
 * File: src/features/credentials/engine.ts
 *
 * Implements Step 74:
 * - State resolution (Presence vs Validity)
 * - Safe credential rotation workflow
 * - Zero-prompt validation coordinator (using checkProviderHealth metadata ping)
 * - Compromise response runbooks and immediate local purge/disable
 * - Custom endpoint security validation (TLS, localhost exceptions, query secret audit)
 * - Strict zero plaintext secret leaks
 */

import {
  saveProviderCredential,
  deleteProviderCredential,
  setProviderActive,
  getProviderCredentialStatus,
  listProviderCredentialStatuses,
} from "../../services/ipc/credentials.ts";
import type { ProviderCredentialStatus } from "../../services/ipc/types.ts";
import { checkProviderHealth } from "../../services/ipc/provider_health.ts";
import type {
  CredentialValidationStatus,
  ProviderCredentialLifecycleDto,
  ZeroPromptValidationResult,
  EndpointSecurityAudit,
  CompromiseIncidentResponse,
} from "./types.ts";

/** Default threshold in milliseconds for marking a credential as stale (90 days) */
export const CREDENTIAL_STALE_THRESHOLD_MS = 90 * 24 * 60 * 60 * 1000;

/** Provider administrative console links for remote revocation */
export const PROVIDER_CONSOLE_REVOCATION_URLS: Record<string, string> = {
  openai: "https://platform.openai.com/api-keys",
  anthropic: "https://console.anthropic.com/settings/keys",
  gemini: "https://aistudio.google.com/app/apikey",
  groq: "https://console.groq.com/keys",
  deepseek: "https://platform.deepseek.com/api_keys",
  mistral: "https://console.mistral.ai/api-keys",
};

// In-memory verification cache to track non-secret validation observations
interface VerificationRecord {
  status: CredentialValidationStatus;
  lastVerifiedAtMs: number;
  lastRotatedAtMs: number | null;
  message: string;
}

const verificationStateCache = new Map<string, VerificationRecord>();

/**
 * Resets the in-memory verification cache (for isolated tests).
 */
export function resetCredentialLifecycleCache(): void {
  verificationStateCache.clear();
}

/**
 * Returns human-readable instructions for incident response when a key is compromised.
 */
export function getCompromiseRemediationSteps(providerDisplayName: string, revocationUrl: string): string[] {
  return [
    `1. IMMEDIATELY log in to the official ${providerDisplayName} console: ${revocationUrl}`,
    `2. Revoke and permanently delete the compromised API key in the provider dashboard. (Local deletion in Nano Route does NOT revoke the key upstream!)`,
    `3. Generate a brand new API key with least-privilege scoping in the ${providerDisplayName} console.`,
    `4. Check your upstream billing and usage dashboard for unauthorized consumption.`,
    `5. Return to Nano Route Settings -> Providers and save the newly generated key.`,
  ];
}

/**
 * Validates a custom endpoint URL for security compliance:
 * - Enforces HTTPS unless it is an explicit localhost or 127.0.0.1 development endpoint.
 * - Forbids embedded userinfo (e.g. user:pass@host).
 * - Forbids credentials or tokens in query parameters or URL hash.
 */
export function auditCustomEndpointSecurity(url?: string | null): EndpointSecurityAudit {
  if (!url || !url.trim()) {
    return {
      url: "",
      isValid: true,
      isTlsEnforced: false,
      isLocalhost: false,
      hasEmbeddedAuth: false,
      hasQuerySecrets: false,
    };
  }

  const trimmed = url.trim();

  // Check embedded auth
  if (trimmed.includes("@")) {
    return {
      url: trimmed,
      isValid: false,
      isTlsEnforced: false,
      isLocalhost: false,
      hasEmbeddedAuth: true,
      hasQuerySecrets: false,
      rejectionReason: "Endpoint URL contains embedded credentials (user:password@host is prohibited).",
      recommendation: "Remove credentials from the URL and enter your API key into the secure DPAPI input field.",
    };
  }

  // Parse URL safely
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      url: trimmed,
      isValid: false,
      isTlsEnforced: false,
      isLocalhost: false,
      hasEmbeddedAuth: false,
      hasQuerySecrets: false,
      rejectionReason: "Malformed URL format.",
      recommendation: "Enter a valid absolute URL, e.g. https://api.openai.com/v1 or http://localhost:8000.",
    };
  }

  const isLocal =
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "::1" ||
    parsed.hostname.endsWith(".localhost");

  const isTls = parsed.protocol.toLowerCase() === "https:";

  // Check protocol
  if (!isTls && !isLocal) {
    return {
      url: trimmed,
      isValid: false,
      isTlsEnforced: false,
      isLocalhost: false,
      hasEmbeddedAuth: false,
      hasQuerySecrets: false,
      rejectionReason: "Insecure HTTP protocol is prohibited for non-localhost endpoints.",
      recommendation: "Use HTTPS to ensure encrypted transport and prevent credential interception.",
    };
  }

  // Check for secrets leaked in search query or hash
  const queryKeys = Array.from(parsed.searchParams.keys()).map((k) => k.toLowerCase());
  const hasSecretInQuery = queryKeys.some((k) =>
    k.includes("key") || k.includes("token") || k.includes("secret") || k.includes("auth") || k.includes("bearer")
  );

  const hashHasSecret = /(?:key|token|secret|auth|bearer)=/i.test(parsed.hash);

  if (hasSecretInQuery || hashHasSecret) {
    return {
      url: trimmed,
      isValid: false,
      isTlsEnforced: isTls,
      isLocalhost: isLocal,
      hasEmbeddedAuth: false,
      hasQuerySecrets: true,
      rejectionReason: "URL query parameters or fragment contain secret tokens or API keys.",
      recommendation: "Endpoints must not include credentials in URL query strings. Use standard header authentication.",
    };
  }

  return {
    url: trimmed,
    isValid: true,
    isTlsEnforced: isTls,
    isLocalhost: isLocal,
    hasEmbeddedAuth: false,
    hasQuerySecrets: false,
  };
}

/**
 * Resolves the lifecycle state for a given provider status.
 * Distinguishes Presence (CONFIGURED in DPAPI) from Validity (VALID / INVALID / REVOKED / UNKNOWN).
 */
export function resolveCredentialLifecycleState(
  status: ProviderCredentialStatus | null,
  nowMs: number = Date.now()
): ProviderCredentialLifecycleDto {
  if (!status || !status.isConfigured) {
    return {
      providerId: status?.providerId ?? "unknown",
      isConfigured: false,
      isActive: false,
      validationStatus: "NOT_CONFIGURED",
      lastVerifiedAtMs: null,
      lastRotatedAtMs: null,
      updatedAtMs: status?.updatedAt ?? nowMs,
      isStale: false,
      staleDays: 0,
      hasCustomEndpoint: false,
      customEndpointUrl: null,
    };
  }

  const pid = status.providerId;
  const cached = verificationStateCache.get(pid);

  // If user disabled it locally
  if (!status.isActive) {
    return {
      providerId: pid,
      isConfigured: true,
      isActive: false,
      validationStatus: "DISABLED",
      lastVerifiedAtMs: cached?.lastVerifiedAtMs ?? null,
      lastRotatedAtMs: cached?.lastRotatedAtMs ?? status.updatedAt,
      updatedAtMs: status.updatedAt,
      isStale: false,
      staleDays: 0,
      lastValidationMessage: "Locally disabled by user",
      hasCustomEndpoint: Boolean(status.baseUrl),
      customEndpointUrl: status.baseUrl,
    };
  }

  // Calculate staleness
  const lastChange = cached?.lastRotatedAtMs ?? status.updatedAt;
  const ageMs = Math.max(0, nowMs - lastChange);
  const staleDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
  const isStale = ageMs >= CREDENTIAL_STALE_THRESHOLD_MS;

  // Determine validation status
  let valStatus: CredentialValidationStatus = cached?.status ?? "CONFIGURED";
  if (isStale && (valStatus === "VALID" || valStatus === "CONFIGURED")) {
    valStatus = "EXPIRING_OR_STALE";
  }

  return {
    providerId: pid,
    isConfigured: true,
    isActive: true,
    validationStatus: valStatus,
    lastVerifiedAtMs: cached?.lastVerifiedAtMs ?? null,
    lastRotatedAtMs: lastChange,
    updatedAtMs: status.updatedAt,
    isStale,
    staleDays,
    lastValidationMessage: cached?.message,
    hasCustomEndpoint: Boolean(status.baseUrl),
    customEndpointUrl: status.baseUrl,
  };
}

/**
 * Performs a zero-prompt credential validation.
 * Uses native metadata reachability / health check ping (cmd_check_provider_health).
 * Under NO circumstances does this transmit conversational prompts, chat history, or user messages.
 */
export async function verifyCredentialZeroPrompt(providerId: string): Promise<ZeroPromptValidationResult> {
  const cleanId = providerId.trim().toLowerCase();
  const now = Date.now();

  const credStatus = await getProviderCredentialStatus(cleanId);
  if (!credStatus || !credStatus.isConfigured) {
    const res: ZeroPromptValidationResult = {
      providerId: cleanId,
      status: "NOT_CONFIGURED",
      checkedAtMs: now,
      message: "No credential configured in DPAPI vault",
      isZeroPrompt: true,
    };
    return res;
  }

  try {
    const checkRes = await checkProviderHealth(cleanId);
    let resolvedStatus: CredentialValidationStatus = "VALIDATION_UNKNOWN";
    let message = "Provider reachable; metadata acknowledged";

    const normalizedStatus = String(checkRes.status).toLowerCase();

    if (normalizedStatus === "ready") {
      resolvedStatus = "VALID";
      message = `Authentication verified (latency ${checkRes.latencyMs ?? 0}ms)`;
    } else if (
      checkRes.httpStatus === 401 ||
      normalizedStatus === "authentication_failed" ||
      checkRes.errorCategory?.includes("unauthorized") ||
      checkRes.errorCategory?.includes("invalid_api_key")
    ) {
      resolvedStatus = "INVALID";
      message = "Upstream provider rejected credential (HTTP 401 Unauthorized)";
    } else if (
      checkRes.httpStatus === 403 ||
      normalizedStatus === "authorization_failed" ||
      checkRes.errorCategory?.includes("revoked") ||
      checkRes.errorCategory?.includes("forbidden")
    ) {
      resolvedStatus = "REVOKED_OR_REJECTED";
      message = "Upstream provider reported credential revoked, forbidden, or account suspended (HTTP 403)";
    } else if (normalizedStatus === "provider_disabled" || normalizedStatus === "providerdisabled") {
      resolvedStatus = "DISABLED";
      message = "Provider is currently marked inactive locally";
    } else {
      resolvedStatus = "VALIDATION_UNKNOWN";
      message = `Validation inconclusive: ${checkRes.errorCategory ?? checkRes.status}`;
    }

    const cached = verificationStateCache.get(cleanId);
    verificationStateCache.set(cleanId, {
      status: resolvedStatus,
      lastVerifiedAtMs: now,
      lastRotatedAtMs: cached?.lastRotatedAtMs ?? credStatus.updatedAt,
      message,
    });

    return {
      providerId: cleanId,
      status: resolvedStatus,
      httpStatus: checkRes.httpStatus ?? undefined,
      latencyMs: checkRes.latencyMs ?? undefined,
      checkedAtMs: now,
      message,
      isZeroPrompt: true,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const cached = verificationStateCache.get(cleanId);
    verificationStateCache.set(cleanId, {
      status: "ERROR",
      lastVerifiedAtMs: now,
      lastRotatedAtMs: cached?.lastRotatedAtMs ?? credStatus.updatedAt,
      message: `Validation request error: ${errorMsg}`,
    });

    return {
      providerId: cleanId,
      status: "ERROR",
      checkedAtMs: now,
      message: `Validation request failed: ${errorMsg}`,
      isZeroPrompt: true,
    };
  }
}

/**
 * Executes a safe credential rotation.
 * Encrypts the new key via Windows DPAPI, updates the store, marks rotation timestamp,
 * and immediately triggers a zero-prompt validation to confirm operational status.
 */
export async function rotateProviderCredential(
  providerId: string,
  newApiKey: string,
  options?: {
    baseUrl?: string | null;
    priorityWeight?: number;
    monthlyBudgetLimit?: number | null;
    validateImmediately?: boolean;
  }
): Promise<{
  status: ProviderCredentialStatus;
  lifecycle: ProviderCredentialLifecycleDto;
  validationResult?: ZeroPromptValidationResult;
}> {
  const cleanId = providerId.trim().toLowerCase();
  const now = Date.now();

  // Validate custom endpoint security before saving
  if (options?.baseUrl) {
    const audit = auditCustomEndpointSecurity(options.baseUrl);
    if (!audit.isValid) {
      throw new Error(`Endpoint security violation: ${audit.rejectionReason}`);
    }
  }

  // Encrypt and persist new credential via DPAPI
  const saved = await saveProviderCredential({
    providerId: cleanId,
    apiKey: newApiKey,
    baseUrl: options?.baseUrl,
    priorityWeight: options?.priorityWeight,
    monthlyBudgetLimit: options?.monthlyBudgetLimit,
    isActive: true,
  });

  // Record rotation timestamp in verification cache
  verificationStateCache.set(cleanId, {
    status: "CONFIGURED",
    lastVerifiedAtMs: 0,
    lastRotatedAtMs: now,
    message: "Rotated successfully; pending verification",
  });

  let valResult: ZeroPromptValidationResult | undefined;
  if (options?.validateImmediately !== false) {
    valResult = await verifyCredentialZeroPrompt(cleanId);
  }

  const lifecycle = resolveCredentialLifecycleState(saved, now);

  return {
    status: saved,
    lifecycle,
    validationResult: valResult,
  };
}

/**
 * Handles a suspected compromise incident:
 * 1. Either purges the credential immediately from the DPAPI vault, or disables it.
 * 2. Emits an authoritative CompromiseIncidentResponse with clear instructions that
 *    the key MUST be revoked upstream in the cloud provider console.
 */
export async function handleCompromisedCredential(
  providerId: string,
  providerDisplayName: string,
  action: "PURGE_LOCAL" | "DISABLE_LOCAL"
): Promise<CompromiseIncidentResponse> {
  const cleanId = providerId.trim().toLowerCase();
  const now = Date.now();
  const revocationUrl = PROVIDER_CONSOLE_REVOCATION_URLS[cleanId] ?? `https://console.${cleanId}.com`;

  let localAction: "LOCAL_CREDENTIAL_PURGED" | "LOCAL_CREDENTIAL_DISABLED";

  if (action === "PURGE_LOCAL") {
    await deleteProviderCredential(cleanId);
    verificationStateCache.delete(cleanId);
    localAction = "LOCAL_CREDENTIAL_PURGED";
  } else {
    await setProviderActive(cleanId, false);
    const cached = verificationStateCache.get(cleanId);
    verificationStateCache.set(cleanId, {
      status: "DISABLED",
      lastVerifiedAtMs: cached?.lastVerifiedAtMs ?? now,
      lastRotatedAtMs: cached?.lastRotatedAtMs ?? null,
      message: "Disabled due to suspected compromise",
    });
    localAction = "LOCAL_CREDENTIAL_DISABLED";
  }

  return {
    providerId: cleanId,
    providerDisplayName,
    incidentTimestampMs: now,
    localActionTaken: localAction,
    remoteRevocationRequired: true,
    providerRevocationUrl: revocationUrl,
    incidentNotice:
      `[SECURITY ALERT] Local secret for ${providerDisplayName} has been ${
        localAction === "LOCAL_CREDENTIAL_PURGED" ? "permanently deleted from your Windows DPAPI vault" : "disabled locally"
      }. NOTE: This does NOT revoke the key on ${providerDisplayName}'s servers. You must immediately visit their admin console to revoke it.`,
    remediationSteps: getCompromiseRemediationSteps(providerDisplayName, revocationUrl),
  };
}

/**
 * Lists lifecycle states for all providers.
 */
export async function listAllCredentialLifecycles(): Promise<ProviderCredentialLifecycleDto[]> {
  const statuses = await listProviderCredentialStatuses();
  const now = Date.now();
  return statuses.map((s) => resolveCredentialLifecycleState(s, now));
}
