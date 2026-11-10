// ============================================================================
// Nano Route - Candidate Score Calculator
// File: src-tauri/src/routing/scoring/calculator.rs
// ============================================================================
// Calculates normalized multi-dimensional suitability scores [0.0, 1.0] for
// eligible candidates using validated weights. Strictly guarded against NaN/Inf.
// ============================================================================

use crate::analysis::types::{RequirementStrength, TaskAnalysisResult, TaskCapabilityRequirement};
use crate::providers::capabilities::ProviderCapability;
use crate::providers::descriptor::ProviderDescriptor;
use crate::providers::health_types::RuntimeHealthState;
use crate::providers::models::ProviderModel;
use crate::routing::scoring::profiles::ModelRoutingProfile;
use crate::routing::scoring::types::{ScoreAdjustment, ScoreBreakdown};
use crate::routing::scoring::weights::RoutingScoringWeights;

pub struct ScoreCalculator;

impl ScoreCalculator {
    /// Computes component score breakdown, total normalized score, and audit adjustments.
    pub fn calculate(
        provider: &ProviderDescriptor,
        model: &ProviderModel,
        profile: &ModelRoutingProfile,
        analysis: &TaskAnalysisResult,
        health_state: RuntimeHealthState,
        user_priority_weight: u32,
        preferred_providers: Option<&[String]>,
        estimated_input_tokens: Option<u64>,
        estimated_output_tokens: Option<u64>,
        weights: &RoutingScoringWeights,
    ) -> (ScoreBreakdown, f64, Vec<ScoreAdjustment>, bool, bool) {
        let mut adjustments = Vec::new();

        // 1. Intent Fit
        let (intent_fit, intent_adj) = Self::calculate_intent_fit(profile, analysis);
        if let Some(adj) = intent_adj {
            adjustments.push(adj);
        }

        // 2. Complexity Fit
        let (complexity_fit, comp_adj) = Self::calculate_complexity_fit(profile, analysis);
        if let Some(adj) = comp_adj {
            adjustments.push(adj);
        }

        // 3. Domain Fit
        let (domain_fit, dom_adj) = Self::calculate_domain_fit(profile, analysis);
        if let Some(adj) = dom_adj {
            adjustments.push(adj);
        }

        // 4. Capability Fit (preferred capabilities + capability breadth)
        let (capability_fit, cap_adj) = Self::calculate_capability_fit(model, analysis);
        if let Some(adj) = cap_adj {
            adjustments.push(adj);
        }

        // 5. Context Fit (headroom vs waste)
        let (context_fit, ctx_adj) =
            Self::calculate_context_fit(model, estimated_input_tokens, estimated_output_tokens);
        if let Some(adj) = ctx_adj {
            adjustments.push(adj);
        }

        // 6. Modality Fit
        let (modality_fit, mod_adj) = Self::calculate_modality_fit(model, analysis);
        if let Some(adj) = mod_adj {
            adjustments.push(adj);
        }

        // 7. Preference Fit (user configured priority + request preferred providers)
        let (preference_fit, pref_adj) =
            Self::calculate_preference_fit(provider, user_priority_weight, preferred_providers);
        if let Some(adj) = pref_adj {
            adjustments.push(adj);
        }

        // 8. Cost Fit (pricing knowledge; neutral if unknown)
        let (cost_fit, cost_adj, pricing_known) = Self::calculate_cost_fit(model, profile);
        if let Some(adj) = cost_adj {
            adjustments.push(adj);
        }

        // 9. Latency Fit (latency tier; neutral if unknown)
        let (latency_fit, lat_adj, latency_known) = Self::calculate_latency_fit(profile);
        if let Some(adj) = lat_adj {
            adjustments.push(adj);
        }

        // 10. Reliability Fit (runtime health state)
        let (reliability_fit, rel_adj) = Self::calculate_reliability_fit(health_state);
        if let Some(adj) = rel_adj {
            adjustments.push(adj);
        }

        // 11. Profile Fit (base model routing suitability)
        let profile_fit = clamp_01(profile.base_suitability);

        let breakdown = ScoreBreakdown {
            intent_fit,
            complexity_fit,
            domain_fit,
            capability_fit,
            context_fit,
            modality_fit,
            preference_fit,
            cost_fit,
            latency_fit,
            reliability_fit,
            profile_fit,
        };

        // Weighted Sum Calculation
        let raw_total = (weights.intent_weight * breakdown.intent_fit)
            + (weights.complexity_weight * breakdown.complexity_fit)
            + (weights.domain_weight * breakdown.domain_fit)
            + (weights.capability_weight * breakdown.capability_fit)
            + (weights.context_weight * breakdown.context_fit)
            + (weights.modality_weight * breakdown.modality_fit)
            + (weights.preference_weight * breakdown.preference_fit)
            + (weights.cost_weight * breakdown.cost_fit)
            + (weights.latency_weight * breakdown.latency_fit)
            + (weights.reliability_weight * breakdown.reliability_fit)
            + (weights.profile_weight * breakdown.profile_fit);

        let total_score = clamp_01(raw_total);

        (breakdown, total_score, adjustments, pricing_known, latency_known)
    }

