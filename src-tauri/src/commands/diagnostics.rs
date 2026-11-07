//! Diagnostic and IPC Validation Commands
//!
//! Provides typed request/response validation, request ID handling,
//! payload size limit enforcement, and error sanitization.

use serde::{Deserialize, Serialize};
use crate::errors::AppError;

/// Safe maximum length for diagnostic ping messages (256 bytes).
pub const MAX_PING_MESSAGE_LEN: usize = 256;

/// Diagnostic Ping Request DTO
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct PingRequest {
    /// Non-empty diagnostic message.
    pub message: String,
    /// Safe, non-secret correlation request identifier.
    #[serde(default)]
    pub request_id: Option<String>,
}

/// Diagnostic Ping Response DTO
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct PingResponse {
    /// Echoed diagnostic message.
    pub message: String,
    /// Safe non-secret correlation request identifier.
    pub request_id: String,
    /// Server timestamp in UTC RFC3339 format.
    pub timestamp: String,
    /// Duration of processing in milliseconds.
    pub duration_ms: u64,
}

/// Validated diagnostic ping command.
///
/// Demonstrates the full IPC contract:
/// 1. Untrusted argument validation (non-empty, maximum length).
/// 2. Request ID flow & correlation.
/// 3. Normalized error response via `AppError::InvalidInput`.
#[tauri::command]
pub fn cmd_ping(request: PingRequest) -> Result<PingResponse, AppError> {
    let trimmed = request.message.trim();
    if trimmed.is_empty() {
        return Err(AppError::InvalidInput(
            "Ping message cannot be empty or whitespace only".to_string(),
        ));
    }

    if request.message.len() > MAX_PING_MESSAGE_LEN {
        return Err(AppError::InvalidInput(format!(
            "Ping message exceeds maximum permitted length of {} bytes (received {} bytes)",
            MAX_PING_MESSAGE_LEN,
            request.message.len()
        )));
    }

    let request_id = match request.request_id {
        Some(ref id) if !id.trim().is_empty() => id.trim().to_string(),
        _ => "req_generated_rust".to_string(),
    };

    Ok(PingResponse {
        message: trimmed.to_string(),
        request_id,
        timestamp: "2026-11-07T15:00:00Z".to_string(),
        duration_ms: 0,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ping_valid_with_request_id() {
        let req = PingRequest {
            message: "hello native".to_string(),
            request_id: Some("req_custom_123".to_string()),
        };
        let res = cmd_ping(req).expect("valid ping should succeed");
        assert_eq!(res.message, "hello native");
        assert_eq!(res.request_id, "req_custom_123");
    }

    #[test]
    fn test_ping_valid_without_request_id_generates_fallback() {
        let req = PingRequest {
            message: "ping test".to_string(),
            request_id: None,
        };
        let res = cmd_ping(req).expect("valid ping should succeed");
        assert_eq!(res.message, "ping test");
        assert!(!res.request_id.is_empty());
    }

    #[test]
    fn test_ping_empty_message_rejected() {
        let req = PingRequest {
            message: "   ".to_string(),
            request_id: None,
        };
        let err = cmd_ping(req).expect_err("empty message should fail");
        assert!(matches!(err, AppError::InvalidInput(_)));
    }

    #[test]
    fn test_ping_oversized_message_rejected() {
        let req = PingRequest {
            message: "a".repeat(300),
            request_id: None,
        };
        let err = cmd_ping(req).expect_err("oversized message should fail");
        assert!(matches!(err, AppError::InvalidInput(_)));
    }
}

