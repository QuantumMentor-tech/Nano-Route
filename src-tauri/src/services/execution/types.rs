// ============================================================================
// Nano Route - Execution Lifecycle & Cancellation Types
// File: src-tauri/src/services/execution/types.rs
// ============================================================================
// Authoritative data types and state machine contracts for execution lifecycle,
// cooperative cancellation, ownership tracking, and recovery context.
// ============================================================================

use serde::{Deserialize, Serialize};
use tokio_util::sync::CancellationToken;

/// Authoritative execution lifecycle state machine.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExecutionLifecycleState {
    /// Request created and initialized in native execution registry.
    Created,
    /// Request inputs and parameters being validated.
    Validating,
    /// Local SLM intent classification, task analysis, and scoring active.
    Routing,
    /// Final route selected and verified against provider/model registry.
    RouteResolved,
    /// Outbound provider network I/O in flight (non-streaming).
    Executing,
    /// Incremental provider response chunks streaming across IPC Channel.
    Streaming,
    /// Cancellation signal received; actively terminating transport and tasks.
    Cancelling,
    /// Cleanly terminated following cooperative cancellation.
    Cancelled,
    /// Successfully finalized with persisted response and telemetry.
    Completed,
    /// Terminated due to unrecoverable provider or runtime error.
    Failed,
    /// Cleaning up resources and reconciling state after interruption.
    Recovering,
}

impl ExecutionLifecycleState {
    /// Returns true if the request is still actively running or transitioning.
    pub fn is_active(&self) -> bool {
        matches!(
            self,
            Self::Created
                | Self::Validating
                | Self::Routing
                | Self::RouteResolved
                | Self::Executing
                | Self::Streaming
                | Self::Cancelling
                | Self::Recovering
        )
    }

    /// Returns true if the execution has reached an irreversible terminal state.
    pub fn is_terminal(&self) -> bool {
        matches!(self, Self::Cancelled | Self::Completed | Self::Failed)
    }

    /// Returns true if the execution state permits requesting cancellation.
    pub fn can_cancel(&self) -> bool {
        self.is_active() && *self != Self::Cancelling
    }

    /// Validates whether a state transition is legal according to the lifecycle model.
    pub fn can_transition_to(&self, next: Self) -> bool {
        if *self == next {
            return true;
        }

        if self.is_terminal() {
            return false;
        }

        match (self, next) {
            // Forward progression
            (Self::Created, Self::Validating) => true,
            (Self::Validating, Self::Routing) => true,
            (Self::Routing, Self::RouteResolved) => true,
            (Self::RouteResolved, Self::Executing) => true,
            (Self::RouteResolved, Self::Streaming) => true,
            (Self::Executing, Self::Completed) => true,
            (Self::Streaming, Self::Completed) => true,

            // Cancellation paths from any active state
            (Self::Created, Self::Cancelling) => true,
            (Self::Validating, Self::Cancelling) => true,
            (Self::Routing, Self::Cancelling) => true,
            (Self::RouteResolved, Self::Cancelling) => true,
            (Self::Executing, Self::Cancelling) => true,
            (Self::Streaming, Self::Cancelling) => true,
            (Self::Cancelling, Self::Cancelled) => true,
            (Self::Cancelling, Self::Failed) => true,

            // Interruption & recovery / failover paths
            (Self::Executing, Self::Recovering) => true,
            (Self::Streaming, Self::Recovering) => true,
            (Self::Cancelling, Self::Recovering) => true,
            (Self::Recovering, Self::RouteResolved) => true,
            (Self::Recovering, Self::Executing) => true,
            (Self::Recovering, Self::Streaming) => true,
            (Self::Recovering, Self::Cancelled) => true,
            (Self::Recovering, Self::Failed) => true,
            (Self::Recovering, Self::Completed) => true,

            // Failure paths from active states
            (_, Self::Failed) => true,

            _ => false,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Created => "created",
            Self::Validating => "validating",
            Self::Routing => "routing",
            Self::RouteResolved => "route_resolved",
            Self::Executing => "executing",
            Self::Streaming => "streaming",
            Self::Cancelling => "cancelling",
            Self::Cancelled => "cancelled",
            Self::Completed => "completed",
            Self::Failed => "failed",
            Self::Recovering => "recovering",
        }
    }
}

