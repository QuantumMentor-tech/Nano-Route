// ============================================================================
// Nano Route - Routing Explanation Service
// File: src-tauri/src/routing/explanation/service.rs
// ============================================================================
// Core explainability service transforming routing decisions, task analysis,
// and candidate scoring breakdowns into deterministic, transparent explanations.
// Strictly read-only: does not re-score, re-rank, or alter routing decisions.
// ============================================================================

use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::analysis::types::{AnalysisAmbiguity, TaskAnalysisResult};
use crate::domain::{ChatMessage, MessageSender};
use crate::errors::AppError;
use crate::providers::identity::ProviderId;
use crate::providers::registry::ProviderRegistry;
use crate::routing::explanation::types::{
    AlternativeCandidateExplanation, ConfidenceSummaryExplanation, ExplanationEvidence,
    PolicyFactorExplanation, RoutingExplanation, ScoreAdjustmentExplanation,
    ScoreBreakdownExplanation, ScoreDimensionExplanation, SelectedRouteExplanation,
    SelectionMarginExplanation, TaskAnalysisSummary, TaskRequirementExplanation,
    DEFAULT_EXPLANATION_SCHEMA_VERSION,
};
use crate::routing::policy::types::{RoutingDecision, SelectionMode};
use crate::routing::scoring::types::RoutingScoreResult;
use crate::services::chat::ChatService;
use crate::services::telemetry::TelemetryService;

const MAX_CACHE_ENTRIES: usize = 200;

fn current_epoch_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Central application service producing, caching, and serving routing explanations.
pub struct RoutingExplanationService {
    chat_service: Arc<ChatService>,
    telemetry_service: Arc<TelemetryService>,
    provider_registry: Arc<ProviderRegistry>,
    live_cache: RwLock<HashMap<String, RoutingExplanation>>,
}

impl RoutingExplanationService {
    pub fn new(
        chat_service: Arc<ChatService>,
        telemetry_service: Arc<TelemetryService>,
        provider_registry: Arc<ProviderRegistry>,
    ) -> Self {
        Self {
            chat_service,
            telemetry_service,
            provider_registry,
            live_cache: RwLock::new(HashMap::new()),
        }
    }

    /// Stores a freshly evaluated live route explanation in memory keyed by message ID.
    pub fn store_live_explanation(&self, message_id: &str, explanation: RoutingExplanation) {
        if let Ok(mut cache) = self.live_cache.write() {
            if cache.len() >= MAX_CACHE_ENTRIES {
                // Bounded eviction: drop an arbitrary entry when capacity is reached
                if let Some(key) = cache.keys().next().cloned() {
                    cache.remove(&key);
                }
            }
            cache.insert(message_id.to_string(), explanation);
        }
    }

    /// Retrieves the routing explanation for a given message ID.
    /// Returns live cached breakdown if available; otherwise falls back to safe historical metadata.
    /// Strictly read-only: never reruns SLM inference or candidate scoring!
    pub fn get_explanation(
        &self,
        message_id: &str,
        session_id_context: Option<&str>,
    ) -> Result<RoutingExplanation, AppError> {
        // 1. Check Live In-Memory Cache
        if let Ok(cache) = self.live_cache.read() {
            if let Some(cached) = cache.get(message_id) {
                if let Some(expected_session) = session_id_context {
                    if let Some(ref cached_session) = cached.session_id {
                        if cached_session != expected_session {
                            return Err(AppError::InvalidInput(format!(
                                "Message '{}' does not belong to session '{}'",
                                message_id, expected_session
                            )));
                        }
                    }
                }
                return Ok(cached.clone());
            }
        }

        // 2. Fetch Historical Message from SQLite
        let message = self
            .chat_service
            .get_message(message_id)?
            .ok_or_else(|| AppError::NotFound(format!("Chat message '{}' not found", message_id)))?;

        // Context / Ownership check
        if let Some(expected_session) = session_id_context {
            if message.session_id != expected_session {
                return Err(AppError::InvalidInput(format!(
                    "Message '{}' does not belong to session '{}'",
                    message_id, expected_session
                )));
            }
        }

        // Only assistant messages carry routing decisions
        if message.sender != MessageSender::Assistant {
            return Err(AppError::InvalidInput(format!(
                "Message '{}' is a {} message; routing explanations only apply to assistant responses",
                message_id,
                message.sender.as_str()
            )));
        }

        // 3. Build Safe Historical Explanation (Read-only, zero re-computation)
        Ok(self.build_historical_explanation(&message))
    }

