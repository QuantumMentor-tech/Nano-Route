// ============================================================================
// Nano Route - Step 21 Provider & Model Registry Foundation Unit Tests
// File: src/services/ipc/__tests__/registry.test.ts
// ============================================================================
// Verifies authoritative provider catalog, model descriptors, capability facts,
// effective configuration resolution, historical model compatibility, and zero-secret invariants.
// ============================================================================

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  listRegisteredProviders,
  getRegisteredProvider,
  listRegisteredModels,
  getRegisteredModel,
  resolveEffectiveProviders,
  resolveHistoricalModel,
  resetMockRegistry,
} from "../registry.ts";
import {
  registerMockCommandHandler,
  clearMockCommandHandlers,
  setMockTauriContext,
} from "../client.ts";
import { IPC_COMMANDS, type HistoricalModelDto } from "../types.ts";
import { IpcError } from "../errors.ts";

describe("Step 21 Provider & Model Registry Foundation", () => {
  beforeEach(() => {
    resetMockRegistry();
    clearMockCommandHandlers();
  });

  describe("1. Provider Registry Catalog & Lookups", () => {
    it("lists all canonical MVP registered providers in deterministic order", async () => {
      const providers = await listRegisteredProviders();

      assert.ok(providers.length >= 8);
      const ids = providers.map((p) => p.providerId);

      assert.ok(ids.includes("openai"));
      assert.ok(ids.includes("anthropic"));
      assert.ok(ids.includes("gemini"));
      assert.ok(ids.includes("deepseek"));
      assert.ok(ids.includes("groq"));
      assert.ok(ids.includes("mistral"));
      assert.ok(ids.includes("local"));
      assert.ok(ids.includes("custom"));

      // Verify IDs are all unique
      const uniqueIds = new Set(ids);
      assert.equal(uniqueIds.size, ids.length);
    });

    it("retrieves a specific provider descriptor by canonical ID", async () => {
      const anthropic = await getRegisteredProvider("anthropic");

      assert.ok(anthropic);
      assert.equal(anthropic.providerId, "anthropic");
      assert.equal(anthropic.displayName, "Anthropic");
      assert.equal(anthropic.defaultBaseUrl, "https://api.anthropic.com");
      assert.equal(anthropic.defaultModelId, "claude-3-5-sonnet-20241022");
      assert.equal(anthropic.credentialRequired, true);
      assert.equal(anthropic.implementationState, "planned");
      assert.equal(anthropic.lifecycleState, "active");
    });

    it("identifies local provider as requiring no credentials", async () => {
      const local = await getRegisteredProvider("local");

      assert.ok(local);
      assert.equal(local.providerId, "local");
      assert.equal(local.credentialRequired, false);
      assert.equal(local.defaultBaseUrl, "http://localhost:11434");
    });

    it("returns null for an uncataloged provider", async () => {
      const unknown = await getRegisteredProvider("nonexistent-ai");
      assert.equal(unknown, null);
    });

    it("rejects empty provider ID lookup with InvalidInput error", async () => {
      await assert.rejects(
        async () => {
          await getRegisteredProvider("   ");
        },
        (err) => err instanceof IpcError && err.category === "InvalidInput"
      );
    });
  });

  describe("2. Model Registry Catalog & Lookups", () => {
    it("lists models registered under a specific provider", async () => {
      const openaiModels = await listRegisteredModels("openai");

      assert.ok(openaiModels.length >= 2);
      const modelIds = openaiModels.map((m) => m.modelId);
      assert.ok(modelIds.includes("gpt-4o"));
      assert.ok(modelIds.includes("gpt-4o-mini"));
    });

    it("retrieves specific model descriptor with context window and capabilities", async () => {
      const model = await getRegisteredModel("openai", "gpt-4o");

      assert.ok(model);
      assert.equal(model.providerId, "openai");
      assert.equal(model.modelId, "gpt-4o");
      assert.equal(model.displayName, "GPT-4o");
      assert.equal(model.contextWindow, 128_000);
      assert.equal(model.maxOutputTokens, 4096);
      assert.equal(model.isDefault, true);

      // Verify capabilities
      assert.ok(model.capabilities.capabilities.includes("streaming"));
      assert.ok(model.capabilities.capabilities.includes("vision"));
    });

    it("returns null when querying uncataloged model ID", async () => {
      const missing = await getRegisteredModel("openai", "unknown-model-xyz");
      assert.equal(missing, null);
    });

    it("rejects empty IDs in model lookup with InvalidInput", async () => {
      await assert.rejects(
        async () => {
          await getRegisteredModel("", "gpt-4o");
        },
        (err) => err instanceof IpcError && err.category === "InvalidInput"
      );
    });
  });

  describe("3. Effective Configuration Resolution", () => {
    it("resolves effective provider descriptors merging static metadata with defaults", async () => {
      const effectiveList = await resolveEffectiveProviders();

      assert.ok(effectiveList.length >= 8);
      const anthropic = effectiveList.find((p) => p.providerId === "anthropic");

      assert.ok(anthropic);
      assert.equal(anthropic.displayName, "Anthropic");
      assert.equal(anthropic.defaultBaseUrl, "https://api.anthropic.com");
      assert.equal(anthropic.effectiveBaseUrl, "https://api.anthropic.com");
      assert.equal(anthropic.isActive, true);
      assert.equal(anthropic.priorityWeight, 5);
      assert.equal(anthropic.isCredentialConfigured, false);
      assert.ok(anthropic.models.length >= 1);
    });
  });

  describe("4. Historical Model Compatibility", () => {
    it("recognizes active catalog model as known in active registry", async () => {
      const ref = await resolveHistoricalModel("anthropic", "claude-3-5-sonnet-20241022");

      assert.equal(ref.providerId, "anthropic");
      assert.equal(ref.modelId, "claude-3-5-sonnet-20241022");
      assert.equal(ref.displayName, "Claude 3.5 Sonnet");
      assert.equal(ref.isKnownInActiveRegistry, true);
    });

    it("safely displays raw model ID for historical/decommissioned model without crashing", async () => {
      const ref = await resolveHistoricalModel("openai", "gpt-3.5-turbo-0613-historical");

      assert.equal(ref.providerId, "openai");
      assert.equal(ref.modelId, "gpt-3.5-turbo-0613-historical");
      // Falls back to raw model ID as display name
      assert.equal(ref.displayName, "gpt-3.5-turbo-0613-historical");
      assert.equal(ref.isKnownInActiveRegistry, false);
    });
  });

  describe("5. Zero-Secret Boundary Invariants", () => {
    it("guarantees ProviderDescriptorDto contains zero secrets or credential fields", async () => {
      const providers = await listRegisteredProviders();
      for (const p of providers) {
        const keys = Object.keys(p);
        assert.ok(!keys.includes("apiKey"));
        assert.ok(!keys.includes("api_key"));
        assert.ok(!keys.includes("secret"));
        assert.ok(!keys.includes("encryptedApiKey"));
        assert.ok(!keys.includes("ciphertext"));
      }
    });

    it("guarantees EffectiveProviderDto contains zero secrets or credential fields", async () => {
      const effective = await resolveEffectiveProviders();
      for (const e of effective) {
        const keys = Object.keys(e);
        assert.ok(!keys.includes("apiKey"));
        assert.ok(!keys.includes("api_key"));
        assert.ok(!keys.includes("secret"));
        assert.ok(!keys.includes("encryptedApiKey"));
        assert.ok(!keys.includes("ciphertext"));
      }
    });
  });

  describe("6. IPC Boundary Round-Trip (Simulated Tauri Environment)", () => {
    it("dispatches cmd_list_registered_providers via mock Tauri IPC registry", async () => {
      setMockTauriContext(true);
      registerMockCommandHandler(IPC_COMMANDS.LIST_REGISTERED_PROVIDERS, async () => {
        return [
          {
            providerId: "mock-provider",
            displayName: "Mock Provider",
            description: "IPC mock test provider",
            defaultBaseUrl: "https://mock.ai/v1",
            capabilities: { capabilities: ["text_generation", "streaming"] },
            implementationState: "implemented",
            lifecycleState: "active",
            credentialRequired: true,
          },
        ];
      });

      const providers = await listRegisteredProviders();
      assert.equal(providers.length, 1);
      assert.equal(providers[0].providerId, "mock-provider");
      assert.equal(providers[0].displayName, "Mock Provider");
    });

    it("dispatches cmd_resolve_historical_model via mock Tauri IPC registry", async () => {
      setMockTauriContext(true);
      registerMockCommandHandler(IPC_COMMANDS.RESOLVE_HISTORICAL_MODEL, async (args) => {
        const { providerId, modelId } = args as { providerId: string; modelId: string };
        return {
          providerId,
          modelId,
          displayName: `Resolved ${modelId}`,
          isKnownInActiveRegistry: true,
        } as HistoricalModelDto;
      });

      const ref = await resolveHistoricalModel("openai", "custom-model");
      assert.equal(ref.providerId, "openai");
      assert.equal(ref.displayName, "Resolved custom-model");
      assert.equal(ref.isKnownInActiveRegistry, true);
    });
  });
});
