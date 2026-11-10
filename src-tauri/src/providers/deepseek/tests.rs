// ============================================================================
// Nano Route - DeepSeek Provider Unit Test Suite
// File: src-tauri/src/providers/deepseek/tests.rs
// ============================================================================

use super::*;
use crate::core::tasks::TaskContext;
use crate::providers::deepseek::client::DeepSeekClient;
use crate::providers::deepseek::policy::{scrub_deepseek_secrets, DeepSeekPolicy};
use crate::providers::errors::ProviderErrorKind;
use crate::providers::request::{ChatMessage, GenerationParams, ProviderRequest, RequestMetadata};
use crate::providers::response::ProviderFinishReason;
use crate::providers::shared::compatible_chat::{
    ChatCompletionPolicy, CompatibleChatRequest, MockCompatibleChatTransport,
};
use crate::security::SecretString;
use std::sync::Arc;

#[test]
fn test_deepseek_request_mapping() {
    let policy = DeepSeekPolicy;
    let req = ProviderRequest {
        model_id: "deepseek-chat".to_string(),
        messages: vec![
            ChatMessage::system("You are a helpful coding assistant."),
            ChatMessage::user("Solve the two sum problem in Rust."),
        ],
        params: GenerationParams {
            temperature: Some(0.2),
            max_tokens: Some(2048),
            top_p: Some(0.9),
            stop_sequences: Vec::new(),
        },
        metadata: RequestMetadata::new("req_ds_01"),
    };

    let chat_req = CompatibleChatRequest::from_provider_request(&req, false, &policy).unwrap();
    assert_eq!(chat_req.model, "deepseek-chat");
    assert_eq!(chat_req.messages.len(), 2);
    assert_eq!(chat_req.messages[0].role, "system");
    assert_eq!(chat_req.messages[1].role, "user");
    assert_eq!(chat_req.max_tokens, Some(2048));
    assert_eq!(chat_req.temperature, Some(0.2));
}

#[test]
fn test_deepseek_error_mapping_and_secret_scrubbing() {
    let policy = DeepSeekPolicy;
    let secret = "sk-deepseek-super-secret-key-12345";
    let leaked = format!("Unauthorized request for key {}", secret);
    let sanitized = scrub_deepseek_secrets(&leaked);
    assert!(!sanitized.contains(secret));
    assert!(sanitized.contains("[REDACTED_API_KEY]"));

    let err_401 = policy.map_http_error(401, &format!(r#"{{"error":{{"message":"{}"}}}}"#, secret), None);
    assert_eq!(err_401.kind, ProviderErrorKind::AuthenticationFailed);
    assert!(!err_401.message.contains(secret));

    let err_429 = policy.map_http_error(429, r#"{"error":{"message":"Rate limit exceeded","code":"rate_limit_exceeded"}}"#, Some("15"));
    assert_eq!(err_429.kind, ProviderErrorKind::RateLimited);
    assert_eq!(err_429.retry_after_ms, Some(15_000));
}

#[tokio::test]
async fn test_deepseek_client_execution_with_mock() {
    let mock = Arc::new(MockCompatibleChatTransport::new());
    let test_key = SecretString::new("sk-test-deepseek-key-12345");
    let client = DeepSeekClient::with_transport_and_vault(mock.clone(), None, Some(test_key));

    let req = ProviderRequest {
        model_id: "deepseek-chat".to_string(),
        messages: vec![ChatMessage::user("Hello DeepSeek")],
        params: GenerationParams::default(),
        metadata: RequestMetadata::new("req_ds_test"),
    };

    let context = TaskContext::default();
    let resp = client.execute(req, &context).await.unwrap();

    assert_eq!(resp.model_id, "deepseek-chat");
    assert_eq!(resp.finish_reason, ProviderFinishReason::Completed);

    let recorded = mock.get_recorded_requests();
    assert_eq!(recorded.len(), 1);
    assert_eq!(recorded[0].url, "https://api.deepseek.com/chat/completions");

    let auth = recorded[0]
        .headers
        .iter()
        .find(|(k, _)| k.to_lowercase() == "authorization")
        .map(|(_, v)| v.as_str());
    assert_eq!(auth, Some("Bearer sk-test-deepseek-key-12345"));
}

