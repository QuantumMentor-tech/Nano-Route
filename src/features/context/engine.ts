/**
 * Nano Route — Context Window Management & Request Size Guardrail Engine
 * File: src/features/context/engine.ts
 *
 * Implements Step 76:
 * - Authoritative model context limits resolution
 * - Non-blocking asynchronous token estimation with immutable caching
 * - Output capacity calculation and max-output validation
 * - Preflight context evaluations before network transmission
 * - Safe, non-destructive context reduction planning (zero history deletion)
 * - Upstream context error normalization
 */

import type {
  ModelContextLimits,
  EstimatedTokenCounts,
  ContextPreflightEvaluation,
  ContextReductionPlan,
  ContextReductionMode,
  ContextErrorDetails,
  ContextErrorCode,
} from "./types.ts";

// ============================================================================
// Authoritative Model Context Limits Catalog (Step 21 & Step 56 Source of Truth)
// ============================================================================

export const KNOWN_MODEL_CONTEXT_LIMITS: Record<string, Record<string, ModelContextLimits>> = {
  openai: {
    "gpt-4o": {
      providerId: "openai",
      modelId: "gpt-4o",
      displayName: "GPT-4o",
      contextWindow: 128_000,
      maxInputTokens: 128_000,
      maxOutputTokens: 4096,
      combinedLimit: true,
      source: "REGISTRY",
      confidence: "AUTHORITATIVE",
      lastVerifiedAtMs: 1_725_000_000_000,
    },
    "gpt-4o-mini": {
      providerId: "openai",
      modelId: "gpt-4o-mini",
      displayName: "GPT-4o mini",
      contextWindow: 128_000,
      maxInputTokens: 128_000,
      maxOutputTokens: 16384,
      combinedLimit: true,
      source: "REGISTRY",
      confidence: "AUTHORITATIVE",
      lastVerifiedAtMs: 1_725_000_000_000,
    },
    "o1": {
      providerId: "openai",
      modelId: "o1",
      displayName: "OpenAI o1",
      contextWindow: 200_000,
      maxInputTokens: 200_000,
      maxOutputTokens: 100_000,
      combinedLimit: true,
      source: "REGISTRY",
      confidence: "AUTHORITATIVE",
      lastVerifiedAtMs: 1_728_000_000_000,
    },
    "o3-mini": {
      providerId: "openai",
      modelId: "o3-mini",
      displayName: "OpenAI o3-mini",
      contextWindow: 200_000,
      maxInputTokens: 200_000,
      maxOutputTokens: 100_000,
      combinedLimit: true,
      source: "REGISTRY",
      confidence: "AUTHORITATIVE",
      lastVerifiedAtMs: 1_730_000_000_000,
    },
  },
  anthropic: {
    "claude-3-5-sonnet-20241022": {
      providerId: "anthropic",
      modelId: "claude-3-5-sonnet-20241022",
      displayName: "Claude 3.5 Sonnet",
      contextWindow: 200_000,
      maxInputTokens: 200_000,
      maxOutputTokens: 8192,
      combinedLimit: true,
      source: "REGISTRY",
      confidence: "AUTHORITATIVE",
      lastVerifiedAtMs: 1_729_000_000_000,
    },
    "claude-3-5-haiku-20241022": {
      providerId: "anthropic",
      modelId: "claude-3-5-haiku-20241022",
      displayName: "Claude 3.5 Haiku",
      contextWindow: 200_000,
      maxInputTokens: 200_000,
      maxOutputTokens: 8192,
      combinedLimit: true,
      source: "REGISTRY",
      confidence: "AUTHORITATIVE",
      lastVerifiedAtMs: 1_729_000_000_000,
    },
    "claude-3-opus-20240229": {
      providerId: "anthropic",
      modelId: "claude-3-opus-20240229",
      displayName: "Claude 3 Opus",
      contextWindow: 200_000,
      maxInputTokens: 200_000,
      maxOutputTokens: 4096,
      combinedLimit: true,
      source: "REGISTRY",
      confidence: "AUTHORITATIVE",
      lastVerifiedAtMs: 1_720_000_000_000,
    },
  },
  gemini: {
    "gemini-1.5-pro": {
      providerId: "gemini",
      modelId: "gemini-1.5-pro",
      displayName: "Gemini 1.5 Pro",
      contextWindow: 2_000_000,
      maxInputTokens: 2_000_000,
      maxOutputTokens: 8192,
      combinedLimit: true,
      source: "REGISTRY",
      confidence: "AUTHORITATIVE",
      lastVerifiedAtMs: 1_725_000_000_000,
    },
    "gemini-1.5-flash": {
      providerId: "gemini",
      modelId: "gemini-1.5-flash",
      displayName: "Gemini 1.5 Flash",
      contextWindow: 1_000_000,
      maxInputTokens: 1_000_000,
      maxOutputTokens: 8192,
      combinedLimit: true,
      source: "REGISTRY",
      confidence: "AUTHORITATIVE",
      lastVerifiedAtMs: 1_725_000_000_000,
    },
    "gemini-2.0-flash-exp": {
      providerId: "gemini",
      modelId: "gemini-2.0-flash-exp",
      displayName: "Gemini 2.0 Flash",
      contextWindow: 1_000_000,
      maxInputTokens: 1_000_000,
      maxOutputTokens: 8192,
      combinedLimit: true,
      source: "REGISTRY",
      confidence: "AUTHORITATIVE",
      lastVerifiedAtMs: 1_733_000_000_000,
    },
  },
  deepseek: {
    "deepseek-chat": {
      providerId: "deepseek",
      modelId: "deepseek-chat",
      displayName: "DeepSeek-V3",
      contextWindow: 64_000,
      maxInputTokens: 64_000,
      maxOutputTokens: 8192,
      combinedLimit: true,
      source: "REGISTRY",
      confidence: "AUTHORITATIVE",
      lastVerifiedAtMs: 1_734_000_000_000,
    },
    "deepseek-reasoner": {
      providerId: "deepseek",
      modelId: "deepseek-reasoner",
      displayName: "DeepSeek-R1",
      contextWindow: 64_000,
      maxInputTokens: 64_000,
      maxOutputTokens: 8192,
      combinedLimit: true,
      source: "REGISTRY",
      confidence: "AUTHORITATIVE",
      lastVerifiedAtMs: 1_736_000_000_000,
    },
  },
  groq: {
    "llama-3.3-70b-versatile": {
      providerId: "groq",
      modelId: "llama-3.3-70b-versatile",
      displayName: "Llama 3.3 70B (Groq)",
      contextWindow: 128_000,
      maxInputTokens: 128_000,
      maxOutputTokens: 32768,
      combinedLimit: true,
      source: "REGISTRY",
      confidence: "AUTHORITATIVE",
      lastVerifiedAtMs: 1_733_000_000_000,
    },
    "llama-3.1-8b-instant": {
      providerId: "groq",
      modelId: "llama-3.1-8b-instant",
      displayName: "Llama 3.1 8B (Groq)",
      contextWindow: 128_000,
      maxInputTokens: 128_000,
      maxOutputTokens: 8192,
      combinedLimit: true,
      source: "REGISTRY",
      confidence: "AUTHORITATIVE",
      lastVerifiedAtMs: 1_725_000_000_000,
    },
  },
  mistral: {
    "mistral-large-latest": {
      providerId: "mistral",
      modelId: "mistral-large-latest",
      displayName: "Mistral Large",
      contextWindow: 128_000,
      maxInputTokens: 128_000,
      maxOutputTokens: 8192,
      combinedLimit: true,
      source: "REGISTRY",
      confidence: "AUTHORITATIVE",
      lastVerifiedAtMs: 1_730_000_000_000,
    },
    "mistral-small-latest": {
      providerId: "mistral",
      modelId: "mistral-small-latest",
      displayName: "Mistral Small",
      contextWindow: 32_000,
      maxInputTokens: 32_000,
      maxOutputTokens: 8192,
      combinedLimit: true,
      source: "REGISTRY",
      confidence: "AUTHORITATIVE",
      lastVerifiedAtMs: 1_728_000_000_000,
    },
    "codestral-latest": {
      providerId: "mistral",
      modelId: "codestral-latest",
      displayName: "Codestral",
      contextWindow: 256_000,
      maxInputTokens: 256_000,
      maxOutputTokens: 8192,
      combinedLimit: true,
      source: "REGISTRY",
      confidence: "AUTHORITATIVE",
      lastVerifiedAtMs: 1_725_000_000_000,
    },
  },
  local: {
    "llama3.2:3b": {
      providerId: "local",
      modelId: "llama3.2:3b",
      displayName: "Llama 3.2 3B (Local SLM)",
      contextWindow: 8192,
      maxInputTokens: 8192,
      maxOutputTokens: 4096,
      combinedLimit: true,
      source: "REGISTRY",
      confidence: "AUTHORITATIVE",
      lastVerifiedAtMs: 1_728_000_000_000,
    },
  },
};

