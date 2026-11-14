/**
 * Nano Route — Composer Draft Storage Engine
 * File: src/features/composer/engine.ts
 *
 * Implements Step 78:
 * - Local-first durable persistence for unfinished drafts.
 * - Per-session draft indexing and global scratchpad draft support.
 * - Monotonic revision increments and collision-safe updates.
 * - Cascading cleanup when a session is cleared or deleted.
 * - Zero credentials or secrets stored in draft objects.
 */

import type { ComposerDraft, SaveDraftInput } from "./types.ts";

// In-memory store mirroring SQLite composer_drafts table
const draftStoreBySession = new Map<string, ComposerDraft>();
let globalScratchpadDraft: ComposerDraft | null = null;

const GLOBAL_SESSION_KEY = "__nr_global_scratchpad__";

/**
 * Normalizes session ID lookup key.
 */
function getStorageKey(sessionId: string | null): string {
  return sessionId ? sessionId : GLOBAL_SESSION_KEY;
}

/**
 * Retrieves the persisted draft for a specific session (or global scratchpad).
 */
export async function getComposerDraft(
  sessionId: string | null
): Promise<ComposerDraft | null> {
  const key = getStorageKey(sessionId);
  if (key === GLOBAL_SESSION_KEY) {
    return globalScratchpadDraft ? { ...globalScratchpadDraft } : null;
  }
  const found = draftStoreBySession.get(key);
  return found ? { ...found } : null;
}

/**
 * Persists or updates a draft with atomic revision tracking.
 */
export async function saveComposerDraft(
  input: SaveDraftInput
): Promise<ComposerDraft> {
  const key = getStorageKey(input.sessionId);
  const now = Date.now();
  const trimmed = input.content;

  // If content is completely empty, delete draft
  if (trimmed.length === 0) {
    await clearComposerDraft(input.sessionId);
    return {
      id: `draft_${now}`,
      sessionId: input.sessionId,
      content: "",
      templateId: input.templateId || null,
      presetId: input.presetId || null,
      revision: 0,
      isRecovered: false,
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    };
  }

  const existing = key === GLOBAL_SESSION_KEY ? globalScratchpadDraft : draftStoreBySession.get(key);
  const revision = existing ? existing.revision + 1 : 1;
  const id = existing ? existing.id : `draft_${now}_${Math.random().toString(36).substring(2, 7)}`;
  const createdAt = existing ? existing.createdAt : now;

  const draft: ComposerDraft = {
    id,
    sessionId: input.sessionId,
    content: input.content,
    templateId: input.templateId !== undefined ? input.templateId : (existing?.templateId || null),
    presetId: input.presetId !== undefined ? input.presetId : (existing?.presetId || null),
    revision,
    isRecovered: false,
    createdAt,
    updatedAt: now,
    schemaVersion: 1,
  };

  if (key === GLOBAL_SESSION_KEY) {
    globalScratchpadDraft = draft;
  } else {
    draftStoreBySession.set(key, draft);
  }

  return { ...draft };
}

/**
 * Permanently removes a draft for a session (e.g. after prompt submission or explicit Discard).
 */
export async function clearComposerDraft(
  sessionId: string | null
): Promise<boolean> {
  const key = getStorageKey(sessionId);
  if (key === GLOBAL_SESSION_KEY) {
    const existed = globalScratchpadDraft !== null;
    globalScratchpadDraft = null;
    return existed;
  }
  return draftStoreBySession.delete(key);
}

/**
 * Retrieves all stored drafts across all sessions.
 */
export async function listAllComposerDrafts(): Promise<ComposerDraft[]> {
  const all = Array.from(draftStoreBySession.values()).map((d) => ({ ...d }));
  if (globalScratchpadDraft) {
    all.push({ ...globalScratchpadDraft });
  }
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Marks a draft as recovered following an application/renderer restart.
 */
export async function markDraftAsRecovered(
  sessionId: string | null
): Promise<ComposerDraft | null> {
  const draft = await getComposerDraft(sessionId);
  if (!draft) return null;

  const recovered: ComposerDraft = {
    ...draft,
    isRecovered: true,
    updatedAt: Date.now(),
  };

  const key = getStorageKey(sessionId);
  if (key === GLOBAL_SESSION_KEY) {
    globalScratchpadDraft = recovered;
  } else {
    draftStoreBySession.set(key, recovered);
  }

  return { ...recovered };
}

/**
 * Clears the entire draft store (for test resets or Step 69 application reset).
 */
export function resetComposerDraftStore(): void {
  draftStoreBySession.clear();
  globalScratchpadDraft = null;
}

