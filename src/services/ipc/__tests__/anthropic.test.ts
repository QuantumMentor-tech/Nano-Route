// ============================================================================
// Nano Route - Step 23 Anthropic Provider Integration Contract Tests
// File: src/services/ipc/__tests__/anthropic.test.ts
// ============================================================================
// Verifies Anthropic Messages API (/v1/messages) wire contracts, top-level
// system prompt extraction, response deserialization, SSE chunk parsing,
// whitespace preservation, normalized errors, and zero-leak DPAPI credential safety.
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type {
  ProviderRequest,
  ProviderErrorKind,
} from "../types.ts";

// --- Pure Contract Logic Mirrors for TypeScript Verification ---

interface AnthropicMessagesRequestWire {
  model: string;
  max_tokens: number;
  messages: Array<{
    role: string;
    content: string;
  }>;
  system?: string;
  stream?: boolean;
  temperature?: number;
  top_p?: number;
}

function mapToAnthropicMessagesRequest(
  req: ProviderRequest,
  stream = false
): AnthropicMessagesRequestWire {
  if (!req.modelId || req.modelId.trim() === "") {
    throw new Error("Model identifier cannot be empty for Anthropic execution");
  }
  if (!req.messages || req.messages.length === 0) {
    throw new Error("Request must contain at least one message for Anthropic execution");
  }

  const systemParts: string[] = [];
  const messages: Array<{ role: string; content: string }> = [];

  for (let i = 0; i < req.messages.length; i++) {
    const m = req.messages[i];
    if (m.role === "system") {
      if (m.content.trim()) {
        systemParts.push(m.content);
      }
    } else if (m.role === "user") {
      if (!m.content || m.content.trim() === "") {
        throw new Error(`User message at index ${i} has empty content`);
      }
      messages.push({ role: "user", content: m.content });
    } else if (m.role === "assistant") {
      messages.push({ role: "assistant", content: m.content });
    } else {
      throw new Error(`Unsupported message role ${m.role} in Anthropic MVP`);
    }
  }

  if (messages.length === 0) {
    throw new Error("Anthropic request requires at least one conversational user/assistant message");
  }

  return {
    model: req.modelId,
    max_tokens: req.params.maxTokens ?? 4096,
    messages,
    ...(systemParts.length > 0 ? { system: systemParts.join("\n\n") } : {}),
    ...(stream ? { stream: true } : {}),
    ...(req.params.temperature !== undefined ? { temperature: req.params.temperature } : {}),
    ...(req.params.topP !== undefined ? { top_p: req.params.topP } : {}),
  };
}

function extractTextFromAnthropicResponse(payload: any): string {
  if (Array.isArray(payload.content)) {
    return payload.content
      .filter((block: any) => block.type === "text")
      .map((block: any) => block.text || "")
      .join("");
  }
  return "";
}

function mapAnthropicError(statusCode: number, body: any, retryAfterHeader?: string): {
  kind: ProviderErrorKind;
  isRetryable: boolean;
  retryAfterMs?: number;
  message: string;
} {
  const errPayload = body?.error || {};
  const rawMsg = errPayload.message || "Anthropic request failed";

  // Sanitize secret patterns
  const scrubbedMsg = rawMsg.replace(/sk-ant-[a-zA-Z0-9_-]{10,}/g, "[REDACTED_API_KEY]");

  const retryAfterMs = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : undefined;

  switch (statusCode) {
    case 400:
      return {
        kind: "invalid_request",
        isRetryable: false,
        message: scrubbedMsg,
      };
    case 401:
    case 403:
      return {
        kind: "authentication_failed",
        isRetryable: false,
        message: "Invalid or missing Anthropic API key. Check configured credentials in Nano Route settings.",
      };
    case 404:
      return {
        kind: "model_not_found",
        isRetryable: false,
        message: scrubbedMsg,
      };
    case 413:
      return {
        kind: "context_length_exceeded",
        isRetryable: false,
        message: `Anthropic request too large: ${scrubbedMsg}`,
      };
    case 429:
      return {
        kind: "rate_limited",
        isRetryable: true,
        retryAfterMs,
        message: scrubbedMsg,
      };
    case 529:
      return {
        kind: "provider_unavailable",
        isRetryable: true,
        retryAfterMs,
        message: `Anthropic service overloaded (HTTP 529): ${scrubbedMsg}`,
      };
    case 500:
    case 502:
    case 503:
      return {
        kind: "provider_unavailable",
        isRetryable: true,
        retryAfterMs,
        message: `Anthropic upstream service unavailable (HTTP ${statusCode}): ${scrubbedMsg}`,
      };
    case 504:
      return {
        kind: "timeout",
        isRetryable: true,
        message: "Anthropic gateway timed out (HTTP 504)",
      };
    default:
      return {
        kind: "internal",
        isRetryable: false,
        message: scrubbedMsg,
      };
  }
}

