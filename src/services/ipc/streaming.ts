// ============================================================================
// Nano Route - Streaming Transport IPC Service
// File: src/services/ipc/streaming.ts
// ============================================================================
// Authoritative frontend streaming service managing Rust-to-React channel transport.
// Enforces mandatory Rule 27: Channel handler attached BEFORE command invocation.
// Provides isolated StreamController handles, sequence validation, and disposal cleanup.
// ============================================================================

import { Channel } from "@tauri-apps/api/core";
import { safeInvoke, isTauriContext } from "./client.ts";
import { IPC_COMMANDS } from "./types.ts";
import type {
  StreamEvent,
  StreamDeltaEvent,
  StreamCompletedEvent,
  StreamCancelledEvent,
  StreamErrorEvent,
  StreamRequest,
  StreamStartResult,
} from "./types.ts";

// --- Stream ID Generator ---

let streamCounter = 0;

/**
 * Generates a strongly formatted StreamId for client-initiated streams.
 * Format: `strm_<timestamp>_<random>_<counter>`
 */
export function generateStreamId(): string {
  streamCounter = (streamCounter + 1) % 100000;
  const time = Date.now().toString(36);
  const rnd = Math.random().toString(36).substring(2, 7);
  return `strm_${time}_${rnd}_${streamCounter}`;
}

// --- Type Guarding & Unknown Event Safety ---

const KNOWN_EVENT_TYPES = new Set([
  "started",
  "delta",
  "metadata",
  "completed",
  "cancelled",
  "error",
]);

/**
 * Validates that an incoming channel message conforms to the StreamEvent contract.
 * Protects against malformed payloads or future extensions without crashing.
 */
export function isValidStreamEvent(event: unknown): event is StreamEvent {
  if (typeof event !== "object" || event === null) {
    return false;
  }

  const candidate = event as Record<string, unknown>;
  if (typeof candidate.type !== "string" || !KNOWN_EVENT_TYPES.has(candidate.type)) {
    return false;
  }

  if (typeof candidate.streamId !== "string" || typeof candidate.sequence !== "number") {
    return false;
  }

  return true;
}

// --- Active Stream Controller Abstraction ---

export interface StreamController {
  readonly streamId: string;
  cancel(): Promise<boolean>;
  onEvent(callback: (event: StreamEvent) => void): () => void;
  onDelta(callback: (text: string, sequence: number) => void): () => void;
  awaitCompletion(): Promise<StreamCompletedEvent | StreamCancelledEvent | StreamErrorEvent>;
  dispose(): void;
  isTerminal(): boolean;
}

// Registry of active controllers for correlation and mock testing
const activeControllers = new Map<string, StreamControllerImpl>();

class StreamControllerImpl implements StreamController {
  public readonly streamId: string;
  private eventListeners: Set<(event: StreamEvent) => void> = new Set();
  private deltaListeners: Set<(text: string, sequence: number) => void> = new Set();
  private terminalEvent: (StreamCompletedEvent | StreamCancelledEvent | StreamErrorEvent) | null = null;
  private completionPromise: Promise<StreamCompletedEvent | StreamCancelledEvent | StreamErrorEvent>;
  private resolveCompletion!: (event: StreamCompletedEvent | StreamCancelledEvent | StreamErrorEvent) => void;
  private expectedSequence: number = 0;
  private disposed: boolean = false;

  constructor(streamId: string) {
    this.streamId = streamId;
    this.completionPromise = new Promise((resolve) => {
      this.resolveCompletion = resolve;
    });
  }

