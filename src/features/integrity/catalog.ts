/**
 * Nano Route — Integrity Check & Repair Catalog
 * File: src/features/integrity/catalog.ts
 *
 * Implements Step 72 authoritative check specifications,
 * repair definitions, precondition invariants, and classifications.
 */

import {
  type IntegrityCheckDescriptor,
  type RepairActionDescriptor,
  type RepairId,
} from "./types.ts";

export const INTEGRITY_CHECKS_CATALOG: ReadonlyArray<IntegrityCheckDescriptor> = Object.freeze([
  // ─── 1. DATABASE DOMAIN ───
  {
    id: "DB-001",
    domain: "DATABASE",
    name: "SQLite Core & Schema Validity",
    purpose: "Validates database accessibility, WAL journaling mode, and schema integrity.",
    expectedInvariant: "Database connection responsive, schema version is 6, WAL enabled, foreign keys ON.",
    severity: "CRITICAL",
    dependencies: [],
    recoveryRecommendedOnFail: true,
  },
  {
    id: "DB-002",
    domain: "DATABASE",
    name: "Foreign Key Integrity & Referential Constraints",
    purpose: "Ensures no relational tables reference non-existent parent rows.",
    expectedInvariant: "Zero foreign key violations across all tables.",
    severity: "HIGH",
    dependencies: ["DB-001"],
    supportedRepairId: "REMOVE_ORPHANED_MESSAGES",
    recoveryRecommendedOnFail: true,
  },

  // ─── 2. HISTORY DOMAIN ───
  {
    id: "HIST-001",
    domain: "HISTORY",
    name: "Chat Sessions Structural Integrity",
    purpose: "Ensures chat sessions have valid identifiers, clean titles, and non-inverted timestamps.",
    expectedInvariant: "Valid string IDs, non-empty titles, updated_at >= created_at, boolean pinned.",
    severity: "HIGH",
    dependencies: ["DB-001"],
  },
  {
    id: "HIST-002",
    domain: "HISTORY",
    name: "Chat Messages Consistency & Sender Bounds",
    purpose: "Validates message IDs, sender enumeration ('user', 'assistant', 'system'), and parent linkage.",
    expectedInvariant: "Unique message IDs, valid session IDs, allowlisted senders, zero orphans.",
    severity: "HIGH",
    dependencies: ["DB-001", "HIST-001"],
    supportedRepairId: "REMOVE_ORPHANED_MESSAGES",
  },

  // ─── 3. SEARCH_INDEX DOMAIN ───
  {
    id: "SEARCH-001",
    domain: "SEARCH_INDEX",
    name: "FTS5 Search Index Synchronicity",
    purpose: "Validates that SQLite FTS5 search index matches actual chat message content 1:1.",
    expectedInvariant: "Indexed message count matches actual chat message row count; zero ghost entries.",
    severity: "MEDIUM",
    dependencies: ["HIST-002"],
    supportedRepairId: "REBUILD_SEARCH_INDEX",
  },

  // ─── 4. PREFERENCES DOMAIN ───
  {
    id: "PREF-001",
    domain: "PREFERENCES",
    name: "User Preferences Allowlist & Validation",
    purpose: "Validates persisted preferences against Step 66 schema and value domain rules.",
    expectedInvariant: "All stored keys belong to EXPORTABLE_PREFERENCE_KEYS and pass validateSetting.",
    severity: "MEDIUM",
    dependencies: ["DB-001"],
    supportedRepairId: "RESET_INVALID_PREFERENCES",
  },

  // ─── 5. PROFILES DOMAIN ───
  {
    id: "PROF-001",
    domain: "PROFILES",
    name: "Custom Workspace Profiles Integrity",
    purpose: "Validates JSON structure, non-duplicate profile IDs, and preference allowlists.",
    expectedInvariant: "Valid JSON array, schemaVersion == 1, non-empty name <= 40 chars, no forbidden keys.",
    severity: "MEDIUM",
    dependencies: ["DB-001"],
    supportedRepairId: "PRUNE_CORRUPT_PROFILES",
  },

  // ─── 6. SESSION_STATE DOMAIN ───
  {
    id: "SESS-001",
    domain: "SESSION_STATE",
    name: "Startup & Active Route Allowlist Integrity",
    purpose: "Ensures saved route and startup preferences strictly match known application routes.",
    expectedInvariant: "Stored route starts with '/' and belongs to ROUTE_ALLOWLIST.",
    severity: "MEDIUM",
    dependencies: ["PREF-001"],
    supportedRepairId: "REPAIR_INVALID_SESSION_ROUTE",
  },

  // ─── 7. TELEMETRY DOMAIN ───
  {
    id: "TELEM-001",
    domain: "TELEMETRY",
    name: "Telemetry Records Identity & Timestamp Bounds",
    purpose: "Validates telemetry record structure, positive IDs, and non-future timestamps.",
    expectedInvariant: "Unique record IDs, timestamps not >5m in future, valid event types.",
    severity: "LOW",
    dependencies: ["DB-001"],
  },

  // ─── 8. TOKEN_USAGE, COST, SAVINGS & LATENCY DOMAINS ───
  {
    id: "ANALYTICS-001",
    domain: "TOKEN_USAGE",
    name: "Token Usage & Cost Metric Bounds",
    purpose: "Validates non-negative tokens, non-negative cost, and confidence within [0.0, 1.0].",
    expectedInvariant: "prompt_tokens >= 0, completion_tokens >= 0, cost_usd >= 0.0, confidence in [0, 1].",
    severity: "LOW",
    dependencies: ["TELEM-001"],
  },
  {
    id: "LATENCY-001",
    domain: "LATENCY",
    name: "Request Duration & Latency Bounds",
    purpose: "Ensures latency measurements are non-negative real numbers.",
    expectedInvariant: "latency_ms >= 0 across all recorded provider executions.",
    severity: "LOW",
    dependencies: ["TELEM-001"],
  },

  // ─── 9. PROVIDER & MODEL METADATA DOMAIN ───
  {
    id: "PROV-001",
    domain: "PROVIDER_METADATA",
    name: "Provider Registry & Credential References",
    purpose: "Checks that registered providers have valid IDs, endpoints, and consistent credential flags.",
    expectedInvariant: "Non-empty provider IDs, valid https/http base URLs, zero plaintext credentials.",
    severity: "MEDIUM",
    dependencies: ["DB-001"],
  },

  // ─── 10. IMPORT_STATE DOMAIN ───
  {
    id: "IMPORT-001",
    domain: "IMPORT_STATE",
    name: "Import Operation State & Transaction Cleanliness",
    purpose: "Verifies no interrupted or zombie import markers remain in local storage.",
    expectedInvariant: "No active lock flags or uncommitted staging markers.",
    severity: "LOW",
    dependencies: ["DB-001"],
    supportedRepairId: "CLEAR_STALE_IMPORT_MARKER",
  },
]);