/// Precise reason an execution lifecycle terminated.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TerminationReason {
    /// Explicit user click or keyboard action on "Stop Generation".
    UserCancelled,
    /// Active chat session switched before response completed.
    SessionChanged,
    /// Component or view unmounted during active generation.
    ViewDisposed,
    /// Native core or application shutdown requested.
    ApplicationInterrupted,
    /// Upstream network connection dropped or timed out.
    TransportInterrupted,
    /// Stream Channel closed before terminal Completed event.
    StreamClosed,
    /// Cooperative cancellation token triggered.
    ExecutionAborted,
    /// Upstream AI provider returned an API or HTTP error.
    ProviderFailed,
    /// Unspecified system interruption.
    UnknownInterruption,
}

impl TerminationReason {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::UserCancelled => "user_cancelled",
            Self::SessionChanged => "session_changed",
            Self::ViewDisposed => "view_disposed",
            Self::ApplicationInterrupted => "application_interrupted",
            Self::TransportInterrupted => "transport_interrupted",
            Self::StreamClosed => "stream_closed",
            Self::ExecutionAborted => "execution_aborted",
            Self::ProviderFailed => "provider_failed",
            Self::UnknownInterruption => "unknown_interruption",
        }
    }

    pub fn from_opt_str(val: Option<&str>) -> Self {
        match val {
            Some("user_cancelled") | Some("UserCancelled") => Self::UserCancelled,
            Some("session_changed") | Some("SessionChanged") => Self::SessionChanged,
            Some("view_disposed") | Some("ViewDisposed") => Self::ViewDisposed,
            Some("application_interrupted") | Some("ApplicationInterrupted") => Self::ApplicationInterrupted,
            Some("transport_interrupted") | Some("TransportInterrupted") => Self::TransportInterrupted,
            Some("stream_closed") | Some("StreamClosed") => Self::StreamClosed,
            Some("execution_aborted") | Some("ExecutionAborted") => Self::ExecutionAborted,
            Some("provider_failed") | Some("ProviderFailed") => Self::ProviderFailed,
            Some("unknown_interruption") | Some("UnknownInterruption") => Self::UnknownInterruption,
            _ => Self::UserCancelled,
        }
    }
}

impl Default for TerminationReason {
    fn default() -> Self {
        Self::UserCancelled
    }
}

/// Extensible recovery context capturing terminal execution metadata for Step 35-39.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryContext {
    pub execution_id: String,
    pub session_id: String,
    pub provider_id: Option<String>,
    pub model_id: Option<String>,
    pub stream_id: Option<String>,
    pub termination_reason: TerminationReason,
    pub was_streaming: bool,
    pub started_at_ms: u64,
    pub ended_at_ms: u64,
    pub cancellation_requested: bool,
    pub partial_output_available: bool,
    pub cleanup_completed: bool,
}

/// In-memory execution context holding lifecycle ownership and cancellation primitives.
#[derive(Debug, Clone)]
pub struct ExecutionContext {
    pub execution_id: String,
    pub session_id: String,
    pub request_id: String,
    pub stream_id: Option<String>,
    pub user_message_id: Option<String>,
    pub assistant_message_id: Option<String>,
    pub provider_id: Option<String>,
    pub model_id: Option<String>,
    pub state: ExecutionLifecycleState,
    pub started_at_ms: u64,
    pub ended_at_ms: Option<u64>,
    pub cancellation_token: CancellationToken,
    pub cancellation_requested: bool,
    pub is_streaming: bool,
    pub terminal_finalized: bool,
    pub termination_reason: Option<TerminationReason>,
    pub partial_content: Option<String>,
}

impl ExecutionContext {
    pub fn new(
        execution_id: String,
        session_id: String,
        request_id: String,
        is_streaming: bool,
        started_at_ms: u64,
    ) -> Self {
        Self {
            execution_id,
            session_id,
            request_id,
            stream_id: None,
            user_message_id: None,
            assistant_message_id: None,
            provider_id: None,
            model_id: None,
            state: ExecutionLifecycleState::Created,
            started_at_ms,
            ended_at_ms: None,
            cancellation_token: CancellationToken::new(),
            cancellation_requested: false,
            is_streaming,
            terminal_finalized: false,
            termination_reason: None,
            partial_content: None,
        }
    }
}

/// Result returned from user or session cancellation invocations across the IPC boundary.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CancellationResultDto {
    pub execution_id: String,
    pub session_id: String,
    pub state: ExecutionLifecycleState,
    pub is_already_terminal: bool,
    pub message: String,
}

/// Read-only snapshot of active execution state returned across the IPC boundary.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionStateDto {
    pub execution_id: String,
    pub session_id: String,
    pub state: ExecutionLifecycleState,
    pub is_streaming: bool,
    pub provider_id: Option<String>,
    pub model_id: Option<String>,
    pub cancellation_requested: bool,
    pub started_at_ms: u64,
    pub ended_at_ms: Option<u64>,
}