    /// Builds a rich, complete explanation from live runtime routing objects.
    pub fn build_live_explanation(
        &self,
        message_id: Option<&str>,
        session_id: Option<&str>,
        task_analysis: &TaskAnalysisResult,
        scoring_result: &RoutingScoreResult,
        routing_decision: &RoutingDecision,
    ) -> RoutingExplanation {
        let (provider_id_str, model_id_str) = match routing_decision.selected_candidate.as_ref() {
            Some(cand) => (cand.provider_id.clone(), cand.model_id.clone()),
            None => ("unknown".to_string(), "unknown".to_string()),
        };

        // 1. Resolve Provider & Model Catalog Metadata
        let (provider_name, model_name, is_local, context_window) = {
            if let Ok(pid) = ProviderId::new(&provider_id_str) {
                if let Some(m) = self.provider_registry.get_model(&pid, &model_id_str) {
                    let p_name = self
                        .provider_registry
                        .get_provider(&pid)
                        .map(|p| p.metadata.name.clone())
                        .unwrap_or_else(|| provider_id_str.clone());
                    (p_name, m.name.clone(), m.provider_id.is_local(), Some(m.context_window))
                } else {
                    (provider_id_str.clone(), model_id_str.clone(), false, None)
                }
            } else {
                (provider_id_str.clone(), model_id_str.clone(), false, None)
            }
        };

        let selected_route = SelectedRouteExplanation {
            provider_id: provider_id_str.clone(),
            provider_name,
            model_id: model_id_str.clone(),
            model_name,
            is_local,
            context_window,
        };

        // 2. Build Deterministic Summary Text
        let summary = match routing_decision.selection_mode {
            SelectionMode::ManualOverride => {
                "Selected because the user manually chose this model and the route passed capability and availability checks."
                    .to_string()
            }
            SelectionMode::Automatic => {
                let score_str = routing_decision
                    .confidence_metadata
                    .selected_score
                    .map(|s| format!(" (suitability score: {:.2})", s))
                    .unwrap_or_default();
                format!(
                    "Selected because it achieved the highest policy-valid routing fit{} for the detected {} task under current routing policy.",
                    score_str,
                    task_analysis.intent.primary_intent.display_label()
                )
            }
            SelectionMode::OverrideRejected => {
                format!(
                    "Manual override was rejected ({}). Policy fell back to automatic selection.",
                    routing_decision.decision_reason
                )
            }
            SelectionMode::NoRouteAvailable => {
                "No eligible provider/model met hard capability requirements or policy thresholds.".to_string()
            }
            SelectionMode::Blocked => {
                format!("Routing execution was blocked: {}", routing_decision.decision_reason)
            }
        };

        // 3. Build Task Analysis Summary
        let mut domains = vec![task_analysis.primary_domain.domain.display_label().to_string()];
        for sec in &task_analysis.secondary_domains {
            domains.push(sec.domain.display_label().to_string());
        }

        // Compare task capability requirements against the selected model's declared capabilities
        let required_capabilities = task_analysis
            .capabilities
            .iter()
            .map(|cap| {
                let is_matched = if let Ok(pid) = ProviderId::new(&provider_id_str) {
                    if let Some(m) = self.provider_registry.get_model(&pid, &model_id_str) {
                        // Check if model declared this capability
                        m.capabilities.is_supported(&cap.requirement.as_str())
                    } else {
                        false
                    }
                } else {
                    false
                };

                TaskRequirementExplanation {
                    capability: cap.requirement.as_str().to_string(),
                    label: cap.requirement.display_label().to_string(),
                    is_matched_by_selected_model: is_matched,
                }
            })
            .collect();

        let task_summary = TaskAnalysisSummary {
            primary_intent: task_analysis.intent.primary_intent.as_str().to_string(),
            intent_label: task_analysis.intent.primary_intent.display_label().to_string(),
            intent_confidence: task_analysis.intent.confidence,
            complexity: task_analysis.complexity.level.as_str().to_string(),
            complexity_label: task_analysis.complexity.level.display_label().to_string(),
            complexity_score: task_analysis.complexity.score,
            domains,
            required_capabilities,
            is_ambiguous: task_analysis.ambiguity != AnalysisAmbiguity::Low,
            ambiguity_level: format!("{:?}", task_analysis.ambiguity).to_lowercase(),
            completeness: format!("{:?}", task_analysis.completeness).to_lowercase(),
        };

        // 4. Build Candidate Score Breakdown
        let selected_cand_score = scoring_result
            .candidates
            .iter()
            .find(|c| c.provider_id == provider_id_str && c.model_id == model_id_str);

        let score_breakdown = selected_cand_score.and_then(|cand| {
            cand.breakdown.as_ref().map(|b| {
                let weights = &scoring_result.weights_applied;
                let dims = vec![
                    ScoreDimensionExplanation {
                        key: "intent_fit".to_string(),
                        label: "Intent Fit".to_string(),
                        score: b.intent_fit,
                        weight_percent: Some(weights.intent_fit * 100.0),
                        weighted_contribution: Some(b.intent_fit * weights.intent_fit),
                        explanation: "Suitability alignment with the detected primary user intent".to_string(),
                        status: "known".to_string(),
                    },
                    ScoreDimensionExplanation {
                        key: "complexity_fit".to_string(),
                        label: "Complexity Fit".to_string(),
                        score: b.complexity_fit,
                        weight_percent: Some(weights.complexity_fit * 100.0),
                        weighted_contribution: Some(b.complexity_fit * weights.complexity_fit),
                        explanation: "Computational and reasoning tier alignment for task complexity".to_string(),
                        status: "known".to_string(),
                    },
                    ScoreDimensionExplanation {
                        key: "domain_fit".to_string(),
                        label: "Domain Fit".to_string(),
                        score: b.domain_fit,
                        weight_percent: Some(weights.domain_fit * 100.0),
                        weighted_contribution: Some(b.domain_fit * weights.domain_fit),
                        explanation: "Subject-matter taxonomy match with primary and secondary domains".to_string(),
                        status: "known".to_string(),
                    },
                    ScoreDimensionExplanation {
                        key: "capability_fit".to_string(),
                        label: "Capability Match".to_string(),
                        score: b.capability_fit,
                        weight_percent: Some(weights.capability_fit * 100.0),
                        weighted_contribution: Some(b.capability_fit * weights.capability_fit),
                        explanation: "Coverage of task requirements (code, math, context, structured output)".to_string(),
                        status: "known".to_string(),
                    },
                    ScoreDimensionExplanation {
                        key: "context_fit".to_string(),
                        label: "Context Fit".to_string(),
                        score: b.context_fit,
                        weight_percent: Some(weights.context_fit * 100.0),
                        weighted_contribution: Some(b.context_fit * weights.context_fit),
                        explanation: "Supported context window headroom relative to estimated tokens".to_string(),
                        status: "known".to_string(),
                    },
                    ScoreDimensionExplanation {
                        key: "preference_fit".to_string(),
                        label: "User Preference Fit".to_string(),
                        score: b.preference_fit,
                        weight_percent: Some(weights.preference_fit * 100.0),
                        weighted_contribution: Some(b.preference_fit * weights.preference_fit),
                        explanation: "User priority weight and active routing preference mode".to_string(),
                        status: "known".to_string(),
                    },
                    ScoreDimensionExplanation {
                        key: "cost_fit".to_string(),
                        label: "Cost Efficiency".to_string(),
                        score: b.cost_fit,
                        weight_percent: Some(weights.cost_fit * 100.0),
                        weighted_contribution: Some(b.cost_fit * weights.cost_fit),
                        explanation: if cand.pricing_known {
                            "Cost efficiency normalized against token pricing catalog".to_string()
                        } else {
                            "Pricing data unavailable for candidate; default baseline applied".to_string()
                        },
                        status: if cand.pricing_known { "known".to_string() } else { "unknown".to_string() },
                    },
                    ScoreDimensionExplanation {
                        key: "latency_fit".to_string(),
                        label: "Latency Fit".to_string(),
                        score: b.latency_fit,
                        weight_percent: Some(weights.latency_fit * 100.0),
                        weighted_contribution: Some(b.latency_fit * weights.latency_fit),
                        explanation: if cand.latency_known {
                            "Historical health probe latency score".to_string()
                        } else {
                            "Historical latency unmeasured; neutral baseline applied".to_string()
                        },
                        status: if cand.latency_known { "known".to_string() } else { "unknown".to_string() },
                    },
                    ScoreDimensionExplanation {
                        key: "reliability_fit".to_string(),
                        label: "Reliability & Health".to_string(),
                        score: b.reliability_fit,
                        weight_percent: Some(weights.reliability_fit * 100.0),
                        weighted_contribution: Some(b.reliability_fit * weights.reliability_fit),
                        explanation: "Runtime availability and preflight operational status".to_string(),
                        status: "known".to_string(),
                    },
                ];

                let adjustments = cand
                    .adjustments
                    .iter()
                    .map(|a| ScoreAdjustmentExplanation {
                        dimension: a.dimension.clone(),
                        delta: a.delta,
                        reason: a.reason.clone(),
                    })
                    .collect();

                ScoreBreakdownExplanation {
                    overall_score: cand.total_score,
                    dimensions: dims,
                    adjustments,
                }
            })
        });

        // 5. Build Confidence Triad
        let slm_conf = routing_decision.confidence_metadata.slm_analysis_confidence;
        let slm_level = match slm_conf {
            Some(c) if c >= 0.80 => "high",
            Some(c) if c >= 0.50 => "medium",
            Some(_) => "low",
            None => "unknown",
        };

        let confidence_summary = ConfidenceSummaryExplanation {
            slm_confidence: slm_conf,
            slm_confidence_level: slm_level.to_string(),
            routing_fit: routing_decision.confidence_metadata.selected_score,
            selection_margin: routing_decision.confidence_metadata.selection_margin,
            description: "SLM confidence represents the local classifier's self-reported certainty in task analysis, not probability of answer correctness. Routing fit reflects multi-factor candidate suitability under policy scoring."
                .to_string(),
        };

        // 6. Build Selection Margin
        let mut eligible_alternatives: Vec<&crate::routing::scoring::types::CandidateScore> =
            scoring_result
                .candidates
                .iter()
                .filter(|c| c.is_eligible && (c.provider_id != provider_id_str || c.model_id != model_id_str))
                .collect();

        eligible_alternatives.sort_by(|a, b| {
            b.total_score
                .unwrap_or(0.0)
                .partial_cmp(&a.total_score.unwrap_or(0.0))
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        let runner_up = eligible_alternatives.first();
        let selection_margin = routing_decision
            .confidence_metadata
            .selection_margin
            .map(|margin| {
                let (r_model, r_score) = match runner_up {
                    Some(r) => (Some(r.display_name.clone()), r.total_score),
                    None => (None, None),
                };

                let desc = match (&r_model, r_score) {
                    (Some(name), Some(s)) => format!(
                        "The selected route scored {:.2} higher than the next eligible candidate ({} at {:.2}).",
                        margin, name, s
                    ),
                    _ => format!("Selection margin is {:.2} over alternative candidates.", margin),
                };

                SelectionMarginExplanation {
                    margin: Some(margin),
                    runner_up_model: r_model,
                    runner_up_score: r_score,
                    description: desc,
                }
            });

        // 7. Format Top Alternative Candidates (presentation bounded)
        let mut alternatives = Vec::new();
        let mut rank_counter = 2; // rank 1 is selected
        for cand in eligible_alternatives.iter().take(3) {
            let p_name = if let Ok(pid) = ProviderId::new(&cand.provider_id) {
                self.provider_registry
                    .get_provider(&pid)
                    .map(|p| p.metadata.name.clone())
                    .unwrap_or_else(|| cand.provider_id.clone())
            } else {
                cand.provider_id.clone()
            };

            alternatives.push(AlternativeCandidateExplanation {
                rank: rank_counter,
                provider_id: cand.provider_id.clone(),
                provider_name: p_name,
                model_id: cand.model_id.clone(),
                display_name: cand.display_name.clone(),
                score: cand.total_score,
                is_eligible: true,
                ineligibility_reason: None,
                status: "eligible_alternative".to_string(),
            });
            rank_counter += 1;
        }

        // Add 1 ineligible candidate if any exist to explain why it was excluded
        if let Some(ineligible) = scoring_result.candidates.iter().find(|c| !c.is_eligible) {
            let p_name = if let Ok(pid) = ProviderId::new(&ineligible.provider_id) {
                self.provider_registry
                    .get_provider(&pid)
                    .map(|p| p.metadata.name.clone())
                    .unwrap_or_else(|| ineligible.provider_id.clone())
            } else {
                ineligible.provider_id.clone()
            };

            let reason_str = ineligible
                .ineligibility_reasons
                .first()
                .map(|r| r.description())
                .unwrap_or_else(|| "Disqualified by hard eligibility constraints".to_string());

            alternatives.push(AlternativeCandidateExplanation {
                rank: rank_counter,
                provider_id: ineligible.provider_id.clone(),
                provider_name: p_name,
                model_id: ineligible.model_id.clone(),
                display_name: ineligible.display_name.clone(),
                score: ineligible.total_score,
                is_eligible: false,
                ineligibility_reason: Some(reason_str),
                status: "ineligible".to_string(),
            });
        }

        // 8. Policy Factors & Provenance Evidence
        let mut policy_factors = Vec::new();
        policy_factors.push(PolicyFactorExplanation {
            factor: "selection_mode".to_string(),
            label: "Selection Mode".to_string(),
            description: format!("Route determined via {}", routing_decision.selection_mode.as_str()),
        });
        policy_factors.push(PolicyFactorExplanation {
            factor: "policy_version".to_string(),
            label: "Policy Engine".to_string(),
            description: format!("Version {}", routing_decision.policy_version),
        });

        let evidence = vec![
            ExplanationEvidence {
                source: "task_analysis".to_string(),
                label: "Classifier Model".to_string(),
                detail: format!("{}:{}", task_analysis.analyzer_model_id, task_analysis.analyzer_model_version),
            },
            ExplanationEvidence {
                source: "scoring_engine".to_string(),
                label: "Evaluated Candidates".to_string(),
                detail: format!("{} evaluated ({} eligible)", scoring_result.evaluated_candidates_count, scoring_result.eligible_count),
            },
            ExplanationEvidence {
                source: "routing_policy".to_string(),
                label: "Decision Reason".to_string(),
                detail: routing_decision.decision_reason.clone(),
            },
        ];

        RoutingExplanation {
            schema_version: DEFAULT_EXPLANATION_SCHEMA_VERSION.to_string(),
            scoring_algorithm_version: routing_decision.scoring_algorithm_version.clone(),
            policy_version: routing_decision.policy_version.clone(),
            classifier_version: Some(task_analysis.analyzer_model_id.clone()),
            message_id: message_id.map(str::to_string),
            session_id: session_id.map(str::to_string),
            selection_mode: routing_decision.selection_mode.as_str().to_string(),
            summary,
            decision_reason: routing_decision.decision_reason.clone(),
            is_historical: false,
            selected_route,
            task_summary: Some(task_summary),
            score_breakdown,
            confidence_summary,
            selection_margin,
            alternatives,
            policy_factors,
            evidence,
            generated_at_ms: current_epoch_ms(),
        }
    }

    /// Builds a safe, truthful explanation for a historical message.
    /// Strictly read-only: does NOT rerun SLM inference, scoring, or provider probing.
    pub fn build_historical_explanation(&self, message: &ChatMessage) -> RoutingExplanation {
        let meta = &message.metadata;
        let provider_id_str = meta.routed_provider.clone().unwrap_or_else(|| "unknown".to_string());
        let model_id_str = meta.routed_model.clone().unwrap_or_else(|| "unknown".to_string());

        let (provider_name, model_name, is_local, context_window) = {
            if let Ok(pid) = ProviderId::new(&provider_id_str) {
                if let Some(m) = self.provider_registry.get_model(&pid, &model_id_str) {
                    let p_name = self
                        .provider_registry
                        .get_provider(&pid)
                        .map(|p| p.metadata.name.clone())
                        .unwrap_or_else(|| provider_id_str.clone());
                    (p_name, m.name.clone(), m.provider_id.is_local(), Some(m.context_window))
                } else {
                    (provider_id_str.clone(), model_id_str.clone(), false, None)
                }
            } else {
                (provider_id_str.clone(), model_id_str.clone(), false, None)
            }
        };

        let selected_route = SelectedRouteExplanation {
            provider_id: provider_id_str,
            provider_name,
            model_id: model_id_str,
            model_name,
            is_local,
            context_window,
        };

        let slm_conf = meta.slm_confidence_score;
        let slm_level = match slm_conf {
            Some(c) if c >= 0.80 => "high",
            Some(c) if c >= 0.50 => "medium",
            Some(_) => "low",
            None => "unknown",
        };

        let summary = meta
            .routing_reason
            .clone()
            .unwrap_or_else(|| "Historical routing decision recorded in message metadata.".to_string());

        let confidence_summary = ConfidenceSummaryExplanation {
            slm_confidence: slm_conf,
            slm_confidence_level: slm_level.to_string(),
            routing_fit: None,
            selection_margin: None,
            description: "Historical record: Detailed candidate breakdown was not persisted for this turn. SLM confidence reflects local classifier analysis certainty at execution time.".to_string(),
        };

        let evidence = vec![ExplanationEvidence {
            source: "chat_persistence".to_string(),
            label: "Recorded In".to_string(),
            detail: format!("Message {} created at {}", message.id, message.createdAt),
        }];

        RoutingExplanation {
            schema_version: DEFAULT_EXPLANATION_SCHEMA_VERSION.to_string(),
            scoring_algorithm_version: "historical".to_string(),
            policy_version: "historical".to_string(),
            classifier_version: None,
            message_id: Some(message.id.clone()),
            session_id: Some(message.session_id.clone()),
            selection_mode: "recorded".to_string(),
            summary,
            decision_reason: meta.routing_reason.clone().unwrap_or_default(),
            is_historical: true,
            selected_route,
            task_summary: None,
            score_breakdown: None,
            confidence_summary,
            selection_margin: None,
            alternatives: Vec::new(),
            policy_factors: vec![PolicyFactorExplanation {
                factor: "historical_metadata".to_string(),
                label: "Data Source".to_string(),
                description: "Recovered from authoritative SQLite message metadata record".to_string(),
            }],
            evidence,
            generated_at_ms: current_epoch_ms(),
        }
    }
}

