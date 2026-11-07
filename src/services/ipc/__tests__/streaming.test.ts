/**
//! Nano Route — Streaming Transport & Ordered IPC Unit Tests (Step 15)
//!
//! Tests:
//! 1. Stream Identification: generation, format, uniqueness.
//! 2. Event Validation & Discrimination: valid schemas, malformed schemas, unknown future types.
//! 3. Order Preservation & Sequence Audit: 100 sequential deltas received monotonically.
//! 4. Multiple Concurrent Streams: isolation of Stream A, B, and C with independent cancellation.
//! 5. Terminal Event Uniqueness: exactly one terminal event (Completed, Cancelled, Error).
//! 6. Cancellation Resilience: mid-stream cancel, repeated cancel, cancel unknown stream.
//! 7. Stream Controller Lifecycle & Disposal: listener unsubscription, cleanup.
//! 8. Empty Stream & Edge Cases: immediate completion without deltas.
*/

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  generateStreamId,
  isValidStreamEvent,
  startStream,
  cancelStream,
  mockDispatchStreamEvent,
  clearActiveStreamControllers,
} from "../streaming.ts";
import type {
  StreamEvent,
  StreamStartedEvent,
  StreamDeltaEvent,
  StreamCompletedEvent,
  StreamErrorEvent,
  StreamLifecycleState,
} from "../types.ts";

