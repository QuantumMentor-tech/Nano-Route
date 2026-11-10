// ============================================================================
// Nano Route - Google Gemini Provider Adapter Subsystem
// File: src-tauri/src/providers/gemini/mod.rs
// ============================================================================

pub mod client;
pub mod error;
pub mod request;
pub mod response;
pub mod streaming;
pub mod transport;

#[cfg(test)]
mod tests;

pub use client::GeminiClient;
pub use error::{map_gemini_http_error, scrub_gemini_secrets, GeminiErrorDetail, GeminiErrorEnvelope};
pub use request::{
    GeminiContent, GeminiGenerateContentRequest, GeminiGenerationConfig, GeminiPart,
    GeminiSystemInstruction,
};
pub use response::{
    GeminiCandidate, GeminiCandidateContent, GeminiCandidatePart, GeminiGenerateContentResponse,
    GeminiPromptFeedback, GeminiUsageMetadata,
};
pub use streaming::GeminiSseParser;
pub use transport::{
    DefaultGeminiTransport, GeminiHttpResponse, GeminiStreamReceiver, GeminiTransport,
    MockGeminiStreamReceiver, MockGeminiTransport, RecordedGeminiRequest,
};

