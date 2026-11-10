// ============================================================================
// Nano Route - OpenAI Provider Unit Test Suite
// File: src-tauri/src/providers/openai/tests.rs
// ============================================================================
// Exhaustive offline tests covering Responses API request formatting,
// response deserialization, SSE framing, whitespace preservation, error mapping,
// DPAPI secret hygiene, and cooperative cancellation.
// ============================================================================

use super::*;
use crate::core::tasks::TaskContext;
use crate::providers::errors::ProviderErrorKind;
use crate::providers::identity::ProviderId;
use crate::providers::request::{ChatMessage, GenerationParams, ProviderRequest, RequestMetadata};
use crate::providers::response::ProviderFinishReason;
use crate::security::SecretString;
use std::sync::Arc;

#[test]
fn test_request_mapping_single_and_multi_turn() {
    let req = ProviderRequest {
        model_id: "gpt-4o".to_string(),
        messages: vec![
            ChatMessage::system("You are a helpful coding assistant."),
            ChatMessage::user("How does Nano Route route queries?"),
            ChatMessage::assistant("Nano Route uses local SLM inference."),
            ChatMessage::user("What about fallback?"),
        ],
        params: GenerationParams {
            temperature: Some(0.7),
            max_tokens: Some(2048),
            top_p: Some(0.95),
            stop_sequences: Vec::new(),
        },
        metadata: RequestMetadata::new("req_123"),
    };

    let openai_req = OpenAiResponsesRequest::from_provider_request(&req, false).unwrap();
    assert_eq!(openai_req.model, "gpt-4o");
    assert_eq!(openai_req.stream, None);
    assert_eq!(openai_req.temperature, Some(0.7));
    assert_eq!(openai_req.max_output_tokens, Some(2048));
    assert_eq!(openai_req.top_p, Some(0.95));
    assert_eq!(openai_req.input.len(), 4);

    // Verify role mapping: system -> developer
    assert_eq!(openai_req.input[0].role, "developer");
    match &openai_req.input[0].content {
        OpenAiInputContent::Text(t) => assert_eq!(t, "You are a helpful coding assistant."),
        _ => panic!("Expected text content"),
    }

    assert_eq!(openai_req.input[1].role, "user");
    assert_eq!(openai_req.input[2].role, "assistant");
    assert_eq!(openai_req.input[3].role, "user");
}

#[test]
fn test_request_validation_rejects_empty_model_or_messages() {
    let empty_model = ProviderRequest {
        model_id: "   ".to_string(),
        messages: vec![ChatMessage::user("Hello")],
        params: GenerationParams::default(),
        metadata: RequestMetadata::new("req_empty_model"),
    };
    let err = OpenAiResponsesRequest::from_provider_request(&empty_model, false).unwrap_err();
    assert_eq!(err.kind, ProviderErrorKind::InvalidRequest);

    let empty_messages = ProviderRequest {
        model_id: "gpt-4o".to_string(),
        messages: Vec::new(),
        params: GenerationParams::default(),
        metadata: RequestMetadata::new("req_empty_msgs"),
    };
    let err = OpenAiResponsesRequest::from_provider_request(&empty_messages, false).unwrap_err();
    assert_eq!(err.kind, ProviderErrorKind::InvalidRequest);
}

#[test]
fn test_response_parsing_responses_api_format() {
    let raw_json = r#"{
        "id": "resp_998877",
        "object": "response",
        "model": "gpt-4o-2024-08-06",
        "status": "completed",
        "output": [
            {
                "id": "out_item_1",
                "type": "message",
                "role": "assistant",
                "content": [
                    {
                        "type": "output_text",
                        "text": "Nano Route is optimized for low latency."
                    }
                ]
            }
        ],
        "usage": {
            "input_tokens": 42,
            "output_tokens": 10,
            "total_tokens": 52,
            "output_token_details": {
                "reasoning_tokens": 0
            }
        }
    }"#;

    let parsed: OpenAiResponsesResponse = serde_json::from_str(raw_json).unwrap();
    let resp = parsed
        .into_provider_response("req_test".to_string(), "gpt-4o", 150)
        .unwrap();

    assert_eq!(resp.model_id, "gpt-4o");
    assert_eq!(resp.text, "Nano Route is optimized for low latency.");
    assert_eq!(resp.finish_reason, ProviderFinishReason::Completed);
    assert_eq!(resp.metadata.latency_ms, 150);
    assert_eq!(resp.metadata.provider_model_id, "gpt-4o-2024-08-06");

    let usage = resp.usage.unwrap();
    assert_eq!(usage.input_tokens, Some(42));
    assert_eq!(usage.output_tokens, Some(10));
    assert_eq!(usage.total_tokens, Some(52));
    assert_eq!(usage.reasoning_tokens, Some(0));
}

