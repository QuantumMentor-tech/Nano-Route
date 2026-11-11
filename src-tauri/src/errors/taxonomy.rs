// ============================================================================
// Nano Route - Canonical Error Taxonomy
// File: src-tauri/src/errors/taxonomy.rs
// ============================================================================
// Authoritative, provider-neutral error categories, severities, machine-readable
// codes, and classification hints (Step 36).
// ============================================================================

use serde::{Deserialize, Serialize};
use std::fmt;

/// Authoritative semantic categorization of all application, provider, transport,
/// and local runtime failures.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ErrorCategory {
    /// Intentional user or system cooperative cancellation.
    Cancelled,

    // --- Configuration & Credentials ---
    CredentialMissing,
    CredentialInvalidConfiguration,
    ProviderDisabled,
    EndpointMisconfigured,
    ModelConfigurationInvalid,
    UnsupportedProviderConfiguration,

    // --- Security, Authentication & Authorization ---
    AuthenticationFailed,
    AuthorizationFailed,

    // --- Rate Limiting & Velocity ---
    RateLimited,

    // --- Context & Token Limits ---
    ContextLimitExceeded,
    InputTooLarge,
    OutputLimitExceeded,

    // --- Request Validity & Capabilities ---
    InvalidRequest,
    UnsupportedCapability,

    // --- Availability ---
    ModelUnavailable,
    ProviderUnavailable,

    // --- Network & Transport ---
    NetworkUnreachable,
    DnsResolutionFailed,
    ConnectionFailed,
    TlsFailed,
    ConnectionReset,
    TransportClosed,
    NetworkUnknown,
    Timeout,

    // --- Stream Lifecycle ---
    StreamInterrupted,

    // --- Provider Response & Parsing ---
    MalformedProviderResponse,
    ProviderResponseParseFailed,
    UnexpectedProviderResponse,

    // --- Local SLM / Runtime ---
    LocalModelUnavailable,
    LocalModelLoadFailed,
    LocalInferenceFailed,
    LocalModelInputInvalid,
    LocalModelOutputInvalid,
    LocalModelRuntimeUnavailable,

    // --- Routing System ---
    IntentClassificationFailed,
    TaskAnalysisFailed,
    RoutingScoringFailed,
    RoutingPolicyFailed,
    NoEligibleRoute,

    // --- Persistence & Storage ---
    DatabaseFailure,
    PersistenceFailure,
    ChatHistoryWriteFailed,
    TelemetryWriteFailed,

    // --- Application & Fallback ---
    InternalError,
    Unknown,
}

