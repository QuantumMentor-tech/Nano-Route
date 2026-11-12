// ============================================================================
// Nano Route — Step 43 Authoritative Versioned Model Pricing & Baseline Registry
// File: src-tauri/src/providers/pricing.rs
// ============================================================================
// Responsibility:
// - Single authoritative backend source of versioned token pricing metadata.
// - Supports historical timestamp-aware pricing resolution for reproducible
//   actual cost attribution and baseline savings comparisons.
// - Uses integer nano-dollars (1 USD = 1_000_000_000 nano-USD) for intermediate
//   calculations to prevent floating-point drift across large aggregations.
// - Never performs network calls, scraping, or FX conversion.
// ============================================================================

use serde::{Deserialize, Serialize};

/// 1 USD = 1,000,000,000 nano-USD (`10^-9` USD).
/// Since model prices are specified per 1,000,000 (`10^6`) tokens with up to
/// 3 decimal places (e.g., $0.075 / 1M), `1 token` at `$0.001 / 1M` is `1` nano-USD.
pub const NANO_USD_PER_DOLLAR: i128 = 1_000_000_000;

/// Canonical baseline provider ID for routing savings comparisons.
pub const DEFAULT_BASELINE_PROVIDER_ID: &str = "anthropic";

/// Canonical baseline model ID for routing savings comparisons.
pub const DEFAULT_BASELINE_MODEL_ID: &str = "claude-3-5-sonnet-20241022";

/// Versioned pricing entry for a canonical `(provider_id, model_id)` pair.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionedModelPricingEntry {
    pub provider_id: String,
    pub model_id: String,
    pub display_name: String,
    pub pricing_version: String,
    /// Cost in USD per 1,000,000 input tokens.
    pub input_cost_per_million_usd: f64,
    /// Cost in USD per 1,000,000 output tokens.
    pub output_cost_per_million_usd: f64,
    /// ISO 4217 currency code (always `"USD"` in Step 43).
    pub currency: String,
    /// Inclusive UTC epoch milliseconds from which this pricing version is effective.
    pub effective_from_ms: i64,
    /// Exclusive UTC epoch milliseconds until which this pricing version is effective (`None` = currently active).
    pub effective_until_ms: Option<i64>,
    /// Authoritative local provenance identifier.
    pub source: String,
}

impl VersionedModelPricingEntry {
    pub fn new(
        provider_id: &str,
        model_id: &str,
        display_name: &str,
        pricing_version: &str,
        input_cost_per_million_usd: f64,
        output_cost_per_million_usd: f64,
        effective_from_ms: i64,
        effective_until_ms: Option<i64>,
    ) -> Self {
        Self {
            provider_id: provider_id.to_string(),
            model_id: model_id.to_string(),
            display_name: display_name.to_string(),
            pricing_version: pricing_version.to_string(),
            input_cost_per_million_usd,
            output_cost_per_million_usd,
            currency: "USD".to_string(),
            effective_from_ms,
            effective_until_ms,
            source: "builtin_catalog_v1".to_string(),
        }
    }

    /// Checks whether this pricing version was in effect at `timestamp_ms`.
    pub fn is_effective_at(&self, timestamp_ms: i64) -> bool {
        if timestamp_ms < self.effective_from_ms {
            return false;
        }
        if let Some(until) = self.effective_until_ms {
            if timestamp_ms >= until {
                return false;
            }
        }
        true
    }

    /// Computes exact token cost in integer nano-dollars (`10^-9` USD) for `(input_tokens, output_tokens)`.
    pub fn compute_cost_nano_usd(&self, input_tokens: u64, output_tokens: u64) -> i128 {
        compute_token_cost_nano_usd(
            input_tokens,
            output_tokens,
            self.input_cost_per_million_usd,
            self.output_cost_per_million_usd,
        )
    }

    /// Computes token cost in USD (`f64`) from exact nano-dollar arithmetic.
    pub fn compute_cost_usd(&self, input_tokens: u64, output_tokens: u64) -> f64 {
        nano_usd_to_f64(self.compute_cost_nano_usd(input_tokens, output_tokens))
    }
}