#[test]
fn test_response_parsing_chat_completions_fallback() {
    let fallback_json = r#"{
        "id": "chatcmpl_legacy_123",
        "object": "chat.completion",
        "model": "gpt-4o",
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": "Fallback response from OpenAI proxy."
                },
                "finish_reason": "stop"
            }
        ],
        "usage": {
            "prompt_tokens": 15,
            "completion_tokens": 8,
            "total_tokens": 23
        }
    }"#;

    let parsed: OpenAiResponsesResponse = serde_json::from_str(fallback_json).unwrap();
    let resp = parsed
        .into_provider_response("req_fallback".to_string(), "gpt-4o", 210)
        .unwrap();

    assert_eq!(resp.text, "Fallback response from OpenAI proxy.");
    assert_eq!(resp.finish_reason, ProviderFinishReason::Completed);
    let usage = resp.usage.unwrap();
    assert_eq!(usage.input_tokens, Some(15));
    assert_eq!(usage.output_tokens, Some(8));
    assert_eq!(usage.total_tokens, Some(23));
}

#[test]
fn test_sse_streaming_parser_split_chunks_and_whitespace_preservation() {
    let mut parser = OpenAiSseParser::new();

    // Chunk 1: Partial event
    let part1 = "event: response.output_text.delta\nda";
    let chunks1 = parser.parse_chunk(part1).unwrap();
    assert_eq!(chunks1.len(), 0);

    // Chunk 2: Completion of first event and start of second
    let part2 = "ta: {\"type\":\"response.output_text.delta\",\"delta\":\"  def nano_route():\\n    return 42\\n\"}\n\nevent: response.output_text.delta\ndata: ";
    let chunks2 = parser.parse_chunk(part2).unwrap();
    assert_eq!(chunks2.len(), 1);
    assert_eq!(
        chunks2[0].text_delta.as_deref(),
        Some("  def nano_route():\n    return 42\n")
    );

    // Chunk 3: Second event finish and terminal event
    let part3 = "{\"type\":\"response.output_text.delta\",\"delta\":\"# End of script\"}\n\nevent: response.completed\ndata: {\"type\":\"response.completed\",\"response\":{\"status\":\"completed\",\"usage\":{\"input_tokens\":10,\"output_tokens\":20,\"total_tokens\":30}}}\n\ndata: [DONE]\n\n";
    let chunks3 = parser.parse_chunk(part3).unwrap();
    assert_eq!(chunks3.len(), 3);
    assert_eq!(
        chunks3[0].text_delta.as_deref(),
        Some("# End of script")
    );
    assert_eq!(chunks3[1].finish_reason, Some(ProviderFinishReason::Completed));
    assert!(chunks3[1].is_final);
    assert_eq!(chunks3[1].usage.unwrap().total_tokens, Some(30));
    assert!(parser.is_completed());
}

#[test]
fn test_error_mapping_and_retry_after() {
    // 401 Unauthorized
    let err_401 = map_openai_http_error(
        401,
        r#"{"error":{"message":"Incorrect API key provided: sk-test-1234567890abcdef.","type":"invalid_request_error","code":"invalid_api_key"}}"#,
        None,
    );
    assert_eq!(err_401.kind, ProviderErrorKind::AuthenticationFailed);
    assert_eq!(err_401.status_code, Some(401));
    // Verify secret is NOT in message
    assert!(!err_401.message.contains("sk-test-1234567890abcdef"));

    // 429 Rate Limited with Retry-After header
    let err_429 = map_openai_http_error(
        429,
        r#"{"error":{"message":"Rate limit reached for requests","type":"requests","code":"rate_limit_exceeded"}}"#,
        Some("12"),
    );
    assert_eq!(err_429.kind, ProviderErrorKind::RateLimited);
    assert_eq!(err_429.retry_after_ms, Some(12_000));
    assert!(err_429.is_retryable);

    // 429 Insufficient Quota
    let err_quota = map_openai_http_error(
        429,
        r#"{"error":{"message":"You exceeded your current quota, please check your plan.","type":"insufficient_quota","code":"insufficient_quota"}}"#,
        None,
    );
    assert_eq!(err_quota.kind, ProviderErrorKind::QuotaExceeded);

    // 404 Model Not Found
    let err_404 = map_openai_http_error(
        404,
        r#"{"error":{"message":"The model `gpt-nonexistent` does not exist","type":"invalid_request_error","code":"model_not_found"}}"#,
        None,
    );
    assert_eq!(err_404.kind, ProviderErrorKind::ModelNotFound);

    // 400 Context Length Exceeded
    let err_context = map_openai_http_error(
        400,
        r#"{"error":{"message":"This model's maximum context length is 128000 tokens. However, your messages resulted in 130000 tokens.","type":"invalid_request_error","code":"context_length_exceeded"}}"#,
        None,
    );
    assert_eq!(err_context.kind, ProviderErrorKind::ContextLengthExceeded);

    // 503 Provider Unavailable
    let err_503 = map_openai_http_error(503, "The server is currently overloaded.", None);
    assert_eq!(err_503.kind, ProviderErrorKind::ProviderUnavailable);
    assert!(err_503.is_retryable);
}

