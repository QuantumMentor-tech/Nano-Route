// ============================================================================
// Nano Route - Local Inference Worker & Bounded Queue
// File: src-tauri/src/inference/worker.rs
// ============================================================================
// Single-worker execution loop owning the mutable ONNX session.
// Manages bounded FIFO queue, cooperative cancellation, and timeouts without
// blocking the Tauri UI thread.
// ============================================================================

use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{mpsc, oneshot};
use tokio_util::sync::CancellationToken;

use crate::inference::backend::InferenceSession;
use crate::inference::errors::LocalSlmError;
use crate::inference::types::{InferenceInput, InferenceOutput};

/// Maximum capacity of the bounded inference queue.
pub const DEFAULT_MAX_QUEUE_CAPACITY: usize = 32;

/// Default per-request inference timeout.
pub const DEFAULT_INFERENCE_TIMEOUT_MS: u64 = 10_000;

/// Enqueued work unit delivered to the dedicated model worker thread.
pub struct InferenceJob {
    pub request_id: String,
    pub input: InferenceInput,
    pub cancel_token: CancellationToken,
    pub response_tx: oneshot::Sender<Result<InferenceOutput, LocalSlmError>>,
    pub enqueued_at: Instant,
}

/// Handle through which callers enqueue inference jobs.
pub struct InferenceWorkerHandle {
    pub(crate) sender: mpsc::Sender<InferenceJob>,
    pub(crate) queue_depth: Arc<AtomicUsize>,
    pub(crate) is_shutting_down: Arc<AtomicBool>,
    pub(crate) max_capacity: usize,
}

impl InferenceWorkerHandle {
    /// Returns the current number of requests waiting in the queue.
    pub fn queue_depth(&self) -> usize {
        self.queue_depth.load(Ordering::Relaxed)
    }

    /// Checks if the worker is actively accepting work.
    pub fn is_accepting_work(&self) -> bool {
        !self.is_shutting_down.load(Ordering::SeqCst)
    }

    /// Enqueues an inference request with bounded capacity and cooperative cancellation.
    pub async fn submit(
        &self,
        request_id: String,
        input: InferenceInput,
        cancel_token: CancellationToken,
        timeout_duration: Duration,
    ) -> Result<InferenceOutput, LocalSlmError> {
        // 1. Pre-enqueue cancellation check
        if cancel_token.is_cancelled() {
            return Err(LocalSlmError::cancelled());
        }

        // 2. Worker shutdown check
        if self.is_shutting_down.load(Ordering::SeqCst) {
            return Err(LocalSlmError::new(
                crate::inference::errors::LocalSlmErrorKind::RuntimeUnavailable,
                crate::inference::types::InferenceStage::Inference,
                "Local inference worker is shutting down",
            ));
        }

        // 3. Bounded queue capacity check (Section 40)
        let current_depth = self.queue_depth.load(Ordering::Relaxed);
        if current_depth >= self.max_capacity {
            return Err(LocalSlmError::runtime_busy(current_depth));
        }

        let (response_tx, response_rx) = oneshot::channel();
        let job = InferenceJob {
            request_id: request_id.clone(),
            input,
            cancel_token: cancel_token.clone(),
            response_tx,
            enqueued_at: Instant::now(),
        };

        self.queue_depth.fetch_add(1, Ordering::Relaxed);

        if self.sender.send(job).await.is_err() {
            self.queue_depth.fetch_sub(1, Ordering::Relaxed);
            return Err(LocalSlmError::new(
                crate::inference::errors::LocalSlmErrorKind::RuntimeUnavailable,
                crate::inference::types::InferenceStage::Inference,
                "Inference worker channel closed",
            ));
        }

        // 4. Await response with timeout and cancellation
        tokio::select! {
            _ = cancel_token.cancelled() => {
                Err(LocalSlmError::cancelled())
            }
            _ = tokio::time::sleep(timeout_duration) => {
                Err(LocalSlmError::timed_out(timeout_duration.as_millis() as u64))
            }
            res = response_rx => {
                match res {
                    Ok(output_res) => output_res,
                    Err(_) => Err(LocalSlmError::new(
                        crate::inference::errors::LocalSlmErrorKind::InferenceFailed,
                        crate::inference::types::InferenceStage::Inference,
                        "Inference worker dropped response channel without result",
                    )),
                }
            }
        }
    }

    /// Gracefully signals the worker loop to drain and terminate.
    pub fn shutdown(&self) {
        self.is_shutting_down.store(true, Ordering::SeqCst);
    }
}

/// Spawns a dedicated OS thread running the single mutable ONNX session loop.
pub fn spawn_inference_worker(
    mut session: Box<dyn InferenceSession>,
    max_capacity: usize,
) -> (InferenceWorkerHandle, tokio::task::JoinHandle<()>) {
    let (tx, mut rx) = mpsc::channel::<InferenceJob>(max_capacity);
    let queue_depth = Arc::new(AtomicUsize::new(0));
    let is_shutting_down = Arc::new(AtomicBool::new(false));

    let queue_depth_clone = queue_depth.clone();
    let is_shutting_down_clone = is_shutting_down.clone();

    let join_handle = tokio::task::spawn_blocking(move || {
        while let Some(job) = rx.blocking_recv() {
            queue_depth_clone.fetch_sub(1, Ordering::Relaxed);

            // In-queue cancellation check
            if job.cancel_token.is_cancelled() {
                let _ = job.response_tx.send(Err(LocalSlmError::cancelled()));
                continue;
            }

            // Execute inference on the dedicated thread holding mutable session
            let result = session.run(&job.input);
            let _ = job.response_tx.send(result);

            if is_shutting_down_clone.load(Ordering::SeqCst) && queue_depth_clone.load(Ordering::Relaxed) == 0 {
                break;
            }
        }
    });

    let handle = InferenceWorkerHandle {
        sender: tx,
        queue_depth,
        is_shutting_down,
        max_capacity,
    };

    (handle, join_handle)
}
