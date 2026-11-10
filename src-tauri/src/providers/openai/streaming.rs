// ============================================================================
// Nano Route - OpenAI Provider Server-Sent Events (SSE) Streaming Parser
// File: src-tauri/src/providers/openai/streaming.rs
// ============================================================================
// Resilient streaming SSE parser for OpenAI Responses API streaming output.
// Safely frames partial event boundaries across arbitrary chunk fragments,
// extracts text deltas without modifying whitespace, tracks usage and finish
// reasons, and terminates cleanly upon `[DONE]` or `response.completed`.
// ============================================================================

use crate::providers::errors::ProviderError;
use crate::providers::identity::ProviderId;
use crate::providers::openai::response::{OpenAiResponsesResponse, OpenAiResponsesUsage};
use crate::providers::response::{ProviderFinishReason, ProviderUsage};
use crate::services::streaming::types::ProviderStreamChunk;
use serde::Deserialize;

/// Raw parsed SSE frame.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SseFrame {
    pub event_type: Option<String>,
    pub data: String,
}

/// Dedicated SSE buffer parser for framing incoming raw stream fragments.
#[derive(Debug, Default)]
pub struct OpenAiSseParser {
    buffer: String,
    stream_completed: bool,
}

impl OpenAiSseParser {
    pub fn new() -> Self {
        Self {
            buffer: String::new(),
            stream_completed: false,
        }
    }

    /// Feeds a raw text fragment into the buffer and extracts complete SSE frames.
    pub fn feed(&mut self, chunk: &str) -> Vec<SseFrame> {
        self.buffer.push_str(chunk);
        let mut frames = Vec::new();

        // Process all complete events separated by double newlines (\n\n or \r\n\r\n)
        loop {
            let normalized_buffer = self.buffer.replace("\r\n", "\n");
            if let Some(pos) = normalized_buffer.find("\n\n") {
                // Determine cut boundary in original buffer
                // Find matching slice in self.buffer
                let raw_event = &normalized_buffer[..pos];
                let remainder_len = normalized_buffer.len() - (pos + 2);

                // Parse the event block
                if let Some(frame) = Self::parse_raw_event(raw_event) {
                    frames.push(frame);
                }

                // Advance the buffer past the parsed event
                // Find corresponding index in raw self.buffer
                let mut consumed_bytes = 0;
                let mut match_count = 0;
                let bytes = self.buffer.as_bytes();
                let mut i = 0;
                while i < bytes.len() {
                    if bytes[i] == b'\n' {
                        if i + 1 < bytes.len() && bytes[i + 1] == b'\n' {
                            consumed_bytes = i + 2;
                            break;
                        } else if i + 2 < bytes.len()
                            && bytes[i + 1] == b'\r'
                            && bytes[i + 2] == b'\n'
                        {
                            consumed_bytes = i + 3;
                            break;
                        }
                    } else if bytes[i] == b'\r'
                        && i + 3 < bytes.len()
                        && bytes[i + 1] == b'\n'
                        && bytes[i + 2] == b'\r'
                        && bytes[i + 3] == b'\n'
                    {
                        consumed_bytes = i + 4;
                        break;
                    }
                    i += 1;
                }

                if consumed_bytes > 0 {
                    self.buffer.drain(..consumed_bytes);
                } else {
                    // Fallback to draining normalized representation
                    self.buffer = normalized_buffer[pos + 2..].to_string();
                }
            } else {
                break;
            }
        }

        frames
    }

    /// Parses a single SSE block into an `SseFrame`.
    fn parse_raw_event(block: &str) -> Option<SseFrame> {
        let mut event_type: Option<String> = None;
        let mut data_lines: Vec<&str> = Vec::new();

        for line in block.lines() {
            let line = line.trim_end();
            if line.starts_with(':') {
                // SSE comment line - ignore
                continue;
            }
            if let Some(event_val) = line.strip_prefix("event:") {
                event_type = Some(event_val.trim().to_string());
            } else if let Some(data_val) = line.strip_prefix("data:") {
                // Strip one optional leading space after colon per SSE spec
                let val = if data_val.starts_with(' ') {
                    &data_val[1..]
                } else {
                    data_val
                };
                data_lines.push(val);
            }
        }

        if data_lines.is_empty() {
            return None;
        }

        Some(SseFrame {
            event_type,
            data: data_lines.join("\n"),
        })
    }

    /// Consumes a raw chunk, updates internal framing, and parses out discrete `ProviderStreamChunk`s.
    pub fn parse_chunk(
        &mut self,
        raw_chunk: &str,
    ) -> Result<Vec<ProviderStreamChunk>, ProviderError> {
        if self.stream_completed {
            return Ok(Vec::new());
        }

        let frames = self.feed(raw_chunk);
        let mut chunks = Vec::new();

        for frame in frames {
            // Check terminal marker
            if frame.data.trim() == "[DONE]" {
                self.stream_completed = true;
                chunks.push(ProviderStreamChunk {
                    text_delta: None,
                    reasoning_delta: None,
                    finish_reason: Some(ProviderFinishReason::Completed),
                    usage: None,
                    is_final: true,
                });
                break;
            }

            // Parse JSON payload
            let parsed_chunks = Self::parse_sse_data(&frame.data, frame.event_type.as_deref())?;
            for c in parsed_chunks {
                if c.is_final {
                    self.stream_completed = true;
                }
                chunks.push(c);
            }

            if self.stream_completed {
                break;
            }
        }

        Ok(chunks)
    }

