/**
 * Nano Route — Request Inspector & Preflight Transparency Engine
 * File: src/features/request-inspector/engine.ts
 *
 * Implements Step 84:
 * - Assembles unified, read-only canonical request snapshots
 * - Synthesizes Step 76 Context Preflight and Step 75 Budget Guardrails
 * - Detects context reference packs, private notes, and attachment states
 * - Performs fresh, authoritative revalidation immediately before submission
 * - Enforces zero secret leakage and zero network activity during inspection
 */

import { evaluateContextPreflight, estimateTextTokens, resolveModelContextLimits } from "../context/engine.ts";
import { evaluateBudgetPreflight } from "../budget/engine.ts";
import { formatAttachmentsAsPromptContext } from "../attachments/validator.ts";
import { isRemoteProviderBlocked } from "../connectivity/engine.ts";
import type {
  CanonicalRequestSnapshot,
  AssembleSnapshotParams,
  InspectorWarning,
  InspectorAttachmentSummary,
  InspectorCollectionSummary,
  InspectorRoutingSummary,
  RevalidationResult,
} from "./types.ts";

/**
 * Extracts Context Collection information if embedded within the prompt.
 */
function extractContextCollectionSummary(
  prompt: string
): { cleanPrompt: string; summary: InspectorCollectionSummary | null } {
  const match = prompt.match(/\[CONTEXT REFERENCE PACK: "([^"]+)"\]([\s\S]*?)\[\/CONTEXT REFERENCE PACK\]/);
  if (!match) {
    return { cleanPrompt: prompt, summary: null };
  }

  const name = match[1];
  const body = match[2];
  const items = body.split(/--- Reference \d+:/).filter((s) => s.trim().length > 0);
  const hasSensitiveNotes = body.includes("Private Note");
  const hasStaleReferences = body.includes("STALE") || body.includes("unavailable or deleted");
  const estimatedTokens = estimateTextTokens(match[0]);

  // Strip collection block to isolate the user's direct prompt
  const cleanPrompt = prompt.replace(match[0], "").trim();

  return {
    cleanPrompt,
    summary: {
      id: `cc_detected_${name}`,
      name,
      itemCount: items.length,
      hasSensitiveNotes,
      hasStaleReferences,
      estimatedTokens,
    },
  };
}

/**
 * Computes an approximate request cost based on model and token counts.
 */
function computeEstimatedCostUsd(
  providerId: string,
  modelId: string,
  inputTokens: number
): number {
  const cleanProvider = providerId.toLowerCase();
  const cleanModel = modelId.toLowerCase();

  // Standard pricing reference (dollars per 1M tokens)
  let ratePerMillion = 2.5; // default fallback ($2.50 / 1M)
  if (cleanProvider === "local") {
    ratePerMillion = 0.0;
  } else if (cleanProvider === "groq") {
    ratePerMillion = 0.59;
  } else if (cleanModel.includes("mini") || cleanModel.includes("flash") || cleanModel.includes("small")) {
    ratePerMillion = 0.15;
  } else if (cleanModel.includes("o1") || cleanModel.includes("opus")) {
    ratePerMillion = 15.0;
  }

  const cost = (inputTokens / 1_000_000) * ratePerMillion;
  return Math.round(cost * 10000) / 10000;
}

/**
 * Assembles a comprehensive, immutable request snapshot.
 */
