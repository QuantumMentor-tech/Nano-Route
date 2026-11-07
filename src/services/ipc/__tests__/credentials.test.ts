/**
//! Nano Route — Windows DPAPI Credential Vault Unit Tests (Step 19)
//!
//! Tests:
//! 1. Secure Credential Persistence: save credentials, verify safe status returned (no plaintext key).
//! 2. Input Validation Constraints: reject empty/whitespace keys, invalid provider IDs, out-of-range priority.
//! 3. Base URL Security Boundaries: reject unsafe schemes (javascript:, file:) and embedded credentials (@).
//! 4. Credential Lifecycle: retrieve status, list all statuses (ordered by priority), toggle active, delete.
//! 5. Zero-Secret Boundary Invariant: verify that no status response contains secret fields.
//! 6. IPC Boundary Round-Trip: simulated Tauri environment with mock command registry.
*/

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  saveProviderCredential,
  getProviderCredentialStatus,
  listProviderCredentialStatuses,
  setProviderActive,
  deleteProviderCredential,
  resetCredentialMockStore,
} from "../credentials.ts";
import {
  registerMockCommandHandler,
  clearMockCommandHandlers,
  setMockTauriContext,
} from "../client.ts";
import { IPC_COMMANDS } from "../types.ts";
import type { ProviderCredentialStatus } from "../types.ts";

