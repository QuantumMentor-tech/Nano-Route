// ============================================================================
// Nano Route - Anthropic Provider Server-Sent Events (SSE) Streaming Parser
// File: src-tauri/src/providers/anthropic/streaming.rs
// ============================================================================
// Resilient streaming SSE parser for Anthropic Messages API streaming responses.
// Safely frames partial event boundaries across chunk fragments, extracts text deltas
// without modifying whitespace, tracks input/output usage across message_start and
// message_delta events, and terminates cleanly upon `message_stop`.
// ============================================================================

use crate::providers::anthropic::response::AnthropicUsage;
use crate::providers::errors::{ProviderError, ProviderErrorKind};
use crate::providers::identity::ProviderId;
use crate::providers::response::{ProviderFinishReason, ProviderUsage};
use crate::services::streaming::types::ProviderStreamChunk;
use serde::Deserialize;

/// Raw parsed SSE frame.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AnthropicSseFrame {
    pub event_type: Option<String>,
    pub data: String,
}

/// Buffer parser for framing incoming raw Anthropic stream fragments.
#[derive(Debug, Default)]
pub struct AnthropicSseParser {
    buffer: String,
    stream_completed: bool,
    accumulated_input_tokens: Option<u32>,
    accumulated_output_tokens: Option<u32>,
    finish_reason: ProviderFinishReason,
}

impl AnthropicSseParser {
    pub fn new() -> Self {
        Self {
            buffer: String::new(),
            stream_completed: false,
            accumulated_input_tokens: None,
            accumulated_output_tokens: None,
            finish_reason: ProviderFinishReason::Completed,
        }
    }

    /// Feeds a raw text fragment into the buffer and extracts complete SSE frames.
    pub fn feed(&mut self, chunk: &str) -> Vec<AnthropicSseFrame> {
        self.buffer.push_str(chunk);
        let mut frames = Vec::new();

        loop {
            let normalized_buffer = self.buffer.replace("\r\n", "\n");
            if let Some(pos) = normalized_buffer.find("\n\n") {
                let raw_event = &normalized_buffer[..pos];

                if let Some(frame) = Self::parse_raw_event(raw_event) {
                    frames.push(frame);
                }

                // Advance the buffer past the parsed event
                let bytes = self.buffer.as_bytes();
                let mut consumed_bytes = 0;
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
                    self.buffer = normalized_buffer[pos + 2..].to_string();
                }
            } else {
                break;
            }
        }

