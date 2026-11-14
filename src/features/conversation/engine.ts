/**
 * Nano Route — Conversation Branching & Response Variants Engine
 * File: src/features/conversation/engine.ts
 *
 * Implements Step 81:
 * - Persistent CRUD for conversation branches and response variant mappings
 * - Multi-variant registration and preferred variant selection
 * - Non-destructive lineage tracking
 */

import type {
  ConversationBranch,
  MessageResponseVariant,
  CreateBranchInput,
} from "./types.ts";

const branchStore = new Map<string, ConversationBranch>();
const variantStore = new Map<string, MessageResponseVariant[]>(); // Key: userMessageId -> variants[]

/**
 * Creates a new conversation branch from an existing root message.
 */
export async function createConversationBranch(
  input: CreateBranchInput
): Promise<ConversationBranch> {
  const now = Date.now();
  const id = `branch_${now}_${Math.random().toString(36).substring(2, 7)}`;
  const branchCount = Array.from(branchStore.values()).filter(
    (b) => b.sessionId === input.sessionId
  ).length;

  const branch: ConversationBranch = {
    id,
    sessionId: input.sessionId,
    name: input.name?.trim() || `Alternative Branch ${branchCount + 1}`,
    parentBranchId: input.parentBranchId || null,
    rootMessageId: input.rootMessageId,
    createdAt: now,
    updatedAt: now,
  };

  branchStore.set(id, branch);
  return { ...branch };
}

/**
 * Lists all branches associated with a conversation session.
 */
export async function listConversationBranches(
  sessionId: string
): Promise<ConversationBranch[]> {
  return Array.from(branchStore.values())
    .filter((b) => b.sessionId === sessionId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Registers a new assistant response variant for a given user message.
 */
export async function registerResponseVariant(
  userMessageId: string,
  assistantMessageId: string
): Promise<MessageResponseVariant> {
  const now = Date.now();
  const existing = variantStore.get(userMessageId) || [];
  const variantIndex = existing.length + 1;
  const isPreferred = existing.length === 0; // First is preferred by default

  const variant: MessageResponseVariant = {
    id: `var_${now}_${Math.random().toString(36).substring(2, 7)}`,
    userMessageId,
    assistantMessageId,
    variantIndex,
    isPreferred,
    createdAt: now,
  };

  const updated = [...existing, variant];
  variantStore.set(userMessageId, updated);
  return { ...variant };
}

/**
 * Lists all response variants for a given user message turn.
 */
export async function listResponseVariants(
  userMessageId: string
): Promise<MessageResponseVariant[]> {
  return (variantStore.get(userMessageId) || []).map((v) => ({ ...v }));
}

/**
 * Sets the active preferred variant for continuation.
 */
export async function setPreferredVariant(
  userMessageId: string,
  variantId: string
): Promise<boolean> {
  const existing = variantStore.get(userMessageId);
  if (!existing) return false;

  let found = false;
  const updated = existing.map((v) => {
    if (v.id === variantId) {
      found = true;
      return { ...v, isPreferred: true };
    }
    return { ...v, isPreferred: false };
  });

  if (found) {
    variantStore.set(userMessageId, updated);
  }
  return found;
}

/**
 * Resets stores for testing isolation.
 */
export function resetConversationStore(): void {
  branchStore.clear();
  variantStore.clear();
}

