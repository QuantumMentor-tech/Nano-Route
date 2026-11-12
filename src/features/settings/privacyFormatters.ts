/**
//! Nano Route — Step 45 Privacy & Data Lifecycle UI Formatters
//! File: src/features/settings/privacyFormatters.ts
*/

import type {
  AuditHealthState,
  DataCategory,
  DeletionPolicy,
} from "../../services/ipc";

export const EXECUTE_FULL_WIPE_TOKEN_TEXT = "DELETE";

export function formatCategoryBadge(category: DataCategory): {
  label: string;
  bg: string;
  color: string;
} {
  switch (category) {
    case "user_content":
      return {
        label: "User Content",
        bg: "rgba(168, 85, 247, 0.16)",
        color: "#d8b4fe",
      };
    case "secret":
      return {
        label: "Secret (DPAPI)",
        bg: "rgba(239, 68, 68, 0.16)",
        color: "#fca5a5",
      };
    case "operational_telemetry":
      return {
        label: "Operational Telemetry",
        bg: "rgba(56, 189, 248, 0.16)",
        color: "#7dd3fc",
      };
    case "configuration":
      return {
        label: "Configuration",
        bg: "rgba(34, 197, 94, 0.16)",
        color: "#86efac",
      };
    case "search_index":
      return {
        label: "Search Index",
        bg: "rgba(251, 191, 36, 0.16)",
        color: "#fde68a",
      };
    case "application_metadata":
    default:
      return {
        label: "App Metadata",
        bg: "rgba(161, 161, 170, 0.16)",
        color: "#d4d4d8",
      };
  }
}

export function formatDeletionPolicyBadge(policy: DeletionPolicy): {
  label: string;
  bg: string;
  color: string;
} {
  switch (policy) {
    case "retention_eligible":
      return {
        label: "Retention Eligible",
        bg: "rgba(56, 189, 248, 0.14)",
        color: "#38bdf8",
      };
    case "rebuildable":
      return {
        label: "Rebuildable",
        bg: "rgba(251, 191, 36, 0.14)",
        color: "#fbbf24",
      };
    case "credential_sensitive":
      return {
        label: "Credential Sensitive",
        bg: "rgba(239, 68, 68, 0.14)",
        color: "#f87171",
      };
    case "selectively_deletable":
      return {
        label: "Selectively Deletable",
        bg: "rgba(168, 85, 247, 0.14)",
        color: "#c084fc",
      };
    case "user_only":
      return {
        label: "User Only",
        bg: "rgba(34, 197, 94, 0.14)",
        color: "#4ade80",
      };
    case "system_owned":
    default:
      return {
        label: "System Owned",
        bg: "rgba(161, 161, 170, 0.14)",
        color: "#a1a1aa",
      };
  }
}

export function formatHealthStateBadge(state: AuditHealthState): {
  label: string;
  bg: string;
  color: string;
} {
  switch (state) {
    case "healthy":
      return {
        label: "Healthy",
        bg: "rgba(34, 197, 94, 0.18)",
        color: "#86efac",
      };
    case "healthy_with_warnings":
      return {
        label: "Healthy with Warnings",
        bg: "rgba(250, 204, 21, 0.18)",
        color: "#fde047",
      };
    case "needs_attention":
      return {
        label: "Needs Attention",
        bg: "rgba(249, 115, 22, 0.2)",
        color: "#fdba74",
      };
    case "corrupted":
      return {
        label: "Corrupted",
        bg: "rgba(239, 68, 68, 0.22)",
        color: "#fca5a5",
      };
    case "unavailable":
    default:
      return {
        label: "Unavailable",
        bg: "rgba(161, 161, 170, 0.18)",
        color: "#d4d4d8",
      };
  }
}