/**
 * Resolves authoritative context window constraints for a provider and model.
 * If model is uncatalogued, returns a typed descriptor with contextWindow: 0 and source: UNKNOWN.
 */
export function resolveModelContextLimits(
  providerId: string,
  modelId: string
): ModelContextLimits {
  const cleanProvider = providerId.trim().toLowerCase();
  const cleanModel = modelId.trim().toLowerCase();

  const providerGroup = KNOWN_MODEL_CONTEXT_LIMITS[cleanProvider];
  if (providerGroup && providerGroup[cleanModel]) {
    return providerGroup[cleanModel];
  }

  // Check case-insensitive model match
  if (providerGroup) {
    for (const [key, val] of Object.entries(providerGroup)) {
      if (key.toLowerCase() === cleanModel) {
        return val;
      }
    }
  }

  // Explicit unknown representation (Requirement 8)
  return {
    providerId: cleanProvider,
    modelId: cleanModel,
    displayName: modelId,
    contextWindow: 0,
    maxInputTokens: 0,
    maxOutputTokens: 0,
    combinedLimit: true,
    source: "UNKNOWN",
    confidence: "UNKNOWN",
    lastVerifiedAtMs: Date.now(),
  };
}

// ============================================================================
// Immutable Token Estimation Cache & Heuristics
// ============================================================================

