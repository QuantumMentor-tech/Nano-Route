/**
//! Nano Route — Step 43 Authoritative Versioned Model Pricing & Baseline Registry
//! File: src/services/ipc/pricing.ts
//!
//! Responsibility:
//! - Frontend/mock mirror of `src-tauri/src/providers/pricing.rs`.
//! - Uses exact `BigInt` integer nano-dollars (`1 USD = 1_000_000_000n` nano-USD)
//!   for intermediate monetary sums and baseline comparisons so floating-point
//!   drift never occurs across 1k / 10k / 50k / 100k record aggregations.
//! - Supports historical timestamp-aware pricing resolution (`effectiveFromMs` / `effectiveUntilMs`).
//! - Never performs network calls, vendor scraping, or live FX conversions.
*/

export const NANO_USD_PER_DOLLAR = 1_000_000_000n;
export const NANO_USD_PER_DOLLAR_NUM = 1_000_000_000;

export const DEFAULT_BASELINE_PROVIDER_ID = "anthropic";
export const DEFAULT_BASELINE_MODEL_ID = "claude-3-5-sonnet-20241022";

export interface VersionedModelPricingEntry {
  providerId: string;
  modelId: string;
  displayName: string;
  pricingVersion: string;
  inputCostPerMillionUsd: number;
  outputCostPerMillionUsd: number;
  currency: "USD";
  effectiveFromMs: number;
  effectiveUntilMs: number | null;
  source: string;
}

const GPT_4O_PRICE_CUT_EPOCH_MS = 1_722_988_800_000; // 2024-08-07T00:00:00Z