  public handleIncomingEvent(rawEvent: unknown): void {
    if (this.disposed) return;

    if (!isValidStreamEvent(rawEvent)) {
      if (typeof rawEvent === "object" && rawEvent !== null && "type" in rawEvent) {
        // Safe diagnostic for future unrecognized stream event types
        console.warn(`[Streaming IPC] Unrecognized stream event type ignored: ${(rawEvent as { type: unknown }).type}`);
      } else {
        console.warn("[Streaming IPC] Malformed stream event ignored", rawEvent);
      }
      return;
    }

    const event = rawEvent as StreamEvent;

    // Sequence auditing
    if (event.sequence < this.expectedSequence) {
      console.warn(
        `[Streaming IPC] Out-of-order sequence received for ${this.streamId}: expected >= ${this.expectedSequence}, got ${event.sequence}`
      );
    }
    this.expectedSequence = event.sequence + 1;

    // Deliver to listeners
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error("[Streaming IPC] Error in stream event listener", err);
      }
    }

    if (event.type === "delta") {
      const deltaEvent = event as StreamDeltaEvent;
      for (const dListener of this.deltaListeners) {
        try {
          dListener(deltaEvent.text, deltaEvent.sequence);
        } catch (err) {
          console.error("[Streaming IPC] Error in stream delta listener", err);
        }
      }
    }

    // Terminal handling (Completed, Cancelled, Error)
    if (event.type === "completed" || event.type === "cancelled" || event.type === "error") {
      if (!this.terminalEvent) {
        this.terminalEvent = event;
        this.resolveCompletion(event);
        // Automatic cleanup from active map
        activeControllers.delete(this.streamId);
      }
    }
  }

  public onEvent(callback: (event: StreamEvent) => void): () => void {
    if (this.disposed) return () => {};
    this.eventListeners.add(callback);
    return () => {
      this.eventListeners.delete(callback);
    };
  }

  public onDelta(callback: (text: string, sequence: number) => void): () => void {
    if (this.disposed) return () => {};
    this.deltaListeners.add(callback);
    return () => {
      this.deltaListeners.delete(callback);
    };
  }

  public async awaitCompletion(): Promise<StreamCompletedEvent | StreamCancelledEvent | StreamErrorEvent> {
    return this.completionPromise;
  }

  public async cancel(): Promise<boolean> {
    if (this.terminalEvent || this.disposed) return false;
    return cancelStream(this.streamId);
  }

  public isTerminal(): boolean {
    return this.terminalEvent !== null || this.disposed;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.eventListeners.clear();
    this.deltaListeners.clear();
    activeControllers.delete(this.streamId);

    // If still pending, cooperatively signal cancel to native core
    if (!this.terminalEvent) {
      cancelStream(this.streamId).catch(() => {});
    }
  }
}

// --- Authoritative Streaming API ---

/**
 * Initiates an ordered streaming session via Tauri Channel.
 * Guarantees that the channel receiver is attached BEFORE invoking the Rust command.
 */
export async function startStream(request: StreamRequest): Promise<StreamController> {
  const streamId = request.streamId || generateStreamId();
  const normalizedRequest: StreamRequest = {
    ...request,
    streamId,
  };

  const controller = new StreamControllerImpl(streamId);
  activeControllers.set(streamId, controller);

  if (!isTauriContext()) {
    // Non-Tauri or test environment fallback
    return controller;
  }

  // 1. Create native Tauri channel
  const channel = new Channel<StreamEvent>();

  // 2. MANDATORY RULE 27: Attach handler BEFORE command invocation!
  channel.onmessage = (event: StreamEvent) => {
    controller.handleIncomingEvent(event);
  };

  // 3. Invoke native command passing the channel
  try {
    const result = await safeInvoke<StreamStartResult>(IPC_COMMANDS.START_STREAM, {
      request: normalizedRequest,
      channel,
    });

    if (!result.accepted) {
      controller.handleIncomingEvent({
        type: "error",
        streamId,
        sequence: 0,
        code: "STREAM_START_REJECTED",
        message: "Native core rejected stream startup",
        isRetryable: false,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    controller.handleIncomingEvent({
      type: "error",
      streamId,
      sequence: 0,
      code: "INVOKE_FAILED",
      message: msg,
      isRetryable: false,
    });
  }

  return controller;
}

/**
 * Signals cooperative cancellation for an active stream.
 */
export async function cancelStream(streamId: string): Promise<boolean> {
  if (!isTauriContext()) {
    // In headless/test mode, trigger cancelled event directly on the controller if active
    const ctrl = activeControllers.get(streamId);
    if (ctrl && !ctrl.isTerminal()) {
      ctrl.handleIncomingEvent({
        type: "cancelled",
        streamId,
        sequence: 9999,
        reason: "Cancelled by mock client",
      });
      return true;
    }
    return false;
  }

  try {
    const result = await safeInvoke<boolean>(IPC_COMMANDS.CANCEL_STREAM, {
      streamId,
    });
    return !!result;
  } catch {
    return false;
  }
}

// --- Test Mock Utilities ---

/**
 * Test utility: Simulates receiving an event for an active stream controller.
 */
export function mockDispatchStreamEvent(streamId: string, event: unknown): boolean {
  const controller = activeControllers.get(streamId);
  if (!controller) return false;
  controller.handleIncomingEvent(event);
  return true;
}

/**
 * Test utility: Clears all active stream controllers.
 */
export function clearActiveStreamControllers(): void {
  for (const ctrl of activeControllers.values()) {
    ctrl.dispose();
  }
  activeControllers.clear();
}