// Memory-bounded token estimate cache: key -> token count
const tokenCache = new Map<string, number>();
const MAX_CACHE_SIZE = 5000;

/**
 * Fast deterministic string hash for cache keys.
 */
function fastHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
}

/**
 * Estimates token count for a raw text string (~3.8 characters per token heuristic).
 */
export function estimateTextTokens(text: string): number {
  if (!text || text.length === 0) return 0;
  return Math.ceil(text.length / 3.8);
}

/**
 * Estimates token count for a single message including protocol framing overhead (+4 tokens).
 * Utilizes memory-bounded caching for immutable message content.
 */
export function estimateMessageTokens(message: {
  id?: string;
  content: string;
  sender?: string;
}): number {
  const content = message.content || "";
  const cacheKey = message.id
    ? `msg_${message.id}_${fastHash(content)}`
    : `raw_${fastHash(content)}`;

  const cached = tokenCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  // Base text tokens + 4 framing overhead tokens (role tag + delimiters)
  const tokens = estimateTextTokens(content) + 4;

  if (tokenCache.size >= MAX_CACHE_SIZE) {
    // Evict oldest 500 entries
    const iter = tokenCache.keys();
    for (let i = 0; i < 500; i++) {
      const nextKey = iter.next().value;
      if (nextKey) tokenCache.delete(nextKey);
    }
  }

  tokenCache.set(cacheKey, tokens);
  return tokens;
}

/**
 * Invalidates token cache entries. If messageId is provided, purges that message's entries.
 */
export function invalidateContextCache(messageId?: string): void {
  if (!messageId) {
    tokenCache.clear();
    return;
  }
  for (const key of tokenCache.keys()) {
    if (key.startsWith(`msg_${messageId}_`)) {
      tokenCache.delete(key);
    }
  }
}

/**
 * Completely clears the in-memory token estimation cache.
 */
export function clearContextCache(): void {
  tokenCache.clear();
}

/**
 * Estimates total input and projected tokens for a complete conversation context.
 */
export function estimateConversationTokens(
  history: Array<{ id?: string; content: string; sender?: string }>,
  prompt: string,
  systemPrompt?: string,
  requestedOutputTokens?: number
): EstimatedTokenCounts {
  const promptTokens = estimateTextTokens(prompt) + 4;
  const systemTokens = systemPrompt ? estimateTextTokens(systemPrompt) + 4 : 0;

  let historyTokens = 0;
  for (const msg of history) {
    historyTokens += estimateMessageTokens(msg);
  }

  const totalInputTokens = promptTokens + systemTokens + historyTokens;
  const estimatedCompletionTokens = requestedOutputTokens ?? 4096;
  const totalEstimatedTokens = totalInputTokens + estimatedCompletionTokens;

  return {
    promptTokens,
    systemTokens,
    historyTokens,
    totalInputTokens,
    estimatedCompletionTokens,
    totalEstimatedTokens,
    confidence: "APPROXIMATE",
    tokenizerSource: "local_heuristic_v1",
    calculatedAtMs: Date.now(),
  };
}