export async function assembleRequestSnapshot(
  params: AssembleSnapshotParams
): Promise<CanonicalRequestSnapshot> {
  const now = Date.now();
  const snapshotId = `req_snap_${now}_${Math.random().toString(36).substring(2, 7)}`;

  const providerId = (params.providerId || "deepseek").trim().toLowerCase();
  const modelId = (params.modelId || "deepseek-chat").trim();
  const isManualOverride = Boolean(params.isManualOverride);

  // 1. Process attachments
  const attachmentSummaries: InspectorAttachmentSummary[] = [];
  const validPreparedContexts: any[] = [];
  let hasAttachmentErrors = false;

  if (params.attachments && params.attachments.length > 0) {
    for (const att of params.attachments) {
      const isError = ["UNSUPPORTED", "TOO_LARGE", "UNREADABLE", "ERROR"].includes(att.status);
      if (isError) hasAttachmentErrors = true;

      const isMultimodal = att.metadata.category === "image";
      const tokenCount = att.preparedContext
        ? estimateTextTokens(att.preparedContext.textContent || "")
        : 0;

      attachmentSummaries.push({
        id: att.id,
        name: att.metadata.name,
        sizeBytes: att.metadata.sizeBytes,
        category: att.metadata.category,
        status: att.status,
        isMultimodal,
        estimatedTokens: tokenCount,
      });

      if (att.preparedContext && !isError) {
        validPreparedContexts.push(att.preparedContext);
      }
    }
  }

  // 2. Format attachments into prompt context
  const attachmentsContext = formatAttachmentsAsPromptContext(validPreparedContexts);

  // 3. Extract Context Collection summary if present
  const { cleanPrompt, summary: collectionSummary } = extractContextCollectionSummary(params.prompt);

  // 4. Assemble canonical prompt string
  const rawPrompt = params.prompt.trim();
  const fullAssembledPrompt = attachmentsContext
    ? rawPrompt
      ? `${rawPrompt}\n\n${attachmentsContext}`
      : attachmentsContext
    : rawPrompt;

  // 5. Context Preflight via Step 76
  const limits = resolveModelContextLimits(providerId, modelId);
  const contextPreflight = evaluateContextPreflight({
    providerId,
    modelId,
    prompt: fullAssembledPrompt,
    history: params.historyMessages || [],
  });

  // 6. Cost Estimation & Budget Preflight via Step 75
  const estimatedCostUsd = computeEstimatedCostUsd(
    providerId,
    modelId,
    contextPreflight.estimatedInputTokens
  );
  const budgetPreflight = await evaluateBudgetPreflight(providerId, estimatedCostUsd);

  // 7. Routing Summary & Capability Check
  let capabilityStatus: InspectorRoutingSummary["capabilityStatus"] = "COMPATIBLE";
  let compatibilityDetails: string | null = null;

  const hasMultimodal = attachmentSummaries.some((a) => a.isMultimodal);
  if (hasMultimodal && providerId === "local") {
    capabilityStatus = "INCOMPATIBLE";
    compatibilityDetails = "Local SLM does not currently support image inputs.";
  }

  const routing: InspectorRoutingSummary = {
    mode: isManualOverride ? "MANUAL" : "AUTOMATIC",
    providerId,
    modelId,
    displayName: limits.displayName || `${providerId}/${modelId}`,
    isOverride: isManualOverride,
    capabilityStatus,
    compatibilityDetails,
  };

  // 8. Synthesize Unified Warnings
  const warnings: InspectorWarning[] = [];

  // Context warnings
  if (!contextPreflight.allowed || contextPreflight.classification === "EXCEEDS_LIMIT") {
    warnings.push({
      id: "warn_context_overflow",
      severity: "BLOCKING",
      source: "CONTEXT",
      title: "Context Window Limit Exceeded",
      message:
        contextPreflight.blockReason ||
        `Total tokens exceed ${limits.contextWindow.toLocaleString()} token window. Reduce prompt or conversation history.`,
    });
  } else if (contextPreflight.classification === "NEAR_LIMIT") {
    warnings.push({
      id: "warn_context_near_limit",
      severity: "WARNING",
      source: "CONTEXT",
      title: "Approaching Context Limit",
      message: `Prompt uses ${contextPreflight.percentUsed.toFixed(1)}% of available context window.`,
    });
  }

  // Budget warnings
  if (!budgetPreflight.allowed) {
    warnings.push({
      id: "warn_budget_blocked",
      severity: "BLOCKING",
      source: "BUDGET",
      title: "Budget Guardrail Block",
      message: budgetPreflight.warningNotice || "Request blocked by local monthly budget limit.",
    });
  } else if (budgetPreflight.warningNotice) {
    warnings.push({
      id: "warn_budget_threshold",
      severity: "WARNING",
      source: "BUDGET",
      title: "Budget Notice",
      message: budgetPreflight.warningNotice,
    });
  }

  // Attachment warnings
  if (hasAttachmentErrors) {
    warnings.push({
      id: "warn_attachment_error",
      severity: "BLOCKING",
      source: "ATTACHMENT",
      title: "Failed Attachments",
      message: "One or more attachments failed validation or could not be prepared.",
    });
  }

  if (capabilityStatus === "INCOMPATIBLE") {
    warnings.push({
      id: "warn_routing_incompatible",
      severity: "BLOCKING",
      source: "ROUTING",
      title: "Model Capability Conflict",
      message: compatibilityDetails || "Selected model cannot process requested input formats.",
    });
  }

  // Step 86: Connectivity & Offline check
  const connCheck = isRemoteProviderBlocked(providerId);
  if (connCheck.blocked && connCheck.reason) {
    warnings.push({
      id: "warn_connectivity_blocked",
      severity: "BLOCKING",
      source: "ROUTING",
      title: "Network Offline",
      message: connCheck.reason,
    });
  }

  // Context collection warnings
  if (collectionSummary?.hasSensitiveNotes) {
    warnings.push({
      id: "warn_sensitive_notes",
      severity: "WARNING",
      source: "SECURITY",
      title: "Private Notes Included",
      message:
        "This request contains private user notes from a Context Collection. Note content will be transmitted to the model provider.",
    });
  }

  if (collectionSummary?.hasStaleReferences) {
    warnings.push({
      id: "warn_stale_references",
      severity: "WARNING",
      source: "CONTEXT",
      title: "Stale References",
      message: "One or more references in the active Context Collection point to deleted conversation turns.",
    });
  }

  // Determine Submissibility
  const hasBlockingWarnings = warnings.some((w) => w.severity === "BLOCKING");
  const isPromptEmpty = fullAssembledPrompt.trim().length === 0;

  const isSubmissible = !hasBlockingWarnings && !isPromptEmpty;
  const blockingReason = isPromptEmpty
    ? "Prompt cannot be empty."
    : warnings.find((w) => w.severity === "BLOCKING")?.message || null;

  return {
    id: snapshotId,
    createdAtMs: now,
    sessionId: params.sessionId,
    directPrompt: cleanPrompt,
    fullAssembledPrompt,
    template: params.templateInfo || null,
    preset: params.presetInfo || null,
    contextCollection: collectionSummary,
    attachments: attachmentSummaries,
    routing,
    contextPreflight,
    budgetPreflight,
    totalEstimatedTokens: contextPreflight.totalRequiredTokens,
    estimatedCostUsd,
    headroomTokens: contextPreflight.availableHeadroomTokens,
    contextUsagePercent: contextPreflight.percentUsed,
    warnings,
    isSubmissible,
    blockingReason,
  };
}

/**
 * Revalidates snapshot immediately before submission to prevent stale sends.
 */
export async function revalidateSnapshotBeforeSubmit(
  cachedSnapshot: CanonicalRequestSnapshot,
  currentParams: AssembleSnapshotParams
): Promise<RevalidationResult> {
  const freshSnapshot = await assembleRequestSnapshot(currentParams);

  // Check if anything materially changed
  const isPromptChanged = freshSnapshot.fullAssembledPrompt !== cachedSnapshot.fullAssembledPrompt;
  const isAttachmentsCountChanged = freshSnapshot.attachments.length !== cachedSnapshot.attachments.length;
  const isProviderChanged = freshSnapshot.routing.providerId !== cachedSnapshot.routing.providerId;

  const isStale = isPromptChanged || isAttachmentsCountChanged || isProviderChanged;

  if (!freshSnapshot.isSubmissible) {
    return {
      isValid: false,
      isStale,
      freshSnapshot,
      blockReason: freshSnapshot.blockingReason,
    };
  }

  return {
    isValid: true,
    isStale,
    freshSnapshot,
  };
}

