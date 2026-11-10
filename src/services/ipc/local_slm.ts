// ============================================================================
// Nano Route - Local SLM Runtime IPC Bridge
// File: src/services/ipc/local_slm.ts
// ============================================================================
// Frontend IPC wrapper querying native local SLM runtime status, triggering
// local model loading/unloading, reading performance metrics, and executing
// privacy-preserving on-device inference.
// Zero user prompts or raw model weights leave the local machine.
// ============================================================================

import { safeInvoke, isTauriContext, generateRequestId } from "./client.ts";
import {
  IPC_COMMANDS,
  type LocalRuntimeStatusDto,
  type LocalModelStatus,
  type LocalRuntimeMetricsDto,
  type LocalInferenceResultDto,
} from "./types.ts";

/**
 * Baseline mock runtime status for browser development and offline testing.
 */
const DEFAULT_MOCK_RUNTIME_STATUS: LocalRuntimeStatusDto = {
  state: "ready",
  backend: "onnx",
  executionProvider: "cpu",
  modelId: "nano-route-router",
  modelVersion: "1.0.0",
  modelStatus: "loaded",
  runtimeVersion: "ort-1.16-native",
  isBusy: false,
  queueDepth: 0,
  lastInferenceAtMs: null,
  lastLatencyMs: null,
  lastError: null,
};

const DEFAULT_MOCK_METRICS: LocalRuntimeMetricsDto = {
  totalInferences: 0,
  successfulInferences: 0,
  failedInferences: 0,
  cancelledInferences: 0,
  lastTokenizationMs: 0,
  lastQueueWaitMs: 0,
  lastInferenceMs: 0,
  lastTotalMs: 0,
  lastInputTokens: 0,
  averageInferenceMs: 0.0,
  coldLoadMs: 14,
};

let mutableMockStatus = structuredClone(DEFAULT_MOCK_RUNTIME_STATUS);
let mutableMockMetrics = structuredClone(DEFAULT_MOCK_METRICS);

/**
 * Resets in-memory mock state for test isolation.
 */
export function resetMockLocalSlm(): void {
  mutableMockStatus = structuredClone(DEFAULT_MOCK_RUNTIME_STATUS);
  mutableMockMetrics = structuredClone(DEFAULT_MOCK_METRICS);
}

/**
 * Overrides mock status for testing specific error or lifecycle states.
 */
export function setMockLocalSlmStatus(patch: Partial<LocalRuntimeStatusDto>): void {
  mutableMockStatus = { ...mutableMockStatus, ...patch };
}

/**
 * Queries the read-safe status of the local SLM runtime.
 */
export async function getLocalRuntimeStatus(
  requestId?: string
): Promise<LocalRuntimeStatusDto> {
  const reqId = requestId || `req_local_${generateRequestId()}`;

  if (!isTauriContext()) {
    return structuredClone(mutableMockStatus);
  }

  return await safeInvoke<LocalRuntimeStatusDto>(
    IPC_COMMANDS.GET_LOCAL_RUNTIME_STATUS,
    undefined,
    { requestId: reqId }
  );
}

/**
 * Queries the current installation and load status of the local router model.
 */
export async function getLocalModelStatus(
  requestId?: string
): Promise<LocalModelStatus> {
  const reqId = requestId || `req_local_${generateRequestId()}`;

  if (!isTauriContext()) {
    return mutableMockStatus.modelStatus;
  }

  return await safeInvoke<LocalModelStatus>(
    IPC_COMMANDS.GET_LOCAL_MODEL_STATUS,
    undefined,
    { requestId: reqId }
  );
}

/**
 * Explicitly initializes the ONNX runtime environment.
 */
export async function initializeLocalRuntime(
  requestId?: string
): Promise<boolean> {
  const reqId = requestId || `req_local_${generateRequestId()}`;

  if (!isTauriContext()) {
    mutableMockStatus.state = "ready";
    return true;
  }

  return await safeInvoke<boolean>(
    IPC_COMMANDS.INITIALIZE_LOCAL_RUNTIME,
    undefined,
    { requestId: reqId }
  );
}

/**
 * Loads the default designated router SLM package into active session memory.
 */
export async function loadRouterModel(
  requestId?: string
): Promise<boolean> {
  const reqId = requestId || `req_local_${generateRequestId()}`;

  if (!isTauriContext()) {
    mutableMockStatus.state = "ready";
    mutableMockStatus.modelStatus = "loaded";
    mutableMockStatus.modelId = "nano-route-router";
    mutableMockStatus.modelVersion = "1.0.0";
    return true;
  }

  return await safeInvoke<boolean>(
    IPC_COMMANDS.LOAD_ROUTER_MODEL,
    undefined,
    { requestId: reqId }
  );
}

/**
 * Unloads the active model session and frees native execution resources.
 */
export async function unloadRouterModel(
  requestId?: string
): Promise<boolean> {
  const reqId = requestId || `req_local_${generateRequestId()}`;

  if (!isTauriContext()) {
    mutableMockStatus.modelStatus = "not_loaded";
    return true;
  }

  return await safeInvoke<boolean>(
    IPC_COMMANDS.UNLOAD_ROUTER_MODEL,
    undefined,
    { requestId: reqId }
  );
}

/**
 * Queries local SLM performance metrics.
 */
export async function getLocalRuntimeMetrics(
  requestId?: string
): Promise<LocalRuntimeMetricsDto> {
  const reqId = requestId || `req_local_${generateRequestId()}`;

  if (!isTauriContext()) {
    return structuredClone(mutableMockMetrics);
  }

  return await safeInvoke<LocalRuntimeMetricsDto>(
    IPC_COMMANDS.GET_LOCAL_RUNTIME_METRICS,
    undefined,
    { requestId: reqId }
  );
}

/**
 * Executes on-device inference over a text prompt.
 * NEVER makes external network calls or leaks data to cloud providers.
 */
export async function runLocalInference(
  text: string,
  requestId?: string
): Promise<LocalInferenceResultDto> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Inference prompt text cannot be empty or whitespace only");
  }

  const reqId = requestId || `req_local_${generateRequestId()}`;

  if (!isTauriContext()) {
    if (mutableMockStatus.modelStatus !== "loaded") {
      throw new Error("Cannot execute inference: No local model is currently loaded");
    }

    const tokenCount = 2 + trimmed.split(/\s+/).length;
    const latencyMs = 8;
    const now = Date.now();

    mutableMockStatus.lastInferenceAtMs = now;
    mutableMockStatus.lastLatencyMs = latencyMs;

    mutableMockMetrics.totalInferences += 1;
    mutableMockMetrics.successfulInferences += 1;
    mutableMockMetrics.lastTokenizationMs = 1;
    mutableMockMetrics.lastInferenceMs = latencyMs;
    mutableMockMetrics.lastTotalMs = latencyMs + 1;
    mutableMockMetrics.lastInputTokens = tokenCount;

    return {
      requestId: reqId,
      modelId: mutableMockStatus.modelId || "nano-route-router",
      outputShape: [1, 8],
      logitsPreview: [0.85, 0.05, 0.03, 0.02, 0.02, 0.01, 0.01, 0.01],
      latencyMs,
      tokenCount,
    };
  }

  return await safeInvoke<LocalInferenceResultDto>(
    IPC_COMMANDS.RUN_LOCAL_INFERENCE,
    { text: trimmed },
    { requestId: reqId }
  );
}
