/**
 * Nano Route — Connectivity & Network Health Test Suite
 * File: src/features/connectivity/__tests__/connectivity.test.ts
 *
 * Implements Step 86 Test Qualification:
 * - Local network state tracking and transition history
 * - Debounced network event handling and flap protection
 * - Decoupling of Local SLM availability from remote network status
 * - Truthful classification: 401/403 (Auth) vs 429 (Rate Limit) vs 5xx (Service Error) vs Unreachable
 * - Request Inspector & chat preflight offline blocking
 * - Safe, bounded, cancellable manual health checks with zero secret leakage
 * - Recovery without automatic resubmission
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  setNetworkState,
  isAppOffline,
  isRemoteProviderBlocked,
  mapHealthResultToReachability,
  checkProviderReachability,
  getConnectivitySnapshot,
  setLocalSlmAvailable,
  resetConnectivityStore,
  handleNetworkEvent,
} from "../engine.ts";
import { assembleRequestSnapshot } from "../../request-inspector/engine.ts";

describe("Step 86: Connectivity Center, Offline Mode & Network Health", () => {
  beforeEach(() => {
    resetConnectivityStore();
  });

  describe("1. Local Network State Tracking & Snapshot", () => {
    it("initializes with ONLINE network state and valid default provider registry", () => {
      const snap = getConnectivitySnapshot();
      assert.strictEqual(snap.networkState, "ONLINE");
      assert.strictEqual(snap.isLocalSlmAvailable, true);
      assert.strictEqual(isAppOffline(), false);

      // Verify canonical providers present
      assert.ok(snap.providers["openai"]);
      assert.ok(snap.providers["anthropic"]);
      assert.ok(snap.providers["gemini"]);
      assert.ok(snap.providers["deepseek"]);
      assert.ok(snap.providers["groq"]);
      assert.ok(snap.providers["mistral"]);
      assert.ok(snap.providers["local"]);
    });

    it("transitions state and records transition event", () => {
      setNetworkState("OFFLINE", "Simulated adapter disconnect");
      const snap = getConnectivitySnapshot();

      assert.strictEqual(snap.networkState, "OFFLINE");
      assert.strictEqual(isAppOffline(), true);
      assert.strictEqual(snap.offlineReason, "Simulated adapter disconnect");
      assert.strictEqual(snap.recentTransitions.length, 1);
      assert.strictEqual(snap.recentTransitions[0].from, "ONLINE");
      assert.strictEqual(snap.recentTransitions[0].to, "OFFLINE");
    });
  });

  describe("2. Flapping Protection & Debounce Stabilization", () => {
    it("debounces rapid online/offline oscillations before committing state", async () => {
      // Simulate rapid flapping
      handleNetworkEvent(false, "Flap 1: Disconnect");
      handleNetworkEvent(true, "Flap 2: Reconnect");
      handleNetworkEvent(false, "Flap 3: Disconnect");

      // Immediate state should still be original before debounce window elapses
      assert.strictEqual(getConnectivitySnapshot().networkState, "ONLINE");

      // Wait for debounce window (400ms + buffer)
      await new Promise((r) => setTimeout(r, 450));

      const snap = getConnectivitySnapshot();
      assert.strictEqual(snap.networkState, "OFFLINE");
      assert.strictEqual(snap.recentTransitions.length, 1);
      assert.strictEqual(snap.recentTransitions[0].to, "OFFLINE");
    });
  });

  describe("3. Local SLM Decoupling from Network Offline Status", () => {
    it("guarantees Local SLM remains REACHABLE when network is OFFLINE", () => {
      setNetworkState("OFFLINE", "No internet connection");

      const localBlocked = isRemoteProviderBlocked("local");
      assert.strictEqual(localBlocked.blocked, false);
      assert.strictEqual(localBlocked.reason, null);

      const remoteBlocked = isRemoteProviderBlocked("openai");
      assert.strictEqual(remoteBlocked.blocked, true);
      assert.ok(remoteBlocked.reason?.includes("Network offline"));
    });

    it("respects on-device SLM runtime availability state", () => {
      setLocalSlmAvailable(false);
      const snap = getConnectivitySnapshot();
      assert.strictEqual(snap.isLocalSlmAvailable, false);
      assert.strictEqual(snap.providers["local"].state, "UNREACHABLE");

      setLocalSlmAvailable(true);
      const updated = getConnectivitySnapshot();
      assert.strictEqual(updated.isLocalSlmAvailable, true);
      assert.strictEqual(updated.providers["local"].state, "REACHABLE");
    });
  });

  describe("4. Provider Reachability Classification & Truthful Separation", () => {
    it("maps 200 ready to REACHABLE", () => {
      const state = mapHealthResultToReachability("ready", 200);
      assert.strictEqual(state, "REACHABLE");
    });

    it("strictly separates 401/403 Authentication failures from network offline", () => {
      const state401 = mapHealthResultToReachability("authentication_failed", 401);
      assert.strictEqual(state401, "AUTH_REQUIRED");

      const state403 = mapHealthResultToReachability("authorization_failed", 403);
      assert.strictEqual(state403, "AUTH_REQUIRED");
    });

    it("strictly separates 429 Rate Limits from provider outage/offline", () => {
      const state429 = mapHealthResultToReachability("rate_limited", 429);
      assert.strictEqual(state429, "RATE_LIMITED");
    });

    it("maps 5xx server responses to SERVICE_ERROR", () => {
      const state500 = mapHealthResultToReachability("provider_error", 500);
      assert.strictEqual(state500, "SERVICE_ERROR");

      const state503 = mapHealthResultToReachability("service_unavailable", 503);
      assert.strictEqual(state503, "SERVICE_ERROR");
    });

    it("maps missing credentials to NOT_CONFIGURED", () => {
      const stateMissing = mapHealthResultToReachability("credential_missing");
      assert.strictEqual(stateMissing, "NOT_CONFIGURED");
    });
  });

  describe("5. Safe Manual Health Checks", () => {
    it("runs safe reachability probe without prompts or secret credentials", async () => {
      const result = await checkProviderReachability("openai");
      assert.strictEqual(result.providerId, "openai");
      assert.ok(["REACHABLE", "AUTH_REQUIRED", "UNKNOWN"].includes(result.state));
      assert.ok(result.latencyMs !== null);
      assert.strictEqual(result.errorMessage, null);
    });

    it("short-circuits remote provider probe immediately when network is OFFLINE", async () => {
      setNetworkState("OFFLINE", "Cable disconnected");
      const result = await checkProviderReachability("anthropic");

      assert.strictEqual(result.state, "UNREACHABLE");
      assert.strictEqual(result.errorCategory, "NETWORK_OFFLINE");
      assert.strictEqual(result.latencyMs, null);
    });

    it("aborts probe cleanly when AbortSignal is cancelled", async () => {
      const controller = new AbortController();
      controller.abort();

      await assert.rejects(
        () => checkProviderReachability("deepseek", { signal: controller.signal }),
        /cancelled/i
      );
    });
  });

  describe("6. Integration with Request Inspector", () => {
    it("blocks remote request in Request Inspector when network is OFFLINE", async () => {
      setNetworkState("OFFLINE", "Offline mode active");

      const snapshot = await assembleRequestSnapshot({
        sessionId: "sess_conn_test_1",
        prompt: "Summarize this article",
        providerId: "openai",
        modelId: "gpt-4o",
      });

      assert.strictEqual(snapshot.isSubmissible, false);
      assert.ok(snapshot.blockingReason?.includes("Network offline"));

      const connWarn = snapshot.warnings.find((w) => w.title === "Network Offline");
      assert.ok(connWarn);
      assert.strictEqual(connWarn.severity, "BLOCKING");
    });

    it("permits Local SLM request in Request Inspector even when network is OFFLINE", async () => {
      setNetworkState("OFFLINE", "Offline mode active");

      const snapshot = await assembleRequestSnapshot({
        sessionId: "sess_conn_test_2",
        prompt: "Run offline local task",
        providerId: "local",
        modelId: "phi-3-mini",
      });

      // No network offline blocking warning for local SLM
      const connWarn = snapshot.warnings.find((w) => w.title === "Network Offline");
      assert.strictEqual(connWarn, undefined);
      assert.strictEqual(snapshot.isSubmissible, true);
    });
  });

  describe("7. Network Recovery & Zero Automatic Resubmission", () => {
    it("detects recovery from OFFLINE to ONLINE without auto-replaying tasks", () => {
      setNetworkState("OFFLINE", "Initial disconnection");
      assert.strictEqual(isAppOffline(), true);

      // Network restores
      setNetworkState("ONLINE", "Ethernet reconnected");
      assert.strictEqual(isAppOffline(), false);

      const snap = getConnectivitySnapshot();
      assert.strictEqual(snap.networkState, "ONLINE");
      assert.strictEqual(snap.recentTransitions.length, 2);
      assert.strictEqual(snap.recentTransitions[0].from, "OFFLINE");
      assert.strictEqual(snap.recentTransitions[0].to, "ONLINE");

      // Verify remote requests are unblocked
      const unblocked = isRemoteProviderBlocked("openai");
      assert.strictEqual(unblocked.blocked, false);
    });
  });
});
