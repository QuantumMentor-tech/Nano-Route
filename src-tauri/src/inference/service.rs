// ============================================================================
// Nano Route - Local SLM Application Service
// File: src-tauri/src/inference/service.rs
// ============================================================================
// Authoritative composition root for local on-device SLM execution.
// Manages runtime initialization, model session lifecycle, tokenization,
// performance metrics tracking, and safe status reporting.
// Contains zero secret keys, user prompts in logs, or cloud routing logic.
// ============================================================================

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tokio_util::sync::CancellationToken;

use crate::inference::backend::{InferenceBackend, OnnxBackend};
use crate::inference::errors::{LocalSlmError, LocalSlmErrorKind};
use crate::inference::manifest::LocalModelManifest;
use crate::inference::tokenizer::{BertStyleTokenizer, Tokenizer};
use crate::inference::types::{
    ExecutionProviderType, InferenceBackendType, InferenceStage, LocalInferenceResult,
    LocalModelStatus, LocalRuntimeMetrics, LocalRuntimeState, LocalRuntimeStatus,
};
use crate::inference::worker::{
    spawn_inference_worker, InferenceWorkerHandle, DEFAULT_INFERENCE_TIMEOUT_MS,
    DEFAULT_MAX_QUEUE_CAPACITY,
};

fn current_epoch_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Centralized Local SLM Runtime Service.
pub struct LocalSlmService {
    backend: Arc<dyn InferenceBackend>,
    tokenizer: Arc<dyn Tokenizer>,
    manifest: RwLock<Option<LocalModelManifest>>,
    state: RwLock<LocalRuntimeState>,
    model_status: RwLock<LocalModelStatus>,
    worker: RwLock<Option<InferenceWorkerHandle>>,
    metrics: RwLock<LocalRuntimeMetrics>,
    last_error: RwLock<Option<String>>,
    last_inference_at_ms: RwLock<Option<u64>>,
    last_latency_ms: RwLock<Option<u64>>,
    request_counter: AtomicU64,
    inference_timeout: Duration,
}

impl LocalSlmService {
    /// Constructs a production LocalSlmService with ONNX backend and Bert tokenizer.
    pub fn new() -> Self {
        let backend = Arc::new(OnnxBackend::new());
        let tokenizer = Arc::new(BertStyleTokenizer::new(512));

        Self {
            backend,
            tokenizer,
            manifest: RwLock::new(None),
            state: RwLock::new(LocalRuntimeState::Uninitialized),
            model_status: RwLock::new(LocalModelStatus::NotInstalled),
            worker: RwLock::new(None),
            metrics: RwLock::new(LocalRuntimeMetrics::default()),
            last_error: RwLock::new(None),
            last_inference_at_ms: RwLock::new(None),
            last_latency_ms: RwLock::new(None),
            request_counter: AtomicU64::new(1),
            inference_timeout: Duration::from_millis(DEFAULT_INFERENCE_TIMEOUT_MS),
        }
    }

    /// Builder for injecting custom backend and tokenizer (used by unit tests and test doubles).
    pub fn with_custom_components(
        backend: Arc<dyn InferenceBackend>,
        tokenizer: Arc<dyn Tokenizer>,
    ) -> Self {
        Self {
            backend,
            tokenizer,
            manifest: RwLock::new(None),
            state: RwLock::new(LocalRuntimeState::Uninitialized),
            model_status: RwLock::new(LocalModelStatus::NotInstalled),
            worker: RwLock::new(None),
            metrics: RwLock::new(LocalRuntimeMetrics::default()),
            last_error: RwLock::new(None),
            last_inference_at_ms: RwLock::new(None),
            last_latency_ms: RwLock::new(None),
            request_counter: AtomicU64::new(1),
            inference_timeout: Duration::from_millis(DEFAULT_INFERENCE_TIMEOUT_MS),
        }
    }

    /// Explicitly initializes the runtime environment.
    pub fn initialize(&self) -> Result<(), LocalSlmError> {
        let mut state_lock = match self.state.write() {
            Ok(g) => g,
            Err(p) => p.into_inner(),
        };

        if *state_lock == LocalRuntimeState::Ready {
            return Ok(());
        }

        *state_lock = LocalRuntimeState::Initializing;

        if let Err(e) = self.backend.initialize() {
            *state_lock = LocalRuntimeState::Failed;
            if let Ok(mut err_lock) = self.last_error.write() {
                *err_lock = Some(e.to_string());
            }
            return Err(e);
        }

        *state_lock = LocalRuntimeState::Ready;
        Ok(())
    }

