import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createConversationBranch,
  listConversationBranches,
  registerResponseVariant,
  listResponseVariants,
  setPreferredVariant,
  resetConversationStore,
} from "../engine.ts";

describe("Step 81 — Conversation Branching & Response Variants Subsystem", () => {
  describe("Conversation Branching", () => {
    it("creates a non-destructive continuation branch", async () => {
      resetConversationStore();
      const branch = await createConversationBranch({
        sessionId: "sess_main",
        rootMessageId: "msg_user_1",
        name: "Explore Python implementation",
      });

      assert.ok(branch.id);
      assert.equal(branch.sessionId, "sess_main");
      assert.equal(branch.rootMessageId, "msg_user_1");
      assert.equal(branch.name, "Explore Python implementation");
      assert.equal(branch.parentBranchId, null);
    });

    it("lists all branches belonging to a session in chronological order", async () => {
      resetConversationStore();
      await createConversationBranch({
        sessionId: "sess_multi",
        rootMessageId: "msg_1",
        name: "Branch A",
      });
      await createConversationBranch({
        sessionId: "sess_multi",
        rootMessageId: "msg_2",
        name: "Branch B",
      });

      const branches = await listConversationBranches("sess_multi");
      assert.equal(branches.length, 2);
      assert.equal(branches[0].name, "Branch A");
      assert.equal(branches[1].name, "Branch B");
    });
  });

  describe("Response Variants Management", () => {
    it("registers multiple assistant response variants for a user prompt", async () => {
      resetConversationStore();
      const var1 = await registerResponseVariant("msg_user_10", "msg_asst_1");
      const var2 = await registerResponseVariant("msg_user_10", "msg_asst_2");

      assert.equal(var1.variantIndex, 1);
      assert.equal(var1.isPreferred, true); // First registered is preferred by default
      assert.equal(var2.variantIndex, 2);
      assert.equal(var2.isPreferred, false);

      const all = await listResponseVariants("msg_user_10");
      assert.equal(all.length, 2);
    });

    it("sets preferred variant deterministically without mutating prior records", async () => {
      resetConversationStore();
      const var1 = await registerResponseVariant("msg_user_20", "msg_asst_10");
      const var2 = await registerResponseVariant("msg_user_20", "msg_asst_20");

      const success = await setPreferredVariant("msg_user_20", var2.id);
      assert.equal(success, true);

      const variants = await listResponseVariants("msg_user_20");
      const v1 = variants.find((v) => v.id === var1.id);
      const v2 = variants.find((v) => v.id === var2.id);

      assert.equal(v1?.isPreferred, false);
      assert.equal(v2?.isPreferred, true);
    });
  });

  describe("Non-Destructive Lineage Guarantees", () => {
    it("preserves historical messages completely when new variants are generated", async () => {
      resetConversationStore();
      await registerResponseVariant("msg_user_30", "asst_original");
      await registerResponseVariant("msg_user_30", "asst_regenerated");

      const list = await listResponseVariants("msg_user_30");
      assert.equal(list.length, 2);
      assert.ok(list.some((v) => v.assistantMessageId === "asst_original"));
      assert.ok(list.some((v) => v.assistantMessageId === "asst_regenerated"));
    });
  });
});

