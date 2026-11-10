// ============================================================================
// Nano Route - Anthropic Provider Unit Test Suite
// File: src-tauri/src/providers/anthropic/tests.rs
// ============================================================================
// Exhaustive offline tests covering Messages API request formatting,
// top-level system prompt extraction, response deserialization, SSE framing,
// whitespace preservation, error mapping, DPAPI secret hygiene, and cooperative cancellation.
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
fn test_request_mapping_single_and_multi_turn_with_system_extraction() {
    let req = ProviderRequest {
        model_id: "claude-3-5-sonnet-20241022".to_string(),
        messages: vec![
            ChatMessage::system("You are an expert Rust systems programmer."),
            ChatMessage::user("What is RAII in Rust?"),
            ChatMessage::assistant("Resource Acquisition Is Initialization."),
            ChatMessage::user("How does it relate to Drop?"),
        ],
        params: GenerationParams {
            temperature: Some(0.3),
            max_tokens: Some(2048),
            top_p: Some(0.9),
            stop_sequences: Vec::new(),
        },
        metadata: RequestMetadata::new("req_ant_01"),
    };

    let anthropic_req = AnthropicMessagesRequest::from_provider_request(&req, false).unwrap();
    assert_eq!(anthropic_req.model, "claude-3-5-sonnet-20241022");
    assert_eq!(anthropic_req.max_tokens, 2048);
    assert_eq!(
        anthropic_req.system.as_deref(),
        Some("You are an expert Rust systems programmer.")
    );
    assert_eq!(anthropic_req.stream, None);
    assert_eq!(anthropic_req.temperature, Some(0.3));
    assert_eq!(anthropic_req.top_p, Some(0.9));

    // System prompt must NOT be in the messages array
    assert_eq!(anthropic_req.messages.len(), 3);
    assert_eq!(anthropic_req.messages[0].role, "user");
    assert_eq!(anthropic_req.messages[0].content, "What is RAII in Rust?");
    assert_eq!(anthropic_req.messages[1].role, "assistant");
    assert_eq!(anthropic_req.messages[2].role, "user");
}

#[test]
fn test_request_mapping_defaults_max_tokens_when_omitted() {
    let req = ProviderRequest {
        model_id: "claude-3-5-haiku-20241022".to_string(),
        messages: vec![ChatMessage::user("Explain concurrency.")],
        params: GenerationParams::default(),
        metadata: RequestMetadata::new("req_ant_default_tokens"),
    };

    let anthropic_req = AnthropicMessagesRequest::from_provider_request(&req, false).unwrap();
    assert_eq!(anthropic_req.max_tokens, 4096);
    assert_eq!(anthropic_req.system, None);
    assert_eq!(anthropic_req.messages.len(), 1);
}

#[test]
fn test_request_validation_rejects_empty_model_or_messages() {
    let empty_model = ProviderRequest {
        model_id: "   ".to_string(),
        messages: vec![ChatMessage::user("Hello")],
        params: GenerationParams::default(),
        metadata: RequestMetadata::new("req_empty_model"),
    };
    let err = AnthropicMessagesRequest::from_provider_request(&empty_model, false).unwrap_err();
    assert_eq!(err.kind, ProviderErrorKind::InvalidRequest);

    let empty_messages = ProviderRequest {
        model_id: "claude-3-5-sonnet-20241022".to_string(),
        messages: Vec::new(),
        params: GenerationParams::default(),
        metadata: RequestMetadata::new("req_empty_msgs"),
    };
    let err = AnthropicMessagesRequest::from_provider_request(&empty_messages, false).unwrap_err();
    assert_eq!(err.kind, ProviderErrorKind::InvalidRequest);
}

#[test]
fn test_response_parsing_concatenates_multiple_text_blocks() {
    let raw_json = r#"{
        "id": "msg_01X9DsxDc2r2v66wfG2usviR",
        "type": "message",
        "role": "assistant",
        "model": "claude-3-5-sonnet-20241022",
        "content": [
            {
                "type": "text",
                "text": "Part 1 of the explanation.\n"
            },
            {
                "type": "text",
                "text": "Part 2 with code examples."
            }
        ],
        "stop_reason": "end_turn",
        "stop_sequence": null,
        "usage": {
            "input_tokens": 45,
            "output_tokens": 28,
            "cache_creation_input_tokens": 10,
            "cache_read_input_tokens": 5
        }
    }"#;

    let parsed: AnthropicMessagesResponse = serde_json::from_str(raw_json).unwrap();
    let resp = parsed
        .into_provider_response("req_test".to_string(), "claude-3-5-sonnet-20241022", 185)
        .unwrap();

    assert_eq!(resp.model_id, "claude-3-5-sonnet-20241022");
    assert_eq!(
        resp.text,
        "Part 1 of the explanation.\nPart 2 with code examples."
    );
    assert_eq!(resp.finish_reason, ProviderFinishReason::Completed);
    assert_eq!(resp.metadata.latency_ms, 185);
    assert_eq!(
        resp.metadata.provider_model_id,
        "claude-3-5-sonnet-20241022"
    );

    let usage = resp.usage.unwrap();
    assert_eq!(usage.input_tokens, Some(45));
    assert_eq!(usage.output_tokens, Some(28));
    assert_eq!(usage.total_tokens, Some(73));
    assert_eq!(usage.cache_read_tokens, Some(5));
    assert_eq!(usage.cache_write_tokens, Some(10));
}

