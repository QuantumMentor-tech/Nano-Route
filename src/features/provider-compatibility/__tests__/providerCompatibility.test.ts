/**
 * Nano Route — Provider & Model Compatibility Test Suite
 * File: src/features/provider-compatibility/__tests__/providerCompatibility.test.ts
 *
 * Implements Step 87 Test Qualification:
 * - Authoritative normalization of providers and registered model descriptors
 * - Capability extraction (modalities, vision, streaming, tools) without name guessing
 * - Component readiness derivation (Registry, Credentials, Connectivity, Health, Context, Budget)
 * - Request-specific eligibility evaluation and plain-language explanation reasons
 * - Incompatibility diagnostics: image attachment on text-only model, context overflow, offline provider
 * - Model comparison matrix assembly
 * - Search, filter, and zero secret leakage verification
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  getCompatibilitySnapshot,
  evaluateModelEligibility,
  filterModels,
  buildModelComparison,
  resetCompatibilityEngine,
} from "../engine.ts";
import { setNetworkState, resetConnectivityStore } from "../../connectivity/engine.ts";

describe("Step 87: Provider & Model Compatibility Center", () => {
  beforeEach(() => {
    resetCompatibilityEngine();
    resetConnectivityStore();
  });

  describe("1. Authoritative Provider & Model Normalization", () => {
    it("assembles canonical providers with valid component readiness records", async () => {
      const snap = await getCompatibilitySnapshot(undefined, true);
      assert.ok(snap.providers.length >= 6);

      const openai = snap.providers.find((p) => p.providerId === "openai");
      assert.ok(openai);
      assert.strictEqual(openai.displayName, "OpenAI");
      assert.ok(openai.modelsCount > 0);
      assert.ok(["READY", "NOT_CONFIGURED", "AUTH_REQUIRED"].includes(openai.readiness));

      const local = snap.providers.find((p) => p.providerId === "local");
      assert.ok(local);
      assert.strictEqual(local.isLocal, true);
      assert.strictEqual(local.credentialStatus, "NOT_REQUIRED");
      assert.strictEqual(local.connectivityStatus, "REACHABLE");
    });

    it("extracts multimodal capabilities strictly from registered capability flags", async () => {
      const snap = await getCompatibilitySnapshot(undefined, true);

      const gpt4o = snap.models.find((m) => m.modelId === "gpt-4o");
      assert.ok(gpt4o);
      assert.strictEqual(gpt4o.supportsVision, true);
      assert.ok(gpt4o.supportedModalities.includes("image"));
      assert.ok(gpt4o.supportedModalities.includes("text"));
      assert.strictEqual(gpt4o.supportsStreaming, true);

      const deepseek = snap.models.find((m) => m.modelId === "deepseek-chat");
      assert.ok(deepseek);
      assert.strictEqual(deepseek.supportsVision, false);
      assert.ok(!deepseek.supportedModalities.includes("image"));
    });
  });

  describe("2. Request-Specific Eligibility & Explanation Derivation", () => {
    it("evaluates a standard text request as eligible for text-capable models", async () => {
      const snap = await getCompatibilitySnapshot({
        estimatedInputTokens: 2500,
        requiresImageInput: false,
      });

      const gpt4o = snap.models.find((m) => m.modelId === "gpt-4o");
      assert.ok(gpt4o);

      const evalResult = evaluateModelEligibility(gpt4o, {
        estimatedInputTokens: 2500,
        requiresImageInput: false,
      });

      assert.strictEqual(evalResult.isEligible, true);
      assert.ok(evalResult.reasons.some((r) => r.includes("verified")));
    });

    it("marks text-only models ineligible when request requires image input", async () => {
      const snap = await getCompatibilitySnapshot();
      const deepseek = snap.models.find((m) => m.modelId === "deepseek-chat");
      assert.ok(deepseek);

      const evalResult = evaluateModelEligibility(deepseek, {
        requiresImageInput: true,
      });

      assert.strictEqual(evalResult.isEligible, false);
      assert.ok(
        evalResult.reasons.some((r) => r.includes("image attachments, but this model only supports text"))
      );
    });

    it("marks models ineligible when prompt exceeds model context window", async () => {
      const snap = await getCompatibilitySnapshot();
      const gpt4o = snap.models.find((m) => m.modelId === "gpt-4o"); // 128K context window
      assert.ok(gpt4o);

      const evalResult = evaluateModelEligibility(gpt4o, {
        estimatedInputTokens: 160_000,
      });

      assert.strictEqual(evalResult.isEligible, false);
      assert.ok(evalResult.reasons.some((r) => r.includes("exceeds model context window")));

      // Gemini 1.5 Pro with 2M context remains eligible
      const geminiPro = snap.models.find((m) => m.modelId === "gemini-1.5-pro");
      assert.ok(geminiPro);

      const geminiEval = evaluateModelEligibility(geminiPro, {
        estimatedInputTokens: 160_000,
      });
      assert.strictEqual(geminiEval.isEligible, true);
    });
  });

  describe("3. Connectivity & Offline Integration", () => {
    it("flags remote models as ineligible when network state is OFFLINE", async () => {
      setNetworkState("OFFLINE", "Simulated cable disconnect");

      const snap = await getCompatibilitySnapshot(undefined, true);
      const openaiModel = snap.models.find((m) => m.providerId === "openai");
      assert.ok(openaiModel);

      const evalResult = evaluateModelEligibility(openaiModel);
      assert.strictEqual(evalResult.isEligible, false);
      assert.ok(evalResult.reasons.some((r) => r.includes("unreachable or application network is offline")));

      // Local SLM remains reachable and eligible
      const localModel = snap.models.find((m) => m.providerId === "local");
      assert.ok(localModel);
      const localEval = evaluateModelEligibility(localModel);
      assert.strictEqual(localEval.isEligible, true);
    });
  });

  describe("4. Search, Filtering & Model Comparison", () => {
    it("filters models by search query across display names and capabilities", async () => {
      const snap = await getCompatibilitySnapshot();

      const searchClaude = filterModels(snap.models, { search: "claude" });
      assert.ok(searchClaude.length > 0);
      assert.ok(searchClaude.every((m) => m.displayName.toLowerCase().includes("claude")));

      const searchVision = filterModels(snap.models, { modality: "image" });
      assert.ok(searchVision.length > 0);
      assert.ok(searchVision.every((m) => m.supportsVision));
    });

    it("assembles side-by-side model comparison matrix", async () => {
      const snap = await getCompatibilitySnapshot();
      const selected = snap.models.slice(0, 3);

      const comparison = buildModelComparison(selected);
      assert.strictEqual(comparison.length, 3);
      assert.ok(comparison[0].displayName);
      assert.ok(comparison[0].contextWindow > 0);
      assert.ok(Array.isArray(comparison[0].modalities));
      assert.ok(comparison[0].readiness);
      assert.ok(comparison[0].costEstimate);
    });
  });

  describe("5. Security & Privacy Invariants", () => {
    it("proves compatibility snapshot contains zero plaintext API keys or DPAPI tokens", async () => {
      const snap = await getCompatibilitySnapshot();
      const serialized = JSON.stringify(snap);

      assert.strictEqual(serialized.includes("sk-"), false);
      assert.strictEqual(serialized.includes("Bearer "), false);
      assert.strictEqual(serialized.includes("dpapi:"), false);
    });
  });
});