/// Converts a floating-point USD amount to integer nano-dollars (`10^-9` USD).
pub fn usd_to_nano_usd(usd: f64) -> Option<i128> {
    if !usd.is_finite() || usd < 0.0 {
        return None;
    }
    Some((usd * (NANO_USD_PER_DOLLAR as f64)).round() as i128)
}

/// Converts integer nano-dollars (`10^-9` USD) back to `f64` USD.
pub fn nano_usd_to_f64(nano_usd: i128) -> f64 {
    (nano_usd as f64) / (NANO_USD_PER_DOLLAR as f64)
}

/// Computes exact cost in integer nano-dollars for a given token workload and per-million rates.
/// `rate_per_million_usd * 1000` = nano-USD per single token.
pub fn compute_token_cost_nano_usd(
    input_tokens: u64,
    output_tokens: u64,
    input_cost_per_million_usd: f64,
    output_cost_per_million_usd: f64,
) -> i128 {
    let in_rate_nano_per_token = (input_cost_per_million_usd * 1_000.0).round() as i128;
    let out_rate_nano_per_token = (output_cost_per_million_usd * 1_000.0).round() as i128;
    (input_tokens as i128)
        .saturating_mul(in_rate_nano_per_token)
        .saturating_add((output_tokens as i128).saturating_mul(out_rate_nano_per_token))
}

/// Canonicalizes provider identifiers so historical aliases resolve to canonical catalog IDs.
pub fn canonicalize_pricing_provider_id(provider_id: &str) -> String {
    let lower = provider_id.trim().to_lowercase();
    match lower.as_str() {
        "google" | "google_gemini" | "gemini" => "gemini".to_string(),
        "local_slm" | "ollama" | "local" => "local".to_string(),
        _ => lower,
    }
}

/// Canonicalizes model identifiers for pricing lookup while preserving historical identity in reports.
pub fn canonicalize_pricing_model_id(model_id: &str) -> String {
    let lower = model_id.trim().to_lowercase();
    match lower.as_str() {
        "claude-3-5-sonnet" | "claude-3-7-sonnet" | "claude-3-5-sonnet-latest" => {
            "claude-3-5-sonnet-20241022".to_string()
        }
        "claude-3-5-haiku" | "claude-3-5-haiku-latest" => {
            "claude-3-5-haiku-20241022".to_string()
        }
        "claude-3-opus" | "claude-3-opus-latest" => "claude-3-opus-20240229".to_string(),
        "gemini-2.5-pro" => "gemini-1.5-pro".to_string(),
        "gemini-2.5-flash" => "gemini-1.5-flash".to_string(),
        _ => lower,
    }
}