#[test]
fn test_response_stop_reason_mapping() {
    let test_cases = [
        ("end_turn", ProviderFinishReason::Completed),
        ("max_tokens", ProviderFinishReason::LengthLimit),
        ("stop_sequence", ProviderFinishReason::Completed),
        ("tool_use", ProviderFinishReason::ToolCall),
        ("unknown_reason", ProviderFinishReason::Completed),
    ];

    for (reason_str, expected_reason) in test_cases {
        let json = format!(
            r#"{{"id":"msg_1","type":"message","role":"assistant","content":[],"stop_reason":"{}"}}"#,
            reason_str
        );
        let parsed: AnthropicMessagesResponse = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.resolve_finish_reason(), expected_reason);
    }
}

#[test]
fn test_sse_streaming_parser_split_chunks_and_usage_tracking() {
    let mut parser = AnthropicSseParser::new();

    // Chunk 1: message_start split across read
    let part1 = "event: message_start\ndata: {\"type\":\"message_start\",\"message\":{\"id\":\"msg_strm_1\",\"type\":\"message\",\"role\":\"assistant\",\"model\":\"claude-3-5-sonnet-20241022\",\"content\":[],\"usage\":{\"input_tokens\":32,\"output_tokens\":1}}}\n\nevent: content_block_delta\nda";
    let chunks1 = parser.parse_chunk(part1).unwrap();
    assert_eq!(chunks1.len(), 0);

    // Chunk 2: Finish content_block_delta with whitespace preservation
    let part2 = "ta: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"  fn anthropic_route() {\\n    println!(\\\"OK\\\");\\n  }\"}}\n\n";
    let chunks2 = parser.parse_chunk(part2).unwrap();
    assert_eq!(chunks2.len(), 1);
    assert_eq!(
        chunks2[0].text_delta.as_deref(),
        Some("  fn anthropic_route() {\n    println!(\"OK\");\n  }")
    );

    // Chunk 3: ping event, message_delta, and message_stop
    let part3 = "event: ping\ndata: {\"type\":\"ping\"}\n\nevent: message_delta\ndata: {\"type\":\"message_delta\",\"delta\":{\"stop_reason\":\"end_turn\",\"stop_sequence\":null},\"usage\":{\"output_tokens\":20}}\n\nevent: message_stop\ndata: {\"type\":\"message_stop\"}\n\n";
    let chunks3 = parser.parse_chunk(part3).unwrap();
    assert_eq!(chunks3.len(), 1);
    assert_eq!(chunks3[0].finish_reason, Some(ProviderFinishReason::Completed));
    assert!(chunks3[0].is_final);

    let usage = chunks3[0].usage.unwrap();
    assert_eq!(usage.input_tokens, Some(32));
    assert_eq!(usage.output_tokens, Some(20));
    assert_eq!(usage.total_tokens, Some(52));
    assert!(parser.is_completed());
}

#[test]
fn test_error_mapping_status_codes_and_retry_after() {
    // 401 Authentication Failure
    let err_401 = map_anthropic_http_error(
        401,
        r#"{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key: sk-ant-api03-1234567890abcdef."}}"#,
        None,
    );
    assert_eq!(err_401.kind, ProviderErrorKind::AuthenticationFailed);
    assert_eq!(err_401.status_code, Some(401));
    assert!(!err_401.message.contains("sk-ant-api03-1234567890abcdef"));

    // 429 Rate Limited with Retry-After header
    let err_429 = map_anthropic_http_error(
        429,
        r#"{"type":"error","error":{"type":"rate_limit_error","message":"Number of request tokens has exceeded your per-minute rate limit."}}"#,
        Some("20"),
    );
    assert_eq!(err_429.kind, ProviderErrorKind::RateLimited);
    assert_eq!(err_429.retry_after_ms, Some(20_000));
    assert!(err_429.is_retryable);

    // 413 Request Too Large
    let err_413 = map_anthropic_http_error(
        413,
        r#"{"type":"error","error":{"type":"request_too_large","message":"Request exceeds maximum size limit."}}"#,
        None,
    );
    assert_eq!(err_413.kind, ProviderErrorKind::ContextLengthExceeded);

    // 529 Overloaded Error
    let err_529 = map_anthropic_http_error(
        529,
        r#"{"type":"error","error":{"type":"overloaded_error","message":"Anthropic is temporarily overloaded. Please try again later."}}"#,
        Some("5"),
    );
    assert_eq!(err_529.kind, ProviderErrorKind::ProviderUnavailable);
    assert_eq!(err_529.status_code, Some(529));
    assert_eq!(err_529.retry_after_ms, Some(5_000));
    assert!(err_529.is_retryable);
}

#[test]
fn test_scrub_anthropic_secrets_prevents_api_key_leaks() {
    let secret = "sk-ant-api03-secret-key-1234567890abcdef";
    let leaked_str = format!("Failed to authenticate with token {}", secret);
    let sanitized = scrub_anthropic_secrets(&leaked_str);

    assert!(!sanitized.contains(secret));
    assert!(sanitized.contains("[REDACTED_API_KEY]"));
}

#[tokio::test]
async fn test_client_execute_end_to_end_with_mock_transport() {
    let mock_transport = Arc::new(MockAnthropicTransport::new());
    let test_key = SecretString::new("sk-ant-test-mock-secret-key");

    let client = AnthropicClient::with_transport_and_vault(
        mock_transport.clone(),
        None,
        Some(test_key),
    );

    let req = ProviderRequest {
        model_id: "claude-3-5-sonnet-20241022".to_string(),
        messages: vec![ChatMessage::user("Hello Anthropic")],
        params: GenerationParams::default(),
        metadata: RequestMetadata::new("req_offline_ant"),
    };

    let context = TaskContext::default();
    let resp = client.execute(req, &context).await.unwrap();

    assert_eq!(resp.model_id, "claude-3-5-sonnet-20241022");
    assert_eq!(
        resp.text,
        "This is a deterministic mock response from Anthropic Messages API."
    );
    assert_eq!(resp.finish_reason, ProviderFinishReason::Completed);

    // Verify recorded outbound HTTP request
    let recorded = mock_transport.get_recorded_requests();
    assert_eq!(recorded.len(), 1);
    assert_eq!(recorded[0].url, "https://api.anthropic.com/v1/messages");

    // Verify headers: x-api-key and anthropic-version
    let key_header = recorded[0]
        .headers
        .iter()
        .find(|(k, _)| k.to_lowercase() == "x-api-key")
        .map(|(_, v)| v.as_str());
    assert_eq!(key_header, Some("sk-ant-test-mock-secret-key"));

    let version_header = recorded[0]
        .headers
        .iter()
        .find(|(k, _)| k.to_lowercase() == "anthropic-version")
        .map(|(_, v)| v.as_str());
    assert_eq!(version_header, Some(ANTHROPIC_API_VERSION));
}

#[tokio::test]
async fn test_client_cooperative_cancellation_aborts_before_io() {
    let mock_transport = Arc::new(MockAnthropicTransport::new());
    let client = AnthropicClient::with_transport_and_vault(
        mock_transport.clone(),
        None,
        Some(SecretString::new("sk-ant-cancellation")),
    );

    let req = ProviderRequest {
        model_id: "claude-3-5-sonnet-20241022".to_string(),
        messages: vec![ChatMessage::user("Cancelled prompt")],
        params: GenerationParams::default(),
        metadata: RequestMetadata::new("req_cancel_ant"),
    };

    let context = TaskContext::default();
    context.cancel(); // Pre-cancelled

    let result = client.execute(req, &context).await;
    assert!(result.is_err());
    let err = result.unwrap_err();
    assert_eq!(err.kind, ProviderErrorKind::Cancelled);

    assert_eq!(mock_transport.get_recorded_requests().len(), 0);
}

#[tokio::test]
async fn test_client_streaming_chunks_delivery() {
    let mock_transport = Arc::new(MockAnthropicTransport::new());
    let client = AnthropicClient::with_transport_and_vault(
        mock_transport.clone(),
        None,
        Some(SecretString::new("sk-ant-stream-key")),
    );

    let req = ProviderRequest {
        model_id: "claude-3-5-sonnet-20241022".to_string(),
        messages: vec![ChatMessage::user("Stream to me")],
        params: GenerationParams::default(),
        metadata: RequestMetadata::new("req_stream_ant"),
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

    assert_eq!(collected_text, "Hello Claude");
    assert!(finished);
}

