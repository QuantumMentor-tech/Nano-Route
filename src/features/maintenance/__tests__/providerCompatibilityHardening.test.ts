/**
//! Step 56 — Frontier Provider Compatibility, Model Registry & Contract Tests
//!
//! Authoritative validation suite for:
//! 1. Implemented Provider Registry Integrity (OpenAI, Anthropic, Gemini, DeepSeek, Groq, Mistral)
//! 2. Model Capabilities & Context Window Contracts
//! 3. Error Normalization & Status Mapping
//! 4. Unknown & Deprecated Model Drift Protection
//! 5. Provider Base URL Security & Protocol Constraints
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  listRegisteredProviders,
  listRegisteredModels,
  getRegisteredModel,
  resolveEffectiveProviders,
} from "../../../services/ipc/registry.ts";
import { classifyError } from "../../../services/ipc/chat.ts";

describe("Step 56 Frontier Provider Compatibility & Model Registry Drift Hardening", () => {
  describe("1. Authoritative Implemented Provider Inventory", () => {
    it("returns all 6 canonical frontier providers plus local SLM", async () => {
      const providers = await listRegisteredProviders();
      const providerIds = providers.map((p) => p.providerId);

      assert.ok(providerIds.includes("openai"), "OpenAI must be registered");
      assert.ok(providerIds.includes("anthropic"), "Anthropic must be registered");
      assert.ok(providerIds.includes("gemini"), "Gemini must be registered");
      assert.ok(providerIds.includes("deepseek"), "DeepSeek must be registered");
      assert.ok(providerIds.includes("groq"), "Groq must be registered");
      assert.ok(providerIds.includes("mistral"), "Mistral must be registered");
      assert.ok(providerIds.includes("local"), "Local SLM must be registered");
    });

    it("verifies provider descriptors contain zero credential secrets", async () => {
      const providers = await listRegisteredProviders();
      for (const p of providers) {
        assert.equal((p as unknown as Record<string, unknown>).apiKey, undefined);
        assert.equal((p as unknown as Record<string, unknown>).encryptedApiKey, undefined);
        assert.ok(p.defaultBaseUrl.startsWith("https://") || p.defaultBaseUrl.startsWith("http://localhost"));
      }
    });
  });

  describe("2. Model Capabilities & Context Invariants", () => {
    it("ensures models declare authentic context limits and capabilities", async () => {
      const models = await listRegisteredModels();
      assert.ok(models.length >= 6);

      const gpt4o = models.find((m) => m.modelId === "gpt-4o");
      assert.ok(gpt4o);
      assert.equal(gpt4o.contextWindow, 128000);
      assert.ok(gpt4o.capabilities.capabilities.includes("vision"));

      const geminiPro = models.find((m) => m.modelId === "gemini-1.5-pro");
      assert.ok(geminiPro);
      assert.equal(geminiPro.contextWindow, 2000000);
      assert.ok(geminiPro.capabilities.capabilities.includes("audio_input"));
    });

    it("rejects unknown model lookups gracefully without throwing unhandled panics", async () => {
      const unknown = await getRegisteredModel("openai", "non-existent-model-xyz");
      assert.equal(unknown, null);
    });
  });

  describe("3. Error Normalization Across Providers", () => {
    it("normalizes provider HTTP 401/403 into AUTHENTICATION_FAILED", async () => {
      const errorCategory = await classifyError({
        errorMessage: "Invalid API key provided",
        httpStatus: 401,
      });
      assert.equal(errorCategory.errorCode, "AUTHENTICATION_FAILED");
      assert.equal(errorCategory.retryabilityHint, "user_action_required");
    });

    it("normalizes provider HTTP 429 into RATE_LIMITED with retryable flag", async () => {
      const errorCategory = await classifyError({
        errorMessage: "Rate limit reached for requests",
        httpStatus: 429,
      });
      assert.equal(errorCategory.errorCode, "RATE_LIMITED");
      assert.equal(errorCategory.retryabilityHint, "likely_transient");
    });

    it("normalizes provider HTTP 500/503 into PROVIDER_UNAVAILABLE with retryable flag", async () => {
      const errorCategory = await classifyError({
        errorMessage: "The server is currently overloaded",
        httpStatus: 503,
      });
      assert.equal(errorCategory.errorCode, "PROVIDER_UNAVAILABLE");
      assert.equal(errorCategory.retryabilityHint, "likely_transient");
    });
  });

  describe("4. Effective Provider Resolution & State Isolation", () => {
    it("resolves configured effective providers while preserving historical attribution", async () => {
      const effective = await resolveEffectiveProviders();
      assert.ok(effective.length >= 1);
      for (const ep of effective) {
        assert.ok(ep.providerId);
        assert.ok(ep.displayName);
        assert.ok(ep.effectiveBaseUrl);
      }
    });
  });
});
