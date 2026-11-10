// ============================================================================
// Nano Route - Step 25 Provider Health & Capability Intelligence Contract Tests
// File: src/services/ipc/__tests__/provider_health.test.ts
// ============================================================================
// Verifies runtime health snapshot retrieval, capability intelligence,
// preflight request validation, model vs provider scope separation,
// explicit health checks, and zero-leak credential invariants.
// ============================================================================

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  getProviderHealth,
  getAllProviderHealth,
  getProviderCapabilities,
  getModelCapabilities,
  preflightProviderRequest,
  checkProviderHealth,
  resetMockHealth,
  setMockProviderHealth,
} from "../provider_health.ts";

describe("Step 25 Provider Health, Runtime Availability & Capability Intelligence", () => {
  beforeEach(() => {
    resetMockHealth();
  });

  // --------------------------------------------------------------------------
  // 1. Initial State & All Providers Observability
  // --------------------------------------------------------------------------
  describe("1. Initial Runtime Health State", () => {
    it("initializes all 6 MVP cloud providers with state 'unknown' and no background network calls", async () => {
      const allHealth = await getAllProviderHealth();
      assert.ok(allHealth.length >= 6);

      const ids = allHealth.map((h) => h.providerId);
      assert.ok(ids.includes("openai"));
      assert.ok(ids.includes("anthropic"));
      assert.ok(ids.includes("gemini"));
      assert.ok(ids.includes("deepseek"));
      assert.ok(ids.includes("groq"));
      assert.ok(ids.includes("mistral"));

      for (const h of allHealth) {
        assert.equal(h.state, "unknown");
        assert.equal(h.lastObservedAtMs ?? null, null);
        assert.equal(h.lastSuccessAtMs ?? null, null);
        assert.equal(h.rateLimitInfo.isLimited, false);
      }
    });

    it("retrieves individual provider health snapshot by canonical ID", async () => {
      const openai = await getProviderHealth("openai");
      assert.ok(openai);
      assert.equal(openai.providerId, "openai");
      assert.equal(openai.displayName, "OpenAI");
      assert.equal(openai.state, "unknown");
      assert.equal(openai.isEnabled, true);
      assert.equal(openai.isCredentialConfigured, true);
      assert.equal(openai.isAdapterImplemented, true);
      assert.ok(openai.models.length >= 2);
    });

    it("returns null for unknown provider", async () => {
      const unknown = await getProviderHealth("nonexistent-cloud");
      assert.equal(unknown, null);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Capability Evaluation & Intelligence
  // --------------------------------------------------------------------------
  describe("2. Effective Capability Intelligence", () => {
    it("reports baseline implemented capabilities (text, streaming, system_messages) for providers", async () => {
      const caps = await getProviderCapabilities("anthropic");
      assert.ok(caps);
      assert.ok(caps.capabilities.includes("text_generation"));
      assert.ok(caps.capabilities.includes("streaming"));
      assert.ok(caps.capabilities.includes("system_messages"));
      // Tool calling is not in the MVP adapter baseline
      assert.ok(!caps.capabilities.includes("tool_calling"));
    });

    it("reports model-level effective capabilities correctly", async () => {
      const modelCaps = await getModelCapabilities("gemini", "gemini-1.5-pro");
      assert.ok(modelCaps);
      assert.ok(modelCaps.capabilities.includes("text_generation"));
      assert.ok(modelCaps.capabilities.includes("streaming"));
    });
  });

  // --------------------------------------------------------------------------
  // 3. Preflight Request Validation
  // --------------------------------------------------------------------------
  describe("3. Preflight Request Validation (Allowed vs Blocked)", () => {
    it("permits standard text and streaming chat requests for an unknown healthy provider", async () => {
      const evalResult = await preflightProviderRequest(
        "openai",
        "gpt-4o",
        {
          requiresText: true,
          requiresStreaming: true,
          requiresSystemMessages: true,
        }
      );

      assert.equal(evalResult.allowed, true);
      assert.equal(evalResult.blockReason, null);
    });

    it("blocks request locally when unsupported capability (e.g. tools) is demanded", async () => {
      const evalResult = await preflightProviderRequest(
        "anthropic",
        "claude-3-5-sonnet-20241022",
        {
          requiresText: true,
          requiresTools: true, // Not implemented in current adapter baseline
        }
      );

      assert.equal(evalResult.allowed, false);
      assert.equal(evalResult.blockReason, "capability_unsupported");
      assert.ok(evalResult.message.includes("ToolCalling"));
    });

    it("blocks request locally when provider is disabled in user preferences", async () => {
      setMockProviderHealth({
        providerId: "groq",
        displayName: "Groq",
        state: "provider_disabled",
        isEnabled: false,
        isCredentialConfigured: true,
        isAdapterImplemented: true,
        rateLimitInfo: { isLimited: false },
        models: [],
      });

      const evalResult = await preflightProviderRequest(
        "groq",
        "llama-3.3-70b-versatile",
        { requiresText: true }
      );

      assert.equal(evalResult.allowed, false);
      assert.equal(evalResult.blockReason, "provider_disabled");
    });

    it("blocks request locally when credential is not configured", async () => {
      setMockProviderHealth({
        providerId: "mistral",
        displayName: "Mistral AI",
        state: "credential_missing",
        isEnabled: true,
        isCredentialConfigured: false,
        isAdapterImplemented: true,
        rateLimitInfo: { isLimited: false },
        models: [],
      });

      const evalResult = await preflightProviderRequest(
        "mistral",
        "mistral-large-latest",
        { requiresText: true }
      );

      assert.equal(evalResult.allowed, false);
      assert.equal(evalResult.blockReason, "credential_missing");
    });

    it("blocks request locally when provider is in authentication_failed state", async () => {
      setMockProviderHealth({
        providerId: "deepseek",
        displayName: "DeepSeek",
        state: "authentication_failed",
        isEnabled: true,
        isCredentialConfigured: true,
        isAdapterImplemented: true,
        rateLimitInfo: { isLimited: false },
        models: [],
      });

      const evalResult = await preflightProviderRequest(
        "deepseek",
        "deepseek-chat",
        { requiresText: true }
      );

      assert.equal(evalResult.allowed, false);
      assert.equal(evalResult.blockReason, "authentication_failed");
    });

    it("preflight NEVER returns or recommends a fallback provider", async () => {
      const blockedEval = await preflightProviderRequest(
        "nonexistent",
        "some-model",
        { requiresText: true }
      );

      assert.equal(blockedEval.allowed, false);
      // Preflight schema must never contain a "recommendedProvider" or "fallbackProvider"
      assert.equal((blockedEval as any).recommendedProvider, undefined);
      assert.equal((blockedEval as any).fallbackProvider, undefined);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Explicit Health Checks
  // --------------------------------------------------------------------------
  describe("4. Explicit Health Checks (Opt-in Probe)", () => {
    it("executes an explicit check and updates state to ready with latency", async () => {
      const probeResult = await checkProviderHealth("openai");

      assert.equal(probeResult.providerId, "openai");
      assert.equal(probeResult.status, "ready");
      assert.ok(typeof probeResult.latencyMs === "number");
      assert.ok(probeResult.latencyMs! > 0);

      // Verify the in-memory health snapshot reflects the update
      const updated = await getProviderHealth("openai");
      assert.ok(updated);
      assert.equal(updated.state, "ready");
      assert.ok(updated.lastObservedAtMs! > 0);
      assert.ok(updated.lastSuccessAtMs! > 0);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Zero-Secret Exposure Invariants
  // --------------------------------------------------------------------------
  describe("5. Zero-Secret Exposure Invariants", () => {
    it("guarantees no API key, auth header, or token material exists in health snapshots", async () => {
      const allHealth = await getAllProviderHealth();
      const serialized = JSON.stringify(allHealth);

      assert.ok(!serialized.includes("apiKey"));
      assert.ok(!serialized.includes("api_key"));
      assert.ok(!serialized.includes("password"));
      assert.ok(!serialized.includes("secret"));
      assert.ok(!serialized.includes("Bearer"));
      assert.ok(!serialized.includes("Authorization"));
      assert.ok(!serialized.includes("AIza"));
      assert.ok(!serialized.includes("sk-"));
    });
  });
});

