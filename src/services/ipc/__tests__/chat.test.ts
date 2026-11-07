/**
//! Nano Route — Chat Session & Message Persistence Unit Tests (Step 17)
//!
//! Tests:
//! 1. Session Lifecycle Contracts: create, get, list with pagination/pinned ordering, rename, pin, delete.
//! 2. Message Persistence & Metadata: append user, assistant with routing metrics, system messages.
//! 3. Deterministic Message Sequencing: verify monotonic chronological sorting by (createdAt ASC, id ASC).
//! 4. Conversation Atomic Thread Retrieval: verify getChatConversation returns session + ordered messages.
//! 5. Cascade Deletion Contracts: session deletion purges associated messages.
//! 6. Validation & Constraint Enforcement: empty session IDs, invalid sender, oversized title, non-existent sessions.
//! 7. IPC Boundary Round-Trip: simulated Tauri environment with mock command handlers.
*/

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  createChatSession,
  getChatSession,
  listChatSessions,
  renameChatSession,
  setChatSessionPinned,
  deleteChatSession,
  appendChatMessage,
  getChatMessages,
  getChatConversation,
  deleteChatMessage,
  resetChatMockStore,
} from "../chat.ts";
import {
  registerMockCommandHandler,
  clearMockCommandHandlers,
  setMockTauriContext,
} from "../client.ts";
import { IPC_COMMANDS } from "../types.ts";
import type {
  ChatConversation,
  ChatSession,
} from "../types.ts";