export const REPAIR_CATALOG: Readonly<Record<RepairId, RepairActionDescriptor>> = Object.freeze({
  REBUILD_SEARCH_INDEX: {
    repairId: "REBUILD_SEARCH_INDEX",
    name: "Rebuild SQLite FTS5 Search Index",
    description: "Drops and reconstructs the message search index from authoritative SQLite chat tables.",
    classification: "REGENERATIVE",
    preconditions: ["Source chat_messages table must be intact and queryable."],
    affectedData: "SQLite FTS5 virtual table rows only.",
    preservedData: "All chat sessions, messages, user text, and timestamps remain completely untouched.",
    backupRecommended: false,
    targetCheckId: "SEARCH-001",
  },

  REMOVE_ORPHANED_MESSAGES: {
    repairId: "REMOVE_ORPHANED_MESSAGES",
    name: "Remove Orphaned Messages & Rebuild Index",
    description: "Safely prunes messages referencing non-existent parent sessions and updates search index.",
    classification: "NON_DESTRUCTIVE",
    preconditions: ["Foreign key violation check has identified specific orphaned child records."],
    affectedData: "Unlinked orphan message rows that have no parent session.",
    preservedData: "All valid chat sessions and their linked messages are preserved.",
    backupRecommended: true,
    targetCheckId: "DB-002",
  },

  REPAIR_INVALID_SESSION_ROUTE: {
    repairId: "REPAIR_INVALID_SESSION_ROUTE",
    name: "Reset Startup Route to Safe Default",
    description: "Replaces an unrecognized or malformed route preference with the default '/' route.",
    classification: "CONFIGURATION_CHANGING",
    preconditions: ["Saved route failed ROUTE_ALLOWLIST validation."],
    affectedData: "The 'workspace.startup_route' setting only.",
    preservedData: "All other user preferences, themes, and window states.",
    backupRecommended: false,
    targetCheckId: "SESS-001",
  },

  PRUNE_CORRUPT_PROFILES: {
    repairId: "PRUNE_CORRUPT_PROFILES",
    name: "Prune Malformed Custom Workspace Profiles",
    description: "Removes unparseable or corrupted profile entries while preserving valid custom profiles.",
    classification: "DATA_MUTATING",
    preconditions: ["Custom profiles JSON contains invalid schema entries."],
    affectedData: "Unparseable profile JSON elements.",
    preservedData: "All built-in profiles and valid custom profiles.",
    backupRecommended: true,
    targetCheckId: "PROF-001",
  },

  RESET_INVALID_PREFERENCES: {
    repairId: "RESET_INVALID_PREFERENCES",
    name: "Reset Invalid Preferences to Safe Defaults",
    description: "Replaces any individual preference value that fails domain validation with its default.",
    classification: "CONFIGURATION_CHANGING",
    preconditions: ["One or more preference keys failed validation."],
    affectedData: "Only the specific failing preference keys.",
    preservedData: "All conforming preference keys and user data.",
    backupRecommended: false,
    targetCheckId: "PREF-001",
  },

  CLEAR_STALE_IMPORT_MARKER: {
    repairId: "CLEAR_STALE_IMPORT_MARKER",
    name: "Clear Stale Import Lock Markers",
    description: "Clears abandoned import in-progress flags from previous application sessions.",
    classification: "NON_DESTRUCTIVE",
    preconditions: ["Stale lock found with no active background task."],
    affectedData: "Transient import state marker.",
    preservedData: "All historical and imported database records.",
    backupRecommended: false,
    targetCheckId: "IMPORT-001",
  },
});