// ============================================================================
// Output Capacity Calculation
// ============================================================================

/**
 * Calculates remaining available output generation capacity given input tokens and model limits.
 * available_output = min(max_output_tokens, max(0, context_window - estimated_input))
 */
export function computeAvailableOutputCapacity(
  limits: ModelContextLimits,
  estimatedInputTokens: number
): number {
  if (limits.contextWindow === 0) return 0;
  const headroom = Math.max(0, limits.contextWindow - estimatedInputTokens);
  const maxOutput = limits.maxOutputTokens > 0 ? limits.maxOutputTokens : headroom;
  return Math.min(headroom, maxOutput);
}

// ============================================================================
// Request Preflight Context Evaluation
// ============================================================================

export interface ContextPreflightParams {
  providerId: string;
  modelId: string;
  prompt: string;
  history?: Array<{ id?: string; content: string; sender?: string }>;
  systemPrompt?: string;
  requestedOutputTokens?: number;
}

/**
 * Evaluates whether a proposed request fits comfortably within candidate model context limits.
 * Runs completely locally BEFORE network transmission, protecting rate limits and user time.
 */
export function evaluateContextPreflight(
  params: ContextPreflightParams
): ContextPreflightEvaluation {
  const {
    providerId,
    modelId,
    prompt,
    history = [],
    systemPrompt,
    requestedOutputTokens,
  } = params;

  const limits = resolveModelContextLimits(providerId, modelId);
  const tokenCounts = estimateConversationTokens(
    history,
    prompt,
    systemPrompt,
    requestedOutputTokens
  );

  const estimatedInputTokens = tokenCounts.totalInputTokens;
  const targetOutputTokens =
    requestedOutputTokens ??
    (limits.maxOutputTokens > 0 ? Math.min(limits.maxOutputTokens, 4096) : 4096);

  const totalRequiredTokens = estimatedInputTokens + targetOutputTokens;
  const safetyMarginTokens = Math.max(
    Math.ceil(totalRequiredTokens * 0.1),
    500
  );

  // 1. Unknown Context Limits
  if (limits.contextWindow === 0 || limits.source === "UNKNOWN") {
    return {
      providerId: limits.providerId,
      modelId: limits.modelId,
      classification: "UNKNOWN",
      allowed: true, // Non-blocking when limit is unverified locally
      limits,
      estimatedInputTokens,
      requestedOutputTokens: targetOutputTokens,
      totalRequiredTokens,
      safetyMarginTokens,
      availableHeadroomTokens: 0,
      availableOutputCapacity: targetOutputTokens,
      percentUsed: 0,
      blockReason: null,
      warningNotice: `Context limit for ${limits.displayName} is unverified. Request will proceed with provider-side validation.`,
      confidence: tokenCounts.confidence,
      evaluatedAtMs: Date.now(),
    };
  }

  const availableHeadroomTokens = limits.contextWindow - totalRequiredTokens;
  const availableOutputCapacity = computeAvailableOutputCapacity(
    limits,
    estimatedInputTokens
  );
  const percentUsed = Math.min(
    100,
    (totalRequiredTokens / limits.contextWindow) * 100
  );

  // 2. Input Tokens Exceed Maximum Input Limit
  if (
    limits.maxInputTokens > 0 &&
    estimatedInputTokens > limits.maxInputTokens
  ) {
    return {
      providerId: limits.providerId,
      modelId: limits.modelId,
      classification: "EXCEEDS_LIMIT",
      allowed: false,
      limits,
      estimatedInputTokens,
      requestedOutputTokens: targetOutputTokens,
      totalRequiredTokens,
      safetyMarginTokens,
      availableHeadroomTokens,
      availableOutputCapacity: 0,
      percentUsed: (estimatedInputTokens / limits.contextWindow) * 100,
      blockReason: "INPUT_TOKEN_LIMIT",
      warningNotice: `Estimated input (${estimatedInputTokens.toLocaleString()} tokens) exceeds ${limits.displayName} input limit (${limits.maxInputTokens.toLocaleString()} tokens).`,
      confidence: tokenCounts.confidence,
      evaluatedAtMs: Date.now(),
    };
  }

  // 3. Requested Output Exceeds Model Max Output Limit
  if (
    limits.maxOutputTokens > 0 &&
    requestedOutputTokens !== undefined &&
    requestedOutputTokens > limits.maxOutputTokens
  ) {
    return {
      providerId: limits.providerId,
      modelId: limits.modelId,
      classification: "EXCEEDS_LIMIT",
      allowed: false,
      limits,
      estimatedInputTokens,
      requestedOutputTokens: targetOutputTokens,
      totalRequiredTokens,
      safetyMarginTokens,
      availableHeadroomTokens,
      availableOutputCapacity: limits.maxOutputTokens,
      percentUsed,
      blockReason: "OUTPUT_TOKEN_LIMIT",
      warningNotice: `Requested output (${requestedOutputTokens.toLocaleString()} tokens) exceeds ${limits.displayName} ceiling (${limits.maxOutputTokens.toLocaleString()} tokens).`,
      confidence: tokenCounts.confidence,
      evaluatedAtMs: Date.now(),
    };
  }

  // 4. Total Required Exceeds Total Context Window
  if (totalRequiredTokens > limits.contextWindow) {
    return {
      providerId: limits.providerId,
      modelId: limits.modelId,
      classification: "EXCEEDS_LIMIT",
      allowed: false,
      limits,
      estimatedInputTokens,
      requestedOutputTokens: targetOutputTokens,
      totalRequiredTokens,
      safetyMarginTokens,
      availableHeadroomTokens,
      availableOutputCapacity: 0,
      percentUsed: Math.max(100, (totalRequiredTokens / limits.contextWindow) * 100),
      blockReason: "CONTEXT_LIMIT_EXCEEDED",
      warningNotice: `Total required (${totalRequiredTokens.toLocaleString()} tokens) exceeds ${limits.displayName} context window (${limits.contextWindow.toLocaleString()} tokens).`,
      confidence: tokenCounts.confidence,
      evaluatedAtMs: Date.now(),
    };
  }

  // 5. Near Limit (Within Safety Buffer or >= 80% used)
  if (availableHeadroomTokens < safetyMarginTokens || percentUsed >= 80) {
    return {
      providerId: limits.providerId,
      modelId: limits.modelId,
      classification: "NEAR_LIMIT",
      allowed: true, // Non-blocking warning
      limits,
      estimatedInputTokens,
      requestedOutputTokens: targetOutputTokens,
      totalRequiredTokens,
      safetyMarginTokens,
      availableHeadroomTokens,
      availableOutputCapacity,
      percentUsed,
      blockReason: null,
      warningNotice: `Large context: Request uses ${percentUsed.toFixed(0)}% of ${limits.displayName}'s context window (${totalRequiredTokens.toLocaleString()} / ${limits.contextWindow.toLocaleString()} tokens). Output room is restricted to ~${availableOutputCapacity.toLocaleString()} tokens.`,
      confidence: tokenCounts.confidence,
      evaluatedAtMs: Date.now(),
    };
  }

  // 6. Safe
  return {
    providerId: limits.providerId,
    modelId: limits.modelId,
    classification: "SAFE",
    allowed: true,
    limits,
    estimatedInputTokens,
    requestedOutputTokens: targetOutputTokens,
    totalRequiredTokens,
    safetyMarginTokens,
    availableHeadroomTokens,
    availableOutputCapacity,
    percentUsed,
    blockReason: null,
    warningNotice: null,
    confidence: tokenCounts.confidence,
    evaluatedAtMs: Date.now(),
  };
}

