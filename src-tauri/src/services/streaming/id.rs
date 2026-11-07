// ============================================================================
// Nano Route - Stream Identifier Contract
// File: src-tauri/src/services/streaming/id.rs
// ============================================================================
// Strongly-typed correlation identifier for streaming execution lifecycles.
// Distinct from RequestId (IPC correlation) and TaskId (async task unit).
// Guarantees zero credential leakage and safe serialization.
// ============================================================================

use crate::errors::AppError;
use serde::{Deserialize, Serialize};
use std::fmt;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

static STREAM_COUNTER: AtomicU64 = AtomicU64::new(1);

/// Strongly-typed identifier representing a unique streaming session.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct StreamId(String);

impl StreamId {
    /// Generates a new unique StreamId using timestamp and monotonic counter.
    /// Format: `strm_<epoch_ms>_<counter>`
    pub fn generate() -> Self {
        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);
        let count = STREAM_COUNTER.fetch_add(1, Ordering::Relaxed);
        Self(format!("strm_{}_{}", now_ms, count))
    }

    /// Constructs a StreamId from an existing validated string.
    pub fn parse(s: impl Into<String>) -> Result<Self, AppError> {
        let val = s.into();
        let trimmed = val.trim();

        if trimmed.is_empty() {
            return Err(AppError::InvalidInput("StreamId cannot be empty".to_string()));
        }

        if trimmed.len() < 3 || trimmed.len() > 64 {
            return Err(AppError::InvalidInput(format!(
                "StreamId length must be between 3 and 64 characters; got {}",
                trimmed.len()
            )));
        }

        // Must start with alphanumeric and contain only valid slug chars
        let is_valid = trimmed.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-');
        if !is_valid {
            return Err(AppError::InvalidInput(
                "StreamId contains invalid characters; must be alphanumeric, underscore, or hyphen".to_string(),
            ));
        }

        Ok(Self(trimmed.to_string()))
    }

    /// Returns a borrowed slice of the inner identifier string.
    #[inline]
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for StreamId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl AsRef<str> for StreamId {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stream_id_generation() {
        let s1 = StreamId::generate();
        let s2 = StreamId::generate();
        assert!(s1.as_str().starts_with("strm_"));
        assert!(s2.as_str().starts_with("strm_"));
        assert_ne!(s1, s2);
    }

    #[test]
    fn test_stream_id_validation() {
        assert!(StreamId::parse("strm_valid_123").is_ok());
        assert!(StreamId::parse("test-stream-abc").is_ok());

        assert!(StreamId::parse("").is_err());
        assert!(StreamId::parse("a").is_err()); // too short
        assert!(StreamId::parse("bad id with spaces").is_err());
        assert!(StreamId::parse("bad@id!").is_err());
    }
}

