// ============================================================================
// Nano Route - Routing Policy Selection Logic
// File: src-tauri/src/routing/policy/selection.rs
// ============================================================================
// Pure, deterministic evaluation of candidate suitability scores under active
// routing policy rules, preference profiles, thresholds, and tie resolution.
// Strictly decoupled from network execution and actual failover dispatch.
// ============================================================================

use std::cmp::Ordering;
use std::collections::HashMap;

use crate::analysis::types::TaskAnalysisResult;
use crate::domain::settings::RoutingPreferenceMode;
use crate::routing::policy::config::RoutingPolicyConfig;
use crate::routing::policy::types::{
    CandidateSelectionStatus, FallbackCandidate, RankedCandidate, RoutingConfidenceMetadata,
    RoutingDecisionExplanation, SelectedRouteCandidate, SelectionMode,
};
use crate::routing::scoring::types::CandidateScore;

pub struct PolicySelector;

impl PolicySelector {
    /// Selects the primary route and prepares ordered fallback candidates according to policy.
    pub fn select_automatic_route(
        candidates: &[CandidateScore],
        config: &RoutingPolicyConfig,
        task_analysis: Option<&TaskAnalysisResult>,
        provider_priorities: &HashMap<String, u32>,
    ) -> (
        SelectionMode,
        Option<SelectedRouteCandidate>,
        Vec<FallbackCandidate>,
        Vec<RankedCandidate>,
        String,
        RoutingDecisionExplanation,
        RoutingConfidenceMetadata,
    ) {
        if candidates.is_empty() {
            let explanation = RoutingDecisionExplanation {
                mode: SelectionMode::NoRouteAvailable,
                summary: "No candidate models evaluated".to_string(),
                primary_reason: "Registry catalog returned zero candidate models".to_string(),
                score_reason: None,
                policy_reason: None,
                override_reason: None,
                eligibility_reason: Some("No models present in catalog".to_string()),
                fallback_reason: None,
            };
            let confidence = RoutingConfidenceMetadata {
                slm_analysis_confidence: task_analysis.map(|a| a.complexity.confidence),
                selected_score: None,
                selection_margin: None,
                is_ambiguous: false,
            };
            return (
                SelectionMode::NoRouteAvailable,
                None,
                Vec::new(),
                Vec::new(),
                "No candidate models available in catalog".to_string(),
                explanation,
                confidence,
            );
        }

        // 1. Separate Hard-Eligible from Hard-Ineligible
        let mut eligible_candidates: Vec<&CandidateScore> = candidates
            .iter()
            .filter(|c| c.is_eligible && c.total_score.is_some())
            .collect();

        // 2. Sort Eligible Candidates by Policy Criteria
        eligible_candidates.sort_by(|a, b| {
            Self::compare_candidates(a, b, config, provider_priorities)
        });

        // 3. Evaluate Policy Thresholds
        let mut policy_admissible: Vec<&CandidateScore> = Vec::new();
        let mut threshold_filtered: Vec<&CandidateScore> = Vec::new();

        for candidate in &eligible_candidates {
            let score = candidate.total_score.unwrap_or(0.0);
            if score >= config.minimum_accepted_score {
                policy_admissible.push(candidate);
            } else {
                threshold_filtered.push(candidate);
            }
        }

        // 4. Determine Primary Selection
        if policy_admissible.is_empty() {
            let (decision_reason, summary) = if eligible_candidates.is_empty() {
                (
                    "No candidates satisfied hard capability or credential requirements".to_string(),
                    "All evaluated candidates are hard-ineligible".to_string(),
                )
            } else {
                (
                    format!(
                        "All eligible candidates scored below minimum policy threshold ({:.2})",
                        config.minimum_accepted_score
                    ),
                    format!(
                        "Eligible candidates fell below minimum score threshold of {:.2}",
                        config.minimum_accepted_score
                    ),
                )
            };

            // Build full ranking audit trail
            let mut ranking = Vec::new();
            let mut rank = 1;

            for candidate in &threshold_filtered {
                ranking.push(RankedCandidate {
                    rank,
                    provider_id: candidate.provider_id.clone(),
                    model_id: candidate.model_id.clone(),
                    display_name: candidate.display_name.clone(),
                    score: candidate.total_score,
                    status: CandidateSelectionStatus::FilteredPolicyThreshold,
                    rejection_reasons: vec![format!(
                        "Score {:.3} below threshold {:.2}",
                        candidate.total_score.unwrap_or(0.0),
                        config.minimum_accepted_score
                    )],
                });
                rank += 1;
            }

            for candidate in candidates.iter().filter(|c| !c.is_eligible) {
                ranking.push(RankedCandidate {
                    rank,
                    provider_id: candidate.provider_id.clone(),
                    model_id: candidate.model_id.clone(),
                    display_name: candidate.display_name.clone(),
                    score: None,
                    status: CandidateSelectionStatus::DisqualifiedHardConstraint,
                    rejection_reasons: candidate
                        .ineligibility_reasons
                        .iter()
                        .map(|r| r.description())
                        .collect(),
                });
                rank += 1;
            }

            let explanation = RoutingDecisionExplanation {
                mode: SelectionMode::NoRouteAvailable,
                summary,
                primary_reason: decision_reason.clone(),
                score_reason: Some(format!(
                    "Minimum required score: {:.2}",
                    config.minimum_accepted_score
                )),
                policy_reason: Some(format!(
                    "Policy preference: {}",
                    config.preference_profile.as_str()
                )),
                override_reason: None,
                eligibility_reason: if eligible_candidates.is_empty() {
                    Some("Hard eligibility check disqualified all candidates".to_string())
                } else {
                    None
                },
                fallback_reason: None,
            };

            let confidence = RoutingConfidenceMetadata {
                slm_analysis_confidence: task_analysis.map(|a| a.complexity.confidence),
                selected_score: None,
                selection_margin: None,
                is_ambiguous: false,
            };

            return (
                SelectionMode::NoRouteAvailable,
                None,
                Vec::new(),
                ranking,
                decision_reason,
                explanation,
                confidence,
            );
        }

        // Primary candidate is top of policy_admissible
        let primary = policy_admissible[0];
        let primary_score = primary.total_score.unwrap_or(0.0);

        // Calculate selection margin against runner-up if present
        let runner_up_score = policy_admissible.get(1).and_then(|r| r.total_score);
        let selection_margin = runner_up_score.map(|s| (primary_score - s).max(0.0));

        let selected = SelectedRouteCandidate {
            provider_id: primary.provider_id.clone(),
            model_id: primary.model_id.clone(),
            display_name: primary.display_name.clone(),
            score: Some(primary_score),
            selection_margin,
            context_window: primary.context_window,
        };

        // 5. Build Ordered Fallback Candidates (excluding primary)
        let mut fallbacks = Vec::new();
        let fallback_pool: Vec<&CandidateScore> = policy_admissible
            .iter()
            .skip(1)
            .take(config.max_fallback_candidates)
            .copied()
            .collect();

        for (idx, fb) in fallback_pool.iter().enumerate() {
            fallbacks.push(FallbackCandidate {
                rank: idx + 1,
                provider_id: fb.provider_id.clone(),
                model_id: fb.model_id.clone(),
                display_name: fb.display_name.clone(),
                score: fb.total_score.unwrap_or(0.0),
                reason: format!(
                    "Eligible fallback candidate #{} (suitability score: {:.3})",
                    idx + 1,
                    fb.total_score.unwrap_or(0.0)
                ),
            });
        }

        // 6. Build Diagnostic Ranking Trail
        let mut ranking = Vec::new();
        ranking.push(RankedCandidate {
            rank: 1,
            provider_id: primary.provider_id.clone(),
            model_id: primary.model_id.clone(),
            display_name: primary.display_name.clone(),
            score: Some(primary_score),
            status: CandidateSelectionStatus::SelectedPrimary,
            rejection_reasons: Vec::new(),
        });

        let mut current_rank = 2;
        for fb in &fallbacks {
            ranking.push(RankedCandidate {
                rank: current_rank,
                provider_id: fb.provider_id.clone(),
                model_id: fb.model_id.clone(),
                display_name: fb.display_name.clone(),
                score: Some(fb.score),
                status: CandidateSelectionStatus::EligibleFallback,
                rejection_reasons: Vec::new(),
            });
            current_rank += 1;
        }

        for candidate in &threshold_filtered {
            ranking.push(RankedCandidate {
                rank: current_rank,
                provider_id: candidate.provider_id.clone(),
                model_id: candidate.model_id.clone(),
                display_name: candidate.display_name.clone(),
                score: candidate.total_score,
                status: CandidateSelectionStatus::FilteredPolicyThreshold,
                rejection_reasons: vec![format!(
                    "Score {:.3} below threshold {:.2}",
                    candidate.total_score.unwrap_or(0.0),
                    config.minimum_accepted_score
                )],
            });
            current_rank += 1;
        }

        for candidate in candidates.iter().filter(|c| !c.is_eligible) {
            ranking.push(RankedCandidate {
                rank: current_rank,
                provider_id: candidate.provider_id.clone(),
                model_id: candidate.model_id.clone(),
                display_name: candidate.display_name.clone(),
                score: None,
                status: CandidateSelectionStatus::DisqualifiedHardConstraint,
                rejection_reasons: candidate
                    .ineligibility_reasons
                    .iter()
                    .map(|r| r.description())
                    .collect(),
            });
            current_rank += 1;
        }

        // 7. Generate Explanations
        let decision_reason = format!(
            "Automatically selected '{}' ({}/{}) with suitability score {:.3} under '{}' policy",
            primary.display_name,
            primary.provider_id,
            primary.model_id,
            primary_score,
            config.preference_profile.as_str()
        );

        let explanation = RoutingDecisionExplanation {
            mode: SelectionMode::Automatic,
            summary: format!(
                "Selected '{}' as primary route from {} eligible candidates",
                primary.display_name,
                policy_admissible.len()
            ),
            primary_reason: format!(
                "Highest policy-valid suitability score ({:.3}) satisfying task constraints",
                primary_score
            ),
            score_reason: Some(format!(
                "Score: {:.3}{}",
                primary_score,
                selection_margin
                    .map(|m| format!(" (margin: +{:.3})", m))
                    .unwrap_or_default()
            )),
            policy_reason: Some(format!(
                "Routing preference: {}",
                config.preference_profile.as_str()
            )),
            override_reason: None,
            eligibility_reason: Some("Passed all hard capability and health checks".to_string()),
            fallback_reason: if fallbacks.is_empty() {
                Some("No additional eligible fallback candidates available".to_string())
            } else {
                Some(format!("Prepared {} fallback candidates", fallbacks.len()))
            },
        };

        let confidence = RoutingConfidenceMetadata {
            slm_analysis_confidence: task_analysis.map(|a| a.complexity.confidence),
            selected_score: Some(primary_score),
            selection_margin,
            is_ambiguous: selection_margin.map(|m| m < config.tie_tolerance).unwrap_or(false),
        };

        (
            SelectionMode::Automatic,
            Some(selected),
            fallbacks,
            ranking,
            decision_reason,
            explanation,
            confidence,
        )
    }

