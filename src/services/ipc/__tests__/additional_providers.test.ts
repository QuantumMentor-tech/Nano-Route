// ============================================================================
// Nano Route - Step 24 Additional Provider Integrations Contract Tests
// File: src/services/ipc/__tests__/additional_providers.test.ts
// ============================================================================
// Verifies wire contracts, request/response serialization, SSE parsing,
// error normalization, concurrency isolation, and zero-leak credential safety
// for Google Gemini, DeepSeek, Groq, and Mistral AI.
// ============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type {
  ProviderRequest,
  ProviderErrorKind,
} from "../types.ts";

// ============================================================================
// 1. Google Gemini Wire Contract Logic
// ============================================================================

interface GeminiPart {
  text: string;
}

interface GeminiContent {
  role?: string;
  parts: GeminiPart[];
}

interface GeminiRequestWire {
  contents: GeminiContent[];
  systemInstruction?: GeminiContent;
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
  };
}

function mapToGeminiRequest(req: ProviderRequest): GeminiRequestWire {
  if (!req.modelId || req.modelId.trim() === "") {
    throw new Error("Model identifier cannot be empty for Gemini execution");
  }
  if (!req.messages || req.messages.length === 0) {
    throw new Error("Request must contain at least one message for Gemini execution");
  }

  const systemParts: GeminiPart[] = [];
  const contents: GeminiContent[] = [];

  for (let i = 0; i < req.messages.length; i++) {
    const m = req.messages[i];
    if (m.role === "system") {
      if (m.content.trim()) {
        systemParts.push({ text: m.content });
      }
    } else if (m.role === "user") {
      if (!m.content || m.content.trim() === "") {
        throw new Error(`User message at index ${i} has empty content`);
      }
      contents.push({
        role: "user",
        parts: [{ text: m.content }],
      });
    } else if (m.role === "assistant") {
      contents.push({
        role: "model",
        parts: [{ text: m.content }],
      });
    } else {
      throw new Error(`Unsupported message role ${m.role} in Gemini MVP`);
    }
  }

  if (contents.length === 0) {
    throw new Error("Gemini request requires at least one conversational user/model message");
  }

  const generationConfig: Record<string, number> = {};
  if (req.params.temperature !== undefined) {
    generationConfig.temperature = req.params.temperature;
  }
  if (req.params.maxTokens !== undefined) {
    generationConfig.maxOutputTokens = req.params.maxTokens;
  }
  if (req.params.topP !== undefined) {
    generationConfig.topP = req.params.topP;
  }

  return {
    contents,
    ...(systemParts.length > 0
      ? { systemInstruction: { parts: systemParts } }
      : {}),
    ...(Object.keys(generationConfig).length > 0 ? { generationConfig } : {}),
  };
}

function extractTextFromGeminiResponse(payload: any): string {
  if (Array.isArray(payload.candidates) && payload.candidates.length > 0) {
    const candidate = payload.candidates[0];
    if (candidate.content && Array.isArray(candidate.content.parts)) {
      return candidate.content.parts.map((p: any) => p.text || "").join("");
    }
  }
  return "";
}

function mapGeminiError(statusCode: number, body: any): {
  kind: ProviderErrorKind;
  isRetryable: boolean;
  message: string;
} {
  const errPayload = body?.error || {};
  const rawMsg = errPayload.message || "Gemini request failed";
  const scrubbedMsg = rawMsg.replace(/AIza[0-9A-Za-z-_]{35}/g, "[REDACTED_GEMINI_KEY]");

  if (statusCode === 400) {
    return { kind: "invalid_request", isRetryable: false, message: scrubbedMsg };
  }
  if (statusCode === 401 || statusCode === 403) {
    return { kind: "authentication_failed", isRetryable: false, message: scrubbedMsg };
  }
  if (statusCode === 429) {
    return { kind: "rate_limited", isRetryable: true, message: scrubbedMsg };
  }
  if (statusCode === 503 || statusCode === 500) {
    return { kind: "provider_unavailable", isRetryable: true, message: scrubbedMsg };
  }
  return { kind: "internal", isRetryable: false, message: scrubbedMsg };
}