#[test]
fn test_scrub_openai_secrets_prevents_api_key_leaks() {
    let secret = "sk-proj-1234567890abcdefghijklmnopqrstuvwxyz";
    let leaked_str = format!("Error occurred while authenticating with key {}", secret);
    let sanitized = scrub_openai_secrets(&leaked_str);

    assert!(!sanitized.contains(secret));
    assert!(sanitized.contains("[REDACTED_API_KEY]"));
}

#[tokio::test]
async fn test_client_execute_end_to_end_with_mock_transport() {
    let mock_transport = Arc::new(MockOpenAiTransport::new());
    let test_key = SecretString::new("sk-test-mock-secret-key-12345");

    let client = OpenAiClient::with_transport_and_vault(
        mock_transport.clone(),
        None,
        Some(test_key),
    );

    let req = ProviderRequest {
        model_id: "gpt-4o".to_string(),
        messages: vec![ChatMessage::user("Hello OpenAI")],
        params: GenerationParams::default(),
        metadata: RequestMetadata::new("req_offline_test"),
    };

    let context = TaskContext::default();
    let resp = client.execute(req, &context).await.unwrap();

    assert_eq!(resp.model_id, "gpt-4o");
    assert_eq!(
        resp.text,
        "This is a deterministic mock response from OpenAI Responses API."
    );
    assert_eq!(resp.finish_reason, ProviderFinishReason::Completed);

    // Verify recorded outbound HTTP request
    let recorded = mock_transport.get_recorded_requests();
    assert_eq!(recorded.len(), 1);
    assert_eq!(recorded[0].url, "https://api.openai.com/v1/responses");

    // Verify Authorization header was sent with Bearer
    let auth_header = recorded[0]
        .headers
        .iter()
        .find(|(k, _)| k.to_lowercase() == "authorization")
        .map(|(_, v)| v.as_str());
    assert_eq!(
        auth_header,
        Some("Bearer sk-test-mock-secret-key-12345")
    );
}

#[tokio::test]
async fn test_client_cooperative_cancellation_aborts_before_io() {
    let mock_transport = Arc::new(MockOpenAiTransport::new());
    let client = OpenAiClient::with_transport_and_vault(
        mock_transport.clone(),
        None,
        Some(SecretString::new("sk-test-cancellation")),
    );

    let req = ProviderRequest {
        model_id: "gpt-4o".to_string(),
        messages: vec![ChatMessage::user("Cancelled prompt")],
        params: GenerationParams::default(),
        metadata: RequestMetadata::new("req_cancel_test"),
    };

    let context = TaskContext::default();
    context.cancel(); // Pre-cancelled

    let result = client.execute(req, &context).await;
    assert!(result.is_err());
    let err = result.unwrap_err();
    assert_eq!(err.kind, ProviderErrorKind::Cancelled);

    // Ensure zero requests were sent to transport
    assert_eq!(mock_transport.get_recorded_requests().len(), 0);
}

#[tokio::test]
async fn test_client_streaming_chunks_delivery() {
    let mock_transport = Arc::new(MockOpenAiTransport::new());
    let client = OpenAiClient::with_transport_and_vault(
        mock_transport.clone(),
        None,
        Some(SecretString::new("sk-test-stream")),
    );

    let req = ProviderRequest {
        model_id: "gpt-4o".to_string(),
        messages: vec![ChatMessage::user("Stream to me")],
        params: GenerationParams::default(),
        metadata: RequestMetadata::new("req_stream_test"),
    };

    let context = TaskContext::default();
    let mut collected_text = String::new();
    let mut finished = false;

    client
        .execute_stream_chunks(req, &context, |chunk| {
            if let Some(delta) = chunk.text_delta {
                collected_text.push_str(&delta);
            }
            if chunk.is_final {
                finished = true;
            }
            Ok(())
        })
        .await
        .unwrap();

    assert_eq!(collected_text, "Hello Nano Route");
    assert!(finished);
}