    /// Deterministic candidate comparison under routing policy rules.
    fn compare_candidates(
        a: &CandidateScore,
        b: &CandidateScore,
        config: &RoutingPolicyConfig,
        provider_priorities: &HashMap<String, u32>,
    ) -> Ordering {
        let score_a = a.total_score.unwrap_or(0.0);
        let score_b = b.total_score.unwrap_or(0.0);
        let diff = (score_a - score_b).abs();

        // 1. If score difference is greater than tie tolerance, evaluate preference profile
        match config.preference_profile {
            RoutingPreferenceMode::Quality => {
                // Quality mode: strictly highest score
                if diff > config.tie_tolerance {
                    return score_b.partial_cmp(&score_a).unwrap_or(Ordering::Equal);
                }
            }
            RoutingPreferenceMode::CostSaving => {
                // CostSaving mode: if scores are within 4x tie tolerance (e.g. within 0.06), favor higher cost_fit
                if diff <= (config.tie_tolerance * 4.0) {
                    let cost_a = a.breakdown.as_ref().map(|bk| bk.cost_fit).unwrap_or(0.5);
                    let cost_b = b.breakdown.as_ref().map(|bk| bk.cost_fit).unwrap_or(0.5);
                    let cost_diff = (cost_a - cost_b).abs();
                    if cost_diff > config.tie_tolerance {
                        return cost_b.partial_cmp(&cost_a).unwrap_or(Ordering::Equal);
                    }
                } else {
                    return score_b.partial_cmp(&score_a).unwrap_or(Ordering::Equal);
                }
            }
            RoutingPreferenceMode::Balanced => {
                if diff > config.tie_tolerance {
                    return score_b.partial_cmp(&score_a).unwrap_or(Ordering::Equal);
                }
            }
        }

        // 2. Score Difference Tie-breaker (if not identical)
        if diff > 1e-5 {
            return score_b.partial_cmp(&score_a).unwrap_or(Ordering::Equal);
        }

        // 3. User Provider Priority Weight (1..10)
        let prio_a = provider_priorities.get(&a.provider_id).copied().unwrap_or(5);
        let prio_b = provider_priorities.get(&b.provider_id).copied().unwrap_or(5);
        if prio_a != prio_b {
            return prio_b.cmp(&prio_a); // Higher priority weight first
        }

        // 4. Provider ID ascending (lexicographical)
        match a.provider_id.cmp(&b.provider_id) {
            Ordering::Equal => {}
            other => return other,
        }

        // 5. Model ID ascending (lexicographical)
        a.model_id.cmp(&b.model_id)
    }
}

