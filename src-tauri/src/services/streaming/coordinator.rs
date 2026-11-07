// ============================================================================
// Nano Route - Streaming Coordinator
// File: src-tauri/src/services/streaming/coordinator.rs
// ============================================================================
// Composition engine orchestrating provider streams, TaskManager tasks,
// cooperative cancellation, monotonic sequence ordering, and channel dispatch.
// Enforces single-terminal-event invariant and automatic memory cleanup.
// ============================================================================

use crate::core::tasks::{TaskContext, TaskId, TaskKind, TaskManager};
use crate::errors::AppError;
use crate::providers::ProviderFinishReason;
use crate::services::streaming::id::StreamId;
use crate::services::streaming::mock::MockStreamGenerator;
use crate::services::streaming::registry::{StreamRecord, StreamRegistry};
use crate::services::streaming::types::{
    MockStreamMode, ProviderStreamChunk, StreamEvent, StreamLifecycleState, StreamMetadata,
    StreamRequest, StreamStartResult,
};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio_util::sync::CancellationToken;

/// Abstraction for the outbound stream event destination.
/// Implemented by `tauri::ipc::Channel<StreamEvent>` and test doubles.
pub trait StreamSink: Send + Sync + 'static {
    fn send(&self, event: StreamEvent) -> Result<(), String>;
}

/// Implementation of StreamSink for Tauri's native IPC Channel.
impl StreamSink for tauri::ipc::Channel<StreamEvent> {
    fn send(&self, event: StreamEvent) -> Result<(), String> {
        tauri::ipc::Channel::send(self, event).map_err(|e| e.to_string())
    }
}

/// Central application service coordinating active streaming sessions.
pub struct StreamCoordinator {
    registry: Arc<StreamRegistry>,
    task_manager: Arc<TaskManager>,
}

impl StreamCoordinator {
    /// Constructs a new StreamCoordinator with the shared registry and TaskManager.
    pub fn new(task_manager: Arc<TaskManager>) -> Self {
        Self {
            registry: Arc::new(StreamRegistry::new()),
            task_manager,
        }
    }

    /// Constructs a StreamCoordinator with an explicit registry (useful for testing).
    pub fn with_registry(registry: Arc<StreamRegistry>, task_manager: Arc<TaskManager>) -> Self {
        Self {
            registry,
            task_manager,
        }
    }

    /// Accessor for the active stream registry.
    pub fn registry(&self) -> &Arc<StreamRegistry> {
        &self.registry
    }

    /// Accessor for the TaskManager.
    pub fn task_manager(&self) -> &Arc<TaskManager> {
        &self.task_manager
    }

    /// Cancels an active stream by StreamId.
    /// Returns true if the stream was found and cancelled; false if unknown or already terminal.
    pub fn cancel_stream(&self, stream_id: &StreamId) -> bool {
        self.registry.cancel(stream_id)
    }

