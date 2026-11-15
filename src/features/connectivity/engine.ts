/**
 * Nano Route — Connectivity Center & Network Health Engine
 * File: src/features/connectivity/engine.ts
 *
 * Implements Step 86:
 * - Single authoritative in-memory store for connectivity & network health
 * - OS network transition observation with flapping protection
 * - Decoupled local network status from provider-specific reachability
 * - Full protection of Local SLM during remote network outages
 * - Safe, bounded, cancellable manual health checks via Step 25 IPC
 * - Zero secret leakage and zero unauthorized provider polling loops
 */

import { checkProviderHealth } from "../../services/ipc/provider_health.ts";
import type {
  LocalNetworkState,
  ProviderReachabilityState,
  ProviderReachabilityRecord,
  NetworkTransitionEvent,
  ConnectivityStatusSnapshot,
  CheckProviderResult,
} from "./types.ts";

const MAX_TRANSITION_HISTORY = 20;
const FLAP_DEBOUNCE_MS = 400;

const DEFAULT_PROVIDERS: Record<string, { displayName: string; isLocal: boolean }> = {
  openai: { displayName: "OpenAI", isLocal: false },
  anthropic: { displayName: "Anthropic", isLocal: false },
  gemini: { displayName: "Google Gemini", isLocal: false },
  deepseek: { displayName: "DeepSeek", isLocal: false },
  groq: { displayName: "Groq", isLocal: false },
  mistral: { displayName: "Mistral AI", isLocal: false },
  local: { displayName: "Local SLM", isLocal: true },
};

// In-memory state store
let currentNetworkState: LocalNetworkState =
  typeof navigator !== "undefined" && typeof navigator.onLine === "boolean"
    ? navigator.onLine
      ? "ONLINE"
      : "OFFLINE"
    : "ONLINE";

let isLocalSlmAvailable: boolean = true;
let lastTransitionAtMs: number = Date.now();
let lastEvaluatedAtMs: number = Date.now();
let offlineReason: string | null = currentNetworkState === "OFFLINE" ? "Network adapter reports disconnected" : null;
let transitionHistory: NetworkTransitionEvent[] = [];

// Provider reachability map
const providerRecords = new Map<string, ProviderReachabilityRecord>();

// Initialize default providers
function initDefaultProviderRecords(): void {
  for (const [providerId, meta] of Object.entries(DEFAULT_PROVIDERS)) {
    if (!providerRecords.has(providerId)) {
      providerRecords.set(providerId, {
        providerId,
        displayName: meta.displayName,
        state: meta.isLocal ? "REACHABLE" : "UNKNOWN",
        lastCheckedAtMs: null,
        latencyMs: meta.isLocal ? 1 : null,
        httpStatus: meta.isLocal ? 200 : null,
        errorCategory: null,
        errorMessage: null,
        isLocal: meta.isLocal,
      });
    }
  }
}
initDefaultProviderRecords();

// Reactive listeners
const listeners = new Set<() => void>();

function notifyListeners(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Ignore listener errors
    }
  });
}

/**
 * Subscribes to real-time connectivity and reachability updates.
 */