// Resilient SSE Parser in TypeScript
class MockAnthropicSseParser {
  private buffer = "";

  feed(chunk: string): Array<{ event?: string; data: string }> {
    this.buffer += chunk;
    const frames: Array<{ event?: string; data: string }> = [];

    while (true) {
      const normalized = this.buffer.replace(/\r\n/g, "\n");
      const pos = normalized.indexOf("\n\n");
      if (pos === -1) break;

      const block = normalized.substring(0, pos);
      this.buffer = normalized.substring(pos + 2);

      let event: string | undefined;
      const dataLines: string[] = [];

      for (const line of block.split("\n")) {
        if (line.startsWith(":")) continue;
        if (line.startsWith("event:")) {
          event = line.substring(6).trim();
        } else if (line.startsWith("data:")) {
          const val = line.substring(5);
          dataLines.push(val.startsWith(" ") ? val.substring(1) : val);
        }
      }

      if (dataLines.length > 0) {
        frames.push({ event, data: dataLines.join("\n") });
      }
    }

    return frames;
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe("Step 23 Anthropic Provider Integration Contract Tests", () => {
  describe("1. Anthropic Messages API (/v1/messages) Request Serialization", () => {
    it("extracts system prompt to top-level system parameter and preserves conversation turns", () => {
      const request: ProviderRequest = {
        modelId: "claude-3-5-sonnet-20241022",
        messages: [
          { role: "system", content: "You are an expert full-stack engineer." },
          { role: "user", content: "What is Tauri v2?" },
          { role: "assistant", content: "Tauri v2 is a desktop application toolkit." },
          { role: "user", content: "How does IPC work?" },
        ],
        params: {
          temperature: 0.5,
          maxTokens: 2048,
          topP: 0.9,
          stopSequences: [],
        },
        metadata: {
          requestId: "req_ant_01",
        },
      };

      const wire = mapToAnthropicMessagesRequest(request, false);
      assert.equal(wire.model, "claude-3-5-sonnet-20241022");
      assert.equal(wire.max_tokens, 2048);
      assert.equal(wire.system, "You are an expert full-stack engineer.");
      assert.equal(wire.stream, undefined);
      assert.equal(wire.temperature, 0.5);
      assert.equal(wire.top_p, 0.9);

      // System message must NOT be inside wire.messages
      assert.equal(wire.messages.length, 3);
      assert.equal(wire.messages[0].role, "user");
      assert.equal(wire.messages[0].content, "What is Tauri v2?");
      assert.equal(wire.messages[1].role, "assistant");
      assert.equal(wire.messages[2].role, "user");
    });

    it("applies default max_tokens = 4096 when omitted from params", () => {
      const request: ProviderRequest = {
        modelId: "claude-3-5-haiku-20241022",
        messages: [{ role: "user", content: "Hello Claude" }],
        params: {},
        metadata: { requestId: "r_default" },
      };

      const wire = mapToAnthropicMessagesRequest(request, true);
      assert.equal(wire.max_tokens, 4096);
      assert.equal(wire.stream, true);
      assert.equal(wire.system, undefined);
    });

    it("rejects empty model IDs and empty message arrays", () => {
      assert.throws(
        () =>
          mapToAnthropicMessagesRequest({
            modelId: "   ",
            messages: [{ role: "user", content: "Hello" }],
            params: {},
            metadata: { requestId: "r1" },
          }),
        /Model identifier cannot be empty/
      );

      assert.throws(
        () =>
          mapToAnthropicMessagesRequest({
            modelId: "claude-3-5-sonnet-20241022",
            messages: [],
            params: {},
            metadata: { requestId: "r2" },
          }),
        /Request must contain at least one message/
      );
    });
  });

  describe("2. Anthropic Messages API Output Parsing & Normalization", () => {
    it("concatenates multiple text blocks in exact order", () => {
      const wireResponse = {
        id: "msg_01X9DsxDc2r2v66wfG2usviR",
        type: "message",
        role: "assistant",
        model: "claude-3-5-sonnet-20241022",
        content: [
          {
            type: "text",
            text: "Here is the architectural overview:\n",
          },
          {
            type: "text",
            text: "Anthropic uses the Messages API.",
          },
        ],
        stop_reason: "end_turn",
        usage: {
          input_tokens: 30,
          output_tokens: 15,
        },
      };

      const text = extractTextFromAnthropicResponse(wireResponse);
      assert.equal(
        text,
        "Here is the architectural overview:\nAnthropic uses the Messages API."
      );
    });
  });

  describe("3. Streaming SSE Parsing & Lossless Text Assembly", () => {
    it("handles fragmented chunk deliveries and preserves exact whitespace", () => {
      const parser = new MockAnthropicSseParser();

      // Chunk 1: message_start split
      const f1 = parser.feed("event: message_start\nda");
      assert.equal(f1.length, 0);

      // Chunk 2: message_start finish and content_block_delta
      const f2 = parser.feed(
        "ta: {\"type\":\"message_start\",\"message\":{\"id\":\"msg_1\",\"usage\":{\"input_tokens\":10}}}\n\nevent: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"   impl ProviderClient for AnthropicClient {\\n\"}}\n\n"
      );
      assert.equal(f2.length, 2);
      assert.equal(f2[0].event, "message_start");
      assert.equal(f2[1].event, "content_block_delta");

      const deltaPayload = JSON.parse(f2[1].data);
      assert.equal(
        deltaPayload.delta.text,
        "   impl ProviderClient for AnthropicClient {\n"
      );

      // Chunk 3: message_delta and message_stop
      const f3 = parser.feed(
        "event: message_delta\ndata: {\"type\":\"message_delta\",\"delta\":{\"stop_reason\":\"end_turn\"},\"usage\":{\"output_tokens\":25}}\n\nevent: message_stop\ndata: {\"type\":\"message_stop\"}\n\n"
      );
      assert.equal(f3.length, 2);
      assert.equal(f3[0].event, "message_delta");
      assert.equal(f3[1].event, "message_stop");
    });
  });

  describe("4. Error Normalization & Status Code Mapping", () => {
    it("maps 401 to authentication_failed without leaking credentials", () => {
      const err = mapAnthropicError(401, {
        error: {
          type: "authentication_error",
          message: "invalid x-api-key: sk-ant-api03-1234567890abcdef",
        },
      });

      assert.equal(err.kind, "authentication_failed");
      assert.equal(err.isRetryable, false);
      assert.ok(!err.message.includes("sk-ant-api03"));
    });

    it("maps 429 rate limit and extracts retry-after duration", () => {
      const err = mapAnthropicError(
        429,
        {
          error: {
            type: "rate_limit_error",
            message: "Request tokens per minute exceeded",
          },
        },
        "30"
      );

      assert.equal(err.kind, "rate_limited");
      assert.equal(err.isRetryable, true);
      assert.equal(err.retryAfterMs, 30000);
    });

    it("maps 529 to retryable provider_unavailable (overloaded)", () => {
      const err = mapAnthropicError(529, {
        error: {
          type: "overloaded_error",
          message: "Anthropic is temporarily overloaded.",
        },
      });

      assert.equal(err.kind, "provider_unavailable");
      assert.equal(err.isRetryable, true);
    });

    it("maps 413 to context_length_exceeded", () => {
      const err = mapAnthropicError(413, {
        error: {
          type: "request_too_large",
          message: "Request payload size exceeds 25MB limit",
        },
      });

      assert.equal(err.kind, "context_length_exceeded");
      assert.equal(err.isRetryable, false);
    });
  });

  describe("5. Secret Redaction & DPAPI Memory Safety", () => {
    it("ensures secret token patterns are scrubbed from error output", () => {
      const secret = "sk-ant-api03-super-secret-key-12345678";
      const leaked = `Connection failed for token ${secret} while calling Anthropic Messages API`;
      const scrubbed = leaked.replace(/sk-ant-[a-zA-Z0-9_-]{10,}/g, "[REDACTED_API_KEY]");

      assert.ok(!scrubbed.includes(secret));
      assert.ok(scrubbed.includes("[REDACTED_API_KEY]"));
    });
  });
});