export const BUILTIN_VERSIONED_PRICING_TABLE: readonly VersionedModelPricingEntry[] = [
  // --- OpenAI ---
  {
    providerId: "openai",
    modelId: "gpt-4o",
    displayName: "GPT-4o",
    pricingVersion: "2024.05-v1",
    inputCostPerMillionUsd: 5.0,
    outputCostPerMillionUsd: 15.0,
    currency: "USD",
    effectiveFromMs: 0,
    effectiveUntilMs: GPT_4O_PRICE_CUT_EPOCH_MS,
    source: "builtin_catalog_v1",
  },
  {
    providerId: "openai",
    modelId: "gpt-4o",
    displayName: "GPT-4o",
    pricingVersion: "2024.08-v2",
    inputCostPerMillionUsd: 2.5,
    outputCostPerMillionUsd: 10.0,
    currency: "USD",
    effectiveFromMs: GPT_4O_PRICE_CUT_EPOCH_MS,
    effectiveUntilMs: null,
    source: "builtin_catalog_v1",
  },
  {
    providerId: "openai",
    modelId: "gpt-4o-mini",
    displayName: "GPT-4o mini",
    pricingVersion: "2024.07-v1",
    inputCostPerMillionUsd: 0.15,
    outputCostPerMillionUsd: 0.6,
    currency: "USD",
    effectiveFromMs: 0,
    effectiveUntilMs: null,
    source: "builtin_catalog_v1",
  },
  {
    providerId: "openai",
    modelId: "o1",
    displayName: "o1 Reasoning",
    pricingVersion: "2024.12-v1",
    inputCostPerMillionUsd: 15.0,
    outputCostPerMillionUsd: 60.0,
    currency: "USD",
    effectiveFromMs: 0,
    effectiveUntilMs: null,
    source: "builtin_catalog_v1",
  },
  {
    providerId: "openai",
    modelId: "o3-mini",
    displayName: "o3-mini",
    pricingVersion: "2025.01-v1",
    inputCostPerMillionUsd: 1.1,
    outputCostPerMillionUsd: 4.4,
    currency: "USD",
    effectiveFromMs: 0,
    effectiveUntilMs: null,
    source: "builtin_catalog_v1",
  },
  // --- Anthropic ---
  {
    providerId: "anthropic",
    modelId: "claude-3-5-sonnet-20241022",
    displayName: "Claude 3.5 Sonnet",
    pricingVersion: "2024.10-v1",
    inputCostPerMillionUsd: 3.0,
    outputCostPerMillionUsd: 15.0,
    currency: "USD",
    effectiveFromMs: 0,
    effectiveUntilMs: null,
    source: "builtin_catalog_v1",
  },
  {
    providerId: "anthropic",
    modelId: "claude-3-5-haiku-20241022",
    displayName: "Claude 3.5 Haiku",
    pricingVersion: "2024.10-v1",
    inputCostPerMillionUsd: 0.8,
    outputCostPerMillionUsd: 4.0,
    currency: "USD",
    effectiveFromMs: 0,
    effectiveUntilMs: null,
    source: "builtin_catalog_v1",
  },
  {
    providerId: "anthropic",
    modelId: "claude-3-opus-20240229",
    displayName: "Claude 3 Opus",
    pricingVersion: "2024.02-v1",
    inputCostPerMillionUsd: 15.0,
    outputCostPerMillionUsd: 75.0,
    currency: "USD",
    effectiveFromMs: 0,
    effectiveUntilMs: null,
    source: "builtin_catalog_v1",
  },
  // --- Google Gemini ---
  {
    providerId: "gemini",
    modelId: "gemini-1.5-pro",
    displayName: "Gemini 1.5 Pro",
    pricingVersion: "2024.05-v1",
    inputCostPerMillionUsd: 1.25,
    outputCostPerMillionUsd: 5.0,
    currency: "USD",
    effectiveFromMs: 0,
    effectiveUntilMs: null,
    source: "builtin_catalog_v1",
  },
  {
    providerId: "gemini",
    modelId: "gemini-1.5-flash",
    displayName: "Gemini 1.5 Flash",
    pricingVersion: "2024.05-v1",
    inputCostPerMillionUsd: 0.075,
    outputCostPerMillionUsd: 0.3,
    currency: "USD",
    effectiveFromMs: 0,
    effectiveUntilMs: null,
    source: "builtin_catalog_v1",
  },
  {
    providerId: "gemini",
    modelId: "gemini-2.0-flash-exp",
    displayName: "Gemini 2.0 Flash (Experimental)",
    pricingVersion: "2024.12-v1",
    inputCostPerMillionUsd: 0.1,
    outputCostPerMillionUsd: 0.4,
    currency: "USD",
    effectiveFromMs: 0,
    effectiveUntilMs: null,
    source: "builtin_catalog_v1",
  },
  // --- DeepSeek ---
  {
    providerId: "deepseek",
    modelId: "deepseek-chat",
    displayName: "DeepSeek-V3",
    pricingVersion: "2024.12-v1",
    inputCostPerMillionUsd: 0.27,
    outputCostPerMillionUsd: 1.1,
    currency: "USD",
    effectiveFromMs: 0,
    effectiveUntilMs: null,
    source: "builtin_catalog_v1",
  },
  {
    providerId: "deepseek",
    modelId: "deepseek-reasoner",
    displayName: "DeepSeek-R1",
    pricingVersion: "2025.01-v1",
    inputCostPerMillionUsd: 0.55,
    outputCostPerMillionUsd: 2.19,
    currency: "USD",
    effectiveFromMs: 0,
    effectiveUntilMs: null,
    source: "builtin_catalog_v1",
  },
  // --- Groq ---
  {
    providerId: "groq",
    modelId: "llama-3.3-70b-versatile",
    displayName: "Llama 3.3 70B (Groq LPU)",
    pricingVersion: "2024.12-v1",
    inputCostPerMillionUsd: 0.59,
    outputCostPerMillionUsd: 0.79,
    currency: "USD",
    effectiveFromMs: 0,
    effectiveUntilMs: null,
    source: "builtin_catalog_v1",
  },
  {
    providerId: "groq",
    modelId: "llama-3.1-8b-instant",
    displayName: "Llama 3.1 8B (Groq LPU)",
    pricingVersion: "2024.07-v1",
    inputCostPerMillionUsd: 0.05,
    outputCostPerMillionUsd: 0.08,
    currency: "USD",
    effectiveFromMs: 0,
    effectiveUntilMs: null,
    source: "builtin_catalog_v1",
  },
  // --- Mistral AI ---
  {
    providerId: "mistral",
    modelId: "mistral-large-latest",
    displayName: "Mistral Large",
    pricingVersion: "2024.11-v1",
    inputCostPerMillionUsd: 2.0,
    outputCostPerMillionUsd: 6.0,
    currency: "USD",
    effectiveFromMs: 0,
    effectiveUntilMs: null,
    source: "builtin_catalog_v1",
  },
  {
    providerId: "mistral",
    modelId: "mistral-small-latest",
    displayName: "Mistral Small",
    pricingVersion: "2024.09-v1",
    inputCostPerMillionUsd: 0.2,
    outputCostPerMillionUsd: 0.6,
    currency: "USD",
    effectiveFromMs: 0,
    effectiveUntilMs: null,
    source: "builtin_catalog_v1",
  },
  {
    providerId: "mistral",
    modelId: "codestral-latest",
    displayName: "Codestral",
    pricingVersion: "2024.05-v1",
    inputCostPerMillionUsd: 0.2,
    outputCostPerMillionUsd: 0.6,
    currency: "USD",
    effectiveFromMs: 0,
    effectiveUntilMs: null,
    source: "builtin_catalog_v1",
  },
  // --- Local SLM / Ollama ---
  {
    providerId: "local",
    modelId: "llama3.2:3b",
    displayName: "Llama 3.2 3B (Local)",
    pricingVersion: "2024.01-local-v1",
    inputCostPerMillionUsd: 0.0,
    outputCostPerMillionUsd: 0.0,
    currency: "USD",
    effectiveFromMs: 0,
    effectiveUntilMs: null,
    source: "builtin_catalog_v1",
  },
  {
    providerId: "local",
    modelId: "qwen2.5-coder:7b",
    displayName: "Qwen 2.5 Coder 7B (Local)",
    pricingVersion: "2024.01-local-v1",
    inputCostPerMillionUsd: 0.0,
    outputCostPerMillionUsd: 0.0,
    currency: "USD",
    effectiveFromMs: 0,
    effectiveUntilMs: null,
    source: "builtin_catalog_v1",
  },
];

