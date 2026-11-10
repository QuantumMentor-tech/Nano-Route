// ============================================================================
// Nano Route - Google Gemini Server-Sent Events (SSE) Streaming Parser
// File: src-tauri/src/providers/gemini/streaming.rs
// ============================================================================
// Resilient streaming parser for Google Gemini `streamGenerateContent?alt=sse`.
// Buffers partial chunk boundaries, extracts candidate delta text parts
// without altering whitespace, tracks usageMetadata, and signals completion cleanly.
// ============================================================================

use crate::providers::errors::ProviderError;
use crate::providers::gemini::response::{GeminiGenerateContentResponse, GeminiUsageMetadata};
use crate::providers::identity::ProviderId;
use crate::providers::response::{ProviderFinishReason, ProviderUsage};
use crate::services::streaming::types::ProviderStreamChunk;

/// Buffer parser for Gemini SSE chunks.
#[derive(Debug, Default)]
pub struct GeminiSseParser {
    buffer: String,
    stream_completed: bool,
    accumulated_usage: Option<ProviderUsage>,
    final_finish_reason: Option<ProviderFinishReason>,
}

impl GeminiSseParser {
    pub fn new() -> Self {
        Self {
            buffer: String::new(),
            stream_completed: false,
            accumulated_usage: None,
            final_finish_reason: None,
        }
    }

    pub fn feed(&mut self, chunk: &str) -> Vec<String> {
        self.buffer.push_str(chunk);
        let mut events = Vec::new();

        loop {
            let normalized = self.buffer.replace("\r\n", "\n");
            if let Some(pos) = normalized.find("\n\n") {
                let block = normalized[..pos].to_string();
                let mut data_lines = Vec::new();

                for line in block.lines() {
                    let line = line.trim_end();
                    if line.starts_with(':') {
                        continue;
                    }
                    if let Some(data_val) = line.strip_prefix("data:") {
                        let val = if data_val.starts_with(' ') {
                            &data_val[1..]
                        } else {
                            data_val
                        };
                        data_lines.push(val);
                    }
                }

                if !data_lines.is_empty() {
                    events.push(data_lines.join("\n"));
                }

                let bytes = self.buffer.as_bytes();
                let mut consumed_bytes = 0;
                let mut i = 0;
                while i < bytes.len() {
                    if bytes[i] == b'\n' {
                        if i + 1 < bytes.len() && bytes[i + 1] == b'\n' {
                            consumed_bytes = i + 2;
                            break;
                        } else if i + 2 < bytes.len() && bytes[i + 1] == b'\r' && bytes[i + 2] == b'\n' {
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
                    self.buffer = normalized[pos + 2..].to_string();
                }
            } else {
                break;
            }
        }

        events
    }

    pub fn parse_chunk(&mut self, raw_chunk: &str) -> Result<Vec<ProviderStreamChunk>, ProviderError> {
        if self.stream_completed {
            return Ok(Vec::new());
        }

        let events = self.feed(raw_chunk);
        let mut chunks = Vec::new();

        for data_str in events {
            if let Ok(resp) = serde_json::from_str::<GeminiGenerateContentResponse>(&data_str) {
                if let Some(usage) = &resp.usage_metadata {
                    self.accumulated_usage = Some(usage.to_provider_usage());
                }

                let finish_reason = resp.resolve_finish_reason();
                let text = resp.extract_text();

                let is_final = resp
                    .candidates
                    .first()
                    .and_then(|c| c.finish_reason.as_deref())
                    .is_some();

                if is_final {
                    self.stream_completed = true;
                    self.final_finish_reason = Some(finish_reason);
                }

                if !text.is_empty() || is_final {
                    chunks.push(ProviderStreamChunk {
                        text_delta: if text.is_empty() { None } else { Some(text) },
                        reasoning_delta: None,
                        finish_reason: if is_final { Some(finish_reason) } else { None },
                        usage: if is_final { self.accumulated_usage } else { None },
                        is_final,
                    });
                }
            }
        }

        Ok(chunks)
    }

    pub fn is_completed(&self) -> bool {
        self.stream_completed
    }
}

