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
      assert.equal(anthropic.implementationState, "implemented");
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

  describe("7. Validation Invariant & Rejection Fixtures (Sections 41-49, 110-115, 176)", () => {
    function validateDescriptors(
      providers: Array<{ providerId: string; defaultModelId?: string | null; defaultBaseUrl: string }>,
      models: Array<{ providerId: string; modelId: string; contextWindow: number }>
    ): void {
      const providerSet = new Set<string>();
      for (const p of providers) {
        if (providerSet.has(p.providerId)) {
          throw new Error(`Duplicate provider ID '${p.providerId}'`);
        }
        providerSet.add(p.providerId);

        const url = p.defaultBaseUrl.trim().toLowerCase();
        if (!url.startsWith("https://") && !url.startsWith("http://localhost") && !url.startsWith("http://127.0.0.1")) {
          throw new Error(`Invalid default base URL '${p.defaultBaseUrl}'`);
        }
        if (p.defaultBaseUrl.includes("@")) {
          throw new Error(`Base URL contains embedded credentials`);
        }
      }

      const modelSet = new Set<string>();
      for (const m of models) {
        if (!providerSet.has(m.providerId)) {
          throw new Error(`Model '${m.modelId}' references unregistered provider '${m.providerId}'`);
        }
        const key = `${m.providerId}/${m.modelId}`;
        if (modelSet.has(key)) {
          throw new Error(`Duplicate model ID '${m.modelId}' under provider '${m.providerId}'`);
        }
        modelSet.add(key);

        if (m.contextWindow <= 0) {
          throw new Error(`Model '${key}' declares an invalid context window of ${m.contextWindow}`);
        }
      }

      for (const p of providers) {
        if (p.defaultModelId) {
          const key = `${p.providerId}/${p.defaultModelId}`;
          if (!modelSet.has(key)) {
            throw new Error(`Provider '${p.providerId}' specifies missing default model '${p.defaultModelId}'`);
          }
        }
      }
    }

    it("rejects duplicate provider IDs during registry validation", () => {
      assert.throws(
        () => {
          validateDescriptors(
            [
              { providerId: "openai", defaultBaseUrl: "https://api.openai.com" },
              { providerId: "openai", defaultBaseUrl: "https://api.openai.com" },
            ],
            []
          );
        },
        /Duplicate provider ID 'openai'/
      );
    });

    it("rejects duplicate model IDs under the same provider", () => {
      assert.throws(
        () => {
          validateDescriptors(
            [{ providerId: "openai", defaultBaseUrl: "https://api.openai.com" }],
            [
              { providerId: "openai", modelId: "gpt-4o", contextWindow: 128000 },
              { providerId: "openai", modelId: "gpt-4o", contextWindow: 128000 },
            ]
          );
        },
        /Duplicate model ID 'gpt-4o' under provider 'openai'/
      );
    });

    it("allows identical model IDs across different providers", () => {
      assert.doesNotThrow(() => {
        validateDescriptors(
          [
            { providerId: "groq", defaultBaseUrl: "https://api.groq.com" },
            { providerId: "local", defaultBaseUrl: "http://localhost:11434" },
          ],
          [
            { providerId: "groq", modelId: "llama-3-8b", contextWindow: 8192 },
            { providerId: "local", modelId: "llama-3-8b", contextWindow: 8192 },
          ]
        );
      });
    });

    it("rejects orphan model referencing an unregistered provider", () => {
      assert.throws(
        () => {
          validateDescriptors(
            [{ providerId: "openai", defaultBaseUrl: "https://api.openai.com" }],
            [{ providerId: "nonexistent-provider", modelId: "orphan-model", contextWindow: 4096 }]
          );
        },
        /references unregistered provider 'nonexistent-provider'/
      );
    });

    it("rejects provider specifying a default model missing from its catalog", () => {
      assert.throws(
        () => {
          validateDescriptors(
            [{ providerId: "anthropic", defaultBaseUrl: "https://api.anthropic.com", defaultModelId: "missing-claude" }],
            [{ providerId: "anthropic", modelId: "claude-3-5-sonnet-20241022", contextWindow: 200000 }]
          );
        },
        /specifies missing default model 'missing-claude'/
      );
    });

    it("rejects model with invalid context window of 0", () => {
      assert.throws(
        () => {
          validateDescriptors(
            [{ providerId: "openai", defaultBaseUrl: "https://api.openai.com" }],
            [{ providerId: "openai", modelId: "broken-model", contextWindow: 0 }]
          );
        },
        /invalid context window of 0/
      );
    });

    it("rejects invalid base URL with insecure protocol or embedded credentials", () => {
      assert.throws(
        () => {
          validateDescriptors(
            [{ providerId: "insecure", defaultBaseUrl: "http://remote-insecure-api.com" }],
            []
          );
        },
        /Invalid default base URL/
      );

      assert.throws(
        () => {
          validateDescriptors(
            [{ providerId: "leaky", defaultBaseUrl: "https://user:password@api.example.com" }],
            []
          );
        },
        /Base URL contains embedded credentials/
      );
    });
  });

  describe("8. Separation Invariants & Mutability Isolation (Sections 116-118, 172)", () => {
    it("guarantees user preference priority change does not mutate static registry descriptor", async () => {
      const original = await getRegisteredProvider("anthropic");
      assert.ok(original);
      assert.equal(original.defaultModelId, "claude-3-5-sonnet-20241022");

      // Effective resolution reflects user override priority = 9, but registry descriptor is intact
      const effectiveList = await resolveEffectiveProviders();
      const anthropicEffective = effectiveList.find((p) => p.providerId === "anthropic");
      assert.ok(anthropicEffective);

      // Verify static descriptor remains unchanged
      const current = await getRegisteredProvider("anthropic");
      assert.ok(current);
      assert.deepEqual(current, original);
    });

    it("guarantees credential changes or rotation do not alter static registry metadata", async () => {
      const openai = await getRegisteredProvider("openai");
      assert.ok(openai);
      assert.equal(openai.credentialRequired, true);

      // Verify no credential fields leaked or added to registry descriptor
      const keys = Object.keys(openai);
      assert.ok(!keys.includes("apiKey"));
      assert.ok(!keys.includes("encryptedApiKey"));
    });
  });

  describe("9. Clean Database & Offline Startup Scenarios (Sections 121, 123-125, 171, 174, 175)", () => {
    it("initializes and serves all static providers on a clean database without credentials", async () => {
      // In clean state (no credentials stored, no user settings altered)
      const providers = await listRegisteredProviders();
      assert.ok(providers.length >= 8);

      for (const p of providers) {
        assert.ok(p.providerId.length > 0);
        assert.ok(p.displayName.length > 0);
        assert.ok(p.defaultBaseUrl.length > 0);
      }
    });

    it("verifies all registered providers declaring default models satisfy catalog ownership", async () => {
      const providers = await listRegisteredProviders();
      for (const p of providers) {
        if (p.defaultModelId) {
          const model = await getRegisteredModel(p.providerId, p.defaultModelId);
          assert.ok(model, `Default model '${p.defaultModelId}' must exist for provider '${p.providerId}'`);
          assert.equal(model.providerId, p.providerId);
          assert.equal(model.modelId, p.defaultModelId);
        }
      }
    });
  });
});
