// ============================================================================
// Nano Route - OpenAI Provider Adapter Subsystem
// File: src-tauri/src/providers/openai/mod.rs
// ============================================================================
// Responsibility:
// - Implements the `ProviderClient` trait targeting the OpenAI Responses API (`/v1/responses`).
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

pub use client::OpenAiClient;
pub use error::{map_openai_http_error, scrub_openai_secrets, OpenAiErrorEnvelope, OpenAiErrorPayload};
pub use request::{OpenAiContentPart, OpenAiInputContent, OpenAiInputItem, OpenAiResponsesRequest};
pub use response::{
    OpenAiChatChoice, OpenAiChatMessage, OpenAiIncompleteDetails, OpenAiOutputContentPart,
    OpenAiOutputItem, OpenAiOutputTokenDetails, OpenAiResponsesResponse, OpenAiResponsesUsage,
};
pub use streaming::{OpenAiSseParser, SseFrame};
pub use transport::{
    DefaultOpenAiTransport, MockOpenAiTransport, MockStreamReceiver, OpenAiHttpResponse,
    OpenAiStreamReceiver, OpenAiTransport, RecordedOpenAiRequest,
};

