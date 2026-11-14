/**
 * Nano Route — Data Health Monitoring & Preventive Maintenance Catalog
 * File: src/features/maintenance/catalog.ts
 *
 * Implements Step 73 authoritative maintenance checks, action specifications,
 * thresholds, preconditions, and safety boundaries.
 */

import {
  type MaintenanceCheckDescriptor,
  type MaintenanceActionDescriptor,
  type MaintenanceActionId,
} from "./types.ts";

/**
 * Authoritative Thresholds for Preventive Maintenance.
 * Strictly documented with rationale and safety guarantees.
 */
export const MAINTENANCE_THRESHOLDS = Object.freeze({
  // Max age for abandoned temporary staging files (export, import, temp JSON): 24 hours (86,400,000 ms)
  MAX_TEMP_FILE_AGE_MS: 24 * 60 * 60 * 1000,

  // Max retained resolved/dismissed notifications before pruning: 100 entries
  MAX_RESOLVED_NOTIFICATIONS_COUNT: 100,

  // Notification expiration threshold for non-critical notifications: 30 days
  MAX_NOTIFICATION_AGE_DAYS: 30,

  // Maximum allowed search index mismatch before recommending FTS5 rebuild: 1 mismatch
  SEARCH_INDEX_DRIFT_THRESHOLD: 1,

  // Stale import lock threshold: 1 hour (3,600,000 ms) without an active background process
  STALE_IMPORT_MARKER_AGE_MS: 60 * 60 * 1000,

  // Session state snapshot max byte threshold before recommending snapshot pruning: 64 KB
  MAX_SESSION_STATE_BYTES: 64 * 1024,

  // History size limit for maintenance execution logs: 50 records
  MAX_MAINTENANCE_HISTORY_ENTRIES: 50,
});

export const MAINTENANCE_CHECKS_CATALOG: ReadonlyArray<MaintenanceCheckDescriptor> = Object.freeze([
  // ─── 1. DATABASE DOMAIN ───
  {
    id: "MAINT-DB-001",
    domain: "DATABASE",
    name: "SQLite Database & WAL Overhead Monitoring",
    purpose: "Monitors SQLite database health, WAL file size, and page allocation fragmentation.",
    trigger: "manual",
    thresholdSummary: "WAL active, responsive, zero unrecoverable disk corruption.",
    recommendedActionId: "OPTIMIZE_DATABASE_PAGES",
    automaticAllowed: false,
  },

  // ─── 2. SEARCH_INDEX DOMAIN ───
  {
    id: "MAINT-SEARCH-001",
    domain: "SEARCH_INDEX",
    name: "FTS5 Message Search Index Synchronicity",
    purpose: "Detects search index drift between virtual FTS5 tables and underlying chat messages.",
    trigger: "manual",
    thresholdSummary: `Mismatch > ${MAINTENANCE_THRESHOLDS.SEARCH_INDEX_DRIFT_THRESHOLD} entries.`,
    recommendedActionId: "REBUILD_SEARCH_INDEX",
    automaticAllowed: false,
  },

  // ─── 3. TEMPORARY_FILES DOMAIN ───
  {
    id: "MAINT-TEMP-001",
    domain: "TEMPORARY_FILES",
    name: "Application Temporary & Staging Artifacts Accumulation",
    purpose: "Audits temporary export/import staging files and abandoned scratch artifacts.",
    trigger: "startup_lightweight",
    thresholdSummary: `Staging files older than 24 hours with no active operation lock.`,
    recommendedActionId: "CLEANUP_STALE_TEMP_FILES",
    automaticAllowed: true,
  },

  // ─── 4. NOTIFICATION_STATE DOMAIN ───
  {
    id: "MAINT-NOTIF-001",
    domain: "NOTIFICATION_STATE",
    name: "Resolved Notification History Accumulation",
    purpose: "Monitors historical resolved notifications, pruning stale dismissed non-critical notices.",
    trigger: "periodic_low_frequency",
    thresholdSummary: `Resolved notifications > ${MAINTENANCE_THRESHOLDS.MAX_RESOLVED_NOTIFICATIONS_COUNT} entries or older than ${MAINTENANCE_THRESHOLDS.MAX_NOTIFICATION_AGE_DAYS} days.`,
    recommendedActionId: "PRUNE_EXPIRED_NOTIFICATIONS",
    automaticAllowed: true,
  },

  // ─── 5. IMPORT_STATE DOMAIN ───
  {
    id: "MAINT-IMPORT-001",
    domain: "IMPORT_STATE",
    name: "Abandoned Import Markers & Locks",
    purpose: "Detects zombie import flags left behind by crashes or interrupted sessions.",
    trigger: "startup_lightweight",
    thresholdSummary: `Import operation lock active for > ${MAINTENANCE_THRESHOLDS.STALE_IMPORT_MARKER_AGE_MS / 60000} minutes with no running task.`,
    recommendedActionId: "CLEAR_ABANDONED_IMPORT_MARKERS",
    automaticAllowed: true,
  },

  // ─── 6. SESSION_STATE DOMAIN ───
  {
    id: "MAINT-SESS-001",
    domain: "SESSION_STATE",
    name: "Session Continuity Snapshot Overhead",
    purpose: "Monitors stored session continuity snapshot size and cleans stale exit state.",
    trigger: "startup_lightweight",
    thresholdSummary: `Stored session state > ${MAINTENANCE_THRESHOLDS.MAX_SESSION_STATE_BYTES / 1024} KB or malformed schema.`,
    recommendedActionId: "PRUNE_STALE_SESSION_SNAPSHOTS",
    automaticAllowed: true,
  },

  // ─── 7. ANALYTICS_CACHE DOMAIN ───
  {
    id: "MAINT-ANALYTICS-001",
    domain: "ANALYTICS_CACHE",
    name: "Derived Analytics & Cost Aggregates Freshness",
    purpose: "Verifies that cached cost/token summaries match raw telemetry event aggregates.",
    trigger: "manual",
    thresholdSummary: "Telemetry event logs updated without analytics invalidation.",
    recommendedActionId: "REFRESH_ANALYTICS_CACHE",
    automaticAllowed: true,
  },

  // ─── 8. TELEMETRY DOMAIN ───
  {
    id: "MAINT-TELEM-001",
    domain: "TELEMETRY",
    name: "Telemetry Retention & Lifecycle Compliance",
    purpose: "Monitors local telemetry volume against Step 45 retention policy.",
    trigger: "manual",
    thresholdSummary: "Telemetry records older than configured retention days.",
    automaticAllowed: false, // Defer to Step 45 explicit retention cleanup
  },
]);

