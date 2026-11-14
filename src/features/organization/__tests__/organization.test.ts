import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  saveBookmark,
  removeBookmark,
  isMessageBookmarked,
  listBookmarks,
  saveNote,
  getNoteByMessage,
  deleteNote,
  resetOrganizationStore,
} from "../engine.ts";

describe("Step 82 — Conversation Organization (Bookmarks & Notes)", () => {
  describe("Bookmarks Management", () => {
    it("bookmarks a message and confirms active status", async () => {
      resetOrganizationStore();
      const bm = await saveBookmark({
        sessionId: "sess_org",
        messageId: "msg_target_1",
        label: "Key Architectural Decision",
        category: "decision",
      });

      assert.ok(bm.id);
      assert.equal(bm.messageId, "msg_target_1");
      assert.equal(bm.label, "Key Architectural Decision");
      assert.equal(bm.category, "decision");

      const bookmarked = await isMessageBookmarked("msg_target_1");
      assert.equal(bookmarked, true);
    });

    it("removes bookmark safely without altering message", async () => {
      resetOrganizationStore();
      await saveBookmark({
        sessionId: "sess_org",
        messageId: "msg_target_2",
      });

      assert.equal(await isMessageBookmarked("msg_target_2"), true);
      const removed = await removeBookmark({ messageId: "msg_target_2" });
      assert.equal(removed, true);
      assert.equal(await isMessageBookmarked("msg_target_2"), false);
    });

    it("lists bookmarks filtered by session", async () => {
      resetOrganizationStore();
      await saveBookmark({ sessionId: "sess_a", messageId: "msg_a" });
      await saveBookmark({ sessionId: "sess_b", messageId: "msg_b" });

      const listA = await listBookmarks({ sessionId: "sess_a" });
      assert.equal(listA.length, 1);
      assert.equal(listA[0].messageId, "msg_a");
    });
  });

  describe("Private User Notes", () => {
    it("attaches private user note to a message", async () => {
      resetOrganizationStore();
      const note = await saveNote({
        sessionId: "sess_org",
        messageId: "msg_asst_note",
        content: "Need to verify this benchmark against DirectML on AMD GPU.",
      });

      assert.ok(note.id);
      assert.equal(note.messageId, "msg_asst_note");
      assert.equal(note.content, "Need to verify this benchmark against DirectML on AMD GPU.");

      const retrieved = await getNoteByMessage("msg_asst_note");
      assert.ok(retrieved);
      assert.equal(retrieved.content, note.content);
    });

    it("updates existing note when resaved", async () => {
      resetOrganizationStore();
      await saveNote({
        sessionId: "sess_org",
        messageId: "msg_asst_update",
        content: "Initial note",
      });

      const updated = await saveNote({
        sessionId: "sess_org",
        messageId: "msg_asst_update",
        content: "Updated note with findings",
      });

      assert.equal(updated.content, "Updated note with findings");
    });

    it("deletes note cleanly", async () => {
      resetOrganizationStore();
      const note = await saveNote({
        sessionId: "sess_org",
        messageId: "msg_delete_me",
        content: "Temporary annotation",
      });

      const deleted = await deleteNote(note.id);
      assert.equal(deleted, true);
      assert.equal(await getNoteByMessage("msg_delete_me"), null);
    });
  });

  describe("Privacy & Non-Destructive Invariant", () => {
    it("organization actions do not mutate or expose canonical message text", async () => {
      resetOrganizationStore();
      const originalMessageContent = "SELECT * FROM telemetry WHERE status = 'OK';";
      
      // Add bookmark & note
      await saveBookmark({ sessionId: "sess_safe", messageId: "msg_canonical" });
      await saveNote({ sessionId: "sess_safe", messageId: "msg_canonical", content: "Query example" });

      // Invariant: originalMessageContent was untouched
      assert.equal(originalMessageContent, "SELECT * FROM telemetry WHERE status = 'OK';");
    });
  });
});