    /// Starts a streaming session and connects it to the provided sink.
    /// Spawns a managed task under `TaskManager` to ensure bounded concurrency,
    /// cooperative cancellation, and guaranteed cleanup.
    pub fn start_stream<S>(
        &self,
        request: StreamRequest,
        sink: S,
    ) -> Result<StreamStartResult, AppError>
    where
        S: StreamSink,
    {
        // 1. Pre-flight validation
        if request.model_id.trim().is_empty() {
            return Err(AppError::InvalidInput("model_id cannot be empty".to_string()));
        }

        let stream_id = request.stream_id.clone();
        let token = CancellationToken::new();

        // 2. Register stream record in Created state
        let record = StreamRecord::new(stream_id.clone(), None, token.clone());
        self.registry.register(record)?;

        let registry = self.registry.clone();
        let s_id = stream_id.clone();
        let stream_token = token.clone();
        let req = request.clone();
        let sink = Arc::new(sink);

        // Guard against multiple terminal events across racing cancellation/completion
        let has_terminated = Arc::new(AtomicBool::new(false));

        // 3. Spawn managed task via TaskManager
        let task_handle = self.task_manager.spawn(
            TaskKind::Io,
            "stream_coordinator",
            None,
            move |task_ctx: TaskContext| async move {
                let coordinator_task = async {
                    // Update task_id in registry
                    if let Ok(mut map) = registry.transition(&s_id, StreamLifecycleState::Starting) {
                        let _ = map;
                    }

                    let now_ms = SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .map(|d| d.as_millis() as u64)
                        .unwrap_or(0);

                    // 4. Emit Started event (sequence 0)
                    let started_event = StreamEvent::Started {
                        stream_id: s_id.clone(),
                        sequence: 0,
                        task_id: Some(task_ctx.task_id.as_str().to_string()),
                        provider_id: req.provider_id.clone(),
                        model_id: Some(req.model_id.clone()),
                        timestamp_ms: now_ms,
                    };
                    let _ = sink.send(started_event);

                    if task_ctx.is_cancelled() || stream_token.is_cancelled() {
                        Self::finalize_cancelled(&registry, &s_id, &sink, &has_terminated, "Cancelled before streaming");
                        return Ok(());
                    }

                    // Transition to Streaming
                    if let Err(err) = registry.transition(&s_id, StreamLifecycleState::Streaming) {
                        Self::finalize_error(&registry, &s_id, &sink, &has_terminated, "LIFECYCLE_ERROR", &err.to_string(), false);
                        return Ok(());
                    }

                    // 5. Execute stream generator (Mock mode or future provider streaming)
                    let test_mode = req.test_mode.unwrap_or(MockStreamMode::Success {
                        chunk_count: 5,
                        delay_ms: 10,
                    });

                    let mut final_usage = None;
                    let mut final_finish_reason = ProviderFinishReason::Stop;

                    let reg_for_chunks = registry.clone();
                    let s_id_chunks = s_id.clone();
                    let sink_for_chunks = sink.clone();

                    let outcome = MockStreamGenerator::run_mock_stream(test_mode, &task_ctx, |chunk: ProviderStreamChunk| {
                        if let Some(text) = chunk.text_delta {
                            if let Ok(seq) = reg_for_chunks.next_sequence(&s_id_chunks) {
                                let delta_event = StreamEvent::Delta {
                                    stream_id: s_id_chunks.clone(),
                                    sequence: seq,
                                    text,
                                };
                                let _ = sink_for_chunks.send(delta_event);
                            }
                        }

                        if let Some(reasoning) = chunk.reasoning_delta {
                            if let Ok(seq) = reg_for_chunks.next_sequence(&s_id_chunks) {
                                let mut extra = std::collections::HashMap::new();
                                extra.insert("reasoning".to_string(), reasoning);
                                let meta_event = StreamEvent::Metadata {
                                    stream_id: s_id_chunks.clone(),
                                    sequence: seq,
                                    metadata: StreamMetadata {
                                        latency_ms: None,
                                        system_fingerprint: None,
                                        throughput_tokens_per_sec: None,
                                        extra: Some(extra),
                                    },
                                };
                                let _ = sink_for_chunks.send(meta_event);
                            }
                        }

                        if let Some(u) = chunk.usage {
                            final_usage = Some(u);
                        }
                        if let Some(fr) = chunk.finish_reason {
                            final_finish_reason = fr;
                        }

                        Ok(())
                    }).await;

                    // 6. Handle terminal state
                    if task_ctx.is_cancelled() || stream_token.is_cancelled() {
                        Self::finalize_cancelled(&registry, &s_id, &sink, &has_terminated, "Cancelled by user or task context");
                        return Ok(());
                    }

                    match outcome {
                        Ok(()) => {
                            Self::finalize_completed(
                                &registry,
                                &s_id,
                                &sink,
                                &has_terminated,
                                final_finish_reason,
                                final_usage,
                                Some(req.model_id),
                            );
                        }
                        Err(err) => {
                            Self::finalize_error(
                                &registry,
                                &s_id,
                                &sink,
                                &has_terminated,
                                "STREAM_EXECUTION_FAILURE",
                                &err.to_string(),
                                true,
                            );
                        }
                    }

                    Ok::<(), AppError>(())
                };

                // Link stream cancellation to task cancellation
                tokio::select! {
                    res = coordinator_task => res,
                    _ = stream_token.cancelled() => {
                        Self::finalize_cancelled(&registry, &s_id, &sink, &has_terminated, "Stream cancellation token triggered");
                        Ok(())
                    }
                }
            },
        )?;

        Ok(StreamStartResult {
            stream_id,
            accepted: true,
            task_id: Some(task_handle.task_id().as_str().to_string()),
        })
    }

    // --- Private Finalization Helpers (Guaranteed Single Terminal Event) ---

    fn finalize_completed(
        registry: &Arc<StreamRegistry>,
        stream_id: &StreamId,
        sink: &Arc<dyn StreamSink>,
        has_terminated: &Arc<AtomicBool>,
        finish_reason: ProviderFinishReason,
        usage: Option<crate::providers::ProviderUsage>,
        model_id: Option<String>,
    ) {
        if has_terminated.swap(true, Ordering::SeqCst) {
            return;
        }

        let _ = registry.transition(stream_id, StreamLifecycleState::Completed);
        let seq = registry.next_sequence(stream_id).unwrap_or(9999);

        let event = StreamEvent::Completed {
            stream_id: stream_id.clone(),
            sequence: seq,
            finish_reason,
            usage,
            model_id,
        };

        let _ = sink.send(event);
        let _ = registry.remove(stream_id);
    }