export const MAINTENANCE_ACTIONS_CATALOG: Readonly<Record<MaintenanceActionId, MaintenanceActionDescriptor>> = Object.freeze({
  CLEANUP_STALE_TEMP_FILES: {
    actionId: "CLEANUP_STALE_TEMP_FILES",
    name: "Clean Stale Temporary Files",
    description: "Safely removes abandoned staging artifacts (>24h old) not locked by any active task.",
    classification: "SAFE_HOUSEKEEPING",
    preconditions: ["No active export, import, or update operation is running."],
    affectedData: "Expired staging artifacts in app temporary directories.",
    preservedData: "All chat conversations, telemetry records, settings, and active working files.",
    automaticAllowed: true,
    backupRecommended: false,
    targetCheckId: "MAINT-TEMP-001",
  },

  PRUNE_EXPIRED_NOTIFICATIONS: {
    actionId: "PRUNE_EXPIRED_NOTIFICATIONS",
    name: "Prune Expired Resolved Notifications",
    description: "Cleans old dismissed/resolved notifications while strictly preserving unresolved critical alerts.",
    classification: "STORAGE_RECLAMATION",
    preconditions: ["Notification store is accessible."],
    affectedData: "Resolved/dismissed notification items older than 30 days.",
    preservedData: "All unread, critical, security, and recovery notifications.",
    automaticAllowed: true,
    backupRecommended: false,
    targetCheckId: "MAINT-NOTIF-001",
  },

  REBUILD_SEARCH_INDEX: {
    actionId: "REBUILD_SEARCH_INDEX",
    name: "Rebuild FTS5 Search Index",
    description: "Regenerates full-text search indexes from authoritative SQLite chat message tables.",
    classification: "REGENERATIVE",
    preconditions: ["Chat messages table is intact and readable."],
    affectedData: "SQLite FTS5 virtual table rows only.",
    preservedData: "All chat sessions, messages, timestamps, and attribution.",
    automaticAllowed: false,
    backupRecommended: false,
    targetCheckId: "MAINT-SEARCH-001",
  },

  REFRESH_ANALYTICS_CACHE: {
    actionId: "REFRESH_ANALYTICS_CACHE",
    name: "Refresh Derived Analytics Cache",
    description: "Recomputes derived token, cost, and savings metrics directly from authoritative telemetry events.",
    classification: "REGENERATIVE",
    preconditions: ["Telemetry event store is intact."],
    affectedData: "Transient analytics summary caches.",
    preservedData: "All raw historical telemetry records and cost logs.",
    automaticAllowed: true,
    backupRecommended: false,
    targetCheckId: "MAINT-ANALYTICS-001",
  },

  CLEAR_ABANDONED_IMPORT_MARKERS: {
    actionId: "CLEAR_ABANDONED_IMPORT_MARKERS",
    name: "Clear Abandoned Import Markers",
    description: "Removes stale import locks left behind after abnormal termination.",
    classification: "SAFE_HOUSEKEEPING",
    preconditions: ["No active import task is running in the current session."],
    affectedData: "Transient import progress markers.",
    preservedData: "All committed chat history and profiles.",
    automaticAllowed: true,
    backupRecommended: false,
    targetCheckId: "MAINT-IMPORT-001",
  },

  PRUNE_STALE_SESSION_SNAPSHOTS: {
    actionId: "PRUNE_STALE_SESSION_SNAPSHOTS",
    name: "Prune Stale Session Continuity Snapshots",
    description: "Resets oversized or obsolete session snapshots to ensure clean, fast startup.",
    classification: "CONFIGURATION_PRUNING",
    preconditions: ["Saved session snapshot is corrupt or exceeds size limits."],
    affectedData: "The 'workspace.session_state' transient setting.",
    preservedData: "All persistent settings, theme choices, and workspace profiles.",
    automaticAllowed: true,
    backupRecommended: false,
    targetCheckId: "MAINT-SESS-001",
  },

  OPTIMIZE_DATABASE_PAGES: {
    actionId: "OPTIMIZE_DATABASE_PAGES",
    name: "Optimize SQLite Database Pages",
    description: "Executes a bounded, safe SQLite incremental vacuum or checkpoint if WAL mode permits.",
    classification: "STORAGE_RECLAMATION",
    preconditions: ["No active streaming, database write, or backup in progress."],
    affectedData: "Unallocated free pages within the SQLite file.",
    preservedData: "All tables, rows, indexes, and schemas.",
    automaticAllowed: false,
    backupRecommended: true,
    targetCheckId: "MAINT-DB-001",
  },
});