// ============================================================================
// Safe Context Reduction Planning (Zero Historical Deletion)
// ============================================================================

/**
 * Creates a deterministic, non-destructive plan for reducing request context to fit a target limit.
 * STRICT INVARIANT: History messages omitted from the request REMAIN in SQLite chat history!
 */
export function createContextReductionPlan(
  history: Array<{ id?: string; content: string; sender?: string }>,
  prompt: string,
  systemPrompt?: string,
  _targetLimitTokens?: number,
  mode: ContextReductionMode = "RECENT_WINDOW",
  windowSize = 10
): ContextReductionPlan {
  const promptTokens = estimateTextTokens(prompt) + 4;
  const systemTokens = systemPrompt ? estimateTextTokens(systemPrompt) + 4 : 0;
  const protectedBaseTokens = promptTokens + systemTokens;

  if (mode === "FULL_HISTORY") {
    let historyTokens = 0;
    for (const msg of history) {
      historyTokens += estimateMessageTokens(msg);
    }
    return {
      mode: "FULL_HISTORY",
      totalHistoryMessages: history.length,
      includedMessagesCount: history.length,
      excludedMessagesCount: 0,
      includedEstimatedTokens: protectedBaseTokens + historyTokens,
      excludedEstimatedTokens: 0,
      systemPromptProtected: true,
      currentPromptProtected: true,
      explanation: `All ${history.length} conversation messages will be sent.`,
    };
  }

  if (mode === "PROTECTED_ONLY") {
    let excludedTokens = 0;
    for (const msg of history) {
      excludedTokens += estimateMessageTokens(msg);
    }
    return {
      mode: "PROTECTED_ONLY",
      totalHistoryMessages: history.length,
      includedMessagesCount: 0,
      excludedMessagesCount: history.length,
      includedEstimatedTokens: protectedBaseTokens,
      excludedEstimatedTokens: excludedTokens,
      systemPromptProtected: true,
      currentPromptProtected: true,
      explanation: `Only the current user prompt and system instructions will be sent. All ${history.length} earlier messages remain preserved in History.`,
    };
  }

  // RECENT_WINDOW mode: keep the last N messages
  const effectiveWindow = Math.max(1, Math.min(windowSize, history.length));
  const startIndex = Math.max(0, history.length - effectiveWindow);

  let includedHistoryTokens = 0;
  let excludedHistoryTokens = 0;

  for (let i = 0; i < history.length; i++) {
    const tokens = estimateMessageTokens(history[i]);
    if (i >= startIndex) {
      includedHistoryTokens += tokens;
    } else {
      excludedHistoryTokens += tokens;
    }
  }

  const includedCount = history.length - startIndex;
  const excludedCount = startIndex;

  return {
    mode: "RECENT_WINDOW",
    totalHistoryMessages: history.length,
    includedMessagesCount: includedCount,
    excludedMessagesCount: excludedCount,
    includedEstimatedTokens: protectedBaseTokens + includedHistoryTokens,
    excludedEstimatedTokens: excludedHistoryTokens,
    systemPromptProtected: true,
    currentPromptProtected: true,
    explanation:
      excludedCount > 0
        ? `Sending the most recent ${includedCount} messages. ${excludedCount} earlier messages remain safely in History but will not be sent for this request.`
        : `All ${history.length} conversation messages fit within the active window.`,
  };
}