    /// Parses the JSON payload within an SSE `data:` field.
    pub fn parse_sse_data(
        data: &str,
        event_type: Option<&str>,
    ) -> Result<Vec<ProviderStreamChunk>, ProviderError> {
        let provider_id = Some(ProviderId::new(ProviderId::OPENAI).unwrap());
        let mut results = Vec::new();

        // 1. Try parsing as OpenAI Responses API streaming event
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(data) {
            let event_name = event_type
                .or_else(|| value.get("type").and_then(|t| t.as_str()))
                .unwrap_or("");

            match event_name {
                // Incremental text delta in Responses API
                "response.output_text.delta" => {
                    if let Some(delta) = value.get("delta").and_then(|d| d.as_str()) {
                        results.push(ProviderStreamChunk {
                            text_delta: Some(delta.to_string()),
                            reasoning_delta: None,
                            finish_reason: None,
                            usage: None,
                            is_final: false,
                        });
                    }
                    return Ok(results);
                }

                // Incremental reasoning delta (e.g. o1/o3 reasoning tokens)
                "response.reasoning_text.delta" => {
                    if let Some(delta) = value.get("delta").and_then(|d| d.as_str()) {
                        results.push(ProviderStreamChunk {
                            text_delta: None,
                            reasoning_delta: Some(delta.to_string()),
                            finish_reason: None,
                            usage: None,
                            is_final: false,
                        });
                    }
                    return Ok(results);
                }

                // Final response completion event in Responses API
                "response.completed" => {
                    let mut usage = None;
                    let mut finish_reason = ProviderFinishReason::Completed;

                    if let Some(resp_obj) = value.get("response") {
                        if let Some(u) = resp_obj.get("usage") {
                            if let Ok(usage_dto) =
                                serde_json::from_value::<OpenAiResponsesUsage>(u.clone())
                            {
                                usage = Some(usage_dto.to_provider_usage());
                            }
                        }
                        if let Some(status) = resp_obj.get("status").and_then(|s| s.as_str()) {
                            match status {
                                "completed" => finish_reason = ProviderFinishReason::Completed,
                                "incomplete" => finish_reason = ProviderFinishReason::LengthLimit,
                                "failed" => finish_reason = ProviderFinishReason::ProviderError,
                                "cancelled" => finish_reason = ProviderFinishReason::Cancelled,
                                _ => {}
                            }
                        }
                    }

                    results.push(ProviderStreamChunk {
                        text_delta: None,
                        reasoning_delta: None,
                        finish_reason: Some(finish_reason),
                        usage,
                        is_final: true,
                    });
                    return Ok(results);
                }

                // Terminal failure event in Responses API
                "response.failed" => {
                    let msg = value
                        .get("error")
                        .and_then(|e| e.get("message"))
                        .and_then(|m| m.as_str())
                        .unwrap_or("OpenAI streaming execution failed");

                    return Err(ProviderError::new(
                        provider_id,
                        crate::providers::ProviderErrorKind::ProviderUnavailable,
                        msg,
                        None,
                        None,
                        None,
                    ));
                }

                _ => {}
            }

            // 2. Fallback to standard chat completions SSE format (e.g. data: {"choices":[{"delta":{"content":"..."}}]})
            if let Some(choices) = value.get("choices").and_then(|c| c.as_array()) {
                if let Some(first) = choices.first() {
                    let text_delta = first
                        .get("delta")
                        .and_then(|d| d.get("content"))
                        .and_then(|c| c.as_str())
                        .map(|s| s.to_string());

                    let finish_str = first.get("finish_reason").and_then(|f| f.as_str());
                    let finish_reason = finish_str.map(|f| match f {
                        "stop" => ProviderFinishReason::Completed,
                        "length" => ProviderFinishReason::LengthLimit,
                        "content_filter" => ProviderFinishReason::ContentFiltered,
                        "tool_calls" => ProviderFinishReason::ToolCall,
                        _ => ProviderFinishReason::Completed,
                    });

                    let is_final = finish_reason.is_some();

                    let usage = value
                        .get("usage")
                        .and_then(|u| serde_json::from_value::<OpenAiResponsesUsage>(u.clone()).ok())
                        .map(|u| u.to_provider_usage());

                    if text_delta.is_some() || finish_reason.is_some() || is_final {
                        results.push(ProviderStreamChunk {
                            text_delta,
                            reasoning_delta: None,
                            finish_reason,
                            usage,
                            is_final,
                        });
                        return Ok(results);
                    }
                }
            }
        }

        // Ignore unrecognized non-terminating frame
        Ok(results)
    }

    /// Checks if the stream has finished.
    pub fn is_completed(&self) -> bool {
        self.stream_completed
    }
}