        frames
    }

    /// Parses a single raw event block into an `AnthropicSseFrame`.
    fn parse_raw_event(block: &str) -> Option<AnthropicSseFrame> {
        let mut event_type: Option<String> = None;
        let mut data_lines: Vec<&str> = Vec::new();

        for line in block.lines() {
            let line = line.trim_end();
            if line.starts_with(':') {
                continue;
            }
            if let Some(event_val) = line.strip_prefix("event:") {
                event_type = Some(event_val.trim().to_string());
            } else if let Some(data_val) = line.strip_prefix("data:") {
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

        Some(AnthropicSseFrame {
            event_type,
            data: data_lines.join("\n"),
        })
    }

    /// Consumes a raw chunk and returns parsed `ProviderStreamChunk` items.
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
            let parsed_chunks = self.process_frame(&frame)?;
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

    /// Processes an individual SSE frame according to Anthropic's streaming schema.
    fn process_frame(
        &mut self,
        frame: &AnthropicSseFrame,
    ) -> Result<Vec<ProviderStreamChunk>, ProviderError> {
        let provider_id = Some(ProviderId::new(ProviderId::ANTHROPIC).unwrap());
        let mut results = Vec::new();

        let json_value: serde_json::Value = match serde_json::from_str(&frame.data) {
            Ok(v) => v,
            Err(_) => return Ok(results),
        };

        let event_type = frame
            .event_type
            .as_deref()
            .or_else(|| json_value.get("type").and_then(|t| t.as_str()))
            .unwrap_or("");

        match event_type {
            // 1. Initial message lifecycle event (contains initial usage/input_tokens)
            "message_start" => {
                if let Some(msg) = json_value.get("message") {
                    if let Some(usage) = msg.get("usage") {
                        if let Some(inp) = usage.get("input_tokens").and_then(|t| t.as_u64()) {
                            self.accumulated_input_tokens = Some(inp as u32);
                        }
                    }
                }
            }

            // 2. Text delta event
            "content_block_delta" => {
                if let Some(delta) = json_value.get("delta") {
                    let delta_type = delta.get("type").and_then(|t| t.as_str()).unwrap_or("");
                    if delta_type == "text_delta" {
                        if let Some(text) = delta.get("text").and_then(|t| t.as_str()) {
                            results.push(ProviderStreamChunk {
                                text_delta: Some(text.to_string()),
                                reasoning_delta: None,
                                finish_reason: None,
                                usage: None,
                                is_final: false,
                            });
                        }
                    }
                }
            }

            // 3. Message delta event (contains stop_reason and output token count)
            "message_delta" => {
                if let Some(delta) = json_value.get("delta") {
                    if let Some(stop_reason) = delta.get("stop_reason").and_then(|s| s.as_str()) {
                        self.finish_reason = match stop_reason {
                            "end_turn" => ProviderFinishReason::Completed,
                            "max_tokens" => ProviderFinishReason::LengthLimit,
                            "stop_sequence" => ProviderFinishReason::Completed,
                            "tool_use" => ProviderFinishReason::ToolCall,
                            _ => ProviderFinishReason::Completed,
                        };
                    }
                }

                if let Some(usage) = json_value.get("usage") {
                    if let Some(out) = usage.get("output_tokens").and_then(|t| t.as_u64()) {
                        self.accumulated_output_tokens = Some(out as u32);
                    }
                }
            }

            // 4. Terminal message stop event
            "message_stop" => {
                self.stream_completed = true;
                let usage = match (self.accumulated_input_tokens, self.accumulated_output_tokens) {
                    (Some(i), Some(o)) => Some(ProviderUsage {
                        input_tokens: Some(i),
                        output_tokens: Some(o),
                        total_tokens: Some(i + o),
                        reasoning_tokens: None,
                        cache_read_tokens: None,
                        cache_write_tokens: None,
                    }),
                    (Some(i), None) => Some(ProviderUsage {
                        input_tokens: Some(i),
                        output_tokens: None,
                        total_tokens: Some(i),
                        reasoning_tokens: None,
                        cache_read_tokens: None,
                        cache_write_tokens: None,
                    }),
                    _ => None,
                };

                results.push(ProviderStreamChunk {
                    text_delta: None,
                    reasoning_delta: None,
                    finish_reason: Some(self.finish_reason),
                    usage,
                    is_final: true,
                });
            }

            // 5. Streaming error event
            "error" => {
                let err_obj = json_value.get("error");
                let err_msg = err_obj
                    .and_then(|e| e.get("message"))
                    .and_then(|m| m.as_str())
                    .unwrap_or("Anthropic streaming error");
                let err_type = err_obj
                    .and_then(|e| e.get("type"))
                    .and_then(|t| t.as_str());

                let kind = match err_type {
                    Some("overloaded_error") => ProviderErrorKind::ProviderUnavailable,
                    Some("rate_limit_error") => ProviderErrorKind::RateLimited,
                    Some("authentication_error") => ProviderErrorKind::AuthenticationFailed,
                    Some("invalid_request_error") => ProviderErrorKind::InvalidRequest,
                    _ => ProviderErrorKind::ProviderUnavailable,
                };

                return Err(ProviderError::new(
                    provider_id,
                    kind,
                    err_msg,
                    None,
                    None,
                    err_type.map(|s| s.to_string()),
                ));
            }

            // Ignore ping, content_block_start, content_block_stop
            _ => {}
        }

        Ok(results)
    }

    /// Returns true if the stream reached terminal completion.
    pub fn is_completed(&self) -> bool {
        self.stream_completed
    }
}