    fn calculate_intent_fit(
        profile: &ModelRoutingProfile,
        analysis: &TaskAnalysisResult,
    ) -> (f64, Option<ScoreAdjustment>) {
        let primary_affinity = profile.get_intent_affinity(analysis.intent.primary_intent);

        let score = if analysis.intent.secondary_intents.is_empty() {
            primary_affinity
        } else {
            let sec_sum: f64 = analysis
                .intent.secondary_intents
                .iter()
                .map(|sec| profile.get_intent_affinity(*sec))
                .sum();
            let sec_avg = sec_sum / (analysis.intent.secondary_intents.len() as f64);
            (primary_affinity * 0.75) + (sec_avg * 0.25)
        };

        let clamped = clamp_01(score);
        let adj = if clamped >= 0.90 {
            Some(ScoreAdjustment {
                dimension: "intent_fit".to_string(),
                delta: 0.10,
                reason: format!(
                    "High affinity for primary intent '{}'",
                    analysis.intent.primary_intent.as_str()
                ),
            })
        } else {
            None
        };

        (clamped, adj)
    }

    fn calculate_complexity_fit(
        profile: &ModelRoutingProfile,
        analysis: &TaskAnalysisResult,
    ) -> (f64, Option<ScoreAdjustment>) {
        let affinity = profile.get_complexity_affinity(analysis.complexity.level);
        let clamped = clamp_01(affinity);

        let adj = if clamped >= 0.90 {
            Some(ScoreAdjustment {
                dimension: "complexity_fit".to_string(),
                delta: 0.10,
                reason: format!(
                    "Model tier aligned with {} task complexity",
                    analysis.complexity.level.display_label()
                ),
            })
        } else if clamped <= 0.40 {
            Some(ScoreAdjustment {
                dimension: "complexity_fit".to_string(),
                delta: -0.15,
                reason: format!(
                    "Model under/over-provisioned for {} task complexity",
                    analysis.complexity.level.display_label()
                ),
            })
        } else {
            None
        };

        (clamped, adj)
    }

    fn calculate_domain_fit(
        profile: &ModelRoutingProfile,
        analysis: &TaskAnalysisResult,
    ) -> (f64, Option<ScoreAdjustment>) {
        let primary_affinity = profile.get_domain_affinity(analysis.primary_domain.domain);

        let score = if analysis.secondary_domains.is_empty() {
            primary_affinity
        } else {
            let sec_sum: f64 = analysis
                .secondary_domains
                .iter()
                .map(|sec| profile.get_domain_affinity(sec.domain))
                .sum();
            let sec_avg = sec_sum / (analysis.secondary_domains.len() as f64);
            (primary_affinity * 0.70) + (sec_avg * 0.30)
        };

        let clamped = clamp_01(score);
        let adj = if clamped >= 0.90 {
            Some(ScoreAdjustment {
                dimension: "domain_fit".to_string(),
                delta: 0.10,
                reason: format!(
                    "High domain specialization for '{}'",
                    analysis.primary_domain.domain.display_label()
                ),
            })
        } else {
            None
        };

        (clamped, adj)
    }

