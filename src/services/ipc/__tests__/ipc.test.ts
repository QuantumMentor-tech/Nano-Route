/**
//! Nano Route — IPC Architecture Unit & Contract Tests
//!
//! Tests:
//! 1. Request ID generation and flow.
//! 2. Error normalization and sanitization (stripping paths, keys).
//! 3. Command input validation (empty/oversized rejection).
//! 4. Typed command execution via mock IPC.
//! 5. Event subscription, delivery, unlisten cleanup, and duplicate listener prevention.
//! 6. Channel ordered chunk consumption and error handling.
//! 7. Transport unavailable error handling in browser context.
*/

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  generateRequestId,
  safeInvoke,
  registerMockCommandHandler,
  clearMockCommandHandlers,
  setMockTauriContext,
  isTauriContext,
} from "../client.ts";
import {
  IpcError,
  normalizeIpcError,
  sanitizeErrorMessage,
} from "../errors.ts";
import {
  pingNative,
  validatePingMessage,
  checkNativeHealth,
  getNativeHealthReport,
  getNativeAppInfo,
  MAX_PING_MESSAGE_LEN,
} from "../commands.ts";
import {
  IPC_EVENTS,
  subscribeToEvent,
  emitMockEvent,
  clearMockEventListeners,
} from "../events.ts";
import {
  createChannelConsumer,
  PLANNED_CHANNELS,
} from "../channels.ts";
import type {
  IpcPingResponse,
  NativeHealthReport,
  NativeAppInfo,
  ChannelStreamChunk,
} from "../types.ts";