impl ErrorCategory {
    /// Returns a static string slice representing the error category.
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Cancelled => "cancelled",
            Self::CredentialMissing => "credential_missing",
            Self::CredentialInvalidConfiguration => "credential_invalid_configuration",
            Self::ProviderDisabled => "provider_disabled",
            Self::EndpointMisconfigured => "endpoint_misconfigured",
            Self::ModelConfigurationInvalid => "model_configuration_invalid",
            Self::UnsupportedProviderConfiguration => "unsupported_provider_configuration",
            Self::AuthenticationFailed => "authentication_failed",
            Self::AuthorizationFailed => "authorization_failed",
            Self::RateLimited => "rate_limited",
            Self::ContextLimitExceeded => "context_limit_exceeded",
            Self::InputTooLarge => "input_too_large",
            Self::OutputLimitExceeded => "output_limit_exceeded",
            Self::InvalidRequest => "invalid_request",
            Self::UnsupportedCapability => "unsupported_capability",
            Self::ModelUnavailable => "model_unavailable",
            Self::ProviderUnavailable => "provider_unavailable",
            Self::NetworkUnreachable => "network_unreachable",
            Self::DnsResolutionFailed => "dns_resolution_failed",
            Self::ConnectionFailed => "connection_failed",
            Self::TlsFailed => "tls_failed",
            Self::ConnectionReset => "connection_reset",
            Self::TransportClosed => "transport_closed",
            Self::NetworkUnknown => "network_unknown",
            Self::Timeout => "timeout",
            Self::StreamInterrupted => "stream_interrupted",
            Self::MalformedProviderResponse => "malformed_provider_response",
            Self::ProviderResponseParseFailed => "provider_response_parse_failed",
            Self::UnexpectedProviderResponse => "unexpected_provider_response",
            Self::LocalModelUnavailable => "local_model_unavailable",
            Self::LocalModelLoadFailed => "local_model_load_failed",
            Self::LocalInferenceFailed => "local_inference_failed",
            Self::LocalModelInputInvalid => "local_model_input_invalid",
            Self::LocalModelOutputInvalid => "local_model_output_invalid",
            Self::LocalModelRuntimeUnavailable => "local_model_runtime_unavailable",
            Self::IntentClassificationFailed => "intent_classification_failed",
            Self::TaskAnalysisFailed => "task_analysis_failed",
            Self::RoutingScoringFailed => "routing_scoring_failed",
            Self::RoutingPolicyFailed => "routing_policy_failed",
            Self::NoEligibleRoute => "no_eligible_route",
            Self::DatabaseFailure => "database_failure",
            Self::PersistenceFailure => "persistence_failure",
            Self::ChatHistoryWriteFailed => "chat_history_write_failed",
            Self::TelemetryWriteFailed => "telemetry_write_failed",
            Self::InternalError => "internal_error",
            Self::Unknown => "unknown",
        }
    }

    /// Default canonical machine-readable error code for this category.
    pub fn default_code(&self) -> &'static str {
        match self {
            Self::Cancelled => "CANCELLED",
            Self::CredentialMissing => "CREDENTIAL_MISSING",
            Self::CredentialInvalidConfiguration => "CREDENTIAL_INVALID_CONFIGURATION",
            Self::ProviderDisabled => "PROVIDER_DISABLED",
            Self::EndpointMisconfigured => "ENDPOINT_MISCONFIGURED",
            Self::ModelConfigurationInvalid => "MODEL_CONFIGURATION_INVALID",
            Self::UnsupportedProviderConfiguration => "UNSUPPORTED_PROVIDER_CONFIGURATION",
            Self::AuthenticationFailed => "AUTHENTICATION_FAILED",
            Self::AuthorizationFailed => "AUTHORIZATION_FAILED",
            Self::RateLimited => "RATE_LIMITED",
            Self::ContextLimitExceeded => "CONTEXT_LIMIT_EXCEEDED",
            Self::InputTooLarge => "INPUT_TOO_LARGE",
            Self::OutputLimitExceeded => "OUTPUT_LIMIT_EXCEEDED",
            Self::InvalidRequest => "INVALID_REQUEST",
            Self::UnsupportedCapability => "UNSUPPORTED_CAPABILITY",
            Self::ModelUnavailable => "MODEL_UNAVAILABLE",
            Self::ProviderUnavailable => "PROVIDER_UNAVAILABLE",
            Self::NetworkUnreachable => "NETWORK_UNREACHABLE",
            Self::DnsResolutionFailed => "DNS_RESOLUTION_FAILED",
            Self::ConnectionFailed => "CONNECTION_FAILED",
            Self::TlsFailed => "TLS_FAILED",
            Self::ConnectionReset => "CONNECTION_RESET",
            Self::TransportClosed => "TRANSPORT_CLOSED",
            Self::NetworkUnknown => "NETWORK_UNKNOWN",
            Self::Timeout => "TIMEOUT",
            Self::StreamInterrupted => "STREAM_INTERRUPTED",
            Self::MalformedProviderResponse => "MALFORMED_PROVIDER_RESPONSE",
            Self::ProviderResponseParseFailed => "PROVIDER_RESPONSE_PARSE_FAILED",
            Self::UnexpectedProviderResponse => "UNEXPECTED_PROVIDER_RESPONSE",
            Self::LocalModelUnavailable => "LOCAL_MODEL_UNAVAILABLE",
            Self::LocalModelLoadFailed => "LOCAL_MODEL_LOAD_FAILED",
            Self::LocalInferenceFailed => "LOCAL_INFERENCE_FAILED",
            Self::LocalModelInputInvalid => "LOCAL_MODEL_INPUT_INVALID",
            Self::LocalModelOutputInvalid => "LOCAL_MODEL_OUTPUT_INVALID",
            Self::LocalModelRuntimeUnavailable => "LOCAL_MODEL_RUNTIME_UNAVAILABLE",
            Self::IntentClassificationFailed => "INTENT_CLASSIFICATION_FAILED",
            Self::TaskAnalysisFailed => "TASK_ANALYSIS_FAILED",
            Self::RoutingScoringFailed => "ROUTING_SCORING_FAILED",
            Self::RoutingPolicyFailed => "ROUTING_POLICY_FAILED",
            Self::NoEligibleRoute => "NO_ELIGIBLE_ROUTE",
            Self::DatabaseFailure => "DATABASE_FAILURE",
            Self::PersistenceFailure => "PERSISTENCE_FAILURE",
            Self::ChatHistoryWriteFailed => "CHAT_HISTORY_WRITE_FAILED",
            Self::TelemetryWriteFailed => "TELEMETRY_WRITE_FAILED",
            Self::InternalError => "INTERNAL_ERROR",
            Self::Unknown => "UNKNOWN_ERROR",
        }
    }

    /// Default operational severity.
    pub fn default_severity(&self) -> ErrorSeverity {
        match self {
            Self::Cancelled => ErrorSeverity::Info,
            Self::RateLimited => ErrorSeverity::Warning,
            Self::Timeout
            | Self::StreamInterrupted
            | Self::NetworkUnreachable
            | Self::DnsResolutionFailed
            | Self::ConnectionFailed
            | Self::TlsFailed
            | Self::ConnectionReset
            | Self::TransportClosed
            | Self::NetworkUnknown
            | Self::ProviderUnavailable => ErrorSeverity::Warning,
            Self::CredentialMissing
            | Self::CredentialInvalidConfiguration
            | Self::ProviderDisabled
            | Self::EndpointMisconfigured
            | Self::ModelConfigurationInvalid
            | Self::UnsupportedProviderConfiguration
            | Self::AuthenticationFailed
            | Self::AuthorizationFailed
            | Self::ContextLimitExceeded
            | Self::InputTooLarge
            | Self::OutputLimitExceeded
            | Self::InvalidRequest
            | Self::UnsupportedCapability
            | Self::ModelUnavailable
            | Self::MalformedProviderResponse
            | Self::ProviderResponseParseFailed
            | Self::UnexpectedProviderResponse
            | Self::IntentClassificationFailed
            | Self::TaskAnalysisFailed
            | Self::RoutingScoringFailed
            | Self::RoutingPolicyFailed
            | Self::NoEligibleRoute
            | Self::DatabaseFailure
            | Self::PersistenceFailure
            | Self::ChatHistoryWriteFailed
            | Self::TelemetryWriteFailed
            | Self::InternalError
            | Self::Unknown => ErrorSeverity::Error,
            Self::LocalModelLoadFailed
            | Self::LocalInferenceFailed
            | Self::LocalModelRuntimeUnavailable => ErrorSeverity::Critical,
            Self::LocalModelUnavailable
            | Self::LocalModelInputInvalid
            | Self::LocalModelOutputInvalid => ErrorSeverity::Error,
        }
    }

    /// Informational retryability hint (Step 36 does NOT execute retries).
    pub fn default_retryability(&self) -> RetryabilityHint {
        match self {
            Self::Cancelled => RetryabilityHint::NotApplicable,
            Self::RateLimited
            | Self::ProviderUnavailable
            | Self::NetworkUnreachable
            | Self::ConnectionFailed
            | Self::ConnectionReset
            | Self::TransportClosed
            | Self::NetworkUnknown
            | Self::Timeout
            | Self::StreamInterrupted => RetryabilityHint::LikelyTransient,

            Self::CredentialMissing
            | Self::CredentialInvalidConfiguration
            | Self::ProviderDisabled
            | Self::EndpointMisconfigured
            | Self::ModelConfigurationInvalid
            | Self::UnsupportedProviderConfiguration
            | Self::AuthenticationFailed
            | Self::AuthorizationFailed
            | Self::ContextLimitExceeded
            | Self::InputTooLarge
            | Self::OutputLimitExceeded
            | Self::InvalidRequest
            | Self::UnsupportedCapability => RetryabilityHint::UserActionRequired,

            Self::ModelUnavailable
            | Self::MalformedProviderResponse
            | Self::ProviderResponseParseFailed
            | Self::UnexpectedProviderResponse
            | Self::IntentClassificationFailed
            | Self::TaskAnalysisFailed
            | Self::RoutingScoringFailed
            | Self::RoutingPolicyFailed
            | Self::NoEligibleRoute
            | Self::DatabaseFailure
            | Self::PersistenceFailure
            | Self::ChatHistoryWriteFailed
            | Self::TelemetryWriteFailed => RetryabilityHint::LikelyPermanent,

            Self::DnsResolutionFailed
            | Self::TlsFailed
            | Self::LocalModelUnavailable
            | Self::LocalModelLoadFailed
            | Self::LocalInferenceFailed
            | Self::LocalModelInputInvalid
            | Self::LocalModelOutputInvalid
            | Self::LocalModelRuntimeUnavailable
            | Self::InternalError
            | Self::Unknown => RetryabilityHint::Unknown,
        }
    }

    /// Informational failover hint (Step 36 does NOT execute failovers).
    pub fn default_failover(&self) -> FailoverHint {
        match self {
            Self::Cancelled => FailoverHint::NotApplicable,
            Self::RateLimited
            | Self::ProviderUnavailable
            | Self::ModelUnavailable
            | Self::NetworkUnreachable
            | Self::ConnectionFailed
            | Self::Timeout
            | Self::StreamInterrupted
            | Self::ProviderDisabled
            | Self::EndpointMisconfigured => FailoverHint::PotentiallyEligible,

            Self::InvalidRequest
            | Self::ContextLimitExceeded
            | Self::InputTooLarge
            | Self::OutputLimitExceeded
            | Self::UnsupportedCapability
            | Self::DatabaseFailure
            | Self::PersistenceFailure
            | Self::ChatHistoryWriteFailed
            | Self::TelemetryWriteFailed => FailoverHint::UsuallyNotEligible,

            _ => FailoverHint::Unknown,
        }
    }

    /// Recommended user-level action guidance.
    pub fn default_user_action(&self) -> UserAction {
        match self {
            Self::Cancelled => UserAction::None,
            Self::CredentialMissing => UserAction::ConfigureProvider,
            Self::CredentialInvalidConfiguration | Self::AuthenticationFailed => {
                UserAction::UpdateCredential
            }
            Self::AuthorizationFailed => UserAction::CheckProviderAccess,
            Self::RateLimited | Self::Timeout => UserAction::WaitAndRetryLater,
            Self::ContextLimitExceeded | Self::InputTooLarge => UserAction::ReduceInput,
            Self::UnsupportedCapability => UserAction::ChangeUnsupportedOption,
            Self::NetworkUnreachable
            | Self::DnsResolutionFailed
            | Self::ConnectionFailed
            | Self::ConnectionReset => UserAction::CheckNetwork,
            Self::ProviderUnavailable => UserAction::ContactProvider,
            _ => UserAction::None,
        }
    }
}

