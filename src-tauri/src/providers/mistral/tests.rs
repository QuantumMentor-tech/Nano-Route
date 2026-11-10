// ============================================================================
// Nano Route - Mistral AI Provider Unit Test Suite
// File: src-tauri/src/providers/mistral/tests.rs
// ============================================================================

use super::*;
use crate::core::tasks::TaskContext;
use crate::providers::errors::ProviderErrorKind;
use crate::providers::mistral::client::MistralClient;
use crate::providers::mistral::policy::{scrub_mistral_secrets, MistralPolicy};
use crate::providers::request::{ChatMessage, GenerationParams, ProviderRequest, RequestMetadata};
use crate::providers::response::ProviderFinishReason;
use crate::providers::shared::compatible_chat::{
    ChatCompletionPolicy, CompatibleChatRequest, CompatibleChatResponse, MockCompatibleChatTransport,
};
use crate::security::SecretString;
use std::sync::Arc;

#[test]
fn test_mistral_request_mapping() {
    let policy = MistralPolicy;
    let req = ProviderRequest {
        model_id: "mistral-large-latest".to_string(),
        messages: vec![
            ChatMessage::system("You are Mistral, a helpful assistant."),
            ChatMessage::user("Explain Le Chat."),
        ],
        params: GenerationParams::default(),
        metadata: RequestMetadata::new("req_mistral_01"),
    };

    let chat_req = CompatibleChatRequest::from_provider_request(&req, false, &policy).unwrap();
    assert_eq!(chat_req.model, "mistral-large-latest");
    assert_eq!(chat_req.messages.len(), 2);
    assert_eq!(chat_req.max_tokens, Some(4096)); // Default 4096 applied
}

#[test]
fn test_mistral_response_parsing_with_structured_content_chunks() {
    let raw_json = r#"{
        "id": "cmpl_mistral_123",
        "model": "mistral-large-latest",
        "choices": [{
            "index": 0,
            "message": {
                "role": "assistant",
                "content": [
                    { "type": "text", "text": "Mistral models offer " },
                    { "type": "text", "text": "high efficiency and reasoning." }
                ]
            },
            "finish_reason": "stop"
        }],
        "usage": {
            "prompt_tokens": 12,
            "completion_tokens": 8,
            "total_tokens": 20
        }
    }"#;

    let parsed: CompatibleChatResponse = serde_json::from_str(raw_json).unwrap();
    let resp = parsed
        .into_provider_response("req_test".to_string(), "mistral-large-latest", 120, &MistralPolicy)
        .unwrap();

    assert_eq!(resp.model_id, "mistral-large-latest");
    assert_eq!(resp.text, "Mistral models offer high efficiency and reasoning.");
    assert_eq!(resp.finish_reason, ProviderFinishReason::Completed);
    assert_eq!(resp.usage.unwrap().total_tokens, Some(20));
}

#[test]
fn test_mistral_error_mapping_and_secret_scrubbing() {
    let policy = MistralPolicy;
    let secret = "mistral_api_secret_key_1234567890";
    let leaked = format!("Failed authentication with token {}", secret);
    let sanitized = scrub_mistral_secrets(&leaked);
    assert!(!sanitized.contains(secret));
    assert!(sanitized.contains("[REDACTED_API_KEY]"));

    let err_401 = policy.map_http_error(401, &format!(r#"{{"message":"{}"}}"#, secret), None);
    assert_eq!(err_401.kind, ProviderErrorKind::AuthenticationFailed);
    assert!(!err_401.message.contains(secret));

    let err_429 = policy.map_http_error(429, r#"{"message":"Too Many Requests"}"#, Some("12"));
    assert_eq!(err_429.kind, ProviderErrorKind::RateLimited);
    assert_eq!(err_429.retry_after_ms, Some(12_000));
}

#[tokio::test]
async fn test_mistral_client_execution_with_mock() {
    let mock = Arc::new(MockCompatibleChatTransport::new());
    let test_key = SecretString::new("mistral_test_secret_key");
    let client = MistralClient::with_transport_and_vault(mock.clone(), None, Some(test_key));

    let req = ProviderRequest {
        model_id: "mistral-large-latest".to_string(),
        messages: vec![ChatMessage::user("Hello Mistral")],
        params: GenerationParams::default(),
        metadata: RequestMetadata::new("req_mistral_test"),
    };

    let context = TaskContext::default();
    let resp = client.execute(req, &context).await.unwrap();

    assert_eq!(resp.model_id, "mistral-large-latest");
    assert_eq!(resp.finish_reason, ProviderFinishReason::Completed);

    let recorded = mock.get_recorded_requests();
    assert_eq!(recorded.len(), 1);
    assert_eq!(
        recorded[0].url,
        "https://api.mistral.ai/v1/chat/completions"
    );

    let auth = recorded[0]
        .headers
        .iter()
        .find(|(k, _)| k.to_lowercase() == "authorization")
        .map(|(_, v)| v.as_str());
    assert_eq!(auth, Some("Bearer mistral_test_secret_key"));
}