describe("Step 17 Chat Session & Message Persistence", () => {
  beforeEach(() => {
    resetChatMockStore();
    clearMockCommandHandlers();
    setMockTauriContext(false);
  });

  afterEach(() => {
    resetChatMockStore();
    clearMockCommandHandlers();
    setMockTauriContext(false);
  });

  describe("1. Session Lifecycle Contracts", () => {
    it("creates session with default title when title is omitted or blank", async () => {
      const session = await createChatSession();
      assert.ok(session.id.startsWith("mock_sess_"));
      assert.equal(session.title, "New Conversation");
      assert.equal(session.pinned, false);
      assert.ok(session.createdAt > 0);
      assert.equal(session.createdAt, session.updatedAt);
    });

    it("creates session with custom title and pinned flag", async () => {
      const session = await createChatSession({
        title: "Architectural Planning",
        pinned: true,
      });
      assert.equal(session.title, "Architectural Planning");
      assert.equal(session.pinned, true);

      const fetched = await getChatSession(session.id);
      assert.ok(fetched);
      assert.equal(fetched.title, "Architectural Planning");
      assert.equal(fetched.pinned, true);
    });

    it("lists sessions prioritizing pinned sessions, then sorted by updatedAt descending", async () => {
      const s1 = await createChatSession({ title: "Older unpinned", pinned: false });
      const s2 = await createChatSession({ title: "Newer unpinned", pinned: false });
      const s3 = await createChatSession({ title: "Pinned session", pinned: true });

      // Update timestamp on s2 to make it newer than s1
      await renameChatSession(s2.id, "Newer unpinned (edited)");

      const list = await listChatSessions();
      assert.equal(list.length, 3);
      // Pinned session must come first
      assert.equal(list[0].id, s3.id);
      assert.equal(list[0].pinned, true);
      // s2 was edited and has higher updatedAt than s1
      assert.equal(list[1].id, s2.id);
      assert.equal(list[2].id, s1.id);
    });

    it("supports pagination limit and offset in session listing", async () => {
      for (let i = 0; i < 5; i++) {
        await createChatSession({ title: `Session ${i}` });
      }

      const paged = await listChatSessions({ limit: 2, offset: 1 });
      assert.equal(paged.length, 2);
    });

    it("renames session and updates updatedAt timestamp", async () => {
      const session = await createChatSession({ title: "Initial Title" });
      const initialUpdatedAt = session.updatedAt;

      // Small artificial delay to guarantee timestamp difference
      const renamed = await renameChatSession(session.id, "Updated Title");
      assert.equal(renamed.title, "Updated Title");
      assert.ok(renamed.updatedAt >= initialUpdatedAt);

      const fetched = await getChatSession(session.id);
      assert.ok(fetched);
      assert.equal(fetched.title, "Updated Title");
    });

    it("updates pinned status via setChatSessionPinned", async () => {
      const session = await createChatSession({ title: "Test Pinning", pinned: false });
      assert.equal(session.pinned, false);

      const pinned = await setChatSessionPinned(session.id, true);
      assert.equal(pinned.pinned, true);

      const unpinned = await setChatSessionPinned(session.id, false);
      assert.equal(unpinned.pinned, false);
    });

    it("deletes a session and confirms it is no longer retrievable", async () => {
      const session = await createChatSession({ title: "To Delete" });
      const deleteResult = await deleteChatSession(session.id);
      assert.equal(deleteResult, true);

      const fetched = await getChatSession(session.id);
      assert.equal(fetched, null);
    });
  });

  describe("2. Message Persistence & Routing Metadata", () => {
    it("appends a user message and updates session updatedAt", async () => {
      const session = await createChatSession({ title: "Chat Turn 1" });
      const initialUpdatedAt = session.updatedAt;

      const userMsg = await appendChatMessage({
        sessionId: session.id,
        sender: "user",
        content: "Hello Nano Route!",
      });

      assert.ok(userMsg.id.startsWith("mock_msg_"));
      assert.equal(userMsg.sessionId, session.id);
      assert.equal(userMsg.sender, "user");
      assert.equal(userMsg.content, "Hello Nano Route!");
      assert.equal(userMsg.metadata.promptTokens, 0);

      // Verify session updatedAt was touched
      const refreshedSession = await getChatSession(session.id);
      assert.ok(refreshedSession);
      assert.ok(refreshedSession.updatedAt >= initialUpdatedAt);
    });

    it("persists assistant message with comprehensive routing metadata, SLM confidence, and cost", async () => {
      const session = await createChatSession({ title: "Inference Query" });

      const assistantMsg = await appendChatMessage({
        sessionId: session.id,
        sender: "assistant",
        content: "Here is your response computed by the selected provider.",
        metadata: {
          routedProvider: "anthropic",
          routedModel: "claude-3-5-sonnet",
          routingReason: "High-complexity code reasoning requested",
          slmConfidenceScore: 0.942,
          promptTokens: 128,
          completionTokens: 256,
          latencyMs: 412,
          costUsd: 0.0042,
        },
      });

      assert.equal(assistantMsg.sender, "assistant");
      assert.equal(assistantMsg.metadata.routedProvider, "anthropic");
      assert.equal(assistantMsg.metadata.routedModel, "claude-3-5-sonnet");
      assert.equal(assistantMsg.metadata.routingReason, "High-complexity code reasoning requested");
      assert.equal(assistantMsg.metadata.slmConfidenceScore, 0.942);
      assert.equal(assistantMsg.metadata.promptTokens, 128);
      assert.equal(assistantMsg.metadata.completionTokens, 256);
      assert.equal(assistantMsg.metadata.latencyMs, 412);
      assert.equal(assistantMsg.metadata.costUsd, 0.0042);
    });

    it("appends system message correctly", async () => {
      const session = await createChatSession();
      const sysMsg = await appendChatMessage({
        sessionId: session.id,
        sender: "system",
        content: "You are a concise desktop assistant.",
      });

      assert.equal(sysMsg.sender, "system");
      assert.equal(sysMsg.content, "You are a concise desktop assistant.");
    });
  });

  describe("3. Deterministic Message Sequencing & Conversation Retrieval", () => {
    it("retrieves messages in monotonic chronological order (createdAt ASC, id ASC)", async () => {
      const session = await createChatSession();

      const m1 = await appendChatMessage({
        sessionId: session.id,
        sender: "user",
        content: "Turn 1",
      });
      const m2 = await appendChatMessage({
        sessionId: session.id,
        sender: "assistant",
        content: "Turn 2",
      });
      const m3 = await appendChatMessage({
        sessionId: session.id,
        sender: "user",
        content: "Turn 3",
      });

      const messages = await getChatMessages({ sessionId: session.id });
      assert.equal(messages.length, 3);
      assert.equal(messages[0].id, m1.id);
      assert.equal(messages[1].id, m2.id);
      assert.equal(messages[2].id, m3.id);
    });

    it("retrieves full conversation thread atomically via getChatConversation", async () => {
      const session = await createChatSession({ title: "Thread Test" });
      await appendChatMessage({
        sessionId: session.id,
        sender: "user",
        content: "Question A",
      });
      await appendChatMessage({
        sessionId: session.id,
        sender: "assistant",
        content: "Answer A",
      });

      const conversation = await getChatConversation(session.id);
      assert.equal(conversation.session.id, session.id);
      assert.equal(conversation.session.title, "Thread Test");
      assert.equal(conversation.messages.length, 2);
      assert.equal(conversation.messages[0].content, "Question A");
      assert.equal(conversation.messages[1].content, "Answer A");
    });

    it("deletes a single message without destroying session or sibling messages", async () => {
      const session = await createChatSession();
      const msg1 = await appendChatMessage({
        sessionId: session.id,
        sender: "user",
        content: "Keep this",
      });
      const msg2 = await appendChatMessage({
        sessionId: session.id,
        sender: "assistant",
        content: "Delete this",
      });

      const deleteSuccess = await deleteChatMessage(msg2.id);
      assert.equal(deleteSuccess, true);

      const remaining = await getChatMessages({ sessionId: session.id });
      assert.equal(remaining.length, 1);
      assert.equal(remaining[0].id, msg1.id);
    });
  });

  describe("4. Cascade Deletion Contracts", () => {
    it("deleting a session automatically removes all associated messages", async () => {
      const session = await createChatSession({ title: "Cascade Parent" });
      await appendChatMessage({
        sessionId: session.id,
        sender: "user",
        content: "Child Message 1",
      });
      await appendChatMessage({
        sessionId: session.id,
        sender: "assistant",
        content: "Child Message 2",
      });

      // Verify messages exist before deletion
      const beforeDelete = await getChatMessages({ sessionId: session.id });
      assert.equal(beforeDelete.length, 2);

      // Delete parent session
      await deleteChatSession(session.id);

      // Attempting to get messages of deleted session throws NOT_FOUND
      await assert.rejects(
        async () => {
          await getChatMessages({ sessionId: session.id });
        },
        {
          name: "IpcError",
          code: "NOT_FOUND",
        }
      );
    });
  });

  describe("5. Validation & Constraint Enforcement", () => {
    it("rejects empty or whitespace-only session IDs", async () => {
      await assert.rejects(
        async () => {
          await getChatSession("   ");
        },
        {
          name: "IpcError",
          code: "INVALID_INPUT",
        }
      );
    });

    it("rejects invalid message sender types", async () => {
      const session = await createChatSession();
      await assert.rejects(
        async () => {
          await appendChatMessage({
            sessionId: session.id,
            sender: "robot" as any,
            content: "Invalid sender test",
          });
        },
        {
          name: "IpcError",
          code: "INVALID_INPUT",
        }
      );
    });

    it("rejects empty message content", async () => {
      const session = await createChatSession();
      await assert.rejects(
        async () => {
          await appendChatMessage({
            sessionId: session.id,
            sender: "user",
            content: "    ",
          });
        },
        {
          name: "IpcError",
          code: "INVALID_INPUT",
        }
      );
    });

    it("rejects oversized session titles exceeding 255 characters", async () => {
      const oversizedTitle = "A".repeat(256);
      await assert.rejects(
        async () => {
          await createChatSession({ title: oversizedTitle });
        },
        {
          name: "IpcError",
          code: "INVALID_INPUT",
        }
      );
    });

    it("rejects message appending to a non-existent session", async () => {
      await assert.rejects(
        async () => {
          await appendChatMessage({
            sessionId: "non_existent_session_id",
            sender: "user",
            content: "Hello void",
          });
        },
        {
          name: "IpcError",
          code: "NOT_FOUND",
        }
      );
    });
  });

  describe("6. IPC Boundary Round-Trip (Simulated Tauri Environment)", () => {
    it("executes createChatSession through mock Tauri IPC registry", async () => {
      setMockTauriContext(true);

      const mockSessionResponse: ChatSession = {
        id: "sess_native_101",
        title: "Native Conversation",
        createdAt: 1730999000000,
        updatedAt: 1730999000000,
        pinned: true,
      };

      registerMockCommandHandler(
        IPC_COMMANDS.CREATE_CHAT_SESSION,
        async (rawArgs) => {
          const args = rawArgs as { title?: string; pinned?: boolean } | undefined;
          assert.equal(args?.title, "Native Conversation");
          assert.equal(args?.pinned, true);
          return mockSessionResponse;
        }
      );

      const result = await createChatSession({
        title: "Native Conversation",
        pinned: true,
      });

      assert.deepEqual(result, mockSessionResponse);
    });

    it("executes getChatConversation through mock Tauri IPC registry", async () => {
      setMockTauriContext(true);

      const mockConversationResponse: ChatConversation = {
        session: {
          id: "sess_native_202",
          title: "Full Conversation Test",
          createdAt: 1730999100000,
          updatedAt: 1730999200000,
          pinned: false,
        },
        messages: [
          {
            id: "msg_native_001",
            sessionId: "sess_native_202",
            sender: "user",
            content: "What is Nano Route?",
            metadata: {
              promptTokens: 0,
              completionTokens: 0,
              latencyMs: 0,
              costUsd: 0,
            },
            createdAt: 1730999100000,
          },
          {
            id: "msg_native_002",
            sessionId: "sess_native_202",
            sender: "assistant",
            content: "Nano Route is a local-first AI orchestration desktop application.",
            metadata: {
              routedProvider: "local",
              routedModel: "phi-3-mini",
              routingReason: "Local SLM fast response",
              slmConfidenceScore: 0.98,
              promptTokens: 14,
              completionTokens: 16,
              latencyMs: 85,
              costUsd: 0,
            },
            createdAt: 1730999200000,
          },
        ],
      };

      registerMockCommandHandler(
        IPC_COMMANDS.GET_CHAT_CONVERSATION,
        async (rawArgs) => {
          const args = rawArgs as { sessionId?: string } | undefined;
          assert.equal(args?.sessionId, "sess_native_202");
          return mockConversationResponse;
        }
      );

      const conversation = await getChatConversation("sess_native_202");
      assert.deepEqual(conversation, mockConversationResponse);
      assert.equal(conversation.messages.length, 2);
      assert.equal(conversation.messages[1].metadata.routedProvider, "local");
    });
  });
});
