/**
 * Nano Route — Request Inspector & Preflight Transparency Types
 * File: src/features/request-inspector/types.ts
 *
 * Implements Step 84:
 * - Read-only canonical request snapshot representations
 * - Composition breakdown (prompt, templates, context collections, attachments)
 * - Multi-engine preflight synthesis (Step 76 Context, Step 75 Budget)
 * - Routing transparency, capability validation, and unified warnings
 * - Final submission safety review contracts
 */

import type { ContextPreflightEvaluation } from "../context/types.ts";
import type { BudgetPreflightEvaluation } from "../budget/types.ts";
import type { LocalAttachment } from "../attachments/types.ts";

export type InspectorSeverity = "INFO" | "WARNING" | "BLOCKING";

export interface InspectorWarning {
  id: string;
  severity: InspectorSeverity;
  source: "CONTEXT" | "BUDGET" | "ATTACHMENT" | "ROUTING" | "SECURITY";
  title: string;
  message: string;
}

export interface InspectorTemplateSummary {
  id: string;
  name: string;
  variableCount: number;
  unresolvedCount: number;
}

export interface InspectorPresetSummary {
  id: string;
  name: string;
  preferredProvider?: string | null;
  preferredModel?: string | null;
}

export interface InspectorCollectionSummary {
  id: string;
  name: string;
  itemCount: number;
  hasSensitiveNotes: boolean;
  hasStaleReferences: boolean;
  estimatedTokens: number;
}

export interface InspectorAttachmentSummary {
  id: string;
  name: string;
  sizeBytes: number;
  category: string;
  status: string;
  isMultimodal: boolean;
  estimatedTokens: number;
}

export interface InspectorRoutingSummary {
  mode: "AUTOMATIC" | "MANUAL";
  providerId: string;
  modelId: string;
  displayName: string;
  isOverride: boolean;
  capabilityStatus: "COMPATIBLE" | "INCOMPATIBLE" | "UNVERIFIED";
  compatibilityDetails?: string | null;
}

/**
 * Immutable canonical request snapshot evaluated at review time.
 */
export interface CanonicalRequestSnapshot {
  id: string;
  createdAtMs: number;
  sessionId: string | null;
  
  // Composition layers
  directPrompt: string;
  fullAssembledPrompt: string;
  template?: InspectorTemplateSummary | null;
  preset?: InspectorPresetSummary | null;
  contextCollection?: InspectorCollectionSummary | null;
  attachments: InspectorAttachmentSummary[];

  // Routing & Provider
  routing: InspectorRoutingSummary;

  // Authoritative Preflights
  contextPreflight: ContextPreflightEvaluation;
  budgetPreflight: BudgetPreflightEvaluation;

  // Aggregate Metrics
  totalEstimatedTokens: number;
  estimatedCostUsd: number | null;
  headroomTokens: number;
  contextUsagePercent: number;

  // Policy & Submissibility
  warnings: InspectorWarning[];
  isSubmissible: boolean;
  blockingReason: string | null;
}

export interface AssembleSnapshotParams {
  sessionId: string | null;
  prompt: string;
  attachments?: LocalAttachment[];
  historyMessages?: Array<{ id: string; sender?: string; role?: string; content: string }>;
  providerId?: string;
  modelId?: string;
  isManualOverride?: boolean;
  templateInfo?: InspectorTemplateSummary | null;
  presetInfo?: InspectorPresetSummary | null;
}

export interface RevalidationResult {
  isValid: boolean;
  isStale: boolean;
  freshSnapshot: CanonicalRequestSnapshot;
  blockReason?: string | null;
}