    /// Loads and verifies a local model package into an executable session.
    pub fn load_model(
        &self,
        manifest: LocalModelManifest,
        model_bytes: &[u8],
    ) -> Result<(), LocalSlmError> {
        self.initialize()?;

        // 1. Mark LoadingModel state
        if let Ok(mut state_lock) = self.state.write() {
            *state_lock = LocalRuntimeState::LoadingModel;
        }

        let start_load = Instant::now();

        // 2. Validate manifest and integrity
        if let Err(e) = manifest.validate() {
            self.set_failure(LocalModelStatus::LoadFailed, e.to_string());
            return Err(e);
        }

        if let Err(e) = manifest.verify_integrity(model_bytes) {
            self.set_failure(LocalModelStatus::IntegrityFailed, e.to_string());
            return Err(e);
        }

        // 3. Load backend session
        let session = match self.backend.load_session(&manifest, model_bytes) {
            Ok(s) => s,
            Err(e) => {
                self.set_failure(LocalModelStatus::LoadFailed, e.to_string());
                return Err(e);
            }
        };

        // 4. Spawn dedicated worker thread
        let (worker_handle, _) = spawn_inference_worker(session, DEFAULT_MAX_QUEUE_CAPACITY);

        let cold_load_ms = start_load.elapsed().as_millis() as u64;

        // 5. Update state and metrics
        if let Ok(mut worker_lock) = self.worker.write() {
            *worker_lock = Some(worker_handle);
        }
        if let Ok(mut manifest_lock) = self.manifest.write() {
            *manifest_lock = Some(manifest);
        }
        if let Ok(mut model_status_lock) = self.model_status.write() {
            *model_status_lock = LocalModelStatus::Loaded;
        }
        if let Ok(mut state_lock) = self.state.write() {
            *state_lock = LocalRuntimeState::Ready;
        }
        if let Ok(mut metrics_lock) = self.metrics.write() {
            metrics_lock.cold_load_ms = Some(cold_load_ms);
        }
        if let Ok(mut err_lock) = self.last_error.write() {
            *err_lock = None;
        }

        Ok(())
    }

    /// Safely unloads the loaded model session and frees native resources.
    pub fn unload_model(&self) -> Result<(), LocalSlmError> {
        if let Ok(mut state_lock) = self.state.write() {
            *state_lock = LocalRuntimeState::Unloading;
        }

        if let Ok(mut worker_lock) = self.worker.write() {
            if let Some(worker) = worker_lock.take() {
                worker.shutdown();
            }
        }

        if let Ok(mut manifest_lock) = self.manifest.write() {
            *manifest_lock = None;
        }
        if let Ok(mut model_status_lock) = self.model_status.write() {
            *model_status_lock = LocalModelStatus::NotLoaded;
        }
        if let Ok(mut state_lock) = self.state.write() {
            *state_lock = LocalRuntimeState::Ready;
        }

        Ok(())
    }

    /// Returns the currently loaded model manifest, if any.
    pub fn get_manifest(&self) -> Option<LocalModelManifest> {
        self.manifest.read().ok().and_then(|m| m.clone())
    }

    /// Executes raw on-device local inference over a text prompt, returning the full InferenceOutput tensor.
    /// Strictly native; NEVER communicates with cloud APIs.
    pub async fn infer_raw(
        &self,
        text: &str,
        cancel_token: Option<CancellationToken>,
    ) -> Result<crate::inference::types::InferenceOutput, LocalSlmError> {
        let total_start = Instant::now();
        let cancel = cancel_token.unwrap_or_default();

        // 1. Verify model is loaded
        let _model_id = {
            let manifest_lock = match self.manifest.read() {
                Ok(g) => g,
                Err(p) => p.into_inner(),
            };
            match *manifest_lock {
                Some(ref m) => m.id.clone(),
                None => {
                    return Err(LocalSlmError::new(
                        LocalSlmErrorKind::ModelNotFound,
                        InferenceStage::Inference,
                        "Cannot execute inference: No local model is currently loaded",
                    ));
                }
            }
        };

        // 2. Tokenize text input (Section 30-33)
        let token_start = Instant::now();
        let input = self.tokenizer.encode(text)?;
        let tokenization_ms = token_start.elapsed().as_millis() as u64;
        let token_count = input.sequence_length;

        // 3. Acquire worker handle
        let worker_ref = {
            let worker_lock = match self.worker.read() {
                Ok(g) => g,
                Err(p) => p.into_inner(),
            };
            worker_lock.as_ref().cloned_handle()
        };

        let worker = match worker_ref {
            Some(w) => w,
            None => {
                return Err(LocalSlmError::new(
                    LocalSlmErrorKind::RuntimeUnavailable,
                    InferenceStage::Inference,
                    "Inference worker handle not initialized",
                ));
            }
        };

        let req_num = self.request_counter.fetch_add(1, Ordering::Relaxed);
        let request_id = format!("req_local_{}_{}", current_epoch_ms(), req_num);

        // 4. Submit to worker with timeout & cancellation
        let output_res = worker
            .submit(request_id.clone(), input, cancel, self.inference_timeout)
            .await;

        let total_ms = total_start.elapsed().as_millis().max(1) as u64;

        // 5. Update metrics & return
        match output_res {
            Ok(output) => {
                let now = current_epoch_ms();
                if let Ok(mut t_lock) = self.last_inference_at_ms.write() {
                    *t_lock = Some(now);
                }
                if let Ok(mut l_lock) = self.last_latency_ms.write() {
                    *l_lock = Some(output.latency_ms);
                }

                if let Ok(mut metrics_lock) = self.metrics.write() {
                    metrics_lock.total_inferences += 1;
                    metrics_lock.successful_inferences += 1;
                    metrics_lock.last_tokenization_ms = tokenization_ms;
                    metrics_lock.last_inference_ms = output.latency_ms;
                    metrics_lock.last_total_ms = total_ms;
                    metrics_lock.last_input_tokens = token_count;

                    // Rolling average
                    let n = metrics_lock.successful_inferences as f64;
                    metrics_lock.average_inference_ms =
                        ((metrics_lock.average_inference_ms * (n - 1.0)) + output.latency_ms as f64) / n;
                }

                Ok(output)
            }
            Err(e) => {
                if let Ok(mut metrics_lock) = self.metrics.write() {
                    metrics_lock.total_inferences += 1;
                    if e.kind == LocalSlmErrorKind::InferenceCancelled {
                        metrics_lock.cancelled_inferences += 1;
                    } else {
                        metrics_lock.failed_inferences += 1;
                    }
                }
                if let Ok(mut err_lock) = self.last_error.write() {
                    *err_lock = Some(e.to_string());
                }
                Err(e)
            }
        }
    }