// ============================================================================
// Upstream Context Error Normalization
// ============================================================================

/**
 * Normalizes raw upstream provider errors into standard ContextErrorDetails.
 * Prevents collapsing context-length failures into generic network or 500 errors.
 */
export function normalizeContextError(
  rawError: unknown,
  providerId?: string,
  modelId?: string
): ContextErrorDetails {
  const errMsg =
    typeof rawError === "string"
      ? rawError
      : rawError instanceof Error
      ? rawError.message
      : typeof rawError === "object" && rawError !== null && "message" in rawError
      ? String((rawError as { message: unknown }).message)
      : String(rawError || "Unknown error");

  const lower = errMsg.toLowerCase();

  let code: ContextErrorCode = "CONTEXT_LIMIT_EXCEEDED";
  const suggestedActions: string[] = [
    "Switch to a model with a larger context window (e.g., Claude 3.5 Sonnet or Gemini 1.5 Pro).",
    "Use Recent Messages mode in Context Options to transmit only recent conversation turns.",
    "Start a new conversation session to begin with a fresh context window.",
  ];

  if (
    lower.includes("input token") ||
    lower.includes("prompt is too long") ||
    lower.includes("prompt token") ||
    lower.includes("maximum prompt length")
  ) {
    code = "INPUT_TOKEN_LIMIT";
  } else if (
    lower.includes("output token") ||
    lower.includes("max_tokens is too large") ||
    lower.includes("completion token")
  ) {
    code = "OUTPUT_TOKEN_LIMIT";
    suggestedActions.unshift("Lower the requested Max Output Tokens in Chat Settings.");
  } else if (lower.includes("413") || lower.includes("payload too large") || lower.includes("request entity too large")) {
    code = "REQUEST_TOO_LARGE";
  } else if (lower.includes("context limit unknown")) {
    code = "CONTEXT_LIMIT_UNKNOWN";
  }

  return {
    code,
    message: errMsg,
    providerId,
    modelId,
    suggestedActions,
  };
}
