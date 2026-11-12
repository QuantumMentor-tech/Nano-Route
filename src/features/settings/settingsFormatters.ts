/**
//! Nano Route — Step 46 Settings & Provider Management Formatters
//! File: src/features/settings/settingsFormatters.ts
//!
//! Formatting helpers for provider health badges, timestamps, token numbers,
//! and routing mode descriptions.
*/

export interface StatusBadgeInfo {
  label: string;
  bg: string;
  color: string;
  borderColor: string;
}

/**
 * Maps canonical Step 25 runtime health states to UI badge formatting.
 */
export function formatProviderHealthBadge(state: string): StatusBadgeInfo {
  const normalized = state?.toLowerCase() ?? "unknown";
  switch (normalized) {
    case "ready":
      return {
        label: "Ready",
        bg: "rgba(34, 197, 94, 0.12)",
        color: "#4ade80",
        borderColor: "rgba(34, 197, 94, 0.3)",
      };
    case "degraded":
      return {
        label: "Degraded",
        bg: "rgba(234, 179, 8, 0.12)",
        color: "#facc15",
        borderColor: "rgba(234, 179, 8, 0.3)",
      };
    case "rate_limited":
      return {
        label: "Rate Limited",
        bg: "rgba(249, 115, 22, 0.12)",
        color: "#fb923c",
        borderColor: "rgba(249, 115, 22, 0.3)",
      };
    case "authentication_failed":
      return {
        label: "Auth Failed",
        bg: "rgba(239, 68, 68, 0.12)",
        color: "#f87171",
        borderColor: "rgba(239, 68, 68, 0.3)",
      };
    case "authorization_failed":
      return {
        label: "Not Authorized",
        bg: "rgba(239, 68, 68, 0.12)",
        color: "#f87171",
        borderColor: "rgba(239, 68, 68, 0.3)",
      };
    case "provider_unavailable":
      return {
        label: "Unavailable",
        bg: "rgba(239, 68, 68, 0.12)",
        color: "#f87171",
        borderColor: "rgba(239, 68, 68, 0.3)",
      };
    case "endpoint_misconfigured":
      return {
        label: "Misconfigured",
        bg: "rgba(249, 115, 22, 0.12)",
        color: "#fb923c",
        borderColor: "rgba(249, 115, 22, 0.3)",
      };
    case "credential_missing":
      return {
        label: "Key Missing",
        bg: "rgba(148, 163, 184, 0.12)",
        color: "#94a3b8",
        borderColor: "rgba(148, 163, 184, 0.25)",
      };
    case "provider_disabled":
      return {
        label: "Disabled",
        bg: "rgba(148, 163, 184, 0.12)",
        color: "#94a3b8",
        borderColor: "rgba(148, 163, 184, 0.25)",
      };
    case "model_unavailable":
      return {
        label: "Model Unavailable",
        bg: "rgba(249, 115, 22, 0.12)",
        color: "#fb923c",
        borderColor: "rgba(249, 115, 22, 0.3)",
      };
    case "request_rejected":
      return {
        label: "Rejected",
        bg: "rgba(239, 68, 68, 0.12)",
        color: "#f87171",
        borderColor: "rgba(239, 68, 68, 0.3)",
      };
    case "unknown":
    default:
      return {
        label: "Unknown",
        bg: "rgba(100, 116, 139, 0.12)",
        color: "#94a3b8",
        borderColor: "rgba(100, 116, 139, 0.25)",
      };
  }
}

/**
 * Formats a health observation timestamp into friendly human text.
 */
export function formatHealthFreshness(timestampMs?: number | null): string {
  if (!timestampMs || timestampMs <= 0) {
    return "Not checked yet";
  }
  const deltaSec = Math.floor((Date.now() - timestampMs) / 1000);
  if (deltaSec < 30) {
    return "Checked just now";
  }
  if (deltaSec < 3600) {
    const mins = Math.floor(deltaSec / 60);
    return `Checked ${mins}m ago`;
  }
  if (deltaSec < 86400) {
    const hours = Math.floor(deltaSec / 3600);
    return `Checked ${hours}h ago`;
  }
  const days = Math.floor(deltaSec / 86400);
  return `Checked ${days}d ago`;
}

/**
 * Formats token count (e.g. 128000 -> 128k, 2000000 -> 2M).
 */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    const val = (tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1);
    return `${val}M tokens`;
  }
  if (tokens >= 1_000) {
    const val = (tokens / 1_000).toFixed(tokens % 1_000 === 0 ? 0 : 1);
    return `${val}k tokens`;
  }
  return `${tokens} tokens`;
}

/**
 * Returns user-friendly description for routing profiles.
 */
export function getRoutingProfileDescription(mode: string): string {
  switch (mode) {
    case "quality":
      return "Prioritizes highest capability and reasoning performance models for demanding tasks.";
    case "cost_saving":
      return "Prefers economical, lightweight, and high-efficiency models to minimize token burn.";
    case "balanced":
    default:
      return "Standard intelligent routing balancing accuracy, capability, speed, and cost.";
  }
}

