// ============================================================================
// Nano Route - Google Gemini Provider Unit Test Suite
// File: src-tauri/src/providers/gemini/tests.rs
// ============================================================================

use super::*;
use crate::core::tasks::TaskContext;
use crate::providers::errors::ProviderErrorKind;
use crate::providers::gemini::client::GeminiClient;
use crate::providers::gemini::error::{map_gemini_http_error, scrub_gemini_secrets};
use crate::providers::gemini::request::GeminiGenerateContentRequest;
use crate::providers::gemini::response::GeminiGenerateContentResponse;
use crate::providers::gemini::streaming::GeminiSseParser;
use crate::providers::gemini::transport::MockGeminiTransport;
use crate::providers::request::{ChatMessage, GenerationParams, ProviderRequest, RequestMetadata};
use crate::providers::response::ProviderFinishReason;
use crate::security::SecretString;
use std::sync::Arc;

#[test]
fn test_gemini_request_mapping_with_system_instruction() {
    let req = ProviderRequest {
        model_id: "gemini-1.5-pro".to_string(),
        messages: vec![
            ChatMessage::system("You are an AI assistant designed by Google."),
            ChatMessage::user("What is Gemini?"),
            ChatMessage::assistant("Gemini is Google's native multimodal model family."),
            ChatMessage::user("What are its context limits?"),
        ],
        params: GenerationParams {
            temperature: Some(0.4),
            max_tokens: Some(4096),
            top_p: Some(0.95),
            stop_sequences: Vec::new(),
        },
        metadata: RequestMetadata::new("req_gemini_01"),
    };

    let gem_req = GeminiGenerateContentRequest::from_provider_request(&req).unwrap();

    let sys = gem_req.system_instruction.unwrap();
    assert_eq!(sys.parts.len(), 1);
    assert_eq!(sys.parts[0].text, "You are an AI assistant designed by Google.");

    assert_eq!(gem_req.contents.len(), 3);
    assert_eq!(gem_req.contents[0].role, "user");
    assert_eq!(gem_req.contents[0].parts[0].text, "What is Gemini?");
    assert_eq!(gem_req.contents[1].role, "model");
    assert_eq!(
        gem_req.contents[1].parts[0].text,
        "Gemini is Google's native multimodal model family."
    );
    assert_eq!(gem_req.contents[2].role, "user");

    let cfg = gem_req.generation_config.unwrap();
    assert_eq!(cfg.temperature, Some(0.4));
    assert_eq!(cfg.max_output_tokens, Some(4096));
    assert_eq!(cfg.top_p, Some(0.95));
}

#[test]
fn test_gemini_response_parsing_and_usage() {
    let raw_json = r#"{
        "candidates": [{
            "content": {
                "parts": [{ "text": "Gemini 1.5 Pro features a 2 million token context window." }],
                "role": "model"
            },
            "finishReason": "STOP",
            "index": 0
        }],
        "usageMetadata": {
            "promptTokenCount": 24,
            "candidatesTokenCount": 14,
            "totalTokenCount": 38
        },
        "modelVersion": "gemini-1.5-pro-002",
        "responseId": "gem_resp_987"
    }"#;

    let parsed: GeminiGenerateContentResponse = serde_json::from_str(raw_json).unwrap();
    let resp = parsed
        .into_provider_response("req_test".to_string(), "gemini-1.5-pro", 140)
        .unwrap();

    assert_eq!(resp.model_id, "gemini-1.5-pro");
    assert_eq!(
        resp.text,
        "Gemini 1.5 Pro features a 2 million token context window."
    );
    assert_eq!(resp.finish_reason, ProviderFinishReason::Completed);
    assert_eq!(resp.metadata.latency_ms, 140);
    assert_eq!(resp.metadata.provider_model_id, "gemini-1.5-pro-002");

    let usage = resp.usage.unwrap();
    assert_eq!(usage.input_tokens, Some(24));
    assert_eq!(usage.output_tokens, Some(14));
    assert_eq!(usage.total_tokens, Some(38));
}

#[test]
fn test_gemini_sse_streaming_parser() {
    let mut parser = GeminiSseParser::new();

    let chunk1 = "data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"Google \"}],\"role\":\"model\"}}]}\n\ndata: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"DeepMind\"}],\"role\":\"model\"}}]}\n\n";
    let chunks1 = parser.parse_chunk(chunk1).unwrap();
    assert_eq!(chunks1.len(), 2);
    assert_eq!(chunks1[0].text_delta.as_deref(), Some("Google "));
    assert_eq!(chunks1[1].text_delta.as_deref(), Some("DeepMind"));

    let chunk2 = "data: {\"candidates\":[{\"content\":{\"parts\":[]},\"finishReason\":\"STOP\"}],\"usageMetadata\":{\"promptTokenCount\":15,\"candidatesTokenCount\":2,\"totalTokenCount\":17}}\n\n";
    let chunks2 = parser.parse_chunk(chunk2).unwrap();
    assert_eq!(chunks2.len(), 1);
    assert!(chunks2[0].is_final);
    assert_eq!(chunks2[0].finish_reason, Some(ProviderFinishReason::Completed));
    assert_eq!(chunks2[0].usage.unwrap().total_tokens, Some(17));
    assert!(parser.is_completed());
}

#[test]
fn test_gemini_error_mapping_and_secret_scrubbing() {
    let secret = "AIzaSyD-1234567890abcdefghijklmnopqrstuv";
    let leaked_msg = format!("PERMISSION_DENIED with key {}", secret);
    let sanitized = scrub_gemini_secrets(&leaked_msg);
    assert!(!sanitized.contains(secret));
    assert!(sanitized.contains("[REDACTED_API_KEY]"));

    let err_403 = map_gemini_http_error(403, &format!(r#"{{"error":{{"code":403,"message":"{}","status":"PERMISSION_DENIED"}}}}"#, secret), None);
    assert_eq!(err_403.kind, ProviderErrorKind::AuthenticationFailed);
    assert!(!err_403.message.contains(secret));

    let err_429 = map_gemini_http_error(429, r#"{"error":{"code":429,"message":"Resource has been exhausted","status":"RESOURCE_EXHAUSTED"}}"#, Some("10"));
    assert_eq!(err_429.kind, ProviderErrorKind::RateLimited);
    assert_eq!(err_429.retry_after_ms, Some(10_000));
}

#[tokio::test]
async fn test_gemini_client_execute_end_to_end_with_mock() {
    let mock = Arc::new(MockGeminiTransport::new());
    let test_key = SecretString::new("AIzaSyMockTestKey1234567890abcdefgh");

    let client = GeminiClient::with_transport_and_vault(mock.clone(), None, Some(test_key));

    let req = ProviderRequest {
        model_id: "gemini-1.5-pro".to_string(),
        messages: vec![ChatMessage::user("Hello Gemini")],
        params: GenerationParams::default(),
        metadata: RequestMetadata::new("req_gem_test"),
    };

    let context = TaskContext::default();
    let resp = client.execute(req, &context).await.unwrap();

    assert_eq!(resp.model_id, "gemini-1.5-pro");
    assert_eq!(
        resp.text,
        "This is a deterministic mock response from Google Gemini."
    );

    let recorded = mock.get_recorded_requests();
    assert_eq!(recorded.len(), 1);
    assert_eq!(
        recorded[0].url,
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent"
    );

    let auth_header = recorded[0]
        .headers
        .iter()
        .find(|(k, _)| k.to_lowercase() == "x-goog-api-key")
        .map(|(_, v)| v.as_str());
    assert_eq!(auth_header, Some("AIzaSyMockTestKey1234567890abcdefgh"));
}

