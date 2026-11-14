/**
 * Nano Route — Composer Draft System Types
 * File: src/features/composer/types.ts
 *
 * Implements Step 78:
 * - Persistent draft entity definitions
 * - Autosave states and lifecycle transitions
 * - Undo/Redo stack definitions
 * - Recovery metadata and options
 */

export type DraftSaveStatus =
  | "SAVED"
  | "SAVING"
  | "DIRTY"
  | "RECOVERED"
  | "ERROR"
  | "IDLE";

export interface ComposerDraft {
  id: string;
  sessionId: string | null;
  content: string;
  templateId?: string | null;
  presetId?: string | null;
  revision: number;
  isRecovered: boolean;
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
}

export interface SaveDraftInput {
  sessionId: string | null;
  content: string;
  templateId?: string | null;
  presetId?: string | null;
}

export interface DraftHistoryEntry {
  content: string;
  timestamp: number;
}

export interface DraftRecoveryResult {
  hasRecoverableDraft: boolean;
  draft: ComposerDraft | null;
}