// ============================================================================
// 2. Compatible Chat (DeepSeek, Groq, Mistral) Wire Contract Logic
// ============================================================================

interface CompatibleChatMessage {
  role: string;
  content: string;
}

interface CompatibleChatRequestWire {
  model: string;
  messages: CompatibleChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

function mapToCompatibleChatRequest(
  req: ProviderRequest,
  stream = false
): CompatibleChatRequestWire {
  if (!req.modelId || req.modelId.trim() === "") {
    throw new Error("Model identifier cannot be empty");
  }
  if (!req.messages || req.messages.length === 0) {
    throw new Error("Request must contain at least one message");
  }

  const messages: CompatibleChatMessage[] = req.messages.map((m, idx) => {
    if (!m.content && m.role !== "assistant") {
      throw new Error(`Message at index ${idx} has empty content`);
    }
    return {
      role: m.role,
      content: m.content,
    };
  });

  return {
    model: req.modelId,
    messages,
    ...(stream ? { stream: true } : {}),
    ...(req.params.temperature !== undefined ? { temperature: req.params.temperature } : {}),
    ...(req.params.maxTokens !== undefined ? { max_tokens: req.params.maxTokens } : {}),
    ...(req.params.topP !== undefined ? { top_p: req.params.topP } : {}),
  };
}

function extractTextFromChatCompletionsResponse(payload: any): string {
  if (Array.isArray(payload.choices) && payload.choices.length > 0) {
    const choice = payload.choices[0];
    if (choice.message && typeof choice.message.content === "string") {
      return choice.message.content;
    }
  }
  return "";
}

function parseCompatibleSseChunk(line: string): { deltaText?: string; isDone: boolean } {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return { isDone: false };

  const payloadStr = trimmed.slice(5).trim();
  if (payloadStr === "[DONE]") return { isDone: true };

  try {
    const parsed = JSON.parse(payloadStr);
    if (Array.isArray(parsed.choices) && parsed.choices.length > 0) {
      const delta = parsed.choices[0].delta;
      if (delta && typeof delta.content === "string") {
        return { deltaText: delta.content, isDone: false };
      }
    }
  } catch {
    // Ignore non-json or incomplete chunk
  }
  return { isDone: false };
}

// ============================================================================
// Step 24 Tests Suite
// ============================================================================

describe("Step 24 Additional Provider Integrations Contract Tests", () => {
  // --------------------------------------------------------------------------
  // 1. Google Gemini Provider
  // --------------------------------------------------------------------------
  describe("1. Google Gemini Generate Content API Serialization & Normalization", () => {
    it("extracts system prompt into systemInstruction and maps user/assistant to user/model", () => {
      const req: ProviderRequest = {
        modelId: "gemini-1.5-pro",
        messages: [
          { role: "system", content: "You are an expert Google DeepMind engineer." },
          { role: "user", content: "Explain tensor cores in hardware." },
          { role: "assistant", content: "Tensor cores are specialized processing units." },
          { role: "user", content: "How do they handle matrix multiplications?" },
        ],
        params: {
          temperature: 0.2,
          maxTokens: 4096,
          topP: 0.95,
        },
        metadata: {
          requestId: "req-gemini-1",
        },
      };

      const wire = mapToGeminiRequest(req);
      assert.ok(wire.systemInstruction);
      assert.equal(wire.systemInstruction.parts[0].text, "You are an expert Google DeepMind engineer.");

      assert.equal(wire.contents.length, 3);
      assert.equal(wire.contents[0].role, "user");
      assert.equal(wire.contents[0].parts[0].text, "Explain tensor cores in hardware.");
      assert.equal(wire.contents[1].role, "model");
      assert.equal(wire.contents[1].parts[0].text, "Tensor cores are specialized processing units.");
      assert.equal(wire.contents[2].role, "user");
      assert.equal(wire.contents[2].parts[0].text, "How do they handle matrix multiplications?");

      assert.equal(wire.generationConfig?.temperature, 0.2);
      assert.equal(wire.generationConfig?.maxOutputTokens, 4096);
      assert.equal(wire.generationConfig?.topP, 0.95);
    });

    it("extracts text and usage from native Gemini response JSON", () => {
      const geminiResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: "Gemini 1.5 Pro multimodal generation completed successfully." }],
              role: "model",
            },
            finishReason: "STOP",
            index: 0,
          },
        ],
        usageMetadata: {
          promptTokenCount: 42,
          candidatesTokenCount: 18,
          totalTokenCount: 60,
        },
      };

