// ============================================================================
// Nano Route - Intent Classification Service
// File: src-tauri/src/classification/service.rs
// ============================================================================
// Centralized orchestration service for local semantic intent classification.
// Validates model capabilities, executes local SLM inference, performs
// label mapping and confidence evaluation, and records safe operational telemetry.
// Contains zero cloud provider clients, credentials, or prompt telemetry leaks.
// ============================================================================

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, RwLock};
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tokio_util::sync::CancellationToken;

use crate::classification::errors::{ClassificationError, ClassificationErrorKind, ClassificationStage};
use crate::classification::label_map::ClassifierLabelMap;
use crate::classification::mapper::map_inference_output;
use crate::classification::policy::ClassificationPolicy;
use crate::classification::preprocessor::preprocess_classification_input;
use crate::classification::taxonomy::ALL_INTENTS;
use crate::classification::types::{
    ClassifierAvailability, ClassifierStatus, IntentClassificationRequest,
    IntentClassificationResult,
};
use crate::inference::service::LocalSlmService;
use crate::inference::types::{LocalModelStatus, LocalRuntimeState};
use crate::services::telemetry::{RecordTelemetryInput, TelemetryService};
use crate::domain::telemetry::{TelemetryEventType, TelemetryOutcome};

fn current_epoch_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Central native Intent Classifier service.
pub struct IntentClassifier {
    local_slm_service: Arc<LocalSlmService>,
    telemetry_service: Option<Arc<TelemetryService>>,
    policy: ClassificationPolicy,
    label_maps: RwLock<HashMap<String, ClassifierLabelMap>>,
    last_latency_ms: RwLock<Option<u64>>,
    last_error: RwLock<Option<String>>,
    request_counter: AtomicU64,
}

impl IntentClassifier {
    /// Creates a new IntentClassifier service instance.
    pub fn new(
        local_slm_service: Arc<LocalSlmService>,
        telemetry_service: Option<Arc<TelemetryService>>,
    ) -> Self {
        Self {
            local_slm_service,
            telemetry_service,
            policy: ClassificationPolicy::default(),
            label_maps: RwLock::new(HashMap::new()),
            last_latency_ms: RwLock::new(None),
            last_error: RwLock::new(None),
            request_counter: AtomicU64::new(1),
        }
    }

    /// Builder allowing custom classification policy injection.
    pub fn with_policy(mut self, policy: ClassificationPolicy) -> Self {
        self.policy = policy;
        self
    }

    /// Registers a custom or updated label map for a model ID.
    pub fn register_label_map(&self, label_map: ClassifierLabelMap) {
        if let Ok(mut lock) = self.label_maps.write() {
            let key = format!("{}:{}", label_map.model_id, label_map.model_version);
            lock.insert(key, label_map);
        }
    }

    /// Queries the operational status of the classifier.
    pub fn get_status(&self) -> ClassifierStatus {
        let runtime_status = self.local_slm_service.get_status();
        let manifest_opt = self.local_slm_service.get_manifest();

        let availability = match runtime_status.model_status {
            LocalModelStatus::NotInstalled => ClassifierAvailability::NotInstalled,
            LocalModelStatus::IntegrityFailed | LocalModelStatus::LoadFailed => {
                ClassifierAvailability::ModelInvalid
            }
            LocalModelStatus::NotLoaded => ClassifierAvailability::RuntimeUnavailable,
            LocalModelStatus::Loaded => {
                if let Some(ref m) = manifest_opt {
                    if m.task_type != "intent_classification" {
                        ClassifierAvailability::ModelIncompatible
                    } else if runtime_status.state == LocalRuntimeState::Ready
                        || runtime_status.state == LocalRuntimeState::Running
                    {
                        ClassifierAvailability::Available
                    } else {
                        ClassifierAvailability::RuntimeUnavailable
                    }
                } else {
                    ClassifierAvailability::ModelInvalid
                }
            }
        };

        let (model_id, model_version, schema_version) = if let Some(ref m) = manifest_opt {
            (
                Some(m.id.clone()),
                Some(m.version.clone()),
                m.label_schema_id.clone(),
            )
        } else {
            (
                runtime_status.model_id.clone(),
                runtime_status.model_version.clone(),
                "nano-route-intent-schema-v1".to_string(),
            )
        };

        ClassifierStatus {
            availability,
            model_id,
            model_version,
            schema_version,
            supported_intents: ALL_INTENTS.to_vec(),
            runtime_state: runtime_status.state,
            last_latency_ms: self.last_latency_ms.read().ok().and_then(|g| *g),
            last_error: self.last_error.read().ok().and_then(|g| g.clone()),
        }
    }

