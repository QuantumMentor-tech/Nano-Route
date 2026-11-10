// ============================================================================
// Nano Route - Groq Provider Unit Test Suite
// File: src-tauri/src/providers/groq/tests.rs
// ============================================================================

use super::*;
use crate::core::tasks::TaskContext;
use crate::providers::errors::ProviderErrorKind;
use crate::providers::groq::client::GroqClient;
use crate::providers::groq::policy::{scrub_groq_secrets, GroqPolicy};
use crate::providers::request::{ChatMessage, GenerationParams, ProviderRequest, RequestMetadata};
use crate::providers::response::ProviderFinishReason;
use crate::providers::shared::compatible_chat::{
    ChatCompletionPolicy, CompatibleChatRequest, MockCompatibleChatTransport,
};
use crate::security::SecretString;
use std::sync::Arc;

#[test]
fn test_groq_request_mapping() {
    let policy = GroqPolicy;
    let req = ProviderRequest {
        model_id: "llama-3.3-70b-versatile".to_string(),
        messages: vec![
            ChatMessage::system("You are a high-speed AI assistant."),
            ChatMessage::user("What is Groq LPU?"),
        ],
        params: GenerationParams {
            temperature: Some(0.6),
            max_tokens: Some(4096),
            top_p: Some(0.9),
            stop_sequences: Vec::new(),
        },
        metadata: RequestMetadata::new("req_groq_01"),
    };

    let chat_req = CompatibleChatRequest::from_provider_request(&req, false, &policy).unwrap();
    assert_eq!(chat_req.model, "llama-3.3-70b-versatile");
    assert_eq!(chat_req.messages.len(), 2);
    assert_eq!(chat_req.messages[0].role, "system");
    assert_eq!(chat_req.messages[1].role, "user");
    assert_eq!(chat_req.max_tokens, Some(4096));
    assert_eq!(chat_req.temperature, Some(0.6));
}

#[test]
fn test_groq_error_mapping_and_secret_scrubbing() {
    let policy = GroqPolicy;
    let secret = "gsk_1234567890abcdefghijklmnopqrstuvwxyz";
    let leaked = format!("Failed authentication with key {}", secret);
    let sanitized = scrub_groq_secrets(&leaked);
    assert!(!sanitized.contains(secret));
    assert!(sanitized.contains("[REDACTED_API_KEY]"));

    let err_401 = policy.map_http_error(401, &format!(r#"{{"error":{{"message":"{}"}}}}"#, secret), None);
    assert_eq!(err_401.kind, ProviderErrorKind::AuthenticationFailed);
    assert!(!err_401.message.contains(secret));

    let err_429 = policy.map_http_error(429, r#"{"error":{"message":"Rate limit exceeded"}}"#, Some("5"));
    assert_eq!(err_429.kind, ProviderErrorKind::RateLimited);
    assert_eq!(err_429.retry_after_ms, Some(5_000));
}

#[tokio::test]
async fn test_groq_client_execution_with_mock() {
    let mock = Arc::new(MockCompatibleChatTransport::new());
    let test_key = SecretString::new("gsk_mock_test_key_12345");
    let client = GroqClient::with_transport_and_vault(mock.clone(), None, Some(test_key));

    let req = ProviderRequest {
        model_id: "llama-3.3-70b-versatile".to_string(),
        messages: vec![ChatMessage::user("Hello Groq")],
        params: GenerationParams::default(),
        metadata: RequestMetadata::new("req_groq_test"),
    };

    let context = TaskContext::default();
    let resp = client.execute(req, &context).await.unwrap();

    assert_eq!(resp.model_id, "llama-3.3-70b-versatile");
    assert_eq!(resp.finish_reason, ProviderFinishReason::Completed);

    let recorded = mock.get_recorded_requests();
    assert_eq!(recorded.len(), 1);
    assert_eq!(
        recorded[0].url,
        "https://api.groq.com/openai/v1/chat/completions"
    );

    let auth = recorded[0]
        .headers
        .iter()
        .find(|(k, _)| k.to_lowercase() == "authorization")
        .map(|(_, v)| v.as_str());
    assert_eq!(auth, Some("Bearer gsk_mock_test_key_12345"));
}