export function subscribeToConnectivity(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Debounce timer for flapping protection
let flapTimer: ReturnType<typeof setTimeout> | null = null;
let pendingNetworkState: LocalNetworkState | null = null;

function commitNetworkTransition(newState: LocalNetworkState, reason: string): void {
  if (newState === currentNetworkState) {
    return;
  }

  const now = Date.now();
  const event: NetworkTransitionEvent = {
    id: `trans_${now}_${Math.random().toString(36).substring(2, 7)}`,
    from: currentNetworkState,
    to: newState,
    timestampMs: now,
    reason,
  };

  currentNetworkState = newState;
  lastTransitionAtMs = now;
  lastEvaluatedAtMs = now;
  offlineReason = newState === "OFFLINE" ? reason : null;

  transitionHistory.unshift(event);
  if (transitionHistory.length > MAX_TRANSITION_HISTORY) {
    transitionHistory = transitionHistory.slice(0, MAX_TRANSITION_HISTORY);
  }

  notifyListeners();
}

/**
 * Handles network online/offline events with flap protection.
 */
export function handleNetworkEvent(isOnline: boolean, explicitReason?: string): void {
  const targetState: LocalNetworkState = isOnline ? "ONLINE" : "OFFLINE";
  const reason = explicitReason || (isOnline ? "Network connection detected" : "Network connection lost");

  if (flapTimer) {
    clearTimeout(flapTimer);
    flapTimer = null;
  }

  pendingNetworkState = targetState;

  flapTimer = setTimeout(() => {
    if (pendingNetworkState !== null) {
      commitNetworkTransition(pendingNetworkState, reason);
      pendingNetworkState = null;
    }
    flapTimer = null;
  }, FLAP_DEBOUNCE_MS);
}

// Attach browser window listeners if in browser/DOM environment
if (typeof window !== "undefined") {
  window.addEventListener("online", () => handleNetworkEvent(true, "Browser network online event"));
  window.addEventListener("offline", () => handleNetworkEvent(false, "Browser network offline event"));
}

/**
 * Checks whether the application has sufficient network connectivity for remote operations.
 */
export function isAppOffline(): boolean {
  return currentNetworkState === "OFFLINE";
}

/**
 * Determines whether a specific provider request is blocked by offline mode.
 * Strictly distinguishes local SLM (which is never blocked by network offline)
 * from remote providers.
 */
export function isRemoteProviderBlocked(providerId: string): { blocked: boolean; reason: string | null } {
  const cleanId = providerId.trim().toLowerCase();
  const isLocal = cleanId === "local";

  if (isLocal) {
    return { blocked: false, reason: null };
  }

  if (isAppOffline()) {
    return {
      blocked: true,
      reason: "Network offline: internet connection is unavailable. Remote provider requests cannot be sent.",
    };
  }

  const record = providerRecords.get(cleanId);
  if (record && record.state === "AUTH_REQUIRED") {
    return {
      blocked: true,
      reason: `Provider '${record.displayName}' requires authentication. Check API key in Provider Settings.`,
    };
  }

  return { blocked: false, reason: null };
}

/**
 * Maps IPC provider health check results into normalized reachability states.
 */
export function mapHealthResultToReachability(
  status: string,
  httpStatus?: number | null,
  errorCategory?: string | null
): ProviderReachabilityState {
  if (errorCategory === "NETWORK_OFFLINE" || errorCategory === "CONNECTIVITY_ERROR") {
    return "UNREACHABLE";
  }
  if (status === "ready") return "REACHABLE";
  if (status === "authentication_failed" || status === "authorization_failed" || httpStatus === 401 || httpStatus === 403) {
    return "AUTH_REQUIRED";
  }
  if (status === "rate_limited" || httpStatus === 429) {
    return "RATE_LIMITED";
  }
  if (status === "credential_missing") {
    return "NOT_CONFIGURED";
  }
  if (httpStatus && httpStatus >= 500 && httpStatus <= 599) {
    return "SERVICE_ERROR";
  }
  if (status === "provider_unavailable" || status === "endpoint_misconfigured") {
    return "UNREACHABLE";
  }
  return "UNKNOWN";
}

/**
 * Triggers a safe, bounded, cancellable manual reachability check for a provider.
 * Does NOT send conversational prompts or leak credentials.
 */
export async function checkProviderReachability(
  providerId: string,
  options?: { signal?: AbortSignal; force?: boolean }
): Promise<CheckProviderResult> {
  const cleanId = providerId.trim().toLowerCase();
  const meta = DEFAULT_PROVIDERS[cleanId] || { displayName: providerId, isLocal: false };

  // Local SLM check
  if (meta.isLocal) {
    const result: CheckProviderResult = {
      providerId: cleanId,
      state: isLocalSlmAvailable ? "REACHABLE" : "UNREACHABLE",
      latencyMs: 1,
      httpStatus: 200,
      errorCategory: null,
      errorMessage: null,
      checkedAtMs: Date.now(),
    };
    providerRecords.set(cleanId, {
      providerId: cleanId,
      displayName: meta.displayName,
      state: result.state,
      lastCheckedAtMs: result.checkedAtMs,
      latencyMs: 1,
      httpStatus: 200,
      errorCategory: null,
      errorMessage: null,
      isLocal: true,
    });
    notifyListeners();
    return result;
  }

  // If network is offline, short-circuit immediately without sending hopeless probe
  if (isAppOffline()) {
    const result: CheckProviderResult = {
      providerId: cleanId,
      state: "UNREACHABLE",
      latencyMs: null,
      httpStatus: null,
      errorCategory: "NETWORK_OFFLINE",
      errorMessage: "Local network connection is offline",
      checkedAtMs: Date.now(),
    };
    providerRecords.set(cleanId, {
      providerId: cleanId,
      displayName: meta.displayName,
      state: "UNREACHABLE",
      lastCheckedAtMs: result.checkedAtMs,
      latencyMs: null,
      httpStatus: null,
      errorCategory: "NETWORK_OFFLINE",
      errorMessage: "Local network connection is offline",
      isLocal: false,
    });
    notifyListeners();
    return result;
  }

  if (options?.signal?.aborted) {
    throw new Error("Check cancelled by user");
  }

  const startTime = Date.now();
  try {
    const ipcResult = await checkProviderHealth(cleanId);
    const latencyMs = Math.max(1, Date.now() - startTime);

    const mappedState = mapHealthResultToReachability(
      ipcResult.status,
      ipcResult.httpStatus,
      ipcResult.errorCategory
    );

    const result: CheckProviderResult = {
      providerId: cleanId,
      state: mappedState,
      latencyMs: ipcResult.latencyMs ?? latencyMs,
      httpStatus: ipcResult.httpStatus ?? null,
      errorCategory: ipcResult.errorCategory ?? null,
      errorMessage: null,
      checkedAtMs: Date.now(),
    };

    providerRecords.set(cleanId, {
      providerId: cleanId,
      displayName: meta.displayName,
      state: mappedState,
      lastCheckedAtMs: result.checkedAtMs,
      latencyMs: result.latencyMs,
      httpStatus: result.httpStatus,
      errorCategory: result.errorCategory,
      errorMessage: null,
      isLocal: false,
    });

    notifyListeners();
    return result;
  } catch (err: unknown) {
    const latencyMs = Math.max(1, Date.now() - startTime);
    const errorMessage = err instanceof Error ? err.message : String(err);

    const result: CheckProviderResult = {
      providerId: cleanId,
      state: "UNREACHABLE",
      latencyMs,
      httpStatus: null,
      errorCategory: "CONNECTIVITY_ERROR",
      errorMessage,
      checkedAtMs: Date.now(),
    };

    providerRecords.set(cleanId, {
      providerId: cleanId,
      displayName: meta.displayName,
      state: "UNREACHABLE",
      lastCheckedAtMs: result.checkedAtMs,
      latencyMs,
      httpStatus: null,
      errorCategory: "CONNECTIVITY_ERROR",
      errorMessage,
      isLocal: false,
    });

    notifyListeners();
    return result;
  }
}

/**
 * Checks reachability for all configured providers with bounded concurrency.
 */
export async function checkAllProviders(signal?: AbortSignal): Promise<CheckProviderResult[]> {
  const providerIds = Object.keys(DEFAULT_PROVIDERS);
  const results: CheckProviderResult[] = [];

  for (const id of providerIds) {
    if (signal?.aborted) break;
    const res = await checkProviderReachability(id, { signal });
    results.push(res);
  }

  return results;
}

/**
 * Sets local SLM availability state.
 */
export function setLocalSlmAvailable(available: boolean): void {
  isLocalSlmAvailable = available;
  const localRecord = providerRecords.get("local");
  if (localRecord) {
    localRecord.state = available ? "REACHABLE" : "UNREACHABLE";
    localRecord.lastCheckedAtMs = Date.now();
  }
  notifyListeners();
}

/**
 * Explicitly sets the network state (e.g. for manual toggles, testing, or OS signals).
 */
export function setNetworkState(state: LocalNetworkState, reason?: string): void {
  commitNetworkTransition(state, reason || `Manual network state change to ${state}`);
}

/**
 * Returns an immutable snapshot of connectivity and reachability status.
 */
export function getConnectivitySnapshot(): ConnectivityStatusSnapshot {
  const providersObj: Record<string, ProviderReachabilityRecord> = {};
  for (const [k, v] of providerRecords.entries()) {
    providersObj[k] = { ...v };
  }

  return {
    networkState: currentNetworkState,
    isLocalSlmAvailable,
    providers: providersObj,
    lastTransitionAtMs,
    lastEvaluatedAtMs,
    offlineReason,
    recentTransitions: [...transitionHistory],
  };
}

/**
 * Resets state store for testing isolation.
 */
export function resetConnectivityStore(): void {
  if (flapTimer) {
    clearTimeout(flapTimer);
    flapTimer = null;
  }
  pendingNetworkState = null;
  currentNetworkState = "ONLINE";
  isLocalSlmAvailable = true;
  lastTransitionAtMs = Date.now();
  lastEvaluatedAtMs = Date.now();
  offlineReason = null;
  transitionHistory = [];
  providerRecords.clear();
  initDefaultProviderRecords();
  listeners.clear();
}
