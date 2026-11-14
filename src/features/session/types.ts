/**
 * Nano Route — Workspace Session Continuity & Safe Restoration Types
 * File: src/features/session/types.ts
 *
 * Implements Step 68 types for session continuity, typed snapshots,
 * state classifications, exit markers, and restoration results.
 * Plaintext credentials, tokens, and active runtime handles are strictly excluded.
 */

export const SESSION_SCHEMA_FORMAT = "nano-route-workspace-session-v1";
export const SESSION_SCHEMA_VERSION = 1;
export const MAX_SESSION_PAYLOAD_BYTES = 8192; // 8KB strict ceiling

export type StateClassification =
  | "PERSISTENT_PREFERENCE"
  | "SESSION_STATE"
  | "DERIVED_STATE"
  | "TRANSIENT_RUNTIME_STATE"
  | "FORBIDDEN_TO_RESTORE";

export type SessionExitStatus =
  | "clean_exit"
  | "unexpected_exit"
  | "startup_recovery"
  | "unknown";

export interface WindowStateSnapshot {
  isMaximized?: boolean;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
}

export interface WorkspaceSessionSnapshot {
  format: "nano-route-workspace-session-v1";
  schemaVersion: number;
  savedAt: number;
  route: string;
  activeProfileId?: string;
  sidebarCollapsed?: boolean;
  activeChatSessionId?: string;
  settingsTab?: string;
  historyFilter?: string;
  helpArticleId?: string;
  windowState?: WindowStateSnapshot;
}

export interface SessionRestoreResult {
  restored: boolean;
  route: string;
  activeProfileId: string;
  sidebarCollapsed: boolean;
  activeChatSessionId?: string;
  exitStatus: SessionExitStatus;
  wasUnexpectedExit: boolean;
  reason: string;
}

export interface StateFieldCatalogEntry {
  field: string;
  type: string;
  classification: StateClassification;
  purpose: string;
  source: string;
  allowedValues: string;
  persistenceRule: string;
  restorationRule: string;
  fallback: string;
}