let activePricingTable: VersionedModelPricingEntry[] = [...BUILTIN_VERSIONED_PRICING_TABLE];

export function getActivePricingTable(): readonly VersionedModelPricingEntry[] {
  return activePricingTable;
}

export function setMockPricingTable(entries: VersionedModelPricingEntry[]): void {
  activePricingTable = [...entries];
}

export function resetMockPricingTable(): void {
  activePricingTable = [...BUILTIN_VERSIONED_PRICING_TABLE];
}

export function canonicalizePricingProviderId(providerId: string): string {
  const lower = providerId.trim().toLowerCase();
  if (lower === "google" || lower === "google_gemini" || lower === "gemini") {
    return "gemini";
  }
  if (lower === "local_slm" || lower === "ollama" || lower === "local") {
    return "local";
  }
  return lower;
}

export function canonicalizePricingModelId(modelId: string): string {
  const lower = modelId.trim().toLowerCase();
  if (
    lower === "claude-3-5-sonnet" ||
    lower === "claude-3-7-sonnet" ||
    lower === "claude-3-5-sonnet-latest"
  ) {
    return "claude-3-5-sonnet-20241022";
  }
  if (lower === "claude-3-5-haiku" || lower === "claude-3-5-haiku-latest") {
    return "claude-3-5-haiku-20241022";
  }
  if (lower === "claude-3-opus" || lower === "claude-3-opus-latest") {
    return "claude-3-opus-20240229";
  }
  if (lower === "gemini-2.5-pro") {
    return "gemini-1.5-pro";
  }
  if (lower === "gemini-2.5-flash") {
    return "gemini-1.5-flash";
  }
  return lower;
}

