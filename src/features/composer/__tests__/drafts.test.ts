import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getComposerDraft,
  saveComposerDraft,
  clearComposerDraft,
  listAllComposerDrafts,
  markDraftAsRecovered,
  resetComposerDraftStore,
} from "../engine.ts";
import { evaluateContextPreflight } from "../../context/engine.ts";

describe("Step 78 — Composer Draft Persistence & Recovery Subsystem", () => {
  describe("Draft Persistence & Revision Tracking", () => {
    it("persists a new draft for a session with revision 1", async () => {
      resetComposerDraftStore();
      const draft = await saveComposerDraft({
        sessionId: "sess_123",
        content: "Drafting an in-depth query on Rust lifetime syntax...",
      });

      assert.ok(draft.id);
      assert.equal(draft.sessionId, "sess_123");
      assert.equal(draft.content, "Drafting an in-depth query on Rust lifetime syntax...");
      assert.equal(draft.revision, 1);
      assert.equal(draft.isRecovered, false);

      const retrieved = await getComposerDraft("sess_123");
      assert.ok(retrieved);
      assert.equal(retrieved.content, draft.content);
    });

    it("increments revision monotonically upon updates", async () => {
      resetComposerDraftStore();
      await saveComposerDraft({
        sessionId: "sess_456",
        content: "Initial draft text",
      });

      const updated = await saveComposerDraft({
        sessionId: "sess_456",
        content: "Updated draft text with more requirements",
      });

      assert.equal(updated.revision, 2);
      assert.equal(updated.content, "Updated draft text with more requirements");
    });

    it("clears draft when empty content is submitted", async () => {
      resetComposerDraftStore();
      await saveComposerDraft({
        sessionId: "sess_789",
        content: "Temporary text",
      });

      await saveComposerDraft({
        sessionId: "sess_789",
        content: "",
      });

      const retrieved = await getComposerDraft("sess_789");
      assert.equal(retrieved, null);
    });
  });

  describe("Global Scratchpad Drafts (Session-Independent)", () => {
    it("persists and retrieves global drafts when sessionId is null", async () => {
      resetComposerDraftStore();
      const draft = await saveComposerDraft({
        sessionId: null,
        content: "Unassigned draft query",
      });

      assert.equal(draft.sessionId, null);
      const retrieved = await getComposerDraft(null);
      assert.ok(retrieved);
      assert.equal(retrieved.content, "Unassigned draft query");
    });
  });

  describe("Draft Recovery & Restart Lifecycle", () => {
    it("marks drafts as recovered accurately", async () => {
      resetComposerDraftStore();
      await saveComposerDraft({
        sessionId: "sess_crash",
        content: "Valuable prompt drafted before unexpected crash",
      });

      const recovered = await markDraftAsRecovered("sess_crash");
      assert.ok(recovered);
      assert.equal(recovered.isRecovered, true);

      const after = await getComposerDraft("sess_crash");
      assert.equal(after?.isRecovered, true);
    });

    it("lists all drafts across sessions", async () => {
      resetComposerDraftStore();
      await saveComposerDraft({ sessionId: "sess_a", content: "Draft A" });
      await saveComposerDraft({ sessionId: "sess_b", content: "Draft B" });
      await saveComposerDraft({ sessionId: null, content: "Draft Global" });

      const all = await listAllComposerDrafts();
      assert.equal(all.length, 3);
    });
  });

  describe("Explicit Clear & Discard Semantics", () => {
    it("deletes draft on explicit clear call", async () => {
      resetComposerDraftStore();
      await saveComposerDraft({ sessionId: "sess_discard", content: "Draft to discard" });
      const cleared = await clearComposerDraft("sess_discard");
      assert.equal(cleared, true);
      assert.equal(await getComposerDraft("sess_discard"), null);
    });
  });

  describe("Downstream Context & Preflight Isolation", () => {
    it("draft persistence never triggers token consumption or premature preflight rejection", () => {
      const draftText = "Please write a comprehensive guide on SQLite WAL mode.";
      const preflight = evaluateContextPreflight({
        providerId: "deepseek",
        modelId: "deepseek-chat",
        prompt: draftText,
        history: [],
      });

      assert.equal(preflight.allowed, true);
      assert.equal(preflight.classification, "SAFE");
    });
  });
});

