/**
 * Nano Route — Context Collections & Reference Packs Engine
 * File: src/features/context-collections/engine.ts
 *
 * Implements Step 83:
 * - Deterministic, local-first CRUD for Context Collections and Collection Items
 * - Source provenance, staleness detection, and sensitivity tracking
 * - Safe materialization into structured context for Composer and Context Preflight
 * - User-controlled ordering, item removal without modifying canonical chat history
 * - Schema-safe export and import with conflict resolution
 */

import { estimateTextTokens } from "../context/engine.ts";
import {
  type ContextCollection,
  type ContextCollectionItem,
  type ResolvedContextItem,
  type MaterializedContextResult,
  type CreateCollectionInput,
  type UpdateCollectionInput,
  type AddItemInput,
  type ContextCollectionFilter,
  CONTEXT_COLLECTION_LIMITS,
} from "./types.ts";

const collectionsStore = new Map<string, ContextCollection>();
const itemsStore = new Map<string, ContextCollectionItem>();

/**
 * Creates a new Context Collection.
 */
export async function createCollection(
  input: CreateCollectionInput
): Promise<ContextCollection> {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Collection name cannot be empty.");
  }
  if (name.length > CONTEXT_COLLECTION_LIMITS.MAX_COLLECTION_NAME_LENGTH) {
    throw new Error(
      `Collection name cannot exceed ${CONTEXT_COLLECTION_LIMITS.MAX_COLLECTION_NAME_LENGTH} characters.`
    );
  }

  if (collectionsStore.size >= CONTEXT_COLLECTION_LIMITS.MAX_COLLECTIONS_PER_USER) {
    throw new Error(
      `Maximum collection limit reached (${CONTEXT_COLLECTION_LIMITS.MAX_COLLECTIONS_PER_USER}).`
    );
  }

  const description = input.description?.trim() || null;
  if (
    description &&
    description.length > CONTEXT_COLLECTION_LIMITS.MAX_COLLECTION_DESC_LENGTH
  ) {
    throw new Error(
      `Description cannot exceed ${CONTEXT_COLLECTION_LIMITS.MAX_COLLECTION_DESC_LENGTH} characters.`
    );
  }

  const now = Date.now();
  const id = `cc_${now}_${Math.random().toString(36).substring(2, 7)}`;

  const collection: ContextCollection = {
    id,
    name,
    description,
    isFavorite: input.isFavorite ?? false,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  };

  collectionsStore.set(id, collection);
  return { ...collection };
}

/**
 * Updates an existing Context Collection.
 */
export async function updateCollection(
  id: string,
  input: UpdateCollectionInput
): Promise<ContextCollection> {
  const existing = collectionsStore.get(id);
  if (!existing) {
    throw new Error(`Collection not found: ${id}`);
  }

  let name = existing.name;
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) {
      throw new Error("Collection name cannot be empty.");
    }
    if (trimmed.length > CONTEXT_COLLECTION_LIMITS.MAX_COLLECTION_NAME_LENGTH) {
      throw new Error(
        `Collection name cannot exceed ${CONTEXT_COLLECTION_LIMITS.MAX_COLLECTION_NAME_LENGTH} characters.`
      );
    }
    name = trimmed;
  }

  let description = existing.description;
  if (input.description !== undefined) {
    const trimmed = input.description ? input.description.trim() : null;
    if (
      trimmed &&
      trimmed.length > CONTEXT_COLLECTION_LIMITS.MAX_COLLECTION_DESC_LENGTH
    ) {
      throw new Error(
        `Description cannot exceed ${CONTEXT_COLLECTION_LIMITS.MAX_COLLECTION_DESC_LENGTH} characters.`
      );
    }
    description = trimmed;
  }

  const updated: ContextCollection = {
    ...existing,
    name,
    description,
    isFavorite: input.isFavorite !== undefined ? input.isFavorite : existing.isFavorite,
    updatedAt: Date.now(),
  };

  collectionsStore.set(id, updated);
  return { ...updated };
}

/**
 * Deletes a collection and cascades to its items.
 * Canonical chat messages, notes, and attachments are NEVER deleted.
 */
export async function deleteCollection(id: string): Promise<boolean> {
  if (!collectionsStore.has(id)) {
    return false;
  }

  // Cascade delete collection items
  for (const [itemId, item] of itemsStore.entries()) {
    if (item.collectionId === id) {
      itemsStore.delete(itemId);
    }
  }

  return collectionsStore.delete(id);
}

/**
 * Duplicates a collection and its items.
 */