    /// Executes on-device local inference over a text prompt.
    /// Strictly native; NEVER communicates with cloud APIs.
    pub async fn infer(
        &self,
        text: &str,
        cancel_token: Option<CancellationToken>,
    ) -> Result<LocalInferenceResult, LocalSlmError> {
        let manifest = self.get_manifest().ok_or_else(|| {
            LocalSlmError::new(
                LocalSlmErrorKind::ModelNotFound,
                InferenceStage::Inference,
                "Cannot execute inference: No local model is currently loaded",
            )
        })?;

        let output = self.infer_raw(text, cancel_token).await?;
        let token_count = self.tokenizer.token_count(text);

        let req_num = self.request_counter.load(Ordering::Relaxed);
        let request_id = format!("req_local_{}_{}", current_epoch_ms(), req_num);

        Ok(LocalInferenceResult {
            request_id,
            model_id: manifest.id,
            output_shape: output.shape,
            logits_preview: output.logits,
            latency_ms: output.latency_ms,
            token_count,
        })
    }

    /// Queries the read-safe runtime status DTO.
    pub fn get_status(&self) -> LocalRuntimeStatus {
        let state = self.state.read().map(|g| *g).unwrap_or(LocalRuntimeState::Failed);
        let model_status = self
            .model_status
            .read()
            .map(|g| *g)
            .unwrap_or(LocalModelStatus::NotInstalled);

        let (model_id, model_version) = {
            let m_lock = self.manifest.read().ok();
            match m_lock.as_deref() {
                Some(Some(ref m)) => (Some(m.id.clone()), Some(m.version.clone())),
                _ => (None, None),
            }
        };

        let queue_depth = {
            let w_lock = self.worker.read().ok();
            w_lock.as_deref().and_then(|opt| opt.as_ref().map(|w| w.queue_depth())).unwrap_or(0)
        };

        LocalRuntimeStatus {
            state,
            backend: self.backend.backend_type(),
            execution_provider: self.backend.execution_provider(),
            model_id,
            model_version,
            model_status,
            runtime_version: "ort-1.16-native".to_string(),
            is_busy: queue_depth > 0 || state == LocalRuntimeState::Running,
            queue_depth,
            last_inference_at_ms: self.last_inference_at_ms.read().ok().and_then(|g| *g),
            last_latency_ms: self.last_latency_ms.read().ok().and_then(|g| *g),
            last_error: self.last_error.read().ok().and_then(|g| g.clone()),
        }
    }

    /// Queries performance metrics.
    pub fn get_metrics(&self) -> LocalRuntimeMetrics {
        self.metrics.read().map(|g| g.clone()).unwrap_or_default()
    }

    fn set_failure(&self, model_status: LocalModelStatus, err_msg: String) {
        if let Ok(mut s_lock) = self.state.write() {
            *s_lock = LocalRuntimeState::Failed;
        }
        if let Ok(mut m_lock) = self.model_status.write() {
            *m_lock = model_status;
        }
        if let Ok(mut e_lock) = self.last_error.write() {
            *e_lock = Some(err_msg);
        }
    }
}

impl Default for LocalSlmService {
    fn default() -> Self {
        Self::new()
    }
}

// Helper extension on Option<InferenceWorkerHandle> to clone the handle
trait WorkerCloneExt {
    fn cloned_handle(&self) -> Option<InferenceWorkerHandle>;
}

impl WorkerCloneExt for Option<InferenceWorkerHandle> {
    fn cloned_handle(&self) -> Option<InferenceWorkerHandle> {
        self.as_ref().map(|w| InferenceWorkerHandle {
            sender: w.sender.clone(),
            queue_depth: w.queue_depth.clone(),
            is_shutting_down: w.is_shutting_down.clone(),
            max_capacity: w.max_capacity,
        })
    }
}