/// Returns the authoritative built-in versioned pricing table.
/// Includes historical pricing epochs (e.g., `gpt-4o` pre-Aug 2024 vs post-Aug 2024)
/// so historical baseline and cost calculations remain reproducible.
pub fn builtin_versioned_pricing_table() -> Vec<VersionedModelPricingEntry> {
    // 2024-08-07T00:00:00Z in epoch ms = 1722988800000
    const GPT_4O_PRICE_CUT_EPOCH_MS: i64 = 1_722_988_800_000;

    vec![
        // --- OpenAI ---
        VersionedModelPricingEntry::new(
            "openai",
            "gpt-4o",
            "GPT-4o",
            "2024.05-v1",
            5.00,
            15.00,
            0,
            Some(GPT_4O_PRICE_CUT_EPOCH_MS),
        ),
        VersionedModelPricingEntry::new(
            "openai",
            "gpt-4o",
            "GPT-4o",
            "2024.08-v2",
            2.50,
            10.00,
            GPT_4O_PRICE_CUT_EPOCH_MS,
            None,
        ),
        VersionedModelPricingEntry::new(
            "openai",
            "gpt-4o-mini",
            "GPT-4o mini",
            "2024.07-v1",
            0.15,
            0.60,
            0,
            None,
        ),
        VersionedModelPricingEntry::new(
            "openai",
            "o1",
            "o1 Reasoning",
            "2024.12-v1",
            15.00,
            60.00,
            0,
            None,
        ),
        VersionedModelPricingEntry::new(
            "openai",
            "o3-mini",
            "o3-mini",
            "2025.01-v1",
            1.10,
            4.40,
            0,
            None,
        ),
        // --- Anthropic ---
        VersionedModelPricingEntry::new(
            "anthropic",
            "claude-3-5-sonnet-20241022",
            "Claude 3.5 Sonnet",
            "2024.10-v1",
            3.00,
            15.00,
            0,
            None,
        ),
        VersionedModelPricingEntry::new(
            "anthropic",
            "claude-3-5-haiku-20241022",
            "Claude 3.5 Haiku",
            "2024.10-v1",
            0.80,
            4.00,
            0,
            None,
        ),
        VersionedModelPricingEntry::new(
            "anthropic",
            "claude-3-opus-20240229",
            "Claude 3 Opus",
            "2024.02-v1",
            15.00,
            75.00,
            0,
            None,
        ),
        // --- Google Gemini ---
        VersionedModelPricingEntry::new(
            "gemini",
            "gemini-1.5-pro",
            "Gemini 1.5 Pro",
            "2024.05-v1",
            1.25,
            5.00,
            0,
            None,
        ),
        VersionedModelPricingEntry::new(
            "gemini",
            "gemini-1.5-flash",
            "Gemini 1.5 Flash",
            "2024.05-v1",
            0.075,
            0.30,
            0,
            None,
        ),
        VersionedModelPricingEntry::new(
            "gemini",
            "gemini-2.0-flash-exp",
            "Gemini 2.0 Flash (Experimental)",
            "2024.12-v1",
            0.10,
            0.40,
            0,
            None,
        ),
        // --- DeepSeek ---
        VersionedModelPricingEntry::new(
            "deepseek",
            "deepseek-chat",
            "DeepSeek-V3",
            "2024.12-v1",
            0.27,
            1.10,
            0,
            None,
        ),
        VersionedModelPricingEntry::new(
            "deepseek",
            "deepseek-reasoner",
            "DeepSeek-R1",
            "2025.01-v1",
            0.55,
            2.19,
            0,
            None,
        ),
        // --- Groq ---
        VersionedModelPricingEntry::new(
            "groq",
            "llama-3.3-70b-versatile",
            "Llama 3.3 70B (Groq LPU)",
            "2024.12-v1",
            0.59,
            0.79,
            0,
            None,
        ),
        VersionedModelPricingEntry::new(
            "groq",
            "llama-3.1-8b-instant",
            "Llama 3.1 8B (Groq LPU)",
            "2024.07-v1",
            0.05,
            0.08,
            0,
            None,
        ),
        // --- Mistral AI ---
        VersionedModelPricingEntry::new(
            "mistral",
            "mistral-large-latest",
            "Mistral Large",
            "2024.11-v1",
            2.00,
            6.00,
            0,
            None,
        ),
        VersionedModelPricingEntry::new(
            "mistral",
            "mistral-small-latest",
            "Mistral Small",
            "2024.09-v1",
            0.20,
            0.60,
            0,
            None,
        ),
        VersionedModelPricingEntry::new(
            "mistral",
            "codestral-latest",
            "Codestral",
            "2024.05-v1",
            0.20,
            0.60,
            0,
            None,
        ),
        // --- Local SLM / Ollama ---
        VersionedModelPricingEntry::new(
            "local",
            "llama3.2:3b",
            "Llama 3.2 3B (Local)",
            "2024.01-local-v1",
            0.00,
            0.00,
            0,
            None,
        ),
        VersionedModelPricingEntry::new(
            "local",
            "qwen2.5-coder:7b",
            "Qwen 2.5 Coder 7B (Local)",
            "2024.01-local-v1",
            0.00,
            0.00,
            0,
            None,
        ),
    ]
}

/// Resolves the versioned pricing entry effective at `timestamp_ms` for `(provider_id, model_id)`.
/// Returns `None` if the provider/model has no authoritative pricing at that timestamp.
pub fn resolve_versioned_model_pricing(
    table: &[VersionedModelPricingEntry],
    provider_id: &str,
    model_id: &str,
    timestamp_ms: i64,
) -> Option<VersionedModelPricingEntry> {
    let norm_prov = canonicalize_pricing_provider_id(provider_id);
    let norm_model = canonicalize_pricing_model_id(model_id);
    let safe_ts = timestamp_ms.max(0);

    table
        .iter()
        .find(|entry| {
            entry.provider_id == norm_prov
                && entry.model_id == norm_model
                && entry.is_effective_at(safe_ts)
        })
        .cloned()
}