describe("Step 15 Streaming Transport & Ordered IPC Infrastructure", () => {
  beforeEach(() => {
    clearActiveStreamControllers();
  });

  describe("1. Stream Identification & Formatting", () => {
    it("generates unique, well-formed StreamId slugs", () => {
      const id1 = generateStreamId();
      const id2 = generateStreamId();

      assert.match(id1, /^strm_[a-z0-9]+_[a-z0-9]+_\d+$/);
      assert.match(id2, /^strm_[a-z0-9]+_[a-z0-9]+_\d+$/);
      assert.notEqual(id1, id2);
    });
  });

  describe("2. Event Validation & Discrimination", () => {
    it("validates well-formed stream events", () => {
      const deltaEvent: StreamDeltaEvent = {
        type: "delta",
        streamId: "strm_test_1",
        sequence: 1,
        text: "chunk",
      };
      assert.equal(isValidStreamEvent(deltaEvent), true);

      const completedEvent: StreamCompletedEvent = {
        type: "completed",
        streamId: "strm_test_1",
        sequence: 2,
        finishReason: "stop",
      };
      assert.equal(isValidStreamEvent(completedEvent), true);
    });

    it("rejects malformed payloads", () => {
      assert.equal(isValidStreamEvent(null), false);
      assert.equal(isValidStreamEvent("raw string"), false);
      assert.equal(isValidStreamEvent({}), false);
      assert.equal(isValidStreamEvent({ type: "delta" }), false); // missing streamId and sequence
      assert.equal(isValidStreamEvent({ type: "delta", streamId: "s1" }), false); // missing sequence
    });

    it("safely handles unknown future event types without crashing", async () => {
      const streamId = generateStreamId();
      const controller = await startStream({
        streamId,
        modelId: "test-model",
      });

      const receivedEvents: StreamEvent[] = [];
      controller.onEvent((ev) => receivedEvents.push(ev));

      // Dispatch an unknown future event (e.g. tool_started)
      const unknownEvent = {
        type: "tool_started",
        streamId,
        sequence: 1,
        toolName: "web_search",
      };
      const dispatched = mockDispatchStreamEvent(streamId, unknownEvent);
      assert.equal(dispatched, true);

      // Should not be admitted into received known events
      assert.equal(receivedEvents.length, 0);

      controller.dispose();
    });
  });

  describe("3. Order Preservation & 100-Delta Sequence Audit (Section 74)", () => {
    it("preserves exact monotonic order across 100 sequential deltas", async () => {
      const streamId = generateStreamId();
      const controller = await startStream({
        streamId,
        modelId: "test-model",
      });

      const receivedSequences: number[] = [];
      const receivedTexts: string[] = [];

      controller.onDelta((text, seq) => {
        receivedTexts.push(text);
        receivedSequences.push(seq);
      });

      // Emit Started
      mockDispatchStreamEvent(streamId, {
        type: "started",
        streamId,
        sequence: 0,
        timestampMs: Date.now(),
      } as StreamStartedEvent);

      // Emit 100 deltas sequentially
      for (let i = 1; i <= 100; i++) {
        mockDispatchStreamEvent(streamId, {
          type: "delta",
          streamId,
          sequence: i,
          text: `tok_${i} `,
        } as StreamDeltaEvent);
      }

      // Emit Completed
      mockDispatchStreamEvent(streamId, {
        type: "completed",
        streamId,
        sequence: 101,
        finishReason: "stop",
      } as StreamCompletedEvent);

      assert.equal(receivedSequences.length, 100);
      assert.equal(receivedTexts.length, 100);

      // Verify sequence is strictly 1..100
      for (let i = 0; i < 100; i++) {
        assert.equal(receivedSequences[i], i + 1);
        assert.equal(receivedTexts[i], `tok_${i + 1} `);
      }

      controller.dispose();
    });
  });

  describe("4. Multiple Concurrent Streams Isolation (Section 75)", () => {
    it("isolates Stream A, B, and C events and cancellations", async () => {
      const streamA = generateStreamId();
      const streamB = generateStreamId();
      const streamC = generateStreamId();

      const ctrlA = await startStream({ streamId: streamA, modelId: "model-a" });
      const ctrlB = await startStream({ streamId: streamB, modelId: "model-b" });
      const ctrlC = await startStream({ streamId: streamC, modelId: "model-c" });

      const deltasA: string[] = [];
      const deltasB: string[] = [];
      const deltasC: string[] = [];

      ctrlA.onDelta((t) => deltasA.push(t));
      ctrlB.onDelta((t) => deltasB.push(t));
      ctrlC.onDelta((t) => deltasC.push(t));

      // Emit events to A, B, C
      mockDispatchStreamEvent(streamA, { type: "delta", streamId: streamA, sequence: 1, text: "A1" });
      mockDispatchStreamEvent(streamB, { type: "delta", streamId: streamB, sequence: 1, text: "B1" });
      mockDispatchStreamEvent(streamC, { type: "delta", streamId: streamC, sequence: 1, text: "C1" });

      // Cancel only Stream B
      const cancelBResult = await ctrlB.cancel();
      assert.equal(cancelBResult, true);
      assert.equal(ctrlB.isTerminal(), true);

      // A and C must remain active
      assert.equal(ctrlA.isTerminal(), false);
      assert.equal(ctrlC.isTerminal(), false);

      // Emit more deltas to A and C
      mockDispatchStreamEvent(streamA, { type: "delta", streamId: streamA, sequence: 2, text: "A2" });
      mockDispatchStreamEvent(streamC, { type: "delta", streamId: streamC, sequence: 2, text: "C2" });

      assert.deepEqual(deltasA, ["A1", "A2"]);
      assert.deepEqual(deltasB, ["B1"]);
      assert.deepEqual(deltasC, ["C1", "C2"]);

      ctrlA.dispose();
      ctrlB.dispose();
      ctrlC.dispose();
    });
  });

  describe("5. Terminal Event Uniqueness & States (Section 76, 77)", () => {
    it("emits exactly one terminal event on successful stream", async () => {
      const streamId = generateStreamId();
      const controller = await startStream({ streamId, modelId: "m1" });

      let terminalCount = 0;
      controller.onEvent((ev) => {
        if (ev.type === "completed" || ev.type === "cancelled" || ev.type === "error") {
          terminalCount++;
        }
      });

      mockDispatchStreamEvent(streamId, { type: "delta", streamId, sequence: 1, text: "one" });
      mockDispatchStreamEvent(streamId, { type: "completed", streamId, sequence: 2, finishReason: "stop" });

      // Spurious second terminal event attempted
      mockDispatchStreamEvent(streamId, { type: "completed", streamId, sequence: 3, finishReason: "stop" });

      assert.equal(terminalCount, 1);
      assert.equal(controller.isTerminal(), true);
      controller.dispose();
    });

    it("emits exactly one terminal event on stream error", async () => {
      const streamId = generateStreamId();
      const controller = await startStream({ streamId, modelId: "m1" });

      let terminalCount = 0;
      let caughtError: StreamErrorEvent | null = null;

      controller.onEvent((ev) => {
        if (ev.type === "error") {
          terminalCount++;
          caughtError = ev;
        }
      });

      mockDispatchStreamEvent(streamId, {
        type: "error",
        streamId,
        sequence: 1,
        code: "SERVER_ERROR",
        message: "Upstream timeout",
        isRetryable: true,
      });

      assert.equal(terminalCount, 1);
      assert.notEqual(caughtError, null);
      const errPayload = caughtError as unknown as StreamErrorEvent;
      assert.equal(errPayload.code, "SERVER_ERROR");
      assert.equal(controller.isTerminal(), true);
      controller.dispose();
    });
  });

  describe("6. Cancellation Resilience (Section 61, 63, 77)", () => {
    it("handles double cancellation safely as a no-op", async () => {
      const streamId = generateStreamId();
      const controller = await startStream({ streamId, modelId: "m1" });

      const firstCancel = await controller.cancel();
      assert.equal(firstCancel, true);
      assert.equal(controller.isTerminal(), true);

      // Second cancel must return false without throw
      const secondCancel = await controller.cancel();
      assert.equal(secondCancel, false);

      controller.dispose();
    });

    it("cancelling an unknown stream ID returns false safely", async () => {
      const result = await cancelStream("strm_unknown_nonexistent");
      assert.equal(result, false);
    });
  });

  describe("7. Stream Controller Lifecycle & Disposal (Section 78)", () => {
    it("cleans up all listeners on dispose", async () => {
      const streamId = generateStreamId();
      const controller = await startStream({ streamId, modelId: "m1" });

      let deltaCount = 0;
      controller.onDelta(() => {
        deltaCount++;
      });

      mockDispatchStreamEvent(streamId, { type: "delta", streamId, sequence: 1, text: "d1" });
      assert.equal(deltaCount, 1);

      // Dispose controller
      controller.dispose();
      assert.equal(controller.isTerminal(), true);

      // Subsequent event must be ignored
      mockDispatchStreamEvent(streamId, { type: "delta", streamId, sequence: 2, text: "d2" });
      assert.equal(deltaCount, 1);
    });
  });

  describe("8. Empty Stream Handling (Section 58)", () => {
    it("handles empty stream directly with Started and Completed", async () => {
      const streamId = generateStreamId();
      const controller = await startStream({ streamId, modelId: "m1" });

      const events: StreamEvent[] = [];
      controller.onEvent((ev) => events.push(ev));

      mockDispatchStreamEvent(streamId, {
        type: "started",
        streamId,
        sequence: 0,
        timestampMs: Date.now(),
      });

      mockDispatchStreamEvent(streamId, {
        type: "completed",
        streamId,
        sequence: 1,
        finishReason: "stop",
        usage: { promptTokens: 5, completionTokens: 0, totalTokens: 5 },
      });

      assert.equal(events.length, 2);
      assert.equal(events[0].type, "started");
      assert.equal(events[1].type, "completed");
      assert.equal(controller.isTerminal(), true);

      controller.dispose();
    });
  });

  describe("9. Lifecycle State Machine Transitions", () => {
    function canTransition(current: StreamLifecycleState, next: StreamLifecycleState): boolean {
      if (["completed", "cancelled", "failed"].includes(current)) {
        return false;
      }
      switch (current) {
        case "created":
          return ["starting", "cancelled", "failed"].includes(next);
        case "starting":
          return ["streaming", "completed", "cancelled", "failed"].includes(next);
        case "streaming":
          return ["streaming", "completed", "cancelled", "failed"].includes(next);
        default:
          return false;
      }
    }

    it("permits standard forward transitions", () => {
      assert.equal(canTransition("created", "starting"), true);
      assert.equal(canTransition("starting", "streaming"), true);
      assert.equal(canTransition("streaming", "completed"), true);
    });

    it("forbids transitions out of terminal states", () => {
      assert.equal(canTransition("completed", "streaming"), false);
      assert.equal(canTransition("cancelled", "completed"), false);
      assert.equal(canTransition("failed", "cancelled"), false);
    });
  });
});
