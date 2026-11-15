/**
 * Nano Route — Provider & Model Compatibility Center Types
 * File: src/features/provider-compatibility/types.ts
 *
 * Implements Step 87:
 * - Normalized readiness states and component breakdown
 * - Authoritative provider and model capability records
 * - Request-specific eligibility evaluation models and explanation schemas
 * - Side-by-side model comparison data structures
 * - Filter and search criteria
 */

export type ReadinessState =
  | "READY"
  | "READY_WITH_LIMITATIONS"
  | "NOT_CONFIGURED"
  | "AUTH_REQUIRED"
  | "OFFLINE"
  | "UNAVAILABLE"
  | "INCOMPATIBLE"
  | "DEPRECATED"
  | "DISABLED"
  | "UNKNOWN";

export interface ComponentReadiness {
  registry: "READY" | "STALE" | "DEPRECATED" | "UNKNOWN";
  credential: "READY" | "MISSING" | "NEEDS_ATTENTION" | "NOT_REQUIRED" | "UNKNOWN";
  connectivity: "REACHABLE" | "OFFLINE" | "DEGRADED" | "UNKNOWN";
  health: "READY" | "RATE_LIMITED" | "UNAVAILABLE" | "ERROR" | "UNKNOWN";
  capability: "COMPATIBLE" | "INCOMPATIBLE" | "UNKNOWN";
  budget: "WITHIN_LIMIT" | "WARNING" | "BLOCKED" | "UNKNOWN";
  context: "COMPATIBLE" | "NEAR_LIMIT" | "EXCEEDS_LIMIT" | "UNKNOWN";
}

export type SupportedModality = "text" | "image" | "file" | "audio";

export interface ModelCompatibilityRecord {
  providerId: string;
  modelId: string;
  displayName: string;
  description: string;
  contextWindow: number;
  maxOutputTokens: number;
  capabilities: string[];
  supportedModalities: SupportedModality[];
  supportsStreaming: boolean;
  supportsToolCalling: boolean;
  supportsStructuredOutput: boolean;
  supportsVision: boolean;
  readiness: ReadinessState;
  components: ComponentReadiness;
  isEligibleForCurrentRequest: boolean | null;
  eligibilityReasons: string[];
  pricing: {
    inputCostPerMillion: number;
    outputCostPerMillion: number;
    currency: string;
  } | null;
  isDefault: boolean;
  isDeprecated: boolean;
}

export interface ProviderCompatibilityRecord {
  providerId: string;
  displayName: string;
  description: string;
  isConfigured: boolean;
  isActive: boolean;
  credentialRequired: boolean;
  credentialStatus: "READY" | "MISSING" | "NEEDS_ATTENTION" | "NOT_REQUIRED" | "UNKNOWN";
  connectivityStatus: "REACHABLE" | "OFFLINE" | "DEGRADED" | "UNKNOWN";
  healthStatus: "READY" | "RATE_LIMITED" | "UNAVAILABLE" | "ERROR" | "UNKNOWN";
  readiness: ReadinessState;
  modelsCount: number;
  eligibleModelsCount: number;
  models: ModelCompatibilityRecord[];
  baseUrl: string | null;
  priorityWeight: number;
  isLocal: boolean;
}

export interface RequestRequirements {
  estimatedInputTokens?: number;
  requiresImageInput?: boolean;
  requiresFileInput?: boolean;
  requiresStreaming?: boolean;
  requiresToolCalling?: boolean;
  requiresStructuredOutput?: boolean;
  requestedMaxOutputTokens?: number;
}

export interface CompatibilityFilter {
  search?: string;
  readiness?: ReadinessState | "ALL";
  modality?: "all" | "image" | "file";
  providerId?: string;
  onlyEligible?: boolean;
}

export interface ModelComparisonItem {
  providerId: string;
  modelId: string;
  displayName: string;
  contextWindow: number;
  maxOutputTokens: number;
  modalities: SupportedModality[];
  streaming: boolean;
  tools: boolean;
  readiness: ReadinessState;
  eligibility: string;
  costEstimate: string;
}

