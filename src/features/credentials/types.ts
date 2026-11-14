/**
 * Nano Route — Credential Lifecycle & Secret Management Domain Types
 * File: src/features/credentials/types.ts
 *
 * Implements Step 74 state models, rotation requests, validation contracts,
 * custom endpoint safety, and compromise response structures.
 *
 * ZERO PLAINTEXT SECRETS ARE EVER STORED OR TRANSMITTED IN THESE STRUCTURES.
 */

/**
 * Authoritative Credential Lifecycle States.
 * Clearly separates presence (whether ciphertext exists in DPAPI)
 * from validity (whether the upstream provider accepts the credential).
 */
export type CredentialValidationStatus =
  | "NOT_CONFIGURED"       // No key present in DPAPI vault
  | "CONFIGURED"           // Key present in DPAPI, unverified / fresh
  | "VALIDATION_UNKNOWN"   // Validation attempted but indeterminate (e.g. offline/network timeout)
  | "VALID"                // Authenticated successfully against provider metadata/ping endpoint
  | "INVALID"              // Upstream rejected with HTTP 401 / bad format / invalid key
  | "REVOKED_OR_REJECTED"  // Upstream rejected specifically due to key revocation or expiration
  | "EXPIRING_OR_STALE"    // Stale key (> 90 days without rotation or marked near expiration)
  | "DISABLED"             // Manually disabled locally by user (retained in DPAPI but inactive)
  | "DELETION_PENDING"     // User marked for local purge from DPAPI vault
  | "ERROR";               // Technical or local decryption error during validation attempt

/**
 * Extended metadata representing a provider's credential lifecycle state.
 * Contains purely operational and non-secret audit metadata.
 */
export interface ProviderCredentialLifecycleDto {
  providerId: string;
  isConfigured: boolean;
  isActive: boolean;
  validationStatus: CredentialValidationStatus;
  lastVerifiedAtMs: number | null;
  lastRotatedAtMs: number | null;
  updatedAtMs: number;
  isStale: boolean;
  staleDays: number;
  lastValidationMessage?: string;
  hasCustomEndpoint: boolean;
  customEndpointUrl?: string | null;
}

/**
 * Zero-prompt validation result.
 * Strictly guarantees that no user chat prompts or completions were transmitted.
 */
export interface ZeroPromptValidationResult {
  providerId: string;
  status: CredentialValidationStatus;
  httpStatus?: number;
  latencyMs?: number;
  checkedAtMs: number;
  message: string;
  isZeroPrompt: true;
}

/**
 * Endpoint security audit result.
 * Validates TLS, prohibits plain HTTP (except localhost), prevents embedded credentials in URLs,
 * and detects suspicious redirects or query string token leakage.
 */
export interface EndpointSecurityAudit {
  url: string;
  isValid: boolean;
  isTlsEnforced: boolean;
  isLocalhost: boolean;
  hasEmbeddedAuth: boolean;
  hasQuerySecrets: boolean;
  rejectionReason?: string;
  recommendation?: string;
}

/**
 * Compromise incident action payload.
 * Clearly separates local wipe from upstream cloud revocation.
 */
export interface CompromiseIncidentResponse {
  providerId: string;
  providerDisplayName: string;
  incidentTimestampMs: number;
  localActionTaken: "LOCAL_CREDENTIAL_PURGED" | "LOCAL_CREDENTIAL_DISABLED";
  remoteRevocationRequired: true;
  providerRevocationUrl: string;
  incidentNotice: string;
  remediationSteps: string[];
}

