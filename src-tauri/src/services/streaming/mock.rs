// ============================================================================
// Nano Route - Mock Provider Stream Generator
// File: src-tauri/src/services/streaming/mock.rs
// ============================================================================
// Deterministic in-memory streaming source for transport and integration testing.
// Yields normalized `ProviderStreamChunk`s without external network access.
// Supports latency simulation, cancellation observance, and error injection.
// ============================================================================

use crate::core::tasks::TaskContext;
use crate::errors::AppError;
use crate::providers::{ProviderFinishReason, ProviderUsage};
use crate::services::streaming::types::{MockStreamMode, ProviderStreamChunk};
use std::time::Duration;

/// Deterministic mock provider stream generator.
pub struct MockStreamGenerator;

impl MockStreamGenerator {
    /// Generates chunks for a mock streaming session according to the requested mode.
    pub async fn run_mock_stream<F>(
        mode: MockStreamMode,
        context: &TaskContext,
        mut on_chunk: F,
    ) -> Result<(), AppError>
    where
        F: FnMut(ProviderStreamChunk) -> Result<(), AppError>,
    {
        match mode {
            MockStreamMode::Empty => {
                // Immediate empty completion
                let final_chunk = ProviderStreamChunk {
                    text_delta: None,
                    reasoning_delta: None,
                    finish_reason: Some(ProviderFinishReason::Stop),
                    usage: Some(ProviderUsage::new(10, 0)),
                    is_final: true,
                };
                on_chunk(final_chunk)?;
                Ok(())
            }

            MockStreamMode::Success { chunk_count, delay_ms } => {
                let default_tokens = [
                    "Hello", " from", " the", " Nano", " Route", " streaming", " core!",
                    " This", " is", " an", " ordered", " stream.",
                ];

                let mut total_completion_tokens = 0;

                for i in 0..chunk_count {
                    if context.is_cancelled() {
                        return Ok(());
                    }

                    if delay_ms > 0 {
                        tokio::select! {
                            _ = tokio::time::sleep(Duration::from_millis(delay_ms)) => {}
                            _ = context.cancelled() => return Ok(()),
                        }
                    }

                    let token_str = default_tokens[i % default_tokens.len()];
                    total_completion_tokens += 1;
                    let is_last = i == chunk_count - 1;

                    let chunk = ProviderStreamChunk {
                        text_delta: Some(token_str.to_string()),
                        reasoning_delta: None,
                        finish_reason: if is_last { Some(ProviderFinishReason::Stop) } else { None },
                        usage: if is_last {
                            Some(ProviderUsage::new(15, total_completion_tokens))
                        } else {
                            None
                        },
                        is_final: is_last,
                    };

                    on_chunk(chunk)?;
                }

                Ok(())
            }

            MockStreamMode::Slow { delay_ms } => {
                let chunks = ["Chunk 1", " ... Chunk 2", " ... Chunk 3 (Finished)"];
                for (idx, text) in chunks.iter().enumerate() {
                    if context.is_cancelled() {
                        return Ok(());
                    }

                    tokio::select! {
                        _ = tokio::time::sleep(Duration::from_millis(delay_ms)) => {}
                        _ = context.cancelled() => return Ok(()),
                    }

                    let is_last = idx == chunks.len() - 1;
                    let chunk = ProviderStreamChunk {
                        text_delta: Some(text.to_string()),
                        reasoning_delta: None,
                        finish_reason: if is_last { Some(ProviderFinishReason::Stop) } else { None },
                        usage: if is_last { Some(ProviderUsage::new(12, 6)) } else { None },
                        is_final: is_last,
                    };

                    on_chunk(chunk)?;
                }
                Ok(())
            }

            MockStreamMode::Failure { fail_at_chunk } => {
                for i in 0..fail_at_chunk {
                    if context.is_cancelled() {
                        return Ok(());
                    }

                    let chunk = ProviderStreamChunk {
                        text_delta: Some(format!("Pre-fail chunk #{} ", i + 1)),
                        reasoning_delta: None,
                        finish_reason: None,
                        usage: None,
                        is_final: false,
                    };
                    on_chunk(chunk)?;
                }

                // Inject simulated failure
                Err(AppError::ServiceUnavailable(
                    "Simulated provider connection failure during streaming".to_string(),
                ))
            }

            MockStreamMode::LargeOutput { chunk_count } => {
                for i in 0..chunk_count {
                    if context.is_cancelled() {
                        return Ok(());
                    }

                    let is_last = i == chunk_count - 1;
                    let chunk = ProviderStreamChunk {
                        text_delta: Some(format!("Delta-{} ", i + 1)),
                        reasoning_delta: None,
                        finish_reason: if is_last { Some(ProviderFinishReason::Stop) } else { None },
                        usage: if is_last {
                            Some(ProviderUsage::new(50, chunk_count as u32))
                        } else {
                            None
                        },
                        is_final: is_last,
                    };
                    on_chunk(chunk)?;
                }
                Ok(())
            }
        }
    }
}