export function resolveVersionedModelPricing(
  providerId: string,
  modelId: string,
  timestampMs: number,
  table: readonly VersionedModelPricingEntry[] = activePricingTable
): VersionedModelPricingEntry | null {
  const normProv = canonicalizePricingProviderId(providerId);
  const normMod = canonicalizePricingModelId(modelId);
  const safeTs = Number.isFinite(timestampMs) ? Math.max(0, timestampMs) : 0;

  for (const entry of table) {
    if (
      canonicalizePricingProviderId(entry.providerId) === normProv &&
      canonicalizePricingModelId(entry.modelId) === normMod
    ) {
      if (safeTs < entry.effectiveFromMs) continue;
      if (entry.effectiveUntilMs !== null && safeTs >= entry.effectiveUntilMs) continue;
      return entry;
    }
  }
  return null;
}

export function usdToNanoUsd(usd: number | null | undefined): bigint | null {
  if (typeof usd !== "number" || !Number.isFinite(usd) || usd < 0) {
    return null;
  }
  return BigInt(Math.round(usd * NANO_USD_PER_DOLLAR_NUM));
}

export function nanoUsdToUsd(nanoUsd: bigint): number {
  return Number(nanoUsd) / NANO_USD_PER_DOLLAR_NUM;
}

export function computeTokenCostNanoUsd(
  inputTokens: number,
  outputTokens: number,
  inputCostPerMillionUsd: number,
  outputCostPerMillionUsd: number
): bigint {
  const inRateNanoPerToken = BigInt(Math.round(inputCostPerMillionUsd * 1_000));
  const outRateNanoPerToken = BigInt(Math.round(outputCostPerMillionUsd * 1_000));
  return (
    BigInt(Math.max(0, Math.trunc(inputTokens))) * inRateNanoPerToken +
    BigInt(Math.max(0, Math.trunc(outputTokens))) * outRateNanoPerToken
  );
}

/**
 * Formats exact token counts into compact human-readable strings (`1,245`, `12.4K`, `2.15M`)
 * while preserving exact integers for tooltips/accessibility (Section 22, 111).
 */
export function formatCompactTokens(tokens: number | null | undefined): string {
  if (tokens === null || tokens === undefined || !Number.isFinite(tokens) || tokens < 0) {
    return "Unavailable";
  }
  const exact = Math.trunc(tokens);
  if (exact < 10_000) {
    return exact.toLocaleString();
  }
  if (exact < 1_000_000) {
    return `${(exact / 1_000).toFixed(1)}K`;
  }
  return `${(exact / 1_000_000).toFixed(2)}M`;
}

export function formatExactTokens(tokens: number | null | undefined): string {
  if (tokens === null || tokens === undefined || !Number.isFinite(tokens) || tokens < 0) {
    return "Unavailable";
  }
  return Math.trunc(tokens).toLocaleString();
}

/**
 * Formats USD monetary amounts with adaptive precision so nonzero micro-costs
 * (`$0.000420`) are never rounded down to a misleading `$0.00` (Section 58, 111).
 */
export function formatUsdCurrency(
  amountUsd: number | null | undefined,
  options?: { allowSigned?: boolean; unavailableLabel?: string }
): string {
  const unavailableLabel = options?.unavailableLabel ?? "Cost unavailable";
  if (amountUsd === null || amountUsd === undefined || !Number.isFinite(amountUsd)) {
    return unavailableLabel;
  }

  const sign = amountUsd < 0 ? "-" : options?.allowSigned && amountUsd > 0 ? "+" : "";
  const abs = Math.abs(amountUsd);

  if (abs === 0) {
    return "$0.00";
  }
  if (abs >= 1.0) {
    return `${sign}$${abs.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  if (abs >= 0.01) {
    return `${sign}$${abs.toFixed(4)}`;
  }
  return `${sign}$${abs.toFixed(6)}`;
}