describe("Step 12 Secure Tauri IPC Command & Event Architecture", () => {
  beforeEach(() => {
    clearMockCommandHandlers();
    clearMockEventListeners();
    setMockTauriContext(null); // Reset context override
  });

  afterEach(() => {
    clearMockCommandHandlers();
    clearMockEventListeners();
    setMockTauriContext(null);
  });

  describe("Request ID Generation and Flow", () => {
    it("generates unique correlation IDs with req_ prefix", () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();
      assert.ok(id1.startsWith("req_"));
      assert.ok(id2.startsWith("req_"));
      assert.notEqual(id1, id2);
    });

    it("reports context correctly with mock overrides", () => {
      setMockTauriContext(true);
      assert.equal(isTauriContext(), true);
      setMockTauriContext(false);
      assert.equal(isTauriContext(), false);
      setMockTauriContext(null);
      assert.equal(typeof isTauriContext(), "boolean");
    });
  });

  describe("IPC Error Normalization & Sanitization", () => {
    it("redacts Windows and POSIX filesystem paths from error messages", () => {
      const rawWindows = "Failed to open config at C:\\Users\\Admin\\AppData\\secret.json";
      const sanitizedWindows = sanitizeErrorMessage(rawWindows);
      assert.ok(!sanitizedWindows.includes("C:\\Users\\Admin"));
      assert.ok(sanitizedWindows.includes("[REDACTED_PATH]"));

      const rawPosix = "File not found at /Users/john/work/keys.pem";
      const sanitizedPosix = sanitizeErrorMessage(rawPosix);
      assert.ok(!sanitizedPosix.includes("/Users/john"));
      assert.ok(sanitizedPosix.includes("[REDACTED_PATH]"));
    });

    it("redacts bearer tokens and API keys from error messages", () => {
      const rawSecret = "API call failed with Bearer sk-ant-api03-abcdef123456789 and api_key=xyz987654321";
      const sanitized = sanitizeErrorMessage(rawSecret);
      assert.ok(!sanitized.includes("sk-ant-api03"));
      assert.ok(!sanitized.includes("xyz987654321"));
      assert.ok(sanitized.includes("[REDACTED_SECRET]"));
    });

    it("normalizes Rust AppError string representation into typed IpcError", () => {
      const rawErr = "Service unavailable: Database connection pool exhausted";
      const normalized = normalizeIpcError(rawErr, "cmd_query");
      assert.equal(normalized.category, "ServiceUnavailable");
      assert.equal(normalized.code, "SERVICE_UNAVAILABLE");
      assert.equal(normalized.retryable, true);
      assert.ok(normalized.message.includes("[cmd_query]"));
    });

    it("normalizes serialized JSON AppError into typed IpcError", () => {
      const rawErrObj = {
        kind: "InvalidInput",
        message: "Message exceeds 256 bytes",
      };
      const normalized = normalizeIpcError(rawErrObj, "cmd_ping", "req_test_01");
      assert.equal(normalized.category, "InvalidInput");
      assert.equal(normalized.code, "INVALID_INPUT");
      assert.equal(normalized.userActionRequired, true);
      assert.equal(normalized.requestId, "req_test_01");
    });
  });

  describe("Command Input Validation", () => {
    it("accepts valid ping messages within length boundary", () => {
      assert.doesNotThrow(() => validatePingMessage("Valid diagnostic ping"));
    });

    it("rejects empty or whitespace-only messages", () => {
      assert.throws(
        () => validatePingMessage("   "),
        (err: unknown) => {
          assert.ok(err instanceof IpcError);
          assert.equal(err.code, "INVALID_INPUT");
          return true;
        }
      );
    });

    it("rejects messages exceeding MAX_PING_MESSAGE_LEN", () => {
      const oversized = "x".repeat(MAX_PING_MESSAGE_LEN + 1);
      assert.throws(
        () => validatePingMessage(oversized),
        (err: unknown) => {
          assert.ok(err instanceof IpcError);
          assert.equal(err.code, "INVALID_INPUT");
          assert.equal(err.category, "InvalidInput");
          return true;
        }
      );
    });
  });

  describe("Mock IPC Integration & Command Round-Trip", () => {
    it("executes typed ping command through mock registry with correlation ID", async () => {
      setMockTauriContext(true);

      registerMockCommandHandler<IpcPingResponse>("cmd_ping", (args) => {
        const req = (args as { request: { message: string; requestId?: string } })?.request;
        return {
          message: req.message,
          requestId: req.requestId || "req_fallback",
          timestamp: "2026-11-07T15:00:00Z",
          durationMs: 4,
        };
      });

      const response = await pingNative("Hello Core", "req_custom_99");
      assert.equal(response.message, "Hello Core");
      assert.equal(response.requestId, "req_custom_99");
      assert.equal(response.durationMs, 4);
    });

    it("correctly queries typed health report via IPC", async () => {
      setMockTauriContext(true);

      const mockReport: NativeHealthReport = {
        status: "Ready",
        message: "All subsystems operational",
        subsystems: [
          { name: "SLM Runtime", ready: true, details: "Loaded" },
          { name: "SQLite DB", ready: true, details: "Connected" },
        ],
        timestamp: "2026-11-07T15:00:00Z",
      };

      registerMockCommandHandler<NativeHealthReport>("cmd_get_health", () => mockReport);

      const report = await getNativeHealthReport();
      assert.ok(report !== null);
      assert.equal(report?.status, "Ready");
      assert.equal(report?.subsystems.length, 2);
    });

    it("correctly queries typed app info via IPC", async () => {
      setMockTauriContext(true);

      const mockAppInfo: NativeAppInfo = {
        name: "Nano Route",
        version: "0.1.0",
        environment: "production",
        target_os: "windows",
        arch: "x86_64",
      };

      registerMockCommandHandler<NativeAppInfo>("cmd_get_app_info", () => mockAppInfo);

      const info = await getNativeAppInfo();
      assert.ok(info !== null);
      assert.equal(info?.name, "Nano Route");
      assert.equal(info?.target_os, "windows");
    });

    it("fails with TRANSPORT_UNAVAILABLE when invoked outside Tauri without mock", async () => {
      setMockTauriContext(false);

      await assert.rejects(
        async () => {
          await safeInvoke("cmd_unmocked");
        },
        (err: unknown) => {
          assert.ok(err instanceof IpcError);
          assert.equal(err.code, "TRANSPORT_UNAVAILABLE");
          assert.equal(err.category, "ServiceUnavailable");
          return true;
        }
      );
    });

    it("preserves backward compatibility of checkNativeHealth in browser mode", async () => {
      setMockTauriContext(false);
      const res = await checkNativeHealth();
      assert.equal(res.isNative, false);
      assert.ok(res.status.includes("Browser Dev Mode"));
    });
  });

  describe("Event Architecture & Lifecycle Cleanup", () => {
    it("subscribes to typed events and invokes callback on emitted payloads", async () => {
      setMockTauriContext(false); // browser/test mock mode

      const received: string[] = [];
      const unlisten = await subscribeToEvent(IPC_EVENTS.APP_LIFECYCLE_CHANGED, (payload) => {
        received.push(payload.state);
      });

      emitMockEvent(IPC_EVENTS.APP_LIFECYCLE_CHANGED, {
        state: "INITIALIZED",
        timestamp: new Date().toISOString(),
      });

      assert.equal(received.length, 1);
      assert.equal(received[0], "INITIALIZED");

      // Verify unlisten removes listener and prevents subsequent calls
      unlisten();

      emitMockEvent(IPC_EVENTS.APP_LIFECYCLE_CHANGED, {
        state: "TERMINATED",
        timestamp: new Date().toISOString(),
      });

      assert.equal(received.length, 1); // unchanged
    });

    it("prevents duplicate listener accumulation during repeated subscriptions and cleanups", async () => {
      setMockTauriContext(false);

      let callCount = 0;
      const callback = () => {
        callCount++;
      };

      // Mount 1
      const unlisten1 = await subscribeToEvent(IPC_EVENTS.DIAGNOSTIC_NOTIFICATION, callback);
      emitMockEvent(IPC_EVENTS.DIAGNOSTIC_NOTIFICATION, {
        level: "info",
        message: "Test 1",
        timestamp: new Date().toISOString(),
      });
      assert.equal(callCount, 1);

      // Unmount 1
      unlisten1();

      // Mount 2 (remount simulation)
      const unlisten2 = await subscribeToEvent(IPC_EVENTS.DIAGNOSTIC_NOTIFICATION, callback);
      emitMockEvent(IPC_EVENTS.DIAGNOSTIC_NOTIFICATION, {
        level: "info",
        message: "Test 2",
        timestamp: new Date().toISOString(),
      });
      // Should have been called exactly 1 more time (total 2), proving no duplicate listeners
      assert.equal(callCount, 2);

      // Unmount 2
      unlisten2();

      emitMockEvent(IPC_EVENTS.DIAGNOSTIC_NOTIFICATION, {
        level: "info",
        message: "Test 3",
        timestamp: new Date().toISOString(),
      });
      // Listener cleanly detached, callCount remains 2
      assert.equal(callCount, 2);
    });
  });

  describe("Channel Foundation Contracts", () => {
    it("registers planned channels for Step 14-16 streaming", () => {
      assert.equal(PLANNED_CHANNELS.length, 3);
      const names = PLANNED_CHANNELS.map((c) => c.channelName);
      assert.ok(names.includes("chat_token_stream"));
      assert.ok(names.includes("slm_inference_stream"));
      assert.ok(names.includes("model_download_stream"));
    });

    it("processes ordered chunks sequentially and calls completion callback", () => {
      const receivedChunks: string[] = [];
      let completed = false;

      const consumer = createChannelConsumer<string>(
        (chunk) => {
          receivedChunks.push(chunk.data);
        },
        {
          onComplete: () => {
            completed = true;
          },
        }
      );

      const chunk0: ChannelStreamChunk<string> = {
        chunkIndex: 0,
        data: "Hello ",
        isFinal: false,
        requestId: "req_stream_1",
      };
      const chunk1: ChannelStreamChunk<string> = {
        chunkIndex: 1,
        data: "Streaming ",
        isFinal: false,
        requestId: "req_stream_1",
      };
      const chunk2: ChannelStreamChunk<string> = {
        chunkIndex: 2,
        data: "World!",
        isFinal: true,
        requestId: "req_stream_1",
      };

      consumer(chunk0);
      consumer(chunk1);
      consumer(chunk2);

      assert.equal(receivedChunks.join(""), "Hello Streaming World!");
      assert.equal(completed, true);
    });
  });
});