    fn finalize_cancelled(
        registry: &Arc<StreamRegistry>,
        stream_id: &StreamId,
        sink: &Arc<dyn StreamSink>,
        has_terminated: &Arc<AtomicBool>,
        reason: &str,
    ) {
        if has_terminated.swap(true, Ordering::SeqCst) {
            return;
        }

        let _ = registry.transition(stream_id, StreamLifecycleState::Cancelled);
        let seq = registry.next_sequence(stream_id).unwrap_or(9999);

        let event = StreamEvent::Cancelled {
            stream_id: stream_id.clone(),
            sequence: seq,
            reason: Some(reason.to_string()),
        };

        let _ = sink.send(event);
        let _ = registry.remove(stream_id);
    }

    fn finalize_error(
        registry: &Arc<StreamRegistry>,
        stream_id: &StreamId,
        sink: &Arc<dyn StreamSink>,
        has_terminated: &Arc<AtomicBool>,
        code: &str,
        message: &str,
        is_retryable: bool,
    ) {
        if has_terminated.swap(true, Ordering::SeqCst) {
            return;
        }

        let _ = registry.transition(stream_id, StreamLifecycleState::Failed);
        let seq = registry.next_sequence(stream_id).unwrap_or(9999);

        let event = StreamEvent::Error {
            stream_id: stream_id.clone(),
            sequence: seq,
            code: code.to_string(),
            message: message.to_string(),
            is_retryable,
        };

        let _ = sink.send(event);
        let _ = registry.remove(stream_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    struct TestSink {
        events: Mutex<Vec<StreamEvent>>,
    }

    impl TestSink {
        fn new() -> Self {
            Self {
                events: Mutex::new(Vec::new()),
            }
        }

        fn get_events(&self) -> Vec<StreamEvent> {
            self.events.lock().unwrap().clone()
        }
    }

    impl StreamSink for Arc<TestSink> {
        fn send(&self, event: StreamEvent) -> Result<(), String> {
            self.events.lock().unwrap().push(event);
            Ok(())
        }
    }

    #[tokio::test]
    async fn test_successful_stream_lifecycle() {
        let task_mgr = Arc::new(TaskManager::new());
        let coordinator = StreamCoordinator::new(task_mgr);
        let sid = StreamId::parse("strm_test_success_1").unwrap();

        let req = StreamRequest {
            stream_id: sid.clone(),
            session_id: None,
            message_id: None,
            provider_id: None,
            model_id: "test-model".to_string(),
            prompt: Some("Hello".to_string()),
            test_mode: Some(MockStreamMode::Success {
                chunk_count: 3,
                delay_ms: 1,
            }),
        };

        let sink = Arc::new(TestSink::new());
        let result = coordinator.start_stream(req, sink.clone()).unwrap();
        assert!(result.accepted);

        // Wait briefly for the task to finish
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;

        let events = sink.get_events();
        assert!(!events.is_empty());

        // First event is Started (sequence 0)
        assert_eq!(events[0].sequence(), 0);
        assert!(matches!(events[0], StreamEvent::Started { .. }));

        // Followed by deltas (sequence 1, 2, 3)
        assert_eq!(events[1].sequence(), 1);
        assert!(matches!(events[1], StreamEvent::Delta { .. }));
        assert_eq!(events[2].sequence(), 2);
        assert!(matches!(events[2], StreamEvent::Delta { .. }));
        assert_eq!(events[3].sequence(), 3);
        assert!(matches!(events[3], StreamEvent::Delta { .. }));

        // Last event is Completed (sequence 4)
        let last = events.last().unwrap();
        assert_eq!(last.sequence(), 4);
        assert!(matches!(last, StreamEvent::Completed { .. }));

        // Registry memory cleaned up
        assert_eq!(coordinator.registry().active_count(), 0);
    }

    #[tokio::test]
    async fn test_stream_cancellation() {
        let task_mgr = Arc::new(TaskManager::new());
        let coordinator = StreamCoordinator::new(task_mgr);
        let sid = StreamId::parse("strm_test_cancel_1").unwrap();

        let req = StreamRequest {
            stream_id: sid.clone(),
            session_id: None,
            message_id: None,
            provider_id: None,
            model_id: "test-model".to_string(),
            prompt: Some("Slow prompt".to_string()),
            test_mode: Some(MockStreamMode::Slow { delay_ms: 50 }),
        };

        let sink = Arc::new(TestSink::new());
        coordinator.start_stream(req, sink.clone()).unwrap();

        // Wait for Started event
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;

        // Cancel mid-stream
        assert!(coordinator.cancel_stream(&sid));

        tokio::time::sleep(std::time::Duration::from_millis(60)).await;

        let events = sink.get_events();
        let last = events.last().unwrap();
        assert!(matches!(last, StreamEvent::Cancelled { .. }));
        assert_eq!(coordinator.registry().active_count(), 0);
    }
}

