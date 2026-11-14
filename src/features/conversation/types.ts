/**
 * Nano Route — Conversation Branching & Response Variants Types
 * File: src/features/conversation/types.ts
 *
 * Implements Step 81:
 * - Branch entities, lineage trees, and parent-child links
 * - Response variant groupings for multi-attempt assistant turns
 * - Selection preferences and continuation states
 */

export interface ConversationBranch {
  id: string;
  sessionId: string;
  name: string;
  parentBranchId: string | null;
  rootMessageId: string;
  createdAt: number;
  updatedAt: number;
}

export interface MessageResponseVariant {
  id: string;
  userMessageId: string;
  assistantMessageId: string;
  variantIndex: number;
  isPreferred: boolean;
  createdAt: number;
}

export interface VariantGroup {
  userMessageId: string;
  activeVariantIndex: number;
  variants: MessageResponseVariant[];
}

export interface CreateBranchInput {
  sessionId: string;
  name?: string;
  parentBranchId?: string | null;
  rootMessageId: string;
}

