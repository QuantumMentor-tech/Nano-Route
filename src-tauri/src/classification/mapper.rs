// ============================================================================
// Nano Route - Classifier Output Mapper
// File: src-tauri/src/classification/mapper.rs
// ============================================================================
// Deterministically maps raw SLM output tensors to typed IntentClassificationResult.
// Enforces numerical safety (NaN, Inf protection), numerically stable softmax,
// label map alignment, confidence policy evaluation, and feature-based explanations.
// ============================================================================

use crate::classification::errors::{ClassificationError, ClassificationErrorKind, ClassificationStage};
use crate::classification::label_map::ClassifierLabelMap;
use crate::classification::policy::ClassificationPolicy;
use crate::classification::types::{AmbiguityState, IntentCandidate, UserIntent};
use crate::inference::types::InferenceOutput;

/// Output mapping result containing primary classification and metadata.
pub struct MappedClassification {
    pub primary_intent: UserIntent,
    pub confidence: f64,
    pub alternatives: Vec<IntentCandidate>,
    pub ambiguity: AmbiguityState,
    pub explanation: String,
}

/// Numerically stable softmax converting raw logits into normalized probabilities.
pub fn compute_stable_softmax(logits: &[f32]) -> Result<Vec<f64>, ClassificationError> {
    if logits.is_empty() {
        return Err(ClassificationError::new(
            ClassificationErrorKind::InvalidModelOutput,
            ClassificationStage::OutputValidation,
            "Cannot compute probabilities: Output logit vector is empty",
        ));
    }

    // 1. Check for NaN and Infinity (Section 40)
    for (idx, &v) in logits.iter().enumerate() {
        if v.is_nan() {
            return Err(ClassificationError::new(
                ClassificationErrorKind::InvalidModelOutput,
                ClassificationStage::OutputValidation,
                format!("Model logit at index {} is NaN", idx),
            ));
        }
        if v.is_infinite() {
            return Err(ClassificationError::new(
                ClassificationErrorKind::InvalidModelOutput,
                ClassificationStage::OutputValidation,
                format!("Model logit at index {} is Infinite ({})", idx, v),
            ));
        }
    }

    // 2. Subtract maximum logit for numerical stability (prevents float overflow)
    let max_logit = logits.iter().cloned().fold(f32::NEG_INFINITY, f32::max);

    let mut exp_values = Vec::with_capacity(logits.len());
    let mut sum_exp: f64 = 0.0;

    for &logit in logits {
        let e = ((logit - max_logit) as f64).exp();
        exp_values.push(e);
        sum_exp += e;
    }

    if sum_exp <= 0.0 || sum_exp.is_nan() || sum_exp.is_infinite() {
        return Err(ClassificationError::new(
            ClassificationErrorKind::InvalidConfidence,
            ClassificationStage::OutputValidation,
            format!("Softmax denominator is invalid or zero: {}", sum_exp),
        ));
    }

    // 3. Normalize into probabilities
    let mut probabilities = Vec::with_capacity(logits.len());
    for e in exp_values {
        let p = e / sum_exp;
        probabilities.push(p);
    }

    Ok(probabilities)
}

/// Maps model inference output into normalized candidates, applies policy, and builds explanation.
pub fn map_inference_output(
    output: &InferenceOutput,
    label_map: &ClassifierLabelMap,
    policy: &ClassificationPolicy,
) -> Result<MappedClassification, ClassificationError> {
    // 1. Validate output tensor dimensions match registered label map
    label_map.validate_output_dimension(output.logits.len())?;

    // 2. Compute stable softmax probabilities
    let probabilities = compute_stable_softmax(&output.logits)?;

    // 3. Construct raw candidate list
    let mut candidates = Vec::with_capacity(output.logits.len());
    for (idx, &prob) in probabilities.iter().enumerate() {
        let (intent, _) = label_map.get_intent(idx)?;
        candidates.push(IntentCandidate {
            intent,
            normalized_score: prob,
            raw_score: output.logits[idx],
        });
    }

    // 4. Sort deterministically using policy tie-breaker
    policy.sort_candidates(&mut candidates);

    // 5. Evaluate ambiguity and secondary alternatives
    let (primary_intent, confidence, ambiguity, alternatives) =
        policy.evaluate_ambiguity(&candidates);

    // 6. Synthesize deterministic, feature-based explanation
    let explanation = match ambiguity {
        AmbiguityState::NotAmbiguous => {
            let runner_up_margin = if let Some(runner_up) = alternatives.first() {
                format!(" (margin {:.2} over '{}')", confidence - runner_up.normalized_score, runner_up.intent.as_str())
            } else {
                String::new()
            };
            format!(
                "Primary intent '{}' selected with normalized confidence {:.2}{}.",
                primary_intent.as_str(),
                confidence,
                runner_up_margin
            )
        }
        AmbiguityState::Ambiguous => {
            let runner_up_intent = alternatives.first().map(|c| c.intent.as_str()).unwrap_or("none");
            format!(
                "Intent ambiguous between '{}' ({:.2}) and '{}'; narrow margin below policy threshold ({:.2}).",
                primary_intent.as_str(),
                confidence,
                runner_up_intent,
                policy.ambiguity_margin
            )
        }
        AmbiguityState::MultiIntent => {
            let secondary_names: Vec<&str> = alternatives.iter().map(|c| c.intent.as_str()).collect();
            format!(
                "Multi-intent request detected: primary '{}' ({:.2}) with secondary candidates [{}].",
                primary_intent.as_str(),
                confidence,
                secondary_names.join(", ")
            )
        }
        AmbiguityState::Unknown => {
            format!(
                "Intent uncertain: top confidence {:.2} is below acceptance threshold ({:.2}).",
                confidence, policy.confidence_threshold
            )
        }
    };

    Ok(MappedClassification {
        primary_intent,
        confidence,
        alternatives,
        ambiguity,
        explanation,
    })
}

