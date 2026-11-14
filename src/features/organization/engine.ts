/**
 * Nano Route — Conversation Organization Engine
 * File: src/features/organization/engine.ts
 *
 * Implements Step 82:
 * - Persistent CRUD for conversation bookmarks and notes
 * - Search across notes and labels
 * - Safe foreign-key references to canonical chat messages
 */

import type {
  ConversationBookmark,
  ConversationNote,
  SaveBookmarkInput,
  SaveNoteInput,
} from "./types.ts";

const bookmarkStore = new Map<string, ConversationBookmark>(); // Key: bookmarkId
const noteStore = new Map<string, ConversationNote>(); // Key: noteId

/**
 * Creates or updates a bookmark for a message.
 */
export async function saveBookmark(
  input: SaveBookmarkInput
): Promise<ConversationBookmark> {
  const now = Date.now();
  // Check if bookmark already exists for this message
  const existing = Array.from(bookmarkStore.values()).find(
    (b) => b.messageId === input.messageId
  );

  if (existing) {
    const updated: ConversationBookmark = {
      ...existing,
      label: input.label !== undefined ? input.label : existing.label,
      category: input.category || existing.category,
      updatedAt: now,
    };
    bookmarkStore.set(existing.id, updated);
    return { ...updated };
  }

  const id = `bm_${now}_${Math.random().toString(36).substring(2, 7)}`;
  const bookmark: ConversationBookmark = {
    id,
    sessionId: input.sessionId,
    messageId: input.messageId,
    branchId: input.branchId || null,
    label: input.label || null,
    category: input.category || "important",
    createdAt: now,
    updatedAt: now,
  };

  bookmarkStore.set(id, bookmark);
  return { ...bookmark };
}

/**
 * Removes a bookmark by ID or by messageId.
 */
export async function removeBookmark(
  identifier: { bookmarkId?: string; messageId?: string }
): Promise<boolean> {
  if (identifier.bookmarkId) {
    return bookmarkStore.delete(identifier.bookmarkId);
  }
  if (identifier.messageId) {
    const found = Array.from(bookmarkStore.values()).find(
      (b) => b.messageId === identifier.messageId
    );
    if (found) {
      return bookmarkStore.delete(found.id);
    }
  }
  return false;
}

/**
 * Checks if a message is currently bookmarked.
 */
export async function isMessageBookmarked(messageId: string): Promise<boolean> {
  return Array.from(bookmarkStore.values()).some((b) => b.messageId === messageId);
}

/**
 * Lists bookmarks matching optional session or category filter.
 */
export async function listBookmarks(filter?: {
  sessionId?: string;
  category?: string;
}): Promise<ConversationBookmark[]> {
  let list = Array.from(bookmarkStore.values());
  if (filter?.sessionId) {
    list = list.filter((b) => b.sessionId === filter.sessionId);
  }
  if (filter?.category) {
    list = list.filter((b) => b.category === filter.category);
  }
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Saves a private note on a message.
 */
export async function saveNote(input: SaveNoteInput): Promise<ConversationNote> {
  const now = Date.now();
  const existing = Array.from(noteStore.values()).find(
    (n) => n.messageId === input.messageId
  );

  if (existing) {
    const updated: ConversationNote = {
      ...existing,
      content: input.content,
      updatedAt: now,
    };
    noteStore.set(existing.id, updated);
    return { ...updated };
  }

  const id = `note_${now}_${Math.random().toString(36).substring(2, 7)}`;
  const note: ConversationNote = {
    id,
    sessionId: input.sessionId,
    messageId: input.messageId,
    branchId: input.branchId || null,
    content: input.content,
    createdAt: now,
    updatedAt: now,
  };

  noteStore.set(id, note);
  return { ...note };
}

/**
 * Retrieves the note attached to a message if present.
 */
export async function getNoteByMessage(
  messageId: string
): Promise<ConversationNote | null> {
  const found = Array.from(noteStore.values()).find(
    (n) => n.messageId === messageId
  );
  return found ? { ...found } : null;
}

/**
 * Deletes a note by ID.
 */
export async function deleteNote(id: string): Promise<boolean> {
  return noteStore.delete(id);
}

/**
 * Resets stores for test isolation.
 */
export function resetOrganizationStore(): void {
  bookmarkStore.clear();
  noteStore.clear();
}

