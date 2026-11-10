// ============================================================================
// Nano Route - Local Model Manifest & Verification
// File: src-tauri/src/inference/manifest.rs
// ============================================================================
// Authoritative manifest schema describing local model artifacts, tensor
// schemas, sequence limits, and SHA-256 integrity verification contracts.
// ============================================================================

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::inference::errors::LocalSlmError;
use crate::inference::types::{InferenceBackendType, InferenceStage};

/// Current supported manifest schema version.
pub const CURRENT_MANIFEST_SCHEMA_VERSION: &str = "1.0.0";

fn default_task_type() -> String {
    "intent_classification".to_string()
}

fn default_label_schema_id() -> String {
    "nano-route-intent-schema-v1".to_string()
}

fn default_output_kind() -> String {
    "logits".to_string()
}

fn default_label_count() -> usize {
    16
}

fn default_label_map() -> Vec<String> {
    vec![
        "software_engineering".to_string(),
        "code_debugging".to_string(),
        "reasoning_math".to_string(),
        "general_conversation".to_string(),
        "research_retrieval".to_string(),
        "writing".to_string(),
        "data_analysis".to_string(),
        "translation".to_string(),
        "summarization".to_string(),
        "creative_generation".to_string(),
        "coding".to_string(),
        "math".to_string(),
        "reasoning".to_string(),
        "creative".to_string(),
        "other".to_string(),
        "unknown".to_string(),
    ]
}

/// Authoritative manifest contract for a local model package.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LocalModelManifest {
    /// Version of the manifest schema itself (e.g., "1.0.0").
    pub manifest_schema_version: String,
    /// Unique application-level model ID (e.g., "nano-route-router").
    pub id: String,
    /// Semantic version of the model artifact (e.g., "1.0.0").
    pub version: String,
    /// Human-readable display title.
    pub display_name: String,
    /// Required inference engine backend (ONNX Runtime).
    pub runtime: InferenceBackendType,
    /// Underlying model format (e.g., "onnx").
    pub format: String,
    /// Model filename relative to package root.
    pub model_filename: String,
    /// Tokenizer configuration or asset filename.
    pub tokenizer_filename: String,
    /// Maximum permitted token sequence length.
    pub max_sequence_length: usize,
    /// Expected SHA-256 hex digest of the model binary.
    pub expected_sha256: Option<String>,
    /// Expected input tensor names (e.g., ["input_ids", "attention_mask"]).
    pub input_names: Vec<String>,
    /// Expected output tensor names (e.g., ["logits"]).
    pub output_names: Vec<String>,
    /// Maximum allowed model binary size in bytes.
    pub max_file_size_bytes: u64,
    /// Model task type (e.g., "intent_classification", "embedding").
    #[serde(default = "default_task_type")]
    pub task_type: String,
    /// Associated label schema identifier (e.g., "nano-route-intent-schema-v1").
    #[serde(default = "default_label_schema_id")]
    pub label_schema_id: String,
    /// Model output tensor kind (e.g., "logits", "probabilities").
    #[serde(default = "default_output_kind")]
    pub output_kind: String,
    /// Declared number of classification labels/outputs.
    #[serde(default = "default_label_count")]
    pub label_count: usize,
    /// Ordered list of classification label identifiers.
    #[serde(default = "default_label_map")]
    pub label_map: Vec<String>,
}

impl LocalModelManifest {
    /// Standard manifest factory for the Nano Route Router SLM.
    pub fn default_router_manifest() -> Self {
        Self {
            manifest_schema_version: CURRENT_MANIFEST_SCHEMA_VERSION.to_string(),
            id: "nano-route-router".to_string(),
            version: "1.0.0".to_string(),
            display_name: "Nano Route Decision Router SLM".to_string(),
            runtime: InferenceBackendType::Onnx,
            format: "onnx".to_string(),
            model_filename: "model.onnx".to_string(),
            tokenizer_filename: "tokenizer.json".to_string(),
            max_sequence_length: 512,
            expected_sha256: None,
            input_names: vec!["input_ids".to_string(), "attention_mask".to_string()],
            output_names: vec!["logits".to_string()],
            max_file_size_bytes: 500 * 1024 * 1024, // 500 MB
            task_type: default_task_type(),
            label_schema_id: default_label_schema_id(),
            output_kind: default_output_kind(),
            label_count: default_label_count(),
            label_map: default_label_map(),
        }
    }

    /// Validates internal manifest consistency and schema support.
    pub fn validate(&self) -> Result<(), LocalSlmError> {
        if self.manifest_schema_version != CURRENT_MANIFEST_SCHEMA_VERSION {
            return Err(LocalSlmError::manifest_invalid(
                &self.id,
                format!(
                    "Unsupported manifest schema version '{}' (supported: {})",
                    self.manifest_schema_version, CURRENT_MANIFEST_SCHEMA_VERSION
                ),
            ));
        }

        if self.id.trim().is_empty() {
            return Err(LocalSlmError::manifest_invalid(&self.id, "Model ID cannot be empty"));
        }

        if self.max_sequence_length == 0 || self.max_sequence_length > 32_768 {
            return Err(LocalSlmError::manifest_invalid(
                &self.id,
                format!("Invalid max_sequence_length: {}", self.max_sequence_length),
            ));
        }

        if self.input_names.is_empty() {
            return Err(LocalSlmError::manifest_invalid(
                &self.id,
                "Model manifest must declare at least one input tensor name",
            ));
        }

        if self.output_names.is_empty() {
            return Err(LocalSlmError::manifest_invalid(
                &self.id,
                "Model manifest must declare at least one output tensor name",
            ));
        }

        Ok(())
    }

    /// Verifies SHA-256 integrity checksum against model binary bytes.
    pub fn verify_integrity(&self, model_bytes: &[u8]) -> Result<(), LocalSlmError> {
        // 1. File size check
        if model_bytes.len() as u64 > self.max_file_size_bytes {
            return Err(LocalSlmError::new(
                crate::inference::errors::LocalSlmErrorKind::ModelIntegrityFailure,
                InferenceStage::ManifestValidation,
                format!(
                    "Model binary size ({} bytes) exceeds permitted maximum of {} bytes",
                    model_bytes.len(),
                    self.max_file_size_bytes
                ),
            )
            .with_model_id(&self.id));
        }

        if model_bytes.is_empty() {
            return Err(LocalSlmError::new(
                crate::inference::errors::LocalSlmErrorKind::ModelIntegrityFailure,
                InferenceStage::ManifestValidation,
                "Model binary is empty (0 bytes)",
            )
            .with_model_id(&self.id));
        }

        // 2. Optional SHA-256 verification
        if let Some(ref expected_hex) = self.expected_sha256 {
            let mut hasher = Sha256::new();
            hasher.update(model_bytes);
            let actual_hex = format!("{:x}", hasher.finalize());

            if !actual_hex.eq_ignore_ascii_case(expected_hex) {
                return Err(LocalSlmError::integrity_failure(
                    &self.id,
                    expected_hex,
                    &actual_hex,
                ));
            }
        }

        Ok(())
    }
}

