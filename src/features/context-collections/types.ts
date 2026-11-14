/**
 * Nano Route — Context Collections & Reference Packs Types
 * File: src/features/context-collections/types.ts
 *
 * Implements Step 83:
 * - Entity models for curated Context Collections & Reference Packs
 * - Reference source typing (Message, Excerpt, Note, Attachment)
 * - Source provenance, staleness, and sensitivity classifications
 * - Materialization contracts for safe composer context injection
 * - Strict limits and input validation definitions
 */

export type ContextSourceType =
  | "MESSAGE"
  | "MESSAGE_EXCERPT"
  | "NOTE"
  | "ATTACHMENT_REFERENCE";

export type ContextItemStatus =
  | "VALID"
  | "STALE"
  | "UNAVAILABLE"
  | "INVALID";

export type ContextCollectionFilterType =
  | "ALL"
  | "FAVORITES"
  | "RECENT"
  | "WITH_NOTES"
  | "WITH_ATTACHMENTS"
  | "STALE";

export interface ContextCollection {
  id: string;
  name: string;
  description: string | null;
  isFavorite: boolean;
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
}

export interface ContextCollectionItem {
  id: string;
  collectionId: string;
  sourceType: ContextSourceType;
  sourceId: string;
  sessionId?: string | null;
  branchId?: string | null;
  position: number;
  label?: string | null;
  excerptText?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ResolvedContextItem extends ContextCollectionItem {
  status: ContextItemStatus;
  resolvedContent: string;
  charCount: number;
  estimatedTokens: number;
  isSensitive: boolean;
  warningNotice?: string | null;
}

export interface MaterializedContextResult {
  collectionId: string;
  collectionName: string;
  items: ResolvedContextItem[];
  totalCharCount: number;
  totalEstimatedTokens: number;
  validCount: number;
  staleCount: number;
  unavailableCount: number;
  hasSensitiveNotes: boolean;
  formattedContext: string;
  materializedAtMs: number;
}

export interface CreateCollectionInput {
  name: string;
  description?: string | null;
  isFavorite?: boolean;
}

export interface UpdateCollectionInput {
  name?: string;
  description?: string | null;
  isFavorite?: boolean;
}

export interface AddItemInput {
  collectionId: string;
  sourceType: ContextSourceType;
  sourceId: string;
  sessionId?: string | null;
  branchId?: string | null;
  label?: string | null;
  excerptText?: string | null;
}

export interface ContextCollectionFilter {
  filterType?: ContextCollectionFilterType;
  searchQuery?: string;
}

export const CONTEXT_COLLECTION_LIMITS = {
  MAX_COLLECTION_NAME_LENGTH: 100,
  MAX_COLLECTION_DESC_LENGTH: 500,
  MAX_ITEMS_PER_COLLECTION: 50,
  MAX_COLLECTIONS_PER_USER: 100,
  MAX_EXCERPT_LENGTH: 8000,
} as const;

