// ============================================================================
// Nano Route - Classifier Label Mapping
// File: src-tauri/src/classification/label_map.rs
// ============================================================================
// Versioned mapping between model output tensor indices and canonical UserIntent.
// Strictly prevents hardcoded index assumptions or silent index misalignments.
// ============================================================================

use std::collections::HashMap;
use crate::classification::errors::{ClassificationError, ClassificationErrorKind, ClassificationStage};
use crate::classification::types::UserIntent;

pub const DEFAULT_INTENT_SCHEMA_VERSION: &str = "nano-route-intent-schema-v1";

/// Versioned mapping binding a specific model artifact and version to canonical intents.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ClassifierLabelMap {
    pub schema_id: String,
    pub model_id: String,
    pub model_version: String,
    /// Ordered vector mapping tensor output index `i` to `(UserIntent, canonical_label_str)`.
    mapping: Vec<(UserIntent, String)>,
    /// Reverse lookup: intent -> primary index.
    intent_to_index: HashMap<UserIntent, usize>,
}

impl ClassifierLabelMap {
    /// Factory for the default 16-class Nano Route router SLM label schema.
    pub fn default_router_label_map(model_id: &str, model_version: &str) -> Self {
        let labels = vec![
            "software_engineering",
            "code_debugging",
            "reasoning_math",
            "general_conversation",
            "research_retrieval",
            "writing",
            "data_analysis",
            "translation",
            "summarization",
            "creative_generation",
            "coding",
            "math",
            "reasoning",
            "creative",
            "other",
            "unknown",
        ];

        let mut mapping = Vec::with_capacity(labels.len());
        let mut intent_to_index = HashMap::new();

        for (idx, &label) in labels.iter().enumerate() {
            let intent = UserIntent::from_canonical(label).unwrap_or(UserIntent::Other);
            mapping.push((intent, label.to_string()));
            intent_to_index.entry(intent).or_insert(idx);
        }

        Self {
            schema_id: DEFAULT_INTENT_SCHEMA_VERSION.to_string(),
            model_id: model_id.to_string(),
            model_version: model_version.to_string(),
            mapping,
            intent_to_index,
        }
    }

    /// Constructs a label map from a slice of string labels declared in a model manifest.
    pub fn from_manifest_labels(
        schema_id: &str,
        model_id: &str,
        model_version: &str,
        labels: &[String],
    ) -> Result<Self, ClassificationError> {
        if labels.is_empty() {
            return Err(ClassificationError::new(
                ClassificationErrorKind::LabelSchemaMissing,
                ClassificationStage::LabelMapping,
                format!("Label list is empty for model '{}'", model_id),
            )
            .with_model_id(model_id));
        }

        let mut mapping = Vec::with_capacity(labels.len());
        let mut intent_to_index = HashMap::new();

        for (idx, label) in labels.iter().enumerate() {
            let intent = UserIntent::from_canonical(label).ok_or_else(|| {
                ClassificationError::new(
                    ClassificationErrorKind::UnknownIntentLabel,
                    ClassificationStage::LabelMapping,
                    format!("Unknown canonical intent label '{}' at index {}", label, idx),
                )
                .with_model_id(model_id)
            })?;

            mapping.push((intent, label.clone()));
            intent_to_index.entry(intent).or_insert(idx);
        }

        Ok(Self {
            schema_id: schema_id.to_string(),
            model_id: model_id.to_string(),
            model_version: model_version.to_string(),
            mapping,
            intent_to_index,
        })
    }

    /// Number of output labels expected by this mapping.
    pub fn expected_dimension(&self) -> usize {
        self.mapping.len()
    }

    /// Validates that an output tensor dimension matches this label schema exactly.
    pub fn validate_output_dimension(&self, actual_dim: usize) -> Result<(), ClassificationError> {
        if actual_dim != self.expected_dimension() {
            return Err(ClassificationError::schema_mismatch(
                &self.model_id,
                self.expected_dimension(),
                actual_dim,
            ));
        }
        Ok(())
    }

    /// Resolves an output tensor class index to its corresponding `UserIntent`.
    pub fn get_intent(&self, index: usize) -> Result<(UserIntent, &str), ClassificationError> {
        self.mapping
            .get(index)
            .map(|(intent, str_id)| (*intent, str_id.as_str()))
            .ok_or_else(|| {
                ClassificationError::new(
                    ClassificationErrorKind::UnknownIntentLabel,
                    ClassificationStage::LabelMapping,
                    format!(
                        "Class index {} out of bounds for label map of size {}",
                        index,
                        self.mapping.len()
                    ),
                )
                .with_model_id(&self.model_id)
            })
    }

    /// Finds the index associated with an intent (first matching).
    pub fn get_index_for_intent(&self, intent: UserIntent) -> Option<usize> {
        self.intent_to_index.get(&intent).copied()
    }
}

