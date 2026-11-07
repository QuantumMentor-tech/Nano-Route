/**
//! Nano Route — Channel Architecture & Streaming Contracts
//!
//! Responsibility:
//! - Defines future-safe streaming channel abstractions and contracts.
//! - Enforces the boundary rule:
//!     * Commands: Request/Response (unary operations)
//!     * Events: Low-volume application state notifications
//!     * Channels: High-throughput, ordered token and progress streaming
//!
//! NOTE: Actual AI streaming implementation belongs to Step 15 (Chat & Streaming Engine).
//! This module establishes the transport foundation and contract typing.
*/

import type {
  ChannelDescriptor,
  ChannelStreamChunk,
  StreamConsumer,
} from "./types.ts";

/**
 * Authoritative registry of planned streaming channels for future roadmap steps.
 */
export const PLANNED_CHANNELS: readonly ChannelDescriptor[] = [
  {
    channelName: "chat_token_stream",
    purpose: "High-frequency token streaming from external AI providers",
    direction: "RustToFrontend",
    dataType: "TokenChunk",
    plannedStep: 15,
  },
  {
    channelName: "slm_inference_stream",
    purpose: "Real-time token streaming from locally executed Small Language Model",
    direction: "RustToFrontend",
    dataType: "TokenChunk",
    plannedStep: 16,
  },
  {
    channelName: "model_download_stream",
    purpose: "High-throughput binary download progress for SLM weights",
    direction: "RustToFrontend",
    dataType: "DownloadProgressChunk",
    plannedStep: 14,
  },
] as const;

/**
 * Creates an ordered channel chunk receiver for handling incoming streaming data.
 * Validates chunk sequence order and detects completion.
 */
export function createChannelConsumer<T>(
  onChunk: StreamConsumer<T>,
  options?: {
    onComplete?: () => void;
    onError?: (err: Error) => void;
  }
) {
  let expectedIndex = 0;

  return (chunk: ChannelStreamChunk<T>) => {
    if (chunk.chunkIndex < expectedIndex) {
      console.warn(`[Channel Warning] Out-of-order chunk received: expected ${expectedIndex}, got ${chunk.chunkIndex}`);
    }
    expectedIndex = chunk.chunkIndex + 1;

    try {
      onChunk(chunk);
    } catch (err) {
      options?.onError?.(err instanceof Error ? err : new Error(String(err)));
    }

    if (chunk.isFinal) {
      options?.onComplete?.();
    }
  };
}