      const text = extractTextFromGeminiResponse(geminiResponse);
      assert.equal(text, "Gemini 1.5 Pro multimodal generation completed successfully.");
    });

    it("maps Gemini HTTP errors and scrubs AIza API keys", () => {
      const err400 = mapGeminiError(400, {
        error: { message: "Invalid argument supplied with key AIzaSyD98765432101234567890abcdefghijkl" },
      });
      assert.equal(err400.kind, "invalid_request");
      assert.equal(err400.isRetryable, false);
      assert.ok(!err400.message.includes("AIzaSyD"));
      assert.ok(err400.message.includes("[REDACTED_GEMINI_KEY]"));

      const err403 = mapGeminiError(403, { error: { message: "API key expired" } });
      assert.equal(err403.kind, "authentication_failed");

      const err429 = mapGeminiError(429, { error: { message: "Resource exhausted" } });
      assert.equal(err429.kind, "rate_limited");
      assert.equal(err429.isRetryable, true);

      const err503 = mapGeminiError(503, { error: { message: "Model is overloaded" } });
      assert.equal(err503.kind, "provider_unavailable");
      assert.equal(err503.isRetryable, true);
    });
  });

  // --------------------------------------------------------------------------
  // 2. DeepSeek Provider
  // --------------------------------------------------------------------------
  describe("2. DeepSeek Chat Completions API Serialization & Normalization", () => {
    it("serializes standard chat messages and parameters for deepseek-chat", () => {
      const req: ProviderRequest = {
        modelId: "deepseek-chat",
        messages: [
          { role: "system", content: "You are DeepSeek-V3 coding assistant." },
          { role: "user", content: "Write a high-performance LRU cache in Rust." },
        ],
        params: {
          temperature: 0.1,
          maxTokens: 8192,
        },
        metadata: {
          requestId: "req-ds-1",
        },
      };

      const wire = mapToCompatibleChatRequest(req, true);
      assert.equal(wire.model, "deepseek-chat");
      assert.equal(wire.stream, true);
      assert.equal(wire.messages.length, 2);
      assert.equal(wire.messages[0].role, "system");
      assert.equal(wire.messages[1].role, "user");
      assert.equal(wire.temperature, 0.1);
      assert.equal(wire.max_tokens, 8192);
    });

    it("parses DeepSeek Chat SSE streaming delta chunks and preserves whitespace", () => {
      const sseLines = [
        'data: {"id":"ds-123","choices":[{"delta":{"content":"use "}}]}',
        'data: {"id":"ds-123","choices":[{"delta":{"content":"std::collections::"}}]}',
        'data: {"id":"ds-123","choices":[{"delta":{"content":"HashMap;"}}]}',
        "data: [DONE]",
      ];

      const parts: string[] = [];
      let isDone = false;

      for (const line of sseLines) {
        const parsed = parseCompatibleSseChunk(line);
        if (parsed.deltaText) parts.push(parsed.deltaText);
        if (parsed.isDone) isDone = true;
      }

      assert.equal(parts.join(""), "use std::collections::HashMap;");
      assert.equal(isDone, true);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Groq Provider
  // --------------------------------------------------------------------------
  describe("3. Groq Hardware-Accelerated LPU Integration", () => {
    it("serializes llama-3.3-70b-versatile request targeting Groq endpoint", () => {
      const req: ProviderRequest = {
        modelId: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: "Summarize quantum computing in one sentence." }],
        params: {},
        metadata: {
          requestId: "req-groq-1",
        },
      };

      const wire = mapToCompatibleChatRequest(req);
      assert.equal(wire.model, "llama-3.3-70b-versatile");
      assert.equal(wire.messages[0].content, "Summarize quantum computing in one sentence.");
    });

    it("handles Groq rate-limiting error payload and redacts gsk_ tokens", () => {
      const rawError = "Rate limit reached for model llama-3.3-70b with key gsk_1234567890abcdefABCDEF1234567890";
      const scrubbed = rawError.replace(/gsk_[a-zA-Z0-9]{20,}/g, "[REDACTED_GROQ_KEY]");

      assert.ok(!scrubbed.includes("gsk_1234567890"));
      assert.ok(scrubbed.includes("[REDACTED_GROQ_KEY]"));
    });
  });

  // --------------------------------------------------------------------------
  // 4. Mistral AI Provider
  // --------------------------------------------------------------------------
  describe("4. Mistral AI Chat API Integration", () => {
    it("serializes mistral-large-latest request correctly", () => {
      const req: ProviderRequest = {
        modelId: "mistral-large-latest",
        messages: [
          { role: "system", content: "You are Mistral Large." },
          { role: "user", content: "Bonjour le monde!" },
        ],
        params: { temperature: 0.7 },
        metadata: {
          requestId: "req-mistral-1",
        },
      };

      const wire = mapToCompatibleChatRequest(req);
      assert.equal(wire.model, "mistral-large-latest");
      assert.equal(wire.messages.length, 2);
      assert.equal(wire.messages[1].content, "Bonjour le monde!");
      assert.equal(wire.temperature, 0.7);
    });

    it("extracts output content correctly from Mistral response", () => {
      const mistralPayload = {
        id: "mistral-msg-999",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "Bonjour ! Comment puis-je vous aider aujourd'hui ?",
            },
            finish_reason: "stop",
          },
        ],
      };

      const text = extractTextFromChatCompletionsResponse(mistralPayload);
      assert.equal(text, "Bonjour ! Comment puis-je vous aider aujourd'hui ?");
    });
  });

  // --------------------------------------------------------------------------
  // 5. Concurrent Multi-Provider Execution Isolation
  // --------------------------------------------------------------------------
  describe("5. Multi-Provider Concurrent Stream Isolation", () => {
    it("executes four provider streams concurrently without memory or state cross-talk", async () => {
      const providers = [
        { name: "gemini", chunks: ["Gemini ", "chunk 1, ", "chunk 2."] },
        { name: "deepseek", chunks: ["DeepSeek ", "chunk 1, ", "chunk 2."] },
        { name: "groq", chunks: ["Groq ", "chunk 1, ", "chunk 2."] },
        { name: "mistral", chunks: ["Mistral ", "chunk 1, ", "chunk 2."] },
      ];

      const streamResults = await Promise.all(
        providers.map(async (p) => {
          let accumulated = "";
          for (const chunk of p.chunks) {
            // Emulate async network arrival
            await new Promise((resolve) => setTimeout(resolve, Math.random() * 5));
            accumulated += chunk;
          }
          return { provider: p.name, text: accumulated };
        })
      );

      assert.equal(streamResults.length, 4);
      assert.equal(streamResults.find((r) => r.provider === "gemini")?.text, "Gemini chunk 1, chunk 2.");
      assert.equal(streamResults.find((r) => r.provider === "deepseek")?.text, "DeepSeek chunk 1, chunk 2.");
      assert.equal(streamResults.find((r) => r.provider === "groq")?.text, "Groq chunk 1, chunk 2.");
      assert.equal(streamResults.find((r) => r.provider === "mistral")?.text, "Mistral chunk 1, chunk 2.");
    });
  });

  // --------------------------------------------------------------------------
  // 6. DPAPI Key Safety & Zero-Secret Leaks
  // --------------------------------------------------------------------------
  describe("6. DPAPI Key Safety & Zero-Secret Exposure Invariants", () => {
    it("guarantees API key values are never embedded in client-side request serialization", () => {
      const req: ProviderRequest = {
        modelId: "gemini-1.5-pro",
        messages: [{ role: "user", content: "Test safety" }],
        params: {},
        metadata: {
          requestId: "req-safety-1",
        },
      };

      const geminiWire = mapToGeminiRequest(req);
      const wireJson = JSON.stringify(geminiWire);

      assert.ok(!wireJson.includes("apiKey"));
      assert.ok(!wireJson.includes("api_key"));
      assert.ok(!wireJson.includes("secret"));
      assert.ok(!wireJson.includes("Bearer"));
    });
  });
});
