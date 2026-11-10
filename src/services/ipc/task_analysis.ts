// ============================================================================
// Nano Route - Task Analysis IPC Bridge
// File: src/services/ipc/task_analysis.ts
// ============================================================================
// Frontend IPC wrapper invoking native on-device multidimensional task analysis
// (complexity, domain, capability requirements). Strictly provider-neutral.
// ============================================================================

import { safeInvoke, isTauriContext, generateRequestId } from "./client.ts";
import {
  IPC_COMMANDS,
  type TaskAnalysisRequestDto,
  type TaskAnalysisResultDto,
  type TaskAnalyzerStatusDto,
  type TaskComplexity,
  type TaskDomain,
} from "./types.ts";

const DEFAULT_MOCK_ANALYZER_STATUS: TaskAnalyzerStatusDto = {
  isAvailable: true,
  modelId: "nano-route-router",
  modelVersion: "1.0.0",
  schemaVersion: "nano-route-analysis-schema-v1",
  supportedDomains: [
    "software_engineering",
    "mathematics",
    "research",
    "long_form_writing",
    "business",
    "data_analysis",
    "education",
    "translation",
    "planning",
    "technical_documentation",
    "creative",
    "general",
    "other",
    "unknown",
  ],
  supportedCapabilities: [
    "text_generation",
    "long_context",
    "multi_turn_context",
    "code_understanding",
    "code_generation",
    "mathematical_reasoning",
    "deep_reasoning",
    "structured_output",
    "document_analysis",
    "large_document_ingestion",
    "web_retrieval",
    "image_input",
    "audio_input",
    "video_input",
    "tool_calling",
    "file_handling",
    "citation_support",
    "search_grounding",
    "translation",
    "summarization",
  ],
  lastLatencyMs: 14,
  lastError: null,
};

let mutableMockStatus = structuredClone(DEFAULT_MOCK_ANALYZER_STATUS);
let mockResultOverride: Partial<TaskAnalysisResultDto> | null = null;

/**
 * Resets in-memory mock task analyzer state for test isolation.
 */
export function resetMockTaskAnalyzerState(): void {
  mutableMockStatus = structuredClone(DEFAULT_MOCK_ANALYZER_STATUS);
  mockResultOverride = null;
}

/**
 * Overrides mock status for testing specific error or lifecycle states.
 */
export function setMockTaskAnalyzerStatus(patch: Partial<TaskAnalyzerStatusDto>): void {
  mutableMockStatus = { ...mutableMockStatus, ...patch };
}

/**
 * Overrides next analysis result for testing specific complexity, domain, or capability patterns.
 */
export function setMockTaskAnalysisResult(
  override: Partial<TaskAnalysisResultDto> | null
): void {
  mockResultOverride = override;
}

/**
 * Executes local on-device multidimensional task analysis.
 */
export async function analyzeTask(
  request: TaskAnalysisRequestDto
): Promise<TaskAnalysisResultDto> {
  const reqId = request.requestId || `req_an_${generateRequestId()}`;

  if (!request.text || request.text.trim().length === 0) {
    throw new Error("Task prompt cannot be empty or whitespace only");
  }

  if (!isTauriContext()) {
    if (!mutableMockStatus.isAvailable) {
      throw new Error("Task analyzer is unavailable");
    }

    const lower = request.text.toLowerCase();
    let primaryDomain: TaskDomain = "general";
    let complexityLevel: TaskComplexity = "low";

    if (lower.includes("fn ") || lower.includes("struct ") || lower.includes("rust") || lower.includes("code") || lower.includes("refactor")) {
      primaryDomain = "software_engineering";
      complexityLevel = "high";
    } else if (lower.includes("prove") || lower.includes("matrix") || lower.includes("math")) {
      primaryDomain = "mathematics";
      complexityLevel = "high";
    } else if (lower.includes("translate") || lower.includes("urdu")) {
      primaryDomain = "translation";
      complexityLevel = "low";
    } else if (lower.includes("csv") || lower.includes("sales")) {
      primaryDomain = "data_analysis";
      complexityLevel = "moderate";
    }

    const defaultResult: TaskAnalysisResultDto = {
      requestId: reqId,
      intent: {
        primaryIntent: primaryDomain === "software_engineering" ? "software_engineering" : "general_conversation",
        confidence: 0.88,
        ambiguity: "not_ambiguous",
        secondaryIntents: [],
      },
      complexity: {
        level: complexityLevel,
        confidence: 0.85,
        source: "derived",
        score: complexityLevel === "high" ? 0.78 : 0.32,
        evidenceCodes: ["intent_base"],
      },
      primaryDomain: {
        domain: primaryDomain,
        confidence: 0.85,
        source: "derived",
      },
      secondaryDomains: [],
      capabilities: [
        {
          capability: "text_generation",
          strength: "required",
          confidence: 0.99,
          source: "derived",
          reasonCode: "baseline_text_generation",
        },
      ],
      evidence: [],
      conflicts: [],
      ambiguity: "low",
      completeness: "complete",
      analyzerModelId: mutableMockStatus.modelId || "nano-route-router",
      analyzerModelVersion: mutableMockStatus.modelVersion || "1.0.0",
      analysisSchemaVersion: mutableMockStatus.schemaVersion,
      inferenceLatencyMs: 9,
      totalLatencyMs: 14,
      explanation: `Analyzed task: Domain '${primaryDomain}', Complexity '${complexityLevel}'.`,
    };

    return { ...defaultResult, ...mockResultOverride };
  }

  return await safeInvoke<TaskAnalysisResultDto>(
    IPC_COMMANDS.ANALYZE_TASK,
    { request: { ...request, requestId: reqId } },
    { requestId: reqId }
  );
}

/**
 * Queries the operational status and supported taxonomies of the task analyzer.
 */
export async function getTaskAnalyzerStatus(
  requestId?: string
): Promise<TaskAnalyzerStatusDto> {
  const reqId = requestId || `req_an_${generateRequestId()}`;

  if (!isTauriContext()) {
    return structuredClone(mutableMockStatus);
  }

  return await safeInvoke<TaskAnalyzerStatusDto>(
    IPC_COMMANDS.GET_TASK_ANALYZER_STATUS,
    undefined,
    { requestId: reqId }
  );
}