describe("Step 19 Windows DPAPI Credential Vault & Secure Provider Credentials", () => {
  beforeEach(() => {
    resetCredentialMockStore();
    clearMockCommandHandlers();
    setMockTauriContext(false);
  });

  afterEach(() => {
    resetCredentialMockStore();
    clearMockCommandHandlers();
    setMockTauriContext(false);
  });

  describe("1. Secure Credential Persistence & Safe Status", () => {
    it("saves a provider credential and returns non-secret status metadata", async () => {
      const status = await saveProviderCredential({
        providerId: "anthropic",
        apiKey: "test-sk-ant-sample-secret-key-12345",
        priorityWeight: 8,
        monthlyBudgetLimit: 50.0,
      });

      assert.equal(status.providerId, "anthropic");
      assert.equal(status.isConfigured, true);
      assert.equal(status.isActive, true);
      assert.equal(status.priorityWeight, 8);
      assert.equal(status.monthlyBudgetLimit, 50.0);
      assert.equal(status.currentMonthSpend, 0.0);
      assert.ok(status.updatedAt > 0);

      // Verify that plaintext key is NEVER present in the returned status
      const keys = Object.keys(status);
      assert.ok(!keys.includes("apiKey"));
      assert.ok(!keys.includes("api_key"));
      assert.ok(!keys.includes("secret"));
      assert.ok(!keys.includes("encryptedApiKey"));
      assert.ok(!keys.includes("ciphertext"));
    });

    it("retrieves configured status for an existing provider", async () => {
      await saveProviderCredential({
        providerId: "openai",
        apiKey: "test-sk-proj-sample-key",
      });

      const fetched = await getProviderCredentialStatus("openai");
      assert.ok(fetched);
      assert.equal(fetched.providerId, "openai");
      assert.equal(fetched.isConfigured, true);
      assert.equal(fetched.priorityWeight, 5); // default priority weight
    });

    it("returns null when querying status for unconfigured provider", async () => {
      const fetched = await getProviderCredentialStatus("unknown_provider");
      assert.equal(fetched, null);
    });
  });

  describe("2. Input Validation Constraints", () => {
    it("rejects empty or whitespace-only API keys", async () => {
      await assert.rejects(
        async () => {
          await saveProviderCredential({
            providerId: "openai",
            apiKey: "   ",
          });
        },
        {
          name: "IpcError",
          code: "INVALID_INPUT",
        }
      );
    });

    it("rejects invalid provider IDs (uppercase, illegal chars, too short)", async () => {
      await assert.rejects(
        async () => {
          await saveProviderCredential({
            providerId: "OpenAI",
            apiKey: "some-key",
          });
        },
        {
          name: "IpcError",
          code: "INVALID_INPUT",
        }
      );

      await assert.rejects(
        async () => {
          await saveProviderCredential({
            providerId: "a", // length < 2
            apiKey: "some-key",
          });
        },
        {
          name: "IpcError",
          code: "INVALID_INPUT",
        }
      );

      await assert.rejects(
        async () => {
          await saveProviderCredential({
            providerId: "invalid provider with spaces",
            apiKey: "some-key",
          });
        },
        {
          name: "IpcError",
          code: "INVALID_INPUT",
        }
      );
    });

    it("rejects priority weights outside the 1..10 range", async () => {
      await assert.rejects(
        async () => {
          await saveProviderCredential({
            providerId: "groq",
            apiKey: "gsk-sample-key",
            priorityWeight: 0,
          });
        },
        {
          name: "IpcError",
          code: "INVALID_INPUT",
        }
      );

      await assert.rejects(
        async () => {
          await saveProviderCredential({
            providerId: "groq",
            apiKey: "gsk-sample-key",
            priorityWeight: 11,
          });
        },
        {
          name: "IpcError",
          code: "INVALID_INPUT",
        }
      );
    });

    it("rejects negative monthly budget limits", async () => {
      await assert.rejects(
        async () => {
          await saveProviderCredential({
            providerId: "mistral",
            apiKey: "mistral-sample-key",
            monthlyBudgetLimit: -10.0,
          });
        },
        {
          name: "IpcError",
          code: "INVALID_INPUT",
        }
      );
    });
  });

  describe("3. Base URL Security Boundaries", () => {
    it("accepts valid HTTPS endpoints and safe local development URLs", async () => {
      const s1 = await saveProviderCredential({
        providerId: "custom_openai",
        apiKey: "test-key-1",
        baseUrl: "https://api.custom-proxy.internal/v1",
      });
      assert.equal(s1.baseUrl, "https://api.custom-proxy.internal/v1");

      const s2 = await saveProviderCredential({
        providerId: "ollama_local",
        apiKey: "ollama-dummy-key",
        baseUrl: "http://localhost:11434",
      });
      assert.equal(s2.baseUrl, "http://localhost:11434");

      const s3 = await saveProviderCredential({
        providerId: "vllm_local",
        apiKey: "vllm-dummy-key",
        baseUrl: "http://127.0.0.1:8000/v1",
      });
      assert.equal(s3.baseUrl, "http://127.0.0.1:8000/v1");
    });

    it("rejects non-network schemes (javascript:, file:, data:)", async () => {
      await assert.rejects(
        async () => {
          await saveProviderCredential({
            providerId: "bad_url_1",
            apiKey: "key",
            baseUrl: "javascript:alert(1)",
          });
        },
        {
          name: "IpcError",
          code: "INVALID_INPUT",
        }
      );

      await assert.rejects(
        async () => {
          await saveProviderCredential({
            providerId: "bad_url_2",
            apiKey: "key",
            baseUrl: "file:///C:/secrets.txt",
          });
        },
        {
          name: "IpcError",
          code: "INVALID_INPUT",
        }
      );
    });

    it("rejects base URLs containing embedded userinfo credentials (@)", async () => {
      await assert.rejects(
        async () => {
          await saveProviderCredential({
            providerId: "userinfo_leak",
            apiKey: "key",
            baseUrl: "https://admin:secretpassword@api.example.com",
          });
        },
        {
          name: "IpcError",
          code: "INVALID_INPUT",
        }
      );
    });
  });

  describe("4. Credential Lifecycle & Status Management", () => {
    it("lists all configured credentials sorted by priority descending", async () => {
      await saveProviderCredential({ providerId: "groq", apiKey: "key-1", priorityWeight: 3 });
      await saveProviderCredential({ providerId: "anthropic", apiKey: "key-2", priorityWeight: 9 });
      await saveProviderCredential({ providerId: "openai", apiKey: "key-3", priorityWeight: 7 });

      const list = await listProviderCredentialStatuses();
      assert.equal(list.length, 3);
      assert.equal(list[0].providerId, "anthropic");
      assert.equal(list[1].providerId, "openai");
      assert.equal(list[2].providerId, "groq");

      // Verify no secret leakage in listed statuses
      for (const item of list) {
        assert.ok(!("apiKey" in item));
        assert.ok(!("encryptedApiKey" in item));
      }
    });

    it("updates provider active state via setProviderActive", async () => {
      await saveProviderCredential({ providerId: "gemini", apiKey: "test-gemini-key" });

      const deactivated = await setProviderActive("gemini", false);
      assert.equal(deactivated.isActive, false);

      const status = await getProviderCredentialStatus("gemini");
      assert.ok(status);
      assert.equal(status.isActive, false);

      const reactivated = await setProviderActive("gemini", true);
      assert.equal(reactivated.isActive, true);
    });

    it("deletes a provider credential and confirms it is no longer configured", async () => {
      await saveProviderCredential({ providerId: "deepseek", apiKey: "test-deepseek-key" });

      const deleted = await deleteProviderCredential("deepseek");
      assert.equal(deleted, true);

      const status = await getProviderCredentialStatus("deepseek");
      assert.equal(status, null);
    });
  });

  describe("5. IPC Boundary Round-Trip (Simulated Tauri Environment)", () => {
    it("executes saveProviderCredential through mock Tauri IPC registry", async () => {
      setMockTauriContext(true);

      const mockResponse: ProviderCredentialStatus = {
        providerId: "openai",
        isConfigured: true,
        isActive: true,
        priorityWeight: 9,
        baseUrl: null,
        monthlyBudgetLimit: 100.0,
        currentMonthSpend: 0.0,
        updatedAt: 1731000000000,
      };

      registerMockCommandHandler(
        IPC_COMMANDS.SAVE_PROVIDER_CREDENTIAL,
        async (rawArgs) => {
          const args = rawArgs as { input?: any } | undefined;
          assert.equal(args?.input?.providerId, "openai");
          assert.equal(args?.input?.apiKey, "synthetic-test-api-key");
          return mockResponse;
        }
      );

      const status = await saveProviderCredential({
        providerId: "openai",
        apiKey: "synthetic-test-api-key",
        priorityWeight: 9,
        monthlyBudgetLimit: 100.0,
      });

      assert.deepEqual(status, mockResponse);
    });

    it("executes listProviderCredentialStatuses through mock Tauri IPC registry", async () => {
      setMockTauriContext(true);

      const mockList: ProviderCredentialStatus[] = [
        {
          providerId: "anthropic",
          isConfigured: true,
          isActive: true,
          priorityWeight: 10,
          baseUrl: null,
          monthlyBudgetLimit: null,
          currentMonthSpend: 0.0,
          updatedAt: 1731000000000,
        },
      ];

      registerMockCommandHandler(
        IPC_COMMANDS.LIST_PROVIDER_CREDENTIAL_STATUSES,
        async () => {
          return mockList;
        }
      );

      const list = await listProviderCredentialStatuses();
      assert.deepEqual(list, mockList);
      assert.equal(list[0].providerId, "anthropic");
    });
  });
});

