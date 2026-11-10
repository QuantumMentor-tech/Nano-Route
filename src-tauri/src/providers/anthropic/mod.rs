// ============================================================================
// Nano Route - Anthropic Provider Adapter Subsystem
// File: src-tauri/src/providers/anthropic/mod.rs
// ============================================================================
// Responsibility:
// - Implements the `ProviderClient` trait targeting the Anthropic Messages API (`POST /v1/messages`).
// - Standard non-streaming completion and robust incremental streaming SSE parser.
// - Strictly isolates API keys to transient native operations via DPAPI.
// - Pluggable deterministic mock transport for 100% offline testing.
// ============================================================================

pub mod client;
pub mod error;
pub mod request;
pub mod response;
pub mod streaming;
pub mod transport;

#[cfg(test)]
mod tests;

pub use client::{AnthropicClient, ANTHROPIC_API_VERSION};
pub use error::{map_anthropic_http_error, scrub_anthropic_secrets, AnthropicErrorDetail, AnthropicErrorEnvelope};
pub use request::{AnthropicMessage, AnthropicMessagesRequest};
pub use response::{AnthropicContentBlock, AnthropicMessagesResponse, AnthropicUsage};
pub use streaming::{AnthropicSseFrame, AnthropicSseParser};
pub use transport::{
    AnthropicHttpResponse, AnthropicStreamReceiver, AnthropicTransport,
    DefaultAnthropicTransport, MockAnthropicStreamReceiver, MockAnthropicTransport,
    RecordedAnthropicRequest,
};

