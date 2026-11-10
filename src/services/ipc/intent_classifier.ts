// ============================================================================
// Nano Route - Intent Classification IPC Bridge
// File: src/services/ipc/intent_classifier.ts
// ============================================================================
// Frontend IPC wrapper invoking native on-device semantic intent classification,
// querying classifier availability, and executing gold evaluation benchmarks.
// Provider-neutral; contains zero cloud provider routing logic or API keys.
// ============================================================================

import { safeInvoke, isTauriContext, generateRequestId } from "./client.ts";
import {
  IPC_COMMANDS,
  type ClassifierStatusDto,
  type IntentClassificationRequestDto,
  type IntentClassificationResultDto,
  type ClassifierEvalReportDto,
  type UserIntent,
} from "./types.ts";

const DEFAULT_MOCK_CLASSIFIER_STATUS: ClassifierStatusDto = {
  availability: "available",
  modelId: "nano-route-router",
  modelVersion: "1.0.0",
  schemaVersion: "nano-route-intent-schema-v1",
  supportedIntents: [
    "software_engineering",
    "code_debugging",
    "reasoning_math",
    "general_conversation",
    "research_retrieval",
    "writing",
    "data_analysis",
    "translation",
    "summarization",
    "creative_generation",
    "other",
    "unknown",
  ],
  runtimeState: "ready",
  lastLatencyMs: 12,
  lastError: null,
};

const DEFAULT_MOCK_EVAL_REPORT: ClassifierEvalReportDto = {
  datasetVersion: "1.0.0",
  totalSamples: 20,
  correctPrimaryCount: 19,
  accuracyPercentage: 95.0,
  ambiguityCount: 1,
  multiIntentCount: 1,
  unknownCount: 1,
  averageLatencyMs: 9.4,
  p95LatencyMs: 14,
};

let mutableMockStatus = structuredClone(DEFAULT_MOCK_CLASSIFIER_STATUS);
let mockResultOverride: Partial<IntentClassificationResultDto> | null = null;

/**
 * Resets in-memory mock classifier state for test isolation.
 */
export function resetMockClassifierState(): void {
  mutableMockStatus = structuredClone(DEFAULT_MOCK_CLASSIFIER_STATUS);
  mockResultOverride = null;
}

/**
 * Overrides mock status for testing specific error or lifecycle states.
 */
export function setMockClassifierStatus(patch: Partial<ClassifierStatusDto>): void {
  mutableMockStatus = { ...mutableMockStatus, ...patch };
}

/**
 * Overrides next classification result for testing specific intents or ambiguity.
 */
export function setMockClassificationResult(
  override: Partial<IntentClassificationResultDto> | null
): void {
  mockResultOverride = override;
}

/**
 * Executes on-device local semantic classification on user prompt text.
 */
export async function classifyIntent(
  request: IntentClassificationRequestDto
): Promise<IntentClassificationResultDto> {
  const reqId = request.requestId || `req_cls_${generateRequestId()}`;

  if (!request.text || request.text.trim().length === 0) {
    throw new Error("Input text prompt cannot be empty or whitespace only");
  }

  if (!isTauriContext()) {
    if (mutableMockStatus.availability !== "available") {
      throw new Error(`Classifier unavailable: ${mutableMockStatus.availability}`);
    }

    // Default mock heuristic based on prompt keywords if not explicitly overridden
    let primaryIntent: UserIntent = "general_conversation";
    const lower = request.text.toLowerCase();

    if (lower.includes("fn ") || lower.includes("struct ") || lower.includes("rust") || lower.includes("code") || lower.includes("cache")) {
      primaryIntent = "software_engineering";
    } else if (lower.includes("panic") || lower.includes("leak") || lower.includes("debug") || lower.includes("fix")) {
      primaryIntent = "code_debugging";
    } else if (lower.includes("prove") || lower.includes("matrix") || lower.includes("math") || lower.includes("calculate")) {
      primaryIntent = "reasoning_math";
    } else if (lower.includes("translate") || lower.includes("urdu") || lower.includes("french")) {
      primaryIntent = "translation";
    } else if (lower.includes("csv") || lower.includes("table") || lower.includes("sales")) {
      primaryIntent = "data_analysis";
    } else if (lower.includes("summarize") || lower.includes("bullet")) {
      primaryIntent = "summarization";
    } else if (lower.includes("story") || lower.includes("poem") || lower.includes("fiction")) {
      primaryIntent = "creative_generation";
    } else if (lower.includes("draft") || lower.includes("proposal") || lower.includes("letter")) {
      primaryIntent = "writing";
    } else if (lower.includes("compare") || lower.includes("survey") || lower.includes("literature")) {
      primaryIntent = "research_retrieval";
    } else if (lower.includes("can you help with this")) {
      primaryIntent = "unknown";
    }

    const defaultResult: IntentClassificationResultDto = {
      requestId: reqId,
      primaryIntent,
      confidence: primaryIntent === "unknown" ? 0.22 : 0.88,
      alternatives: primaryIntent === "unknown" ? [] : [
        {
          intent: "general_conversation",
          normalizedScore: 0.08,
          rawScore: 0.1,
        },
      ],
      ambiguity: primaryIntent === "unknown" ? "unknown" : "not_ambiguous",
      classifierModelId: mutableMockStatus.modelId || "nano-route-router",
      classifierModelVersion: mutableMockStatus.modelVersion || "1.0.0",
      classifierSchemaVersion: mutableMockStatus.schemaVersion,
      inferenceLatencyMs: 8,
      totalLatencyMs: 11,
      explanation: `Primary intent '${primaryIntent}' selected with normalized confidence.`,
    };

    return { ...defaultResult, ...mockResultOverride };
  }

  return await safeInvoke<IntentClassificationResultDto>(
    IPC_COMMANDS.CLASSIFY_INTENT,
    { request: { ...request, requestId: reqId } },
    { requestId: reqId }
  );
}

/**
 * Queries the current operational availability of the intent classifier.
 */
export async function getClassifierStatus(
  requestId?: string
): Promise<ClassifierStatusDto> {
  const reqId = requestId || `req_cls_${generateRequestId()}`;

  if (!isTauriContext()) {
    return structuredClone(mutableMockStatus);
  }

  return await safeInvoke<ClassifierStatusDto>(
    IPC_COMMANDS.GET_CLASSIFIER_STATUS,
    undefined,
    { requestId: reqId }
  );
}

/**
 * Runs the deterministic gold benchmark evaluation set against the active classifier.
 */
export async function evaluateClassifier(
  requestId?: string
): Promise<ClassifierEvalReportDto> {
  const reqId = requestId || `req_cls_${generateRequestId()}`;

  if (!isTauriContext()) {
    return structuredClone(DEFAULT_MOCK_EVAL_REPORT);
  }

  return await safeInvoke<ClassifierEvalReportDto>(
    IPC_COMMANDS.EVALUATE_CLASSIFIER,
    undefined,
    { requestId: reqId }
  );
}

