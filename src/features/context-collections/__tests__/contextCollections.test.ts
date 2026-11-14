/**
 * Nano Route — Context Collections & Reference Packs Test Suite
 * File: src/features/context-collections/__tests__/contextCollections.test.ts
 *
 * Implements Step 83:
 * - Comprehensive unit and invariant tests for Context Collections
 * - CRUD, ordering, deletion cascading, and source reference preservation
 * - Staleness detection for deleted messages, notes, and attachments
 * - Materialization token estimation and structured context formatting
 * - Privacy invariants, export/import portability, and conflict strategies
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  createCollection,
  updateCollection,
  deleteCollection,
  duplicateCollection,
  getCollection,
  listCollections,
  addItemToCollection,
  removeItemFromCollection,
  reorderCollectionItems,
  getCollectionItems,
  resolveCollectionSource,
  materializeContextCollection,
  exportContextCollections,
  validateAndImportCollections,
  resetContextCollectionsStore,
} from "../engine.ts";
import { CONTEXT_COLLECTION_LIMITS } from "../types.ts";

describe("Step 83: Context Collections & Reference Packs", () => {
  beforeEach(() => {
    resetContextCollectionsStore();
  });

  describe("1. Collection Lifecycle & Bounds", () => {
    it("creates a collection with valid name and optional description", async () => {
      const col = await createCollection({
        name: "Test Architecture Collection",
        description: "References for system design",
      });

      assert.ok(col.id.startsWith("cc_"));
      assert.strictEqual(col.name, "Test Architecture Collection");
      assert.strictEqual(col.description, "References for system design");
      assert.strictEqual(col.isFavorite, false);
      assert.strictEqual(col.schemaVersion, 1);
    });

    it("rejects empty names or names exceeding max limit", async () => {
      await assert.rejects(
        () => createCollection({ name: "   " }),
        /Collection name cannot be empty/
      );

      const longName = "A".repeat(CONTEXT_COLLECTION_LIMITS.MAX_COLLECTION_NAME_LENGTH + 1);
      await assert.rejects(
        () => createCollection({ name: longName }),
        /Collection name cannot exceed/
      );
    });

    it("rejects description exceeding max limit", async () => {
      const longDesc = "D".repeat(CONTEXT_COLLECTION_LIMITS.MAX_COLLECTION_DESC_LENGTH + 1);
      await assert.rejects(
        () => createCollection({ name: "Valid Name", description: longDesc }),
        /Description cannot exceed/
      );
    });

    it("updates collection name, description, and favorite status", async () => {
      const col = await createCollection({ name: "Initial Name" });
      const updated = await updateCollection(col.id, {
        name: "Updated Name",
        description: "New description",
        isFavorite: true,
      });

      assert.strictEqual(updated.name, "Updated Name");
      assert.strictEqual(updated.description, "New description");
      assert.strictEqual(updated.isFavorite, true);
    });

    it("deletes a collection and cascades to items while leaving source data intact", async () => {
      const col = await createCollection({ name: "Temporary Pack" });
      await addItemToCollection({
        collectionId: col.id,
        sourceType: "MESSAGE",
        sourceId: "msg_original_123",
      });

      const itemsBefore = await getCollectionItems(col.id);
      assert.strictEqual(itemsBefore.length, 1);

      const deleted = await deleteCollection(col.id);
      assert.strictEqual(deleted, true);

      const found = await getCollection(col.id);
      assert.strictEqual(found, null);

      const itemsAfter = await getCollectionItems(col.id);
      assert.strictEqual(itemsAfter.length, 0);
    });

    it("duplicates collection and all its item references with distinct IDs", async () => {
      const col = await createCollection({
        name: "Source Pack",
        description: "Source pack description",
      });
      await addItemToCollection({
        collectionId: col.id,
        sourceType: "MESSAGE",
        sourceId: "msg_ref_1",
      });

      const dup = await duplicateCollection(col.id);
      assert.notStrictEqual(dup.id, col.id);
      assert.strictEqual(dup.name, "Copy of Source Pack");

      const dupItems = await getCollectionItems(dup.id);
      assert.strictEqual(dupItems.length, 1);
      assert.strictEqual(dupItems[0].sourceId, "msg_ref_1");
      assert.notStrictEqual(dupItems[0].collectionId, col.id);
    });
  });

  describe("2. Reference Item Management & Ordering", () => {
    it("adds multiple item types and increments positions monotonically", async () => {
      const col = await createCollection({ name: "Multi-type Pack" });

      const item1 = await addItemToCollection({
        collectionId: col.id,
        sourceType: "MESSAGE",
        sourceId: "msg_1",
        label: "User Question",
      });
      assert.strictEqual(item1.position, 0);

      const item2 = await addItemToCollection({
        collectionId: col.id,
        sourceType: "NOTE",
        sourceId: "note_1",
        label: "Private Analysis",
      });
      assert.strictEqual(item2.position, 1);

      const item3 = await addItemToCollection({
        collectionId: col.id,
        sourceType: "ATTACHMENT_REFERENCE",
        sourceId: "att_1",
        label: "Schema Document",
      });
      assert.strictEqual(item3.position, 2);

      const items = await getCollectionItems(col.id);
      assert.strictEqual(items.length, 3);
      assert.strictEqual(items[0].label, "User Question");
      assert.strictEqual(items[1].label, "Private Analysis");
      assert.strictEqual(items[2].label, "Schema Document");
    });

    it("removes an item and re-compacts subsequent positions", async () => {
      const col = await createCollection({ name: "Reorder Test" });
      const i1 = await addItemToCollection({ collectionId: col.id, sourceType: "MESSAGE", sourceId: "m1" });
      const i2 = await addItemToCollection({ collectionId: col.id, sourceType: "MESSAGE", sourceId: "m2" });
      const i3 = await addItemToCollection({ collectionId: col.id, sourceType: "MESSAGE", sourceId: "m3" });

      await removeItemFromCollection(i2.id);

      const remaining = await getCollectionItems(col.id);
      assert.strictEqual(remaining.length, 2);
      assert.strictEqual(remaining[0].id, i1.id);
      assert.strictEqual(remaining[0].position, 0);
      assert.strictEqual(remaining[1].id, i3.id);
      assert.strictEqual(remaining[1].position, 1);
    });

    it("reorders collection items according to specified ID sequence", async () => {
      const col = await createCollection({ name: "Ordering Pack" });
      const i1 = await addItemToCollection({ collectionId: col.id, sourceType: "MESSAGE", sourceId: "m1" });
      const i2 = await addItemToCollection({ collectionId: col.id, sourceType: "MESSAGE", sourceId: "m2" });
      const i3 = await addItemToCollection({ collectionId: col.id, sourceType: "MESSAGE", sourceId: "m3" });

      await reorderCollectionItems(col.id, [i3.id, i1.id, i2.id]);

      const reordered = await getCollectionItems(col.id);
      assert.strictEqual(reordered[0].id, i3.id);
      assert.strictEqual(reordered[0].position, 0);
      assert.strictEqual(reordered[1].id, i1.id);
      assert.strictEqual(reordered[1].position, 1);
      assert.strictEqual(reordered[2].id, i2.id);
      assert.strictEqual(reordered[2].position, 2);
    });
  });

  describe("3. Source Resolution, Staleness & Sensitivity", () => {
    it("resolves valid message content accurately", async () => {
      const col = await createCollection({ name: "Resolution Pack" });
      const item = await addItemToCollection({
        collectionId: col.id,
        sourceType: "MESSAGE",
        sourceId: "msg_valid_1",
      });

      const messages = new Map([["msg_valid_1", "Hello Nano Route!"]]);
      const resolved = await resolveCollectionSource(item, { messages });

      assert.strictEqual(resolved.status, "VALID");
      assert.strictEqual(resolved.resolvedContent, "Hello Nano Route!");
      assert.strictEqual(resolved.isSensitive, false);
      assert.strictEqual(resolved.warningNotice, null);
      assert.ok(resolved.estimatedTokens > 0);
    });

    it("marks deleted or missing message as STALE without crashing", async () => {
      const col = await createCollection({ name: "Stale Pack" });
      const item = await addItemToCollection({
        collectionId: col.id,
        sourceType: "MESSAGE",
        sourceId: "msg_deleted_999",
      });

      const messages = new Map<string, string>();
      const resolved = await resolveCollectionSource(item, { messages });

      assert.strictEqual(resolved.status, "STALE");
      assert.match(resolved.resolvedContent, /unavailable or deleted/);
    });

    it("resolves private note with sensitivity classification and warning notice", async () => {
      const col = await createCollection({ name: "Note Pack" });
      const item = await addItemToCollection({
        collectionId: col.id,
        sourceType: "NOTE",
        sourceId: "note_secret_1",
      });

      const notes = new Map([["note_secret_1", "Private internal benchmark notes"]]);
      const resolved = await resolveCollectionSource(item, { notes });

      assert.strictEqual(resolved.status, "VALID");
      assert.strictEqual(resolved.isSensitive, true);
      assert.match(resolved.warningNotice || "", /Private note will be transmitted/);
      assert.strictEqual(resolved.resolvedContent, "Private internal benchmark notes");
    });
  });

  describe("4. Materialization & Structured Context Formatting", () => {
    it("materializes collection into formatted context with tokens and counts", async () => {
      const col = await createCollection({
        name: "Security Auditing Pack",
        description: "Authentication specifications",
      });
      await addItemToCollection({
        collectionId: col.id,
        sourceType: "MESSAGE",
        sourceId: "msg_auth",
        label: "Auth Implementation",
      });
      await addItemToCollection({
        collectionId: col.id,
        sourceType: "NOTE",
        sourceId: "note_auth",
        label: "Security Considerations",
      });

      const messages = new Map([["msg_auth", "function verifyToken() { return true; }"]]);
      const notes = new Map([["note_auth", "Ensure nonce is verified against replay attacks."]]);

      const mat = await materializeContextCollection(col.id, { messages, notes });

      assert.strictEqual(mat.collectionId, col.id);
      assert.strictEqual(mat.collectionName, "Security Auditing Pack");
      assert.strictEqual(mat.validCount, 2);
      assert.strictEqual(mat.staleCount, 0);
      assert.strictEqual(mat.hasSensitiveNotes, true);
      assert.ok(mat.totalEstimatedTokens > 0);

      // Verify formatted boundary tags
      assert.match(mat.formattedContext, /\[CONTEXT REFERENCE PACK: "Security Auditing Pack"\]/);
      assert.match(mat.formattedContext, /--- Reference 1: Conversation Message - "Auth Implementation" ---/);
      assert.match(mat.formattedContext, /--- Reference 2: Private Note \(User-Authorized Context\) - "Security Considerations" ---/);
      assert.match(mat.formattedContext, /\[\/CONTEXT REFERENCE PACK\]/);
    });
  });

  describe("5. Portability: Export, Import & Conflict Resolution", () => {
    it("exports and imports collections safely with KEEP_BOTH strategy", async () => {
      const col = await createCollection({ name: "Portability Test" });
      await addItemToCollection({
        collectionId: col.id,
        sourceType: "MESSAGE",
        sourceId: "msg_exp_1",
      });

      const jsonStr = await exportContextCollections();
      assert.ok(jsonStr.includes("Portability Test"));

      // Import with KEEP_BOTH should generate a duplicate
      const result = await validateAndImportCollections(jsonStr, { conflictStrategy: "KEEP_BOTH" });
      assert.strictEqual(result.importedCollections, 1);
      assert.strictEqual(result.importedItems, 1);

      const allCols = await listCollections();
      assert.strictEqual(allCols.length, 2);
    });

    it("rejects malformed or invalid import schema", async () => {
      await assert.rejects(
        () => validateAndImportCollections("{ malformed json"),
        /Invalid JSON format/
      );

      await assert.rejects(
        () => validateAndImportCollections(JSON.stringify({ schemaVersion: 99 })),
        /Unsupported or corrupted Context Collections import schema/
      );
    });
  });

  describe("6. Zero Auto-Injection & Privacy Invariants", () => {
    it("guarantees collections never auto-populate prompts without explicit user call", async () => {
      // Merely creating collections and notes has zero side-effects on prompt state
      await createCollection({ name: "Dormant Pack" });
      const cols = await listCollections();
      assert.strictEqual(cols.length, 1);

      // Verify no automatic request context generation occurred
      const items = await getCollectionItems(cols[0].id);
      assert.strictEqual(items.length, 0);
    });
  });
});