impl fmt::Display for ErrorCategory {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Operational severity level of an error.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ErrorSeverity {
    Info,
    Warning,
    Error,
    Critical,
}

impl ErrorSeverity {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Info => "info",
            Self::Warning => "warning",
            Self::Error => "error",
            Self::Critical => "critical",
        }
    }
}

/// Informational classification hint on whether an error is transient, permanent,
/// or requires human intervention.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RetryabilityHint {
    Unknown,
    NotApplicable,
    LikelyTransient,
    LikelyPermanent,
    UserActionRequired,
}

/// Informational classification hint on whether an error might be candidates for
/// a secondary provider failover in Step 37.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FailoverHint {
    Unknown,
    PotentiallyEligible,
    UsuallyNotEligible,
    NotApplicable,
}

/// Recommended next action guidance for the user.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UserAction {
    None,
    ConfigureProvider,
    UpdateCredential,
    CheckProviderAccess,
    ReduceInput,
    ChangeUnsupportedOption,
    WaitAndRetryLater,
    CheckNetwork,
    ContactProvider,
}

/// Classification provenance tracking which layer/signal determined the error category.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ClassificationProvenance {
    ProviderSpecific,
    HttpStatus,
    Transport,
    StreamProtocol,
    LocalRuntime,
    Routing,
    Persistence,
    Application,
    Cancellation,
    FallbackUnknown,
}

