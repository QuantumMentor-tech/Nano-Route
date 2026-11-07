// ============================================================================
// Nano Route - Telemetry Domain Models
// File: src-tauri/src/domain/telemetry.rs
// ============================================================================
// Core business entities and value objects for operational observation.
// Preserves normalized telemetry facts without sensitive prompts or secrets.
// ============================================================================

use serde::{Deserialize, Serialize};

/// High-level categories of observable operational events.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TelemetryEventType {
    RoutingDecision,
    ProviderExecution,
    StreamLifecycle,
    FallbackTransition,
    SystemEvent,
}

impl TelemetryEventType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::RoutingDecision => "routing_decision",
            Self::ProviderExecution => "provider_execution",
            Self::StreamLifecycle => "stream_lifecycle",
            Self::FallbackTransition => "fallback_transition",
            Self::SystemEvent => "system_event",
        }
    }

    pub fn from_str(s: &str) -> Result<Self, String> {
        match s.trim().to_lowercase().as_str() {
            "routing_decision" => Ok(Self::RoutingDecision),
            "provider_execution" => Ok(Self::ProviderExecution),
            "stream_lifecycle" => Ok(Self::StreamLifecycle),
            "fallback_transition" => Ok(Self::FallbackTransition),
            "system_event" => Ok(Self::SystemEvent),
            other => Err(format!(
                "Invalid event type '{}'. Allowed: routing_decision, provider_execution, stream_lifecycle, fallback_transition, system_event",
                other
            )),
        }
    }
}

/// Normalized operational outcome classification.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TelemetryOutcome {
    Success,
    Failure,
    Cancelled,
    Timeout,
    RateLimited,
    Unavailable,
    Fallback,
}

impl TelemetryOutcome {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Success => "success",
            Self::Failure => "failure",
            Self::Cancelled => "cancelled",
            Self::Timeout => "timeout",
            Self::RateLimited => "rate_limited",
            Self::Unavailable => "unavailable",
            Self::Fallback => "fallback",
        }
    }

    pub fn from_str(s: &str) -> Result<Self, String> {
        match s.trim().to_lowercase().as_str() {
            "success" => Ok(Self::Success),
            "failure" => Ok(Self::Failure),
            "cancelled" => Ok(Self::Cancelled),
            "timeout" => Ok(Self::Timeout),
            "rate_limited" => Ok(Self::RateLimited),
            "unavailable" => Ok(Self::Unavailable),
            "fallback" => Ok(Self::Fallback),
            other => Err(format!(
                "Invalid outcome '{}'. Allowed: success, failure, cancelled, timeout, rate_limited, unavailable, fallback",
                other
            )),
        }
    }
}

/// A durable, structured operational telemetry observation record.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryRecord {
    pub id: String,
    pub event_type: TelemetryEventType,
    pub occurred_at: i64,
    pub session_id: Option<String>,
    pub message_id: Option<String>,
    pub task_id: Option<String>,
    pub stream_id: Option<String>,
    pub provider_id: Option<String>,
    pub model_id: Option<String>,
    pub outcome: TelemetryOutcome,
    pub error_code: Option<String>,
    pub latency_ms: Option<u64>,
    pub prompt_tokens: Option<u32>,
    pub completion_tokens: Option<u32>,
    pub cost_usd: Option<f64>,
    pub confidence: Option<f64>,
    pub routing_reason: Option<String>,
}

/// Filter criteria for querying operational telemetry records.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryFilter {
    pub start_time: Option<i64>,
    pub end_time: Option<i64>,
    pub session_id: Option<String>,
    pub provider_id: Option<String>,
    pub model_id: Option<String>,
    pub event_type: Option<TelemetryEventType>,
    pub outcome: Option<TelemetryOutcome>,
}

/// Aggregated operational metrics computed across filtered telemetry facts.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryAggregateReport {
    pub total_events: u64,
    pub successful_events: u64,
    pub failed_events: u64,
    pub total_prompt_tokens: u64,
    pub total_completion_tokens: u64,
    pub total_cost_usd: f64,
    pub avg_latency_ms: Option<f64>,
    pub min_latency_ms: Option<u64>,
    pub max_latency_ms: Option<u64>,
}