    /// Executes local semantic classification on a user request.
    /// Strictly on-device; never calls cloud providers.
    pub async fn classify(
        &self,
        request: IntentClassificationRequest,
        cancel_token: Option<CancellationToken>,
    ) -> Result<IntentClassificationResult, ClassificationError> {
        let start_time = Instant::now();

        // 1. Verify model is loaded and compatible (Section 30, 38)
        let manifest = self.local_slm_service.get_manifest().ok_or_else(|| {
            ClassificationError::model_missing()
        })?;

        if manifest.task_type != "intent_classification" {
            let err = ClassificationError::model_incompatible(&manifest.id, &manifest.task_type);
            self.record_failure(&err.to_string());
            return Err(err);
        }

        // 2. Preprocess input text (Section 31-35)
        let preprocessed_text = preprocess_classification_input(&request, manifest.max_sequence_length)?;

        // 3. Resolve label map for current model
        let label_map = self.get_or_create_label_map(&manifest)?;

        // 4. Execute on-device neural inference via Step 26 runtime
        let inference_res = self
            .local_slm_service
            .infer_raw(&preprocessed_text, cancel_token)
            .await;

        let output = match inference_res {
            Ok(out) => out,
            Err(e) => {
                let class_err = ClassificationError::from(e);
                self.record_failure(&class_err.to_string());
                return Err(class_err);
            }
        };

        // 5. Map inference output to primary intent, confidence, ambiguity, and explanation
        let mapped = match map_inference_output(&output, &label_map, &self.policy) {
            Ok(m) => m,
            Err(e) => {
                self.record_failure(&e.to_string());
                return Err(e);
            }
        };

        let total_latency_ms = start_time.elapsed().as_millis().max(1) as u64;

        if let Ok(mut l_lock) = self.last_latency_ms.write() {
            *l_lock = Some(total_latency_ms);
        }

        let req_id = request.request_id.unwrap_or_else(|| {
            let count = self.request_counter.fetch_add(1, Ordering::Relaxed);
            format!("req_cls_{}_{}", current_epoch_ms(), count)
        });

        // 6. Safe telemetry recording (Section 56, 126) - zero prompt content stored
        self.record_safe_telemetry(&req_id, &manifest.id, mapped.primary_intent.as_str(), mapped.confidence, total_latency_ms);

        Ok(IntentClassificationResult {
            request_id: req_id,
            primary_intent: mapped.primary_intent,
            confidence: mapped.confidence,
            alternatives: mapped.alternatives,
            ambiguity: mapped.ambiguity,
            classifier_model_id: manifest.id,
            classifier_model_version: manifest.version,
            classifier_schema_version: label_map.schema_id,
            inference_latency_ms: output.latency_ms,
            total_latency_ms,
            explanation: mapped.explanation,
        })
    }

    fn get_or_create_label_map(
        &self,
        manifest: &crate::inference::manifest::LocalModelManifest,
    ) -> Result<ClassifierLabelMap, ClassificationError> {
        let key = format!("{}:{}", manifest.id, manifest.version);

        if let Ok(lock) = self.label_maps.read() {
            if let Some(lm) = lock.get(&key) {
                return Ok(lm.clone());
            }
        }

        // Construct label map from manifest declarations or default
        let label_map = if !manifest.label_map.is_empty() {
            ClassifierLabelMap::from_manifest_labels(
                &manifest.label_schema_id,
                &manifest.id,
                &manifest.version,
                &manifest.label_map,
            )?
        } else {
            ClassifierLabelMap::default_router_label_map(&manifest.id, &manifest.version)
        };

        if let Ok(mut lock) = self.label_maps.write() {
            lock.insert(key, label_map.clone());
        }

        Ok(label_map)
    }

    fn record_failure(&self, err_msg: &str) {
        if let Ok(mut lock) = self.last_error.write() {
            *lock = Some(err_msg.to_string());
        }
    }

    fn record_safe_telemetry(
        &self,
        request_id: &str,
        model_id: &str,
        intent_str: &str,
        confidence: f64,
        latency_ms: u64,
    ) {
        if let Some(ref telem) = self.telemetry_service {
            let input = RecordTelemetryInput {
                event_type: Some(TelemetryEventType::Routing),
                task_id: Some(request_id.to_string()),
                provider_id: Some("local".to_string()),
                model_id: Some(model_id.to_string()),
                outcome: Some(TelemetryOutcome::Success),
                error_code: None,
                latency_ms: Some(latency_ms),
                prompt_tokens: None,
                completion_tokens: None,
                cost_usd: None,
                confidence: Some(confidence),
                routing_reason: Some(format!("intent:{}", intent_str)),
                session_id: None,
                message_id: None,
                stream_id: None,
            };
            telem.record(input);
        }
    }
}

