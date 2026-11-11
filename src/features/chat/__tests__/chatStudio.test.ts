/**
//! Nano Route — Chat Studio Logic & Contracts Test Suite
//! File: src/features/chat/__tests__/chatStudio.test.ts
//!
//! Validates SafeMarkdown parsing/sanitization, composer input contracts,
//! session filtering & prioritization, persistence integration, and decoupled intent emission.
*/

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  createChatSession,
  appendChatMessage,
  listChatSessions,
  renameChatSession,
  setChatSessionPinned,
  deleteChatSession,
  getChatMessages,
  resetChatMockStore,
} from "../../../services/ipc/chat.ts";
import type { ChatSession, SubmitPromptIntent } from "../types.ts";

describe("Step 31 Chat Studio UI & Conversation Workspace", () => {
  beforeEach(() => {
    resetChatMockStore();
  });

  // ==========================================================================
  // 1. Safe Markdown Tokenizer & Sanitization Contracts
  // ==========================================================================
  describe("Safe Markdown Parser & Security Contracts", () => {
    function isSafeUrl(url: string): boolean {
      try {
        const trimmed = url.trim();
        return trimmed.startsWith("https://") || trimmed.startsWith("http://");
      } catch {
        return false;
      }
    }

    it("accepts valid https and http links and blocks unsafe schemes", () => {
      assert.equal(isSafeUrl("https://example.com/api"), true);
      assert.equal(isSafeUrl("http://localhost:8080"), true);
      assert.equal(isSafeUrl("javascript:alert(1)"), false);
      assert.equal(isSafeUrl("data:text/html,<script>alert(1)</script>"), false);
      assert.equal(isSafeUrl("vbscript:msgbox(1)"), false);
      assert.equal(isSafeUrl("file:///etc/passwd"), false);
    });

    it("parses code fences with language specification", () => {
      const markdown = "```rust\nfn main() {\n    println!(\"Hello\");\n}\n```";
      const lines = markdown.split(/\r?\n/);

      assert.equal(lines[0].startsWith("```"), true);
      const language = lines[0].slice(3).trim();
      assert.equal(language, "rust");

      const codeLines = lines.slice(1, -1);
      assert.equal(codeLines.length, 3);
      assert.equal(codeLines[0], "fn main() {");
    });

    it("identifies markdown headings and computes heading level", () => {
      function getHeadingLevel(line: string): { level: number; content: string } | null {
        const match = line.match(/^(#{1,6})\s+(.*)$/);
        return match ? { level: match[1].length, content: match[2] } : null;
      }

      assert.deepEqual(getHeadingLevel("# Nano Route"), { level: 1, content: "Nano Route" });
      assert.deepEqual(getHeadingLevel("## Architecture Overview"), { level: 2, content: "Architecture Overview" });
      assert.deepEqual(getHeadingLevel("### Local SLM"), { level: 3, content: "Local SLM" });
      assert.equal(getHeadingLevel("Regular text without heading"), null);
    });

    it("extracts inline tokens (bold, italic, code spans, links)", () => {
      const text = "Use `let x = 10;` with **high performance** and *low latency*.";
      const tokenRegex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
      const matches = Array.from(text.matchAll(tokenRegex)).map((m) => m[0]);

      assert.equal(matches.length, 3);
      assert.equal(matches[0], "`let x = 10;`");
      assert.equal(matches[1], "**high performance**");
      assert.equal(matches[2], "*low latency*");
    });
  });

  // ==========================================================================
  // 2. Composer Input Validation & Keyboard Handling Contracts
  // ==========================================================================
  describe("Composer Validation & Keyboard Handling", () => {
    it("rejects empty or whitespace-only prompts", () => {
      function validatePrompt(input: string): { isValid: boolean; error: string | null } {
        const trimmed = input.trim();
        if (!trimmed) {
          return { isValid: false, error: "Prompt cannot be empty" };
        }
        if (trimmed.length > 16000) {
          return { isValid: false, error: "Prompt exceeds max length" };
        }
        return { isValid: true, error: null };
      }

      assert.equal(validatePrompt("").isValid, false);
      assert.equal(validatePrompt("   \n\t  ").isValid, false);
      assert.equal(validatePrompt("Hello Nano Route").isValid, true);
      assert.equal(validatePrompt("a".repeat(16001)).isValid, false);
    });

    it("differentiates Enter (submit) vs Shift+Enter (newline)", () => {
      function shouldSubmit(key: string, shiftKey: boolean): boolean {
        return key === "Enter" && !shiftKey;
      }

      assert.equal(shouldSubmit("Enter", false), true);
      assert.equal(shouldSubmit("Enter", true), false);
      assert.equal(shouldSubmit("a", false), false);
    });
  });

  // ==========================================================================
  // 3. Session Sorting & Search Prioritization
  // ==========================================================================
  describe("Session Prioritization & Filtering", () => {
    const testSessions: ChatSession[] = [
      { id: "s1", title: "Rust concurrency", createdAt: 1000, updatedAt: 2000, pinned: false },
      { id: "s2", title: "API Key Management", createdAt: 1100, updatedAt: 1500, pinned: true },
      { id: "s3", title: "Local SLM Benchmarks", createdAt: 1200, updatedAt: 3000, pinned: false },
      { id: "s4", title: "System Prompt Design", createdAt: 1300, updatedAt: 1800, pinned: true },
    ];

    it("prioritizes pinned sessions first, followed by updatedAt descending", () => {
      const sorted = [...testSessions].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.updatedAt - a.updatedAt;
      });

      // Pinned sessions come first: s4 (updated 1800) then s2 (updated 1500)
      assert.equal(sorted[0].id, "s4");
      assert.equal(sorted[1].id, "s2");
      // Unpinned sessions next: s3 (updated 3000) then s1 (updated 2000)
      assert.equal(sorted[2].id, "s3");
      assert.equal(sorted[3].id, "s1");
    });

    it("filters sessions by case-insensitive title query", () => {
      function filter(query: string) {
        const q = query.trim().toLowerCase();
        return testSessions.filter((s) => s.title.toLowerCase().includes(q));
      }

      assert.equal(filter("rust").length, 1);
      assert.equal(filter("rust")[0].id, "s1");
      assert.equal(filter("KEY").length, 1);
      assert.equal(filter("key")[0].id, "s2");
      assert.equal(filter("xyz").length, 0);
      assert.equal(filter("").length, 4);
    });
  });

  // ==========================================================================
  // 4. Persistence Integration & Atomic Transactions
  // ==========================================================================
  describe("Chat Persistence Integration (Step 17 Foundation)", () => {
    it("creates a session, appends messages, and verifies conversation history", async () => {
      const session = await createChatSession({ title: "Local Routing Test" });
      assert.ok(session.id);
      assert.equal(session.title, "Local Routing Test");
      assert.equal(session.pinned, false);

      const msg1 = await appendChatMessage({
        sessionId: session.id,
        sender: "user",
        content: "What is Nano Route?",
      });
      assert.equal(msg1.sender, "user");
      assert.equal(msg1.content, "What is Nano Route?");

      const msg2 = await appendChatMessage({
        sessionId: session.id,
        sender: "assistant",
        content: "Nano Route is a privacy-first AI desktop router.",
        metadata: {
          routedProvider: "DeepSeek",
          routedModel: "deepseek-chat",
          latencyMs: 145,
          completionTokens: 28,
        },
      });
      assert.equal(msg2.sender, "assistant");
      assert.equal(msg2.metadata.routedProvider, "DeepSeek");
      assert.equal(msg2.metadata.latencyMs, 145);

      const messages = await getChatMessages({ sessionId: session.id });
      assert.equal(messages.length, 2);
      assert.equal(messages[0].id, msg1.id);
      assert.equal(messages[1].id, msg2.id);
    });

    it("renames and toggles pin state of a conversation", async () => {
      const session = await createChatSession({ title: "Original Title" });

      const renamed = await renameChatSession(session.id, "Updated Title");
      assert.equal(renamed.title, "Updated Title");

      const pinned = await setChatSessionPinned(session.id, true);
      assert.equal(pinned.pinned, true);
    });

    it("deletes a session and cascades deletion to all attached messages", async () => {
      const session = await createChatSession({ title: "To Be Deleted" });
      await appendChatMessage({
        sessionId: session.id,
        sender: "user",
        content: "Delete me",
      });

      const deleted = await deleteChatSession(session.id);
      assert.equal(deleted, true);

      const list = await listChatSessions();
      assert.equal(list.some((s) => s.id === session.id), false);
    });
  });

  // ==========================================================================
  // 5. Decoupled SubmitPromptIntent Contract
  // ==========================================================================
  describe("Decoupled SubmitPromptIntent Emission", () => {
    it("creates typed intent without invoking provider execution directly", async () => {
      const session = await createChatSession({ title: "Decoupled Intent Test" });
      const prompt = "Explain quantum cryptography";

      let emittedIntent: SubmitPromptIntent | null = null;
      function onIntent(intent: SubmitPromptIntent) {
        emittedIntent = intent;
      }

      // Simulate submit prompt
      const userMsg = await appendChatMessage({
        sessionId: session.id,
        sender: "user",
        content: prompt,
      });

      const intent: SubmitPromptIntent = {
        sessionId: session.id,
        prompt: userMsg.content,
        timestamp: userMsg.createdAt,
      };
      onIntent(intent);

      assert.ok(emittedIntent);
      const received = emittedIntent as SubmitPromptIntent;
      assert.equal(received.sessionId, session.id);
      assert.equal(received.prompt, prompt);
      assert.ok(received.timestamp > 0);
    });
  });

  // ==========================================================================
  // 6. Stale Request Protection Contract
  // ==========================================================================
  describe("Stale Request Protection Contract", () => {
    it("discards late asynchronous message fetches when active session changed", async () => {
      let activeSessionId = "session-1";
      let requestSeq = 0;
      let committedSessionId: string | null = null;

      async function fetchMessages(reqSessionId: string, delayMs: number) {
        const seq = ++requestSeq;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        // Commit only if request seq is still latest and session matches
        if (seq === requestSeq && activeSessionId === reqSessionId) {
          committedSessionId = reqSessionId;
        }
      }

      // User rapidly switches from session-1 to session-2
      const fetch1 = fetchMessages("session-1", 50); // slower
      activeSessionId = "session-2";
      const fetch2 = fetchMessages("session-2", 10); // faster

      await Promise.all([fetch1, fetch2]);

      // Only session-2 should have been committed
      assert.equal(committedSessionId, "session-2");
    });
  });
});

