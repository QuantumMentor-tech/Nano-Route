/**
 * Nano Route — Connectivity Center & Network Health Types
 * File: src/features/connectivity/types.ts
 *
 * Implements Step 86:
 * - Normalized local network state (Online, Offline, Degraded, Unknown, Transitioning)
 * - Provider-specific reachability and health states
 * - Decoupled local SLM availability
 * - Bounded network transition events and flap stabilization
 * - Manual, cancellable health check options
 */

export type LocalNetworkState =
  | "ONLINE"
  | "OFFLINE"
  | "DEGRADED"
  | "UNKNOWN"
  | "TRANSITIONING";

export type ProviderReachabilityState =
  | "REACHABLE"
  | "UNREACHABLE"
  | "AUTH_REQUIRED"
  | "RATE_LIMITED"
  | "SERVICE_ERROR"
  | "NOT_CONFIGURED"
  | "UNKNOWN";

export interface ProviderReachabilityRecord {
  providerId: string;
  displayName: string;
  state: ProviderReachabilityState;
  lastCheckedAtMs: number | null;
  latencyMs: number | null;
  httpStatus: number | null;
  errorCategory: string | null;
  errorMessage: string | null;
  isLocal: boolean;
}

export interface NetworkTransitionEvent {
  id: string;
  from: LocalNetworkState;
  to: LocalNetworkState;
  timestampMs: number;
  reason: string;
}

export interface ConnectivityStatusSnapshot {
  networkState: LocalNetworkState;
  isLocalSlmAvailable: boolean;
  providers: Record<string, ProviderReachabilityRecord>;
  lastTransitionAtMs: number;
  lastEvaluatedAtMs: number;
  offlineReason: string | null;
  recentTransitions: NetworkTransitionEvent[];
}

export interface ManualCheckOptions {
  providerId?: string;
  signal?: AbortSignal;
}

export interface CheckProviderResult {
  providerId: string;
  state: ProviderReachabilityState;
  latencyMs: number | null;
  httpStatus: number | null;
  errorCategory: string | null;
  errorMessage: string | null;
  checkedAtMs: number;
}