    fn calculate_capability_fit(
        model: &ProviderModel,
        analysis: &TaskAnalysisResult,
    ) -> (f64, Option<ScoreAdjustment>) {
        let preferred_reqs: Vec<&TaskCapabilityRequirement> = analysis
            .capabilities
            .iter()
            .filter(|c| c.strength == RequirementStrength::Preferred)
            .map(|c| &c.capability)
            .collect();

        if preferred_reqs.is_empty() {
            // Neutral baseline when no optional/preferred capabilities are requested
            let base = if model.capabilities.supports(ProviderCapability::Streaming) {
                0.88
            } else {
                0.80
            };
            return (base, None);
        }

        let mut satisfied = 0;
        for req in &preferred_reqs {
            let has_cap = match req {
                TaskCapabilityRequirement::ImageInput => {
                    model.capabilities.supports(ProviderCapability::ImageInput)
                        || model.capabilities.supports(ProviderCapability::Vision)
                }
                TaskCapabilityRequirement::AudioInput => {
                    model.capabilities.supports(ProviderCapability::AudioInput)
                }
                TaskCapabilityRequirement::ToolCalling => {
                    model.capabilities.supports(ProviderCapability::ToolCalling)
                }
                TaskCapabilityRequirement::StructuredOutput => {
                    model.capabilities.supports(ProviderCapability::StructuredOutput)
                }
                TaskCapabilityRequirement::LongContext => model.context_window >= 16_000,
                TaskCapabilityRequirement::LargeDocumentIngestion => model.context_window >= 64_000,
                _ => true,
            };
            if has_cap {
                satisfied += 1;
            }
        }

        let ratio = (satisfied as f64) / (preferred_reqs.len() as f64);
        let clamped = clamp_01(0.50 + (ratio * 0.45));

        let adj = if ratio >= 1.0 {
            Some(ScoreAdjustment {
                dimension: "capability_fit".to_string(),
                delta: 0.10,
                reason: "Satisfies all preferred task capabilities".to_string(),
            })
        } else {
            None
        };

        (clamped, adj)
    }

    fn calculate_context_fit(
        model: &ProviderModel,
        estimated_input_tokens: Option<u64>,
        estimated_output_tokens: Option<u64>,
    ) -> (f64, Option<ScoreAdjustment>) {
        let total_requested =
            estimated_input_tokens.unwrap_or(0) + estimated_output_tokens.unwrap_or(0);
        let context_limit = model.context_window as u64;

        if total_requested == 0 {
            // No token estimate provided; neutral healthy score
            return (0.85, None);
        }

        if total_requested > context_limit {
            // Should be caught by eligibility check, but safe fallback
            return (0.0, Some(ScoreAdjustment {
                dimension: "context_fit".to_string(),
                delta: -1.0,
                reason: "Exceeds model context limit".to_string(),
            }));
        }

        let ratio = (context_limit as f64) / (total_requested as f64);

        let (score, adj) = if ratio < 1.15 {
            (
                0.45,
                Some(ScoreAdjustment {
                    dimension: "context_fit".to_string(),
                    delta: -0.15,
                    reason: "Dangerously tight context headroom (<15%)".to_string(),
                }),
            )
        } else if ratio <= 200.0 {
            (
                0.95,
                Some(ScoreAdjustment {
                    dimension: "context_fit".to_string(),
                    delta: 0.05,
                    reason: "Optimal context window headroom".to_string(),
                }),
            )
        } else if total_requested < 100 && context_limit >= 100_000 {
            // Mild penalty for allocating a 1M token context to a 20-token greeting
            (0.80, None)
        } else {
            (0.90, None)
        };

        (clamp_01(score), adj)
    }

    fn calculate_modality_fit(
        model: &ProviderModel,
        analysis: &TaskAnalysisResult,
    ) -> (f64, Option<ScoreAdjustment>) {
        let needs_image = analysis.capabilities.iter().any(|c| {
            c.capability == TaskCapabilityRequirement::ImageInput
                && c.strength != RequirementStrength::NotRequired
        });
        let needs_audio = analysis.capabilities.iter().any(|c| {
            c.capability == TaskCapabilityRequirement::AudioInput
                && c.strength != RequirementStrength::NotRequired
        });

        if needs_image || needs_audio {
            let has_image = model.capabilities.supports(ProviderCapability::ImageInput)
                || model.capabilities.supports(ProviderCapability::Vision);
            let has_audio = model.capabilities.supports(ProviderCapability::AudioInput);

            if (needs_image && has_image) || (needs_audio && has_audio) {
                (
                    1.0,
                    Some(ScoreAdjustment {
                        dimension: "modality_fit".to_string(),
                        delta: 0.10,
                        reason: "Native multimodal input support matched".to_string(),
                    }),
                )
            } else {
                (0.40, None)
            }
        } else {
            // Standard text modality
            (0.90, None)
        }
    }

