/**
 * Nano Route — Conversation Organization Types
 * File: src/features/organization/types.ts
 *
 * Implements Step 82:
 * - Bookmark, Note, and Highlight entity models
 * - Input definitions and search/filter contracts
 */

export type BookmarkCategory =
  | "important"
  | "reference"
  | "code"
  | "decision"
  | "follow-up";

export interface ConversationBookmark {
  id: string;
  sessionId: string;
  messageId: string;
  branchId?: string | null;
  label?: string | null;
  category: BookmarkCategory;
  createdAt: number;
  updatedAt: number;
}

export interface ConversationNote {
  id: string;
  sessionId: string;
  messageId: string;
  branchId?: string | null;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface SaveBookmarkInput {
  sessionId: string;
  messageId: string;
  branchId?: string | null;
  label?: string | null;
  category?: BookmarkCategory;
}

export interface SaveNoteInput {
  sessionId: string;
  messageId: string;
  branchId?: string | null;
  content: string;
}