export async function duplicateCollection(id: string): Promise<ContextCollection> {
  const source = collectionsStore.get(id);
  if (!source) {
    throw new Error(`Collection not found: ${id}`);
  }

  const now = Date.now();
  const newCollectionId = `cc_${now}_${Math.random().toString(36).substring(2, 7)}`;
  const duplicate: ContextCollection = {
    id: newCollectionId,
    name: `Copy of ${source.name}`.substring(
      0,
      CONTEXT_COLLECTION_LIMITS.MAX_COLLECTION_NAME_LENGTH
    ),
    description: source.description,
    isFavorite: false,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  };

  collectionsStore.set(newCollectionId, duplicate);

  // Clone items
  const sourceItems = await getCollectionItems(id);
  for (const item of sourceItems) {
    const newItemId = `cci_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    itemsStore.set(newItemId, {
      ...item,
      id: newItemId,
      collectionId: newCollectionId,
      createdAt: now,
      updatedAt: now,
    });
  }

  return { ...duplicate };
}

/**
 * Retrieves a collection by ID.
 */
export async function getCollection(id: string): Promise<ContextCollection | null> {
  const collection = collectionsStore.get(id);
  return collection ? { ...collection } : null;
}

/**
 * Lists collections matching optional filter and search parameters.
 */
export async function listCollections(
  filter?: ContextCollectionFilter
): Promise<ContextCollection[]> {
  let list = Array.from(collectionsStore.values());

  if (filter?.filterType) {
    switch (filter.filterType) {
      case "FAVORITES":
        list = list.filter((c) => c.isFavorite);
        break;
      case "RECENT":
        list = list.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 10);
        break;
      case "WITH_NOTES": {
        const collectionIdsWithNotes = new Set(
          Array.from(itemsStore.values())
            .filter((item) => item.sourceType === "NOTE")
            .map((item) => item.collectionId)
        );
        list = list.filter((c) => collectionIdsWithNotes.has(c.id));
        break;
      }
      case "WITH_ATTACHMENTS": {
        const collectionIdsWithAttachments = new Set(
          Array.from(itemsStore.values())
            .filter((item) => item.sourceType === "ATTACHMENT_REFERENCE")
            .map((item) => item.collectionId)
        );
        list = list.filter((c) => collectionIdsWithAttachments.has(c.id));
        break;
      }
      case "ALL":
      default:
        break;
    }
  }

  if (filter?.searchQuery) {
    const query = filter.searchQuery.toLowerCase().trim();
    list = list.filter((c) => {
      const matchName = c.name.toLowerCase().includes(query);
      const matchDesc = c.description ? c.description.toLowerCase().includes(query) : false;
      return matchName || matchDesc;
    });
  }

  // Default ordering: favorites first, then most recently updated
  return list.sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    return b.updatedAt - a.updatedAt;
  });
}

/**
 * Adds a reference item to a collection.
 */
export async function addItemToCollection(
  input: AddItemInput
): Promise<ContextCollectionItem> {
  const collection = collectionsStore.get(input.collectionId);
  if (!collection) {
    throw new Error(`Collection not found: ${input.collectionId}`);
  }

  const existingItems = await getCollectionItems(input.collectionId);
  if (existingItems.length >= CONTEXT_COLLECTION_LIMITS.MAX_ITEMS_PER_COLLECTION) {
    throw new Error(
      `Collection cannot exceed ${CONTEXT_COLLECTION_LIMITS.MAX_ITEMS_PER_COLLECTION} items.`
    );
  }

  if (input.sourceType === "MESSAGE_EXCERPT" && input.excerptText) {
    if (input.excerptText.length > CONTEXT_COLLECTION_LIMITS.MAX_EXCERPT_LENGTH) {
      throw new Error(
        `Excerpt length cannot exceed ${CONTEXT_COLLECTION_LIMITS.MAX_EXCERPT_LENGTH} characters.`
      );
    }
  }

  const now = Date.now();
  const id = `cci_${now}_${Math.random().toString(36).substring(2, 7)}`;
  const item: ContextCollectionItem = {
    id,
    collectionId: input.collectionId,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    sessionId: input.sessionId || null,
    branchId: input.branchId || null,
    position: existingItems.length,
    label: input.label ? input.label.trim() : null,
    excerptText: input.excerptText ? input.excerptText.trim() : null,
    createdAt: now,
    updatedAt: now,
  };

  itemsStore.set(id, item);

  // Update collection timestamp
  collection.updatedAt = now;

  return { ...item };
}

/**
 * Removes an item from a collection and re-indexes remaining positions.
 */
export async function removeItemFromCollection(itemId: string): Promise<boolean> {
  const item = itemsStore.get(itemId);
  if (!item) {
    return false;
  }

  const collectionId = item.collectionId;
  itemsStore.delete(itemId);

  // Re-index remaining positions
  const remaining = await getCollectionItems(collectionId);
  remaining.forEach((rem, idx) => {
    rem.position = idx;
    rem.updatedAt = Date.now();
    itemsStore.set(rem.id, rem);
  });

  const collection = collectionsStore.get(collectionId);
  if (collection) {
    collection.updatedAt = Date.now();
  }

  return true;
}

/**
 * Reorders items in a collection to match the specified item IDs order.
 */
export async function reorderCollectionItems(
  collectionId: string,
  itemIdsInOrder: string[]
): Promise<ContextCollectionItem[]> {
  const items = await getCollectionItems(collectionId);
  const itemMap = new Map(items.map((i) => [i.id, i]));

  const reordered: ContextCollectionItem[] = [];
  const now = Date.now();

  itemIdsInOrder.forEach((id, index) => {
    const it = itemMap.get(id);
    if (it) {
      it.position = index;
      it.updatedAt = now;
      itemsStore.set(it.id, it);
      reordered.push(it);
    }
  });

  const collection = collectionsStore.get(collectionId);
  if (collection) {
    collection.updatedAt = now;
  }

  return reordered;
}

/**
 * Retrieves all items for a collection, sorted by position ascending.
 */
export async function getCollectionItems(
  collectionId: string
): Promise<ContextCollectionItem[]> {
  return Array.from(itemsStore.values())
    .filter((item) => item.collectionId === collectionId)
    .sort((a, b) => a.position - b.position)
    .map((item) => ({ ...item }));
}

export interface ResolverContext {
  messages?: Map<string, string>;
  notes?: Map<string, string>;
  attachments?: Map<string, string>;
}

/**
 * Resolves a single context reference item against available source stores.
 */
export async function resolveCollectionSource(
  item: ContextCollectionItem,
  resolverContext?: ResolverContext
): Promise<ResolvedContextItem> {
  let status: ResolvedContextItem["status"] = "VALID";
  let resolvedContent = "";
  let isSensitive = false;
  let warningNotice: string | null = null;

  switch (item.sourceType) {
    case "MESSAGE": {
      const content = resolverContext?.messages?.get(item.sourceId);
      if (content !== undefined) {
        resolvedContent = content;
      } else {
        status = "STALE";
        resolvedContent = "[Original conversation message is unavailable or deleted]";
      }
      break;
    }
    case "MESSAGE_EXCERPT": {
      if (item.excerptText) {
        resolvedContent = item.excerptText;
        const msg = resolverContext?.messages?.get(item.sourceId);
        if (msg === undefined && resolverContext?.messages) {
          status = "STALE";
          warningNotice = "Source message was removed; using captured excerpt snapshot.";
        }
      } else {
        status = "INVALID";
        resolvedContent = "[Excerpt text missing]";
      }
      break;
    }
    case "NOTE": {
      isSensitive = true;
      warningNotice = "Private note will be transmitted to the model provider as request context.";
      const noteContent = resolverContext?.notes?.get(item.sourceId);
      if (noteContent !== undefined) {
        resolvedContent = noteContent;
      } else {
        status = "STALE";
        resolvedContent = "[Private note was removed or is inaccessible]";
      }
      break;
    }
    case "ATTACHMENT_REFERENCE": {
      const attContent = resolverContext?.attachments?.get(item.sourceId);
      if (attContent !== undefined) {
        resolvedContent = attContent;
      } else {
        status = "STALE";
        resolvedContent = "[Attachment file reference is unreadable or deleted]";
      }
      break;
    }
    default:
      status = "INVALID";
      resolvedContent = "[Unknown reference source type]";
      break;
  }

  const charCount = resolvedContent.length;
  const estimatedTokens = estimateTextTokens(resolvedContent);

  return {
    ...item,
    status,
    resolvedContent,
    charCount,
    estimatedTokens,
    isSensitive,
    warningNotice,
  };
}

/**
 * Materializes an entire Context Collection into structured context ready for Composer injection.
 */
export async function materializeContextCollection(
  collectionId: string,
  resolverContext?: ResolverContext
): Promise<MaterializedContextResult> {
  const collection = collectionsStore.get(collectionId);
  if (!collection) {
    throw new Error(`Collection not found: ${collectionId}`);
  }

  const items = await getCollectionItems(collectionId);
  const resolvedItems: ResolvedContextItem[] = [];

  let totalCharCount = 0;
  let totalEstimatedTokens = 0;
  let validCount = 0;
  let staleCount = 0;
  let unavailableCount = 0;
  let hasSensitiveNotes = false;

  for (const item of items) {
    const resolved = await resolveCollectionSource(item, resolverContext);
    resolvedItems.push(resolved);

    totalCharCount += resolved.charCount;
    totalEstimatedTokens += resolved.estimatedTokens;

    if (resolved.status === "VALID") validCount++;
    else if (resolved.status === "STALE") staleCount++;
    else unavailableCount++;

    if (resolved.isSensitive) {
      hasSensitiveNotes = true;
    }
  }

  // Format into canonical bounded context block
  const formattedSections: string[] = [
    `[CONTEXT REFERENCE PACK: "${collection.name}"]`,
  ];

  if (collection.description) {
    formattedSections.push(`Context Description: ${collection.description}`);
  }

  resolvedItems.forEach((it, index) => {
    const typeLabel =
      it.sourceType === "MESSAGE"
        ? "Conversation Message"
        : it.sourceType === "MESSAGE_EXCERPT"
        ? "Message Excerpt"
        : it.sourceType === "NOTE"
        ? "Private Note (User-Authorized Context)"
        : "Attachment Context";

    const labelStr = it.label ? ` - "${it.label}"` : "";
    formattedSections.push(
      `--- Reference ${index + 1}: ${typeLabel}${labelStr} ---`
    );
    formattedSections.push(it.resolvedContent);
  });

  formattedSections.push(`[/CONTEXT REFERENCE PACK]`);

  const formattedContext = formattedSections.join("\n\n");

  return {
    collectionId: collection.id,
    collectionName: collection.name,
    items: resolvedItems,
    totalCharCount,
    totalEstimatedTokens,
    validCount,
    staleCount,
    unavailableCount,
    hasSensitiveNotes,
    formattedContext,
    materializedAtMs: Date.now(),
  };
}

/**
 * Exports all Context Collections and their items to a portable JSON format.
 * Zero credentials, zero private tokens, zero system secrets.
 */
export async function exportContextCollections(): Promise<string> {
  const collections = Array.from(collectionsStore.values());
  const items = Array.from(itemsStore.values());

  const exportPayload = {
    schemaVersion: 1,
    exportedAtMs: Date.now(),
    collections,
    items,
  };

  return JSON.stringify(exportPayload, null, 2);
}

/**
 * Validates and imports Context Collections from JSON.
 */
export async function validateAndImportCollections(
  jsonData: string,
  options: { conflictStrategy: "SKIP" | "REPLACE" | "KEEP_BOTH" } = {
    conflictStrategy: "KEEP_BOTH",
  }
): Promise<{ importedCollections: number; importedItems: number }> {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonData);
  } catch {
    throw new Error("Invalid JSON format for context collections import.");
  }

  if (!parsed || parsed.schemaVersion !== 1 || !Array.isArray(parsed.collections)) {
    throw new Error("Unsupported or corrupted Context Collections import schema.");
  }

  let importedCollections = 0;
  let importedItems = 0;
  const now = Date.now();

  for (const coll of parsed.collections) {
    if (!coll.id || !coll.name) continue;

    let targetId = coll.id;
    const exists = collectionsStore.has(coll.id);

    if (exists) {
      if (options.conflictStrategy === "SKIP") {
        continue;
      } else if (options.conflictStrategy === "KEEP_BOTH") {
        targetId = `cc_${now}_${Math.random().toString(36).substring(2, 7)}`;
      }
      // If REPLACE, targetId remains coll.id
    }

    const cleanColl: ContextCollection = {
      id: targetId,
      name: String(coll.name).substring(
        0,
        CONTEXT_COLLECTION_LIMITS.MAX_COLLECTION_NAME_LENGTH
      ),
      description: coll.description ? String(coll.description) : null,
      isFavorite: Boolean(coll.isFavorite),
      createdAt: Number(coll.createdAt) || now,
      updatedAt: now,
      schemaVersion: 1,
    };

    collectionsStore.set(targetId, cleanColl);
    importedCollections++;

    // Import corresponding items
    if (Array.isArray(parsed.items)) {
      const itemsForColl = parsed.items.filter((i: any) => i.collectionId === coll.id);
      for (const item of itemsForColl) {
        const newItemId = `cci_${now}_${Math.random().toString(36).substring(2, 7)}`;
        itemsStore.set(newItemId, {
          id: newItemId,
          collectionId: targetId,
          sourceType: item.sourceType || "MESSAGE",
          sourceId: item.sourceId || "",
          sessionId: item.sessionId || null,
          branchId: item.branchId || null,
          position: Number(item.position) || 0,
          label: item.label ? String(item.label) : null,
          excerptText: item.excerptText ? String(item.excerptText) : null,
          createdAt: Number(item.createdAt) || now,
          updatedAt: now,
        });
        importedItems++;
      }
    }
  }

  return { importedCollections, importedItems };
}

/**
 * Resets stores for test isolation.
 */
export function resetContextCollectionsStore(): void {
  collectionsStore.clear();
  itemsStore.clear();
}