    fn calculate_preference_fit(
        provider: &ProviderDescriptor,
        user_priority_weight: u32,
        preferred_providers: Option<&[String]>,
    ) -> (f64, Option<ScoreAdjustment>) {
        // Priority weight 1..10 maps linearly to 0.1..1.0
        let clamped_weight = user_priority_weight.clamp(1, 10) as f64;
        let mut score = clamped_weight / 10.0;

        let mut adj = None;
        if let Some(preferred) = preferred_providers {
            if preferred.iter().any(|p| p.eq_ignore_ascii_case(provider.id.as_str())) {
                score = (score + 0.15).min(1.0);
                adj = Some(ScoreAdjustment {
                    dimension: "preference_fit".to_string(),
                    delta: 0.15,
                    reason: format!(
                        "Provider '{}' is explicitly preferred in request options",
                        provider.id.as_str()
                    ),
                });
            }
        }

        (clamp_01(score), adj)
    }

    fn calculate_cost_fit(
        model: &ProviderModel,
        profile: &ModelRoutingProfile,
    ) -> (f64, Option<ScoreAdjustment>, bool) {
        if let Some(pricing) = &model.pricing {
            let input_cost = pricing.input_cost_per_million.unwrap_or(2.0);
            let output_cost = pricing.output_cost_per_million.unwrap_or(8.0);
            let weighted_cost = (input_cost * 0.70) + (output_cost * 0.30);

            let (score, adj) = if weighted_cost < 0.60 {
                (
                    0.98,
                    Some(ScoreAdjustment {
                        dimension: "cost_fit".to_string(),
                        delta: 0.10,
                        reason: "Economical token pricing (<$0.60/M tokens)".to_string(),
                    }),
                )
            } else if weighted_cost < 2.50 {
                (0.85, None)
            } else if weighted_cost < 8.00 {
                (0.65, None)
            } else {
                (
                    0.45,
                    Some(ScoreAdjustment {
                        dimension: "cost_fit".to_string(),
                        delta: -0.10,
                        reason: "Premium frontier token pricing (>$8.00/M tokens)".to_string(),
                    }),
                )
            };

            (clamp_01(score), adj, true)
        } else {
            // Pricing is UNKNOWN. Neutral score 0.50 (NEVER assume cost is $0).
            let score = match profile.relative_cost_tier {
                1 => 0.75,
                2 => 0.65,
                3 => 0.50,
                4 => 0.40,
                5 => 0.30,
                _ => 0.50,
            };
            (clamp_01(score), None, false)
        }
    }

    fn calculate_latency_fit(
        profile: &ModelRoutingProfile,
    ) -> (f64, Option<ScoreAdjustment>, bool) {
        let (score, adj, known) = match profile.relative_latency_tier {
            1 => (
                0.98,
                Some(ScoreAdjustment {
                    dimension: "latency_fit".to_string(),
                    delta: 0.10,
                    reason: "Hardware-accelerated or ultra-low latency tier".to_string(),
                }),
                true,
            ),
            2 => (0.85, None, true),
            3 => (0.75, None, true),
            4 => (0.60, None, true),
            5 => (
                0.40,
                Some(ScoreAdjustment {
                    dimension: "latency_fit".to_string(),
                    delta: -0.10,
                    reason: "Deep reasoning multi-step chain-of-thought latency".to_string(),
                }),
                true,
            ),
            _ => (0.50, None, false), // Unknown latency neutral baseline
        };

        (clamp_01(score), adj, known)
    }

    fn calculate_reliability_fit(
        health_state: RuntimeHealthState,
    ) -> (f64, Option<ScoreAdjustment>) {
        match health_state {
            RuntimeHealthState::Healthy => (1.00, None),
            RuntimeHealthState::Degraded => (
                0.60,
                Some(ScoreAdjustment {
                    dimension: "reliability_fit".to_string(),
                    delta: -0.20,
                    reason: "Provider reporting degraded health state".to_string(),
                }),
            ),
            RuntimeHealthState::RateLimited => (
                0.20,
                Some(ScoreAdjustment {
                    dimension: "reliability_fit".to_string(),
                    delta: -0.40,
                    reason: "Provider active rate limit observed".to_string(),
                }),
            ),
            RuntimeHealthState::Unhealthy => (
                0.10,
                Some(ScoreAdjustment {
                    dimension: "reliability_fit".to_string(),
                    delta: -0.50,
                    reason: "Provider reporting unhealthy state".to_string(),
                }),
            ),
            RuntimeHealthState::Unknown => (0.50, None),
        }
    }
}

/// Clamps a float to [0.0, 1.0], replacing non-finite values (NaN, Inf) with 0.0.
#[inline]
pub fn clamp_01(val: f64) -> f64 {
    if !val.is_finite() {
        0.0
    } else {
        val.clamp(0.0, 1.0)
    }
}

