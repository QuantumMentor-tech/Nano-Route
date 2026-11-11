// ============================================================================
// Nano Route - Chat Request Orchestrator Service
// File: src-tauri/src/services/chat_orchestrator.rs
// ============================================================================
// Core application service executing the end-to-end prompt submission workflow.
// Orchestrates:
//   Request Validation → Session Resolution → User Message Persistence →
//   Task Analysis (Intent + Complexity + Domain + Capabilities) →
//   Candidate Scoring & Routing Policy → Final Route Revalidation →
//   Conversation Context Assembly → Provider Client Non-Streaming Execution →
//   Response Normalization → Assistant Message Persistence → Telemetry Record.
//
// Invariants:
// - Database transactions NEVER span outbound provider network I/O.
// - User messages remain persisted in SQLite even if provider execution fails.
// - Plaintext API credentials never cross service or IPC boundaries.
// - Double-submission protected per session.
// ============================================================================

use std::collections::HashSet;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, RwLock};
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};
use tokio_util::sync::CancellationToken;

use crate::analysis::service::TaskAnalyzer;
use crate::analysis::types::TaskAnalysisRequest;
use crate::core::tasks::id::TaskId;
use crate::core::tasks::TaskContext;
use crate::domain::{ChatMessage, ChatMessageMetadata, MessageSender, TelemetryEventType, TelemetryOutcome};
use crate::errors::AppError;
use crate::providers::identity::ProviderId;
use crate::providers::registry::ProviderRegistry;
use crate::providers::request::{GenerationParams, ProviderRequest, RequestMetadata};
use crate::providers::resolver::ProviderResolver;
use crate::providers::response::ProviderFinishReason;
use crate::routing::explanation::RoutingExplanationService;
use crate::routing::policy::engine::RoutingPolicyEngine;
use crate::routing::policy::types::{ManualRouteOverride, RoutingPolicyRequest, SelectionMode};
use crate::routing::scoring::engine::RoutingScoringEngine;
use crate::routing::scoring::types::RoutingScoreRequest;
use crate::services::chat::ChatService;
use crate::services::context_builder::ConversationContextBuilder;
use crate::services::execution::{
    CancellationResultDto, ExecutionContext, ExecutionLifecycleState, ExecutionManager,
    ExecutionStateDto, RecoveryContext, TerminationReason,
};
use crate::services::streaming::types::ProviderStreamChunk;
use crate::services::telemetry::{RecordTelemetryInput, TelemetryService};

/// Maximum prompt length permitted for submission (32KB).
pub const MAX_PROMPT_LENGTH: usize = 32_768;

/// Input payload submitted from the Chat Studio frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatSubmissionRequest {
    pub request_id: Option<String>,
    #[serde(default)]
    pub execution_id: Option<String>,
    pub session_id: String,
    pub prompt: String,
    pub manual_override: Option<ManualRouteOverrideDto>,
}

/// Strongly-typed manual route override parameters from the presentation layer.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManualRouteOverrideDto {
    pub provider_id: String,
    pub model_id: String,
}

/// Comprehensive, sanitized submission result returned across the IPC boundary.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatSubmissionResult {
    pub request_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub execution_id: Option<String>,
    pub session_id: String,
    pub user_message: ChatMessage,
    pub assistant_message: ChatMessage,
    pub routed_provider: String,
    pub routed_model: String,
    pub selection_mode: String,
    pub routing_reason: String,
    pub slm_confidence: Option<f64>,
    pub latency_ms: u64,
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub cost_usd: f64,
    pub status: String,
}

/// Canonical stream event delivered across the Tauri IPC Channel to the Chat Studio frontend.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ChatStreamEvent {
    Started {
        stream_id: String,
        sequence: u64,
        request_id: String,
        session_id: String,
        user_message_id: String,
        provider_id: String,
        model_id: String,
        selection_mode: String,
        routing_reason: String,
        slm_confidence: Option<f64>,
        timestamp_ms: u64,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        execution_id: Option<String>,
    },
    Delta {
        stream_id: String,
        sequence: u64,
        text: String,
    },
    Usage {
        stream_id: String,
        sequence: u64,
        prompt_tokens: u32,
        completion_tokens: u32,
    },
    Completed {
        stream_id: String,
        sequence: u64,
        finish_reason: String,
        latency_ms: u64,
        prompt_tokens: u32,
        completion_tokens: u32,
        cost_usd: f64,
        assistant_message: ChatMessage,
    },
    Failed {
        stream_id: String,
        sequence: u64,
        code: String,
        message: String,
        is_retryable: bool,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        error: Option<crate::errors::ErrorEnvelope>,
    },
    Cancelled {
        stream_id: String,
        sequence: u64,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        execution_id: Option<String>,
        reason: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        partial_text: Option<String>,
        timestamp_ms: u64,
    },
    Failover {
        stream_id: String,
        sequence: u64,
        logical_request_id: String,
        attempt: u32,
        from_provider: String,
        from_model: String,
        to_provider: String,
        to_model: String,
        reason: String,
        new_stream_id: String,
        timestamp_ms: u64,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        execution_id: Option<String>,
    },
    Retry {
        stream_id: String,
        sequence: u64,
        logical_request_id: String,
        attempt: u32,
        max_retries: u32,
        delay_ms: u64,
        provider_id: String,
        model_id: String,
        reason: String,
        timestamp_ms: u64,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        execution_id: Option<String>,
    },
}

/// Outbound sink abstraction for delivering chat stream events across Tauri Channels or test doubles.
pub trait ChatStreamSink: Send + Sync + 'static {
    fn send(&self, event: ChatStreamEvent) -> Result<(), String>;
}

impl ChatStreamSink for tauri::ipc::Channel<ChatStreamEvent> {
    fn send(&self, event: ChatStreamEvent) -> Result<(), String> {
        tauri::ipc::Channel::send(self, event).map_err(|e| e.to_string())
    }
}

/// End-to-end Chat Request Orchestration Service.
pub struct ChatOrchestrator {
    chat_service: Arc<ChatService>,
    task_analyzer: Arc<TaskAnalyzer>,
    routing_scoring_engine: Arc<RoutingScoringEngine>,
    routing_policy_engine: Arc<RoutingPolicyEngine>,
    routing_explanation_service: Arc<RoutingExplanationService>,
    execution_manager: Arc<ExecutionManager>,
    provider_registry: Arc<ProviderRegistry>,
    provider_resolver: Arc<ProviderResolver>,
    telemetry_service: Arc<TelemetryService>,
    failover_manager: Arc<crate::reliability::FailoverManager>,
    retry_policy: Arc<crate::reliability::RetryPolicy>,
    budget_guard: Arc<crate::reliability::BudgetGuard>,
    preflight_coordinator: Arc<crate::reliability::PreflightCoordinator>,
    active_sessions: Arc<RwLock<HashSet<String>>>,
}

impl ChatOrchestrator {
    pub fn new(
        chat_service: Arc<ChatService>,
        task_analyzer: Arc<TaskAnalyzer>,
        routing_scoring_engine: Arc<RoutingScoringEngine>,
        routing_policy_engine: Arc<RoutingPolicyEngine>,
        routing_explanation_service: Arc<RoutingExplanationService>,
        execution_manager: Arc<ExecutionManager>,
        provider_registry: Arc<ProviderRegistry>,
        provider_resolver: Arc<ProviderResolver>,
        telemetry_service: Arc<TelemetryService>,
    ) -> Self {
        let budget_guard = Arc::new(crate::reliability::BudgetGuard::new());
        let candidate_validator = Arc::new(crate::reliability::CandidateValidator::with_budget_guard(
            provider_registry.clone(),
            provider_resolver.credential_vault().clone(),
            budget_guard.clone(),
        ));
        let failover_manager = Arc::new(crate::reliability::FailoverManager::new(
            candidate_validator,
            telemetry_service.clone(),
        ));
        let retry_policy = Arc::new(crate::reliability::RetryPolicy::with_defaults());
        let preflight_coordinator = Arc::new(crate::reliability::PreflightCoordinator::new(
            provider_registry.clone(),
            provider_resolver.credential_vault().clone(),
            budget_guard.clone(),
        ));

        Self {
            chat_service,
            task_analyzer,
            routing_scoring_engine,
            routing_policy_engine,
            routing_explanation_service,
            execution_manager,
            provider_registry,
            provider_resolver,
            telemetry_service,
            failover_manager,
            retry_policy,
            budget_guard,
            preflight_coordinator,
            active_sessions: Arc::new(RwLock::new(HashSet::new())),
        }
    }

    /// Accessor for the retry policy engine.
    pub fn retry_policy(&self) -> &Arc<crate::reliability::RetryPolicy> {
        &self.retry_policy
    }

    /// Accessor for the budget guard.
    pub fn budget_guard(&self) -> &Arc<crate::reliability::BudgetGuard> {
        &self.budget_guard
    }

    /// Accessor for the preflight coordinator.
    pub fn preflight_coordinator(&self) -> &Arc<crate::reliability::PreflightCoordinator> {
        &self.preflight_coordinator
    }

    /// Accessor for the failover manager.
    pub fn failover_manager(&self) -> &Arc<crate::reliability::FailoverManager> {
        &self.failover_manager
    }

    /// Accessor for the underlying execution manager.
    pub fn execution_manager(&self) -> &Arc<ExecutionManager> {
        &self.execution_manager
    }

    /// Requests cooperative cancellation for an execution by stable ID.
    pub fn cancel_execution(
        &self,
        execution_id: &str,
        reason: TerminationReason,
    ) -> Result<CancellationResultDto, AppError> {
        self.execution_manager.request_cancellation(execution_id, reason)
    }

    /// Requests cooperative cancellation for any execution currently active in the specified session.
    pub fn cancel_session_execution(
        &self,
        session_id: &str,
        reason: TerminationReason,
    ) -> Result<Option<CancellationResultDto>, AppError> {
        self.execution_manager.request_cancellation_for_session(session_id, reason)
    }

    /// Queries the current execution state for a given execution ID.
    pub fn get_execution_state(&self, execution_id: &str) -> Option<ExecutionStateDto> {
        self.execution_manager.get_execution_state(execution_id)
    }

    /// Validates the input submission request before performing expensive operations.
    pub fn validate_request(&self, request: &ChatSubmissionRequest) -> Result<(), AppError> {
        let trimmed_session_id = request.session_id.trim();
        if trimmed_session_id.is_empty() {
            return Err(AppError::InvalidInput("Session ID cannot be empty".to_string()));
        }

        let trimmed_prompt = request.prompt.trim();
        if trimmed_prompt.is_empty() {
            return Err(AppError::InvalidInput(
                "Prompt cannot be empty or whitespace only".to_string(),
            ));
        }

        if request.prompt.len() > MAX_PROMPT_LENGTH {
            return Err(AppError::InvalidInput(format!(
                "Prompt length ({} characters) exceeds maximum allowed limit of {} characters",
                request.prompt.len(),
                MAX_PROMPT_LENGTH
            )));
        }

        if let Some(ref ovr) = request.manual_override {
            if ovr.provider_id.trim().is_empty() {
                return Err(AppError::InvalidInput(
                    "Manual override provider ID cannot be empty".to_string(),
                ));
            }
            if ovr.model_id.trim().is_empty() {
                return Err(AppError::InvalidInput(
                    "Manual override model ID cannot be empty".to_string(),
                ));
            }
        }

        Ok(())
    }

    /// Submits a user prompt through the complete routing and non-streaming execution pipeline.
    pub async fn submit_prompt(
        &self,
        request: ChatSubmissionRequest,
    ) -> Result<ChatSubmissionResult, AppError> {
        let request_id = request
            .request_id
            .clone()
            .unwrap_or_else(|| format!("req-{}", uuid_or_timestamp()));

        let execution_id = request
            .execution_id
            .clone()
            .unwrap_or_else(|| format!("exec-{}", uuid_or_timestamp()));

        // 1. Initial Pre-flight Request Validation
        self.validate_request(&request)?;

        let session_id = request.session_id.trim().to_string();
        let prompt = request.prompt.trim().to_string();

        // 2. Double-Submission Guard per session & Register Execution
        let (ctx_arc, cancel_token) = self.execution_manager.create_execution(
            execution_id.clone(),
            session_id.clone(),
            request_id.clone(),
            false,
        )?;

        let exec_manager_ref = self.execution_manager.clone();
        let exec_id_for_guard = execution_id.clone();
        let _exec_guard = ScopeGuard::new(move || {
            let _ = exec_manager_ref.finalize_execution(
                &exec_id_for_guard,
                ExecutionLifecycleState::Failed,
                Some(TerminationReason::ExecutionAborted),
                None,
            );
        });

        {
            let mut active = self.active_sessions.write().map_err(|_| {
                AppError::Internal("Failed to acquire session concurrency lock".to_string())
            })?;
            active.insert(session_id.clone());
        }

        // RAII Guard to ensure active session entry is always removed upon exit
        let active_sessions_ref = self.active_sessions.clone();
        let session_id_clone = session_id.clone();
        let _guard = ScopeGuard::new(move || {
            if let Ok(mut active) = active_sessions_ref.write() {
                active.remove(&session_id_clone);
            }
        });

        let _ = self.execution_manager.transition_state(&execution_id, ExecutionLifecycleState::Validating);

        // 3. Resolve Target Session in Database
        let session = self.chat_service.get_session(&session_id)?;
        if session.is_none() {
            let _ = self.execution_manager.finalize_execution(
                &execution_id,
                ExecutionLifecycleState::Failed,
                Some(TerminationReason::ExecutionAborted),
                None,
            );
            return Err(AppError::NotFound(format!(
                "Chat session '{}' does not exist",
                session_id
            )));
        }

        // 4. Persist User Message to SQLite (Authoritative record; committed before network I/O)
        let user_message = self.chat_service.append_message(
            &session_id,
            MessageSender::User,
            &prompt,
            None,
        )?;

        if let Ok(mut lock) = ctx_arc.write() {
            lock.user_message_id = Some(user_message.id.clone());
        }

        let _ = self.execution_manager.transition_state(&execution_id, ExecutionLifecycleState::Routing);

        // Check if cancellation was requested before expensive routing
        if cancel_token.is_cancelled() {
            let _ = self.execution_manager.finalize_execution(
                &execution_id,
                ExecutionLifecycleState::Cancelled,
                Some(TerminationReason::UserCancelled),
                None,
            );
            return Err(AppError::Internal("Execution was cancelled by user".to_string()));
        }

        // 5. Run Routing Pipeline: Intent Classification + Task Analysis (Step 27 & 28)
        let task_analysis_req = TaskAnalysisRequest {
            request_id: Some(request_id.clone()),
            text: prompt.clone(),
            conversation_context: None,
            intent: None,
            language_hint: None,
        };

        let task_analysis = self
            .task_analyzer
            .analyze(task_analysis_req, None)
            .await
            .map_err(|e| AppError::Internal(format!("Task analysis failed: {}", e)))?;

        // 6. Map Manual Override (Step 30)
        let manual_override = request.manual_override.as_ref().map(|ovr| ManualRouteOverride {
            provider_id: ovr.provider_id.trim().to_string(),
            model_id: ovr.model_id.trim().to_string(),
            enabled: true,
            reason: Some("User manual override from Chat Studio".to_string()),
        });

        // 7. Run Candidate Scoring (Step 29)
        let scoring_req = RoutingScoreRequest {
            request_id: Some(request_id.clone()),
            task_analysis: task_analysis.clone(),
            required_capabilities_override: None,
            preferred_providers: None,
            estimated_input_tokens: None,
            estimated_output_tokens: None,
            max_candidates: None,
        };
        let scoring_result = self
            .routing_scoring_engine
            .score_candidates(scoring_req)
            .map_err(|e| AppError::Internal(format!("Candidate scoring failed: {}", e)))?;

        // 8. Run Routing Policy (Step 30)
        let routing_policy_req = RoutingPolicyRequest {
            request_id: Some(request_id.clone()),
            scoring_result: Some(scoring_result.clone()),
            task_analysis: Some(task_analysis.clone()),
            manual_override,
            estimated_input_tokens: None,
            estimated_output_tokens: None,
        };

        let routing_decision = self
            .routing_policy_engine
            .evaluate_route(routing_policy_req)
            .map_err(|e| AppError::Internal(format!("Routing policy evaluation failed: {}", e)))?;

        // 8. Validate Authoritative Selected Route
        let selected = match routing_decision.selected_candidate.as_ref() {
            Some(cand)
                if routing_decision.selection_mode != SelectionMode::NoRouteAvailable
                    && routing_decision.selection_mode != SelectionMode::OverrideRejected
                    && routing_decision.selection_mode != SelectionMode::Blocked =>
            {
                cand
            }
            _ => {
                return Err(AppError::InvalidInput(format!(
                    "Routing policy failed to select an active route: {}",
                    routing_decision.decision_reason
                )));
            }
        };

        let provider_id_str = selected.provider_id.clone();
        let model_id_str = selected.model_id.clone();

        let _ = self.execution_manager.transition_state(&execution_id, ExecutionLifecycleState::RouteResolved);
        let _ = self.execution_manager.update_route(
            &execution_id,
            provider_id_str.clone(),
            model_id_str.clone(),
            None,
            Some(user_message.id.clone()),
        );

        // 9. Revalidate Model in Registry Catalog
        let provider_id_typed = ProviderId::new(&provider_id_str)
            .map_err(|e| AppError::Internal(format!("Invalid provider identifier: {}", e)))?;
        let catalog_model = self
            .provider_registry
            .get_model(&provider_id_typed, &model_id_str)
            .ok_or_else(|| {
                AppError::NotFound(format!(
                    "Routed model '{}' under provider '{}' is not registered in the catalog",
                    model_id_str, provider_id_str
                ))
            })?;

        // 10. Assemble Conversation Context (Excluding current user message which is appended by builder)
        let prior_messages = self
            .chat_service
            .get_messages(&session_id, Some(100), None)?;
        let history_slice: Vec<ChatMessage> = prior_messages
            .into_iter()
            .filter(|m| m.id != user_message.id)
            .collect();

        let provider_messages =
            ConversationContextBuilder::build(&history_slice, &prompt, &catalog_model)?;

        // 11. Resolve Provider Client
        let provider_client = self
            .provider_resolver
            .resolve(&provider_id_str)
            .map_err(|e| AppError::Internal(format!("Failed to resolve provider client: {}", e)))?;

        // 12. Build Canonical Provider Request
        let provider_req = ProviderRequest {
            model: model_id_str.clone(),
            messages: provider_messages,
            system_instruction: None,
            params: GenerationParams::default(),
            tools: Vec::new(),
            metadata: RequestMetadata::new(request_id.clone()),
        };

        // 13. Execute Outbound Provider Request (Non-Streaming with Cancellation Guard)
        let _ = self.execution_manager.transition_state(&execution_id, ExecutionLifecycleState::Executing);

        let task_context = TaskContext {
            task_id: TaskId::new("chat"),
            token: cancel_token.clone(),
            parent_task_id: None,
        };

        let start_time = Instant::now();
        let execution_result = tokio::select! {
            _ = cancel_token.cancelled() => {
                Err(crate::providers::errors::ProviderError::cancelled(Some(provider_id_typed)))
            }
            res = provider_client.execute(provider_req, &task_context) => {
                res
            }
        };
        let latency_ms = start_time.elapsed().as_millis() as u64;

        let provider_response = match execution_result {
            Ok(resp) => resp,
            Err(e) if e.kind() == crate::providers::errors::ProviderErrorKind::Cancelled || cancel_token.is_cancelled() => {
                let _ = self.telemetry_service.record_event(RecordTelemetryInput {
                    event_type: Some(TelemetryEventType::ProviderExecution),
                    session_id: Some(session_id.clone()),
                    message_id: Some(user_message.id.clone()),
                    provider_id: Some(provider_id_str.clone()),
                    model_id: Some(model_id_str.clone()),
                    outcome: Some(TelemetryOutcome::Cancelled),
                    error_code: Some("USER_CANCELLED".to_string()),
                    latency_ms: Some(latency_ms),
                    routing_reason: Some(routing_decision.decision_reason.clone()),
                    confidence_score: routing_decision.confidence_metadata.slm_analysis_confidence,
                    ..Default::default()
                });

                let _ = self.execution_manager.finalize_execution(
                    &execution_id,
                    ExecutionLifecycleState::Cancelled,
                    Some(TerminationReason::UserCancelled),
                    None,
                );

                return Err(AppError::Internal("Prompt execution was cancelled by user".to_string()));
            }
            Err(e) => {
                let error_envelope = crate::errors::ErrorClassifier::classify_provider_error(
                    &e,
                    Some(execution_id.clone()),
                    Some(request_id.clone()),
                    Some(model_id_str.clone()),
                );

                // Record primary execution failure telemetry
                let _ = self.telemetry_service.record_event(RecordTelemetryInput {
                    event_type: Some(TelemetryEventType::ProviderExecution),
                    session_id: Some(session_id.clone()),
                    message_id: Some(user_message.id.clone()),
                    provider_id: Some(provider_id_str.clone()),
                    model_id: Some(model_id_str.clone()),
                    outcome: Some(TelemetryOutcome::Failed),
                    error_code: Some(error_envelope.error_code.clone()),
                    latency_ms: Some(latency_ms),
                    prompt_tokens: None,
                    completion_tokens: None,
                    cost_usd: None,
                    routing_reason: Some(routing_decision.decision_reason.clone()),
                    confidence_score: routing_decision.confidence_metadata.slm_analysis_confidence,
                    ..Default::default()
                });

                // Check failover eligibility (Step 37)
                let can_failover = self.failover_manager.should_permit_failover(
                    &error_envelope,
                    &routing_decision.selection_mode,
                );

                if can_failover && !routing_decision.fallback_candidates.is_empty() {
                    let mut attempted_candidates: HashSet<(String, String)> = HashSet::new();
                    attempted_candidates.insert((provider_id_str.to_lowercase(), model_id_str.clone()));

                    let _ = self.execution_manager.transition_state(&execution_id, ExecutionLifecycleState::Recovering);

                    for (fallback_idx, candidate) in routing_decision.fallback_candidates.iter().enumerate() {
                        if cancel_token.is_cancelled() {
                            let _ = self.execution_manager.finalize_execution(
                                &execution_id,
                                ExecutionLifecycleState::Cancelled,
                                Some(TerminationReason::UserCancelled),
                                None,
                            );
                            return Err(AppError::Internal("Prompt execution was cancelled by user".to_string()));
                        }

                        if let Err(_rejection) = self.failover_manager.validator().validate_candidate(
                            candidate,
                            &attempted_candidates,
                            Some(&task_analysis),
                            None,
                        ) {
                            continue;
                        }

                        let cand_prov = candidate.provider_id.trim().to_lowercase();
                        let cand_model = candidate.model_id.trim().to_string();
                        attempted_candidates.insert((cand_prov.clone(), cand_model.clone()));

                        let fallback_prov_id_typed = match ProviderId::new(&cand_prov) {
                            Ok(p) => p,
                            Err(_) => continue,
                        };

                        let fallback_catalog_model = match self.provider_registry.get_model(&fallback_prov_id_typed, &cand_model) {
                            Some(m) => m,
                            None => continue,
                        };

                        let fallback_client = match self.provider_resolver.resolve(&cand_prov) {
                            Ok(c) => c,
                            Err(_) => continue,
                        };

                        let fallback_provider_messages = match ConversationContextBuilder::build(&history_slice, &prompt, fallback_catalog_model) {
                            Ok(m) => m,
                            Err(_) => continue,
                        };

                        let fallback_req = ProviderRequest {
                            model: cand_model.clone(),
                            messages: fallback_provider_messages,
                            system_instruction: None,
                            params: GenerationParams::default(),
                            tools: Vec::new(),
                            metadata: RequestMetadata::new(request_id.clone()),
                        };

                        let _ = self.execution_manager.update_route(
                            &execution_id,
                            cand_prov.clone(),
                            cand_model.clone(),
                            None,
                            None,
                        );
                        let _ = self.execution_manager.transition_state(&execution_id, ExecutionLifecycleState::Executing);

                        let fb_start = Instant::now();
                        let fb_res = tokio::select! {
                            _ = cancel_token.cancelled() => {
                                Err(crate::providers::errors::ProviderError::cancelled(Some(fallback_prov_id_typed)))
                            }
                            res = fallback_client.execute(fallback_req, &task_context) => {
                                res
                            }
                        };
                        let fb_latency = fb_start.elapsed().as_millis() as u64;

                        match fb_res {
                            Ok(fb_resp) => {
                                let fb_text = fb_resp.text.trim().to_string();
                                if fb_text.is_empty() {
                                    continue;
                                }

                                let fb_prompt_tokens = fb_resp.usage.as_ref().and_then(|u| u.input_tokens).unwrap_or(0);
                                let fb_completion_tokens = fb_resp.usage.as_ref().and_then(|u| u.output_tokens).unwrap_or(0);
                                let mut fb_cost = 0.0;
                                if let Some(ref pricing) = fallback_catalog_model.pricing {
                                    if let (Some(in_rate), Some(out_rate)) = (pricing.input_cost_per_million, pricing.output_cost_per_million) {
                                        let in_c = (fb_prompt_tokens as f64 / 1_000_000.0) * in_rate;
                                        let out_c = (fb_completion_tokens as f64 / 1_000_000.0) * out_rate;
                                        fb_cost = in_c + out_c;
                                    }
                                }

                                let assistant_metadata = ChatMessageMetadata {
                                    routed_provider: Some(cand_prov.clone()),
                                    routed_model: Some(cand_model.clone()),
                                    routing_reason: Some(format!(
                                        "{} (Failed over from {}/{}: {})",
                                        routing_decision.decision_reason,
                                        provider_id_str,
                                        model_id_str,
                                        error_envelope.user_message
                                    )),
                                    slm_confidence_score: routing_decision.confidence_metadata.slm_analysis_confidence,
                                    prompt_tokens: fb_prompt_tokens,
                                    completion_tokens: fb_completion_tokens,
                                    latency_ms: latency_ms + fb_latency,
                                    cost_usd: fb_cost,
                                    failover_used: Some(true),
                                    failover_from_provider: Some(provider_id_str.clone()),
                                    failover_from_model: Some(model_id_str.clone()),
                                    failover_reason: Some(error_envelope.user_message.clone()),
                                    failover_attempts: Some((fallback_idx + 2) as u32),
                                };

                                let assistant_message = self.chat_service.append_message(
                                    &session_id,
                                    MessageSender::Assistant,
                                    &fb_text,
                                    Some(assistant_metadata),
                                )?;

                                // Record successful fallback telemetry
                                let _ = self.telemetry_service.record_event(RecordTelemetryInput {
                                    event_type: Some(TelemetryEventType::ProviderExecution),
                                    session_id: Some(session_id.clone()),
                                    message_id: Some(assistant_message.id.clone()),
                                    provider_id: Some(cand_prov.clone()),
                                    model_id: Some(cand_model.clone()),
                                    outcome: Some(TelemetryOutcome::Succeeded),
                                    latency_ms: Some(fb_latency),
                                    prompt_tokens: Some(fb_prompt_tokens),
                                    completion_tokens: Some(fb_completion_tokens),
                                    cost_usd: Some(fb_cost),
                                    routing_reason: Some(format!("Failover from {}/{}", provider_id_str, model_id_str)),
                                    confidence_score: routing_decision.confidence_metadata.slm_analysis_confidence,
                                    ..Default::default()
                                });

                                let _ = self.execution_manager.finalize_execution(
                                    &execution_id,
                                    ExecutionLifecycleState::Completed,
                                    None,
                                    None,
                                );

                                return Ok(ChatSubmissionResult {
                                    user_message,
                                    assistant_message,
                                    routed_provider: cand_prov,
                                    routed_model: cand_model,
                                    selection_mode: "fallback".to_string(),
                                    routing_reason: routing_decision.decision_reason.clone(),
                                    slm_confidence: routing_decision.confidence_metadata.slm_analysis_confidence,
                                    latency_ms: latency_ms + fb_latency,
                                    prompt_tokens: fb_prompt_tokens,
                                    completion_tokens: fb_completion_tokens,
                                    cost_usd: fb_cost,
                                });
                            }
                            Err(_) if cancel_token.is_cancelled() => {
                                let _ = self.execution_manager.finalize_execution(
                                    &execution_id,
                                    ExecutionLifecycleState::Cancelled,
                                    Some(TerminationReason::UserCancelled),
                                    None,
                                );
                                return Err(AppError::Internal("Prompt execution was cancelled by user".to_string()));
                            }
                            Err(_) => {
                                continue;
                            }
                        }
                    }
                }

                let _ = self.execution_manager.finalize_execution(
                    &execution_id,
                    ExecutionLifecycleState::Failed,
                    Some(TerminationReason::ProviderFailed),
                    None,
                );

                return Err(AppError::Internal(format!(
                    "Provider execution failed for '{}/{}': {}",
                    provider_id_str, model_id_str, e
                )));
            }
        };

        // 14. Response Normalization & Usage Accounting
        let response_text = provider_response.text.trim().to_string();
        if response_text.is_empty() {
            return Err(AppError::Internal(
                "Provider returned empty completion content".to_string(),
            ));
        }

        let prompt_tokens = provider_response
            .usage
            .as_ref()
            .and_then(|u| u.input_tokens)
            .unwrap_or(0);
        let completion_tokens = provider_response
            .usage
            .as_ref()
            .and_then(|u| u.output_tokens)
            .unwrap_or(0);

        // Compute authoritative cost if pricing is available in catalog
        let mut cost_usd = 0.0;
        if let Some(ref pricing) = catalog_model.pricing {
            if let (Some(in_rate), Some(out_rate)) = (
                pricing.input_cost_per_million,
                pricing.output_cost_per_million,
            ) {
                let in_cost = (prompt_tokens as f64 / 1_000_000.0) * in_rate;
                let out_cost = (completion_tokens as f64 / 1_000_000.0) * out_rate;
                cost_usd = in_cost + out_cost;
            }
        }

        // 15. Persist Assistant Message to SQLite with Metadata
        let assistant_metadata = ChatMessageMetadata {
            routed_provider: Some(provider_id_str.clone()),
            routed_model: Some(model_id_str.clone()),
            routing_reason: Some(routing_decision.decision_reason.clone()),
            slm_confidence_score: routing_decision.confidence_metadata.slm_analysis_confidence,
            prompt_tokens,
            completion_tokens,
            latency_ms,
            cost_usd,
        };

        let assistant_message = self.chat_service.append_message(
            &session_id,
            MessageSender::Assistant,
            &response_text,
            Some(assistant_metadata),
        )?;

        // Build and store live explanation in memory cache
        let explanation = self.routing_explanation_service.build_live_explanation(
            Some(&assistant_message.id),
            Some(&session_id),
            &task_analysis,
            &scoring_result,
            &routing_decision,
        );
        self.routing_explanation_service
            .store_live_explanation(&assistant_message.id, explanation);

        // 16. Record Operational Telemetry Event
        let _ = self.telemetry_service.record_event(RecordTelemetryInput {
            event_type: Some(TelemetryEventType::ProviderExecution),
            session_id: Some(session_id.clone()),
            message_id: Some(assistant_message.id.clone()),
            provider_id: Some(provider_id_str.clone()),
            model_id: Some(model_id_str.clone()),
            outcome: Some(TelemetryOutcome::Success),
            error_code: None,
            latency_ms: Some(latency_ms),
            prompt_tokens: Some(prompt_tokens),
            completion_tokens: Some(completion_tokens),
            cost_usd: Some(cost_usd),
            routing_reason: Some(routing_decision.decision_reason.clone()),
            confidence_score: routing_decision.confidence_metadata.slm_analysis_confidence,
            ..Default::default()
        });

        // Finalize execution state machine (Single-Finalization Invariant)
        let _ = self.execution_manager.finalize_execution(
            &execution_id,
            ExecutionLifecycleState::Completed,
            None,
            None,
        );

        // 17. Return Structured Result to Client
        Ok(ChatSubmissionResult {
            request_id,
            execution_id: Some(execution_id),
            session_id,
            user_message,
            assistant_message,
            routed_provider: provider_id_str,
            routed_model: model_id_str,
            selection_mode: routing_decision.selection_mode.as_str().to_string(),
            routing_reason: routing_decision.decision_reason,
            slm_confidence: routing_decision.confidence_metadata.slm_analysis_confidence,
            latency_ms,
            prompt_tokens,
            completion_tokens,
            cost_usd,
            status: "completed".to_string(),
        })
    }

    /// Streams a user prompt through the complete routing pipeline and live provider stream.
    ///
    /// Invariants:
    /// - User message is persisted to SQLite before outbound network I/O.
    /// - Assistant response is accumulated in memory and persisted to SQLite EXACTLY ONCE upon successful completion.
    /// - On provider failure, partial content is NOT persisted to SQLite as a successful assistant message.
    /// - Channel events adhere strictly to monotonic sequence numbers (0: Started, 1..N: Delta/Usage, N+1: Completed/Failed).
    pub async fn stream_prompt<S>(
        &self,
        request: ChatSubmissionRequest,
        sink: S,
    ) -> Result<(), AppError>
    where
        S: ChatStreamSink,
    {
        let request_id = request
            .request_id
            .clone()
            .unwrap_or_else(|| format!("req-{}", uuid_or_timestamp()));

        // 1. Pre-flight Request Validation
        self.validate_request(&request)?;

        let session_id = request.session_id.trim().to_string();
        let prompt = request.prompt.trim().to_string();

        let execution_id = request
            .execution_id
            .clone()
            .unwrap_or_else(|| format!("exec-{}", uuid_or_timestamp()));

        // 2. Double-Submission Guard per session & Register Execution
        let (ctx_arc, cancel_token) = self.execution_manager.create_execution(
            execution_id.clone(),
            session_id.clone(),
            request_id.clone(),
            true,
        )?;

        let exec_manager_ref = self.execution_manager.clone();
        let exec_id_for_guard = execution_id.clone();
        let _exec_guard = ScopeGuard::new(move || {
            let _ = exec_manager_ref.finalize_execution(
                &exec_id_for_guard,
                ExecutionLifecycleState::Failed,
                Some(TerminationReason::ExecutionAborted),
                None,
            );
        });

        {
            let mut active = self.active_sessions.write().map_err(|_| {
                AppError::Internal("Failed to acquire session concurrency lock".to_string())
            })?;
            active.insert(session_id.clone());
        }

        // RAII Guard to ensure active session entry is always removed upon exit
        let active_sessions_ref = self.active_sessions.clone();
        let session_id_clone = session_id.clone();
        let _guard = ScopeGuard::new(move || {
            if let Ok(mut active) = active_sessions_ref.write() {
                active.remove(&session_id_clone);
            }
        });

        let _ = self.execution_manager.transition_state(&execution_id, ExecutionLifecycleState::Validating);

        // 3. Resolve Target Session in Database
        let session = self.chat_service.get_session(&session_id)?;
        if session.is_none() {
            let _ = self.execution_manager.finalize_execution(
                &execution_id,
                ExecutionLifecycleState::Failed,
                Some(TerminationReason::ExecutionAborted),
                None,
            );
            return Err(AppError::NotFound(format!(
                "Chat session '{}' does not exist",
                session_id
            )));
        }

        // 4. Persist User Message to SQLite (Authoritative record; committed before network I/O)
        let user_message = self.chat_service.append_message(
            &session_id,
            MessageSender::User,
            &prompt,
            None,
        )?;

        if let Ok(mut lock) = ctx_arc.write() {
            lock.user_message_id = Some(user_message.id.clone());
        }

        let _ = self.execution_manager.transition_state(&execution_id, ExecutionLifecycleState::Routing);

        if cancel_token.is_cancelled() {
            let _ = self.execution_manager.finalize_execution(
                &execution_id,
                ExecutionLifecycleState::Cancelled,
                Some(TerminationReason::UserCancelled),
                None,
            );
            return Err(AppError::Internal("Execution was cancelled by user".to_string()));
        }

        // 5. Run Routing Pipeline: Intent Classification + Task Analysis (Step 27 & 28)
        let task_analysis_req = TaskAnalysisRequest {
            request_id: Some(request_id.clone()),
            text: prompt.clone(),
            conversation_context: None,
            intent: None,
            language_hint: None,
        };

        let task_analysis = self
            .task_analyzer
            .analyze(task_analysis_req, None)
            .await
            .map_err(|e| AppError::Internal(format!("Task analysis failed: {}", e)))?;

        // 6. Map Manual Override (Step 30)
        let manual_override = request.manual_override.as_ref().map(|ovr| ManualRouteOverride {
            provider_id: ovr.provider_id.trim().to_string(),
            model_id: ovr.model_id.trim().to_string(),
            enabled: true,
            reason: Some("User manual override from Chat Studio".to_string()),
        });

        // 7. Run Candidate Scoring (Step 29)
        let scoring_req = RoutingScoreRequest {
            request_id: Some(request_id.clone()),
            task_analysis: task_analysis.clone(),
            required_capabilities_override: None,
            preferred_providers: None,
            estimated_input_tokens: None,
            estimated_output_tokens: None,
            max_candidates: None,
        };
        let scoring_result = self
            .routing_scoring_engine
            .score_candidates(scoring_req)
            .map_err(|e| AppError::Internal(format!("Candidate scoring failed: {}", e)))?;

        // 8. Run Routing Policy (Step 30)
        let routing_policy_req = RoutingPolicyRequest {
            request_id: Some(request_id.clone()),
            scoring_result: Some(scoring_result.clone()),
            task_analysis: Some(task_analysis.clone()),
            manual_override,
            estimated_input_tokens: None,
            estimated_output_tokens: None,
        };

        let routing_decision = self
            .routing_policy_engine
            .evaluate_route(routing_policy_req)
            .map_err(|e| AppError::Internal(format!("Routing policy evaluation failed: {}", e)))?;

        // 8. Validate Authoritative Selected Route
        let selected = match routing_decision.selected_candidate.as_ref() {
            Some(cand)
                if routing_decision.selection_mode != SelectionMode::NoRouteAvailable
                    && routing_decision.selection_mode != SelectionMode::OverrideRejected
                    && routing_decision.selection_mode != SelectionMode::Blocked =>
            {
                cand
            }
            _ => {
                return Err(AppError::InvalidInput(format!(
                    "Routing policy failed to select an active route: {}",
                    routing_decision.decision_reason
                )));
            }
        };

        let provider_id_str = selected.provider_id.clone();
        let model_id_str = selected.model_id.clone();

        let stream_id = format!("strm_{}", uuid_or_timestamp());
        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        let _ = self.execution_manager.transition_state(&execution_id, ExecutionLifecycleState::RouteResolved);
        let _ = self.execution_manager.update_route(
            &execution_id,
            provider_id_str.clone(),
            model_id_str.clone(),
            Some(stream_id.clone()),
            Some(user_message.id.clone()),
        );

        // 9. Revalidate Model in Registry Catalog
        let provider_id_typed = ProviderId::new(&provider_id_str)
            .map_err(|e| AppError::Internal(format!("Invalid provider identifier: {}", e)))?;
        let catalog_model = self
            .provider_registry
            .get_model(&provider_id_typed, &model_id_str)
            .ok_or_else(|| {
                AppError::NotFound(format!(
                    "Routed model '{}' under provider '{}' is not registered in the catalog",
                    model_id_str, provider_id_str
                ))
            })?;

        // 10. Assemble Conversation Context
        let prior_messages = self
            .chat_service
            .get_messages(&session_id, Some(100), None)?;
        let history_slice: Vec<ChatMessage> = prior_messages
            .into_iter()
            .filter(|m| m.id != user_message.id)
            .collect();

        let provider_messages =
            ConversationContextBuilder::build(&history_slice, &prompt, &catalog_model)?;

        // 11. Resolve Provider Client
        let provider_client = self
            .provider_resolver
            .resolve(&provider_id_str)
            .map_err(|e| AppError::Internal(format!("Failed to resolve provider client: {}", e)))?;

        // 12. Build Canonical Provider Request
        let provider_req = ProviderRequest {
            model: model_id_str.clone(),
            messages: provider_messages,
            system_instruction: None,
            params: GenerationParams::default(),
            tools: Vec::new(),
            metadata: RequestMetadata::new(request_id.clone()),
        };

        let _ = self.execution_manager.transition_state(&execution_id, ExecutionLifecycleState::Streaming);

        // 13. Emit Started Event (Sequence 0)
        let _ = sink.send(ChatStreamEvent::Started {
            stream_id: stream_id.clone(),
            sequence: 0,
            request_id: request_id.clone(),
            session_id: session_id.clone(),
            user_message_id: user_message.id.clone(),
            provider_id: provider_id_str.clone(),
            model_id: model_id_str.clone(),
            selection_mode: routing_decision.selection_mode.as_str().to_string(),
            routing_reason: routing_decision.decision_reason.clone(),
            slm_confidence: routing_decision.confidence_metadata.slm_analysis_confidence,
            timestamp_ms: now_ms,
            execution_id: Some(execution_id.clone()),
        });

        // 14. Execute Streaming Pipeline
        let task_context = TaskContext {
            task_id: TaskId::new("chat_stream"),
            token: cancel_token.clone(),
            parent_task_id: None,
        };

        let sequence_counter = Arc::new(AtomicU64::new(1));
        let accumulated_text = Arc::new(Mutex::new(String::new()));
        let usage_tracker = Arc::new(Mutex::new(None));
        let finish_reason_tracker = Arc::new(Mutex::new(ProviderFinishReason::Completed));

        let sink_ref = Arc::new(sink);
        let stream_id_for_chunk = stream_id.clone();
        let seq_ref = sequence_counter.clone();
        let text_ref = accumulated_text.clone();
        let usage_ref = usage_tracker.clone();
        let finish_ref = finish_reason_tracker.clone();
        let sink_for_chunk = sink_ref.clone();
        let cancel_token_chunk = cancel_token.clone();

        let on_chunk = Box::new(move |chunk: ProviderStreamChunk| -> Result<(), crate::providers::errors::ProviderError> {
            if cancel_token_chunk.is_cancelled() {
                return Err(crate::providers::errors::ProviderError::cancelled(None));
            }

            if let Some(text) = chunk.text_delta {
                if !text.is_empty() {
                    text_ref.lock().unwrap().push_str(&text);
                    let seq = seq_ref.fetch_add(1, Ordering::SeqCst);
                    let _ = sink_for_chunk.send(ChatStreamEvent::Delta {
                        stream_id: stream_id_for_chunk.clone(),
                        sequence: seq,
                        text,
                    });
                }
            }

            if let Some(usage) = chunk.usage {
                let prompt_tokens = usage.input_tokens.unwrap_or(0);
                let completion_tokens = usage.output_tokens.unwrap_or(0);
                *usage_ref.lock().unwrap() = Some(usage);
                let seq = seq_ref.fetch_add(1, Ordering::SeqCst);
                let _ = sink_for_chunk.send(ChatStreamEvent::Usage {
                    stream_id: stream_id_for_chunk.clone(),
                    sequence: seq,
                    prompt_tokens,
                    completion_tokens,
                });
            }

            if let Some(fr) = chunk.finish_reason {
                *finish_ref.lock().unwrap() = fr;
            }

            Ok(())
        });

        let start_time = Instant::now();
        let execution_result = provider_client.execute_stream(provider_req, &task_context, on_chunk).await;
        let latency_ms = start_time.elapsed().as_millis() as u64;

        match execution_result {
            Err(e) if e.kind() == crate::providers::errors::ProviderErrorKind::Cancelled || cancel_token.is_cancelled() => {
                let full_text = accumulated_text.lock().unwrap().clone();
                let partial_text = if full_text.trim().is_empty() { None } else { Some(full_text.clone()) };

                let _ = self.execution_manager.finalize_execution(
                    &execution_id,
                    ExecutionLifecycleState::Cancelled,
                    Some(TerminationReason::UserCancelled),
                    partial_text.clone(),
                );

                let _ = self.telemetry_service.record_event(RecordTelemetryInput {
                    event_type: Some(TelemetryEventType::StreamLifecycle),
                    session_id: Some(session_id.clone()),
                    message_id: Some(user_message.id.clone()),
                    provider_id: Some(provider_id_str.clone()),
                    model_id: Some(model_id_str.clone()),
                    outcome: Some(TelemetryOutcome::Cancelled),
                    error_code: Some("USER_CANCELLED".to_string()),
                    latency_ms: Some(latency_ms),
                    routing_reason: Some(routing_decision.decision_reason.clone()),
                    confidence_score: routing_decision.confidence_metadata.slm_analysis_confidence,
                    ..Default::default()
                });

                let seq = sequence_counter.fetch_add(1, Ordering::SeqCst);
                let _ = sink_ref.send(ChatStreamEvent::Cancelled {
                    stream_id: stream_id.clone(),
                    sequence: seq,
                    execution_id: Some(execution_id.clone()),
                    reason: "Prompt generation was cancelled by user".to_string(),
                    partial_text,
                    timestamp_ms: SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .map(|d| d.as_millis() as u64)
                        .unwrap_or(0),
                });

                return Ok(());
            }
            Err(e) => {
                let error_envelope = crate::errors::ErrorClassifier::classify_provider_error(
                    &e,
                    Some(execution_id.clone()),
                    Some(request_id.clone()),
                    Some(model_id_str.clone()),
                );

                // Record primary execution failure telemetry
                let _ = self.telemetry_service.record_event(RecordTelemetryInput {
                    event_type: Some(TelemetryEventType::ProviderExecution),
                    session_id: Some(session_id.clone()),
                    message_id: Some(user_message.id.clone()),
                    provider_id: Some(provider_id_str.clone()),
                    model_id: Some(model_id_str.clone()),
                    outcome: Some(TelemetryOutcome::Failed),
                    error_code: Some(error_envelope.error_code.clone()),
                    latency_ms: Some(latency_ms),
                    prompt_tokens: None,
                    completion_tokens: None,
                    cost_usd: None,
                    routing_reason: Some(routing_decision.decision_reason.clone()),
                    confidence_score: routing_decision.confidence_metadata.slm_analysis_confidence,
                    ..Default::default()
                });

                // Failover Evaluation & Execution
                if self.failover_manager.should_permit_failover(&error_envelope, &routing_decision.selection_mode) {
                    for (fallback_idx, candidate) in routing_decision.fallback_candidates.iter().enumerate() {
                        if cancel_token.is_cancelled() {
                            let _ = self.execution_manager.finalize_execution(
                                &execution_id,
                                ExecutionLifecycleState::Cancelled,
                                Some(TerminationReason::UserCancelled),
                                None,
                            );
                            let seq = sequence_counter.fetch_add(1, Ordering::SeqCst);
                            let _ = sink_ref.send(ChatStreamEvent::Cancelled {
                                stream_id: stream_id.clone(),
                                sequence: seq,
                                execution_id: Some(execution_id.clone()),
                                reason: "Execution was cancelled by user".to_string(),
                                partial_text: None,
                                timestamp_ms: SystemTime::now()
                                    .duration_since(UNIX_EPOCH)
                                    .map(|d| d.as_millis() as u64)
                                    .unwrap_or(0),
                            });
                            return Ok(());
                        }

                        let cand_prov = candidate.provider_id.clone();
                        let cand_model = candidate.model_id.clone();

                        if cand_prov == provider_id_str && cand_model == model_id_str {
                            continue;
                        }

                        if let Err(rejection) = self.failover_manager.validator().validate_candidate(candidate, &task_analysis) {
                            tracing::warn!(
                                fallback_candidate = %format!("{}/{}", cand_prov, cand_model),
                                reason = ?rejection,
                                "Fallback candidate rejected during failover stream validation"
                            );
                            continue;
                        }

                        let fallback_prov_id_typed = match ProviderId::new(&cand_prov) {
                            Ok(p) => p,
                            Err(_) => continue,
                        };

                        let fallback_catalog_model = match self.provider_registry.get_model(&fallback_prov_id_typed, &cand_model) {
                            Some(m) => m,
                            None => continue,
                        };

                        let fallback_client = match self.provider_resolver.resolve(&cand_prov) {
                            Ok(c) => c,
                            Err(_) => continue,
                        };

                        let fallback_messages = match ConversationContextBuilder::build(&history_slice, &prompt, &fallback_catalog_model) {
                            Ok(m) => m,
                            Err(_) => continue,
                        };

                        let fallback_req = ProviderRequest {
                            model: cand_model.clone(),
                            messages: fallback_messages,
                            system_instruction: None,
                            params: GenerationParams::default(),
                            tools: Vec::new(),
                            metadata: RequestMetadata::new(request_id.clone()),
                        };

                        let fb_stream_id = format!("strm_{}_{}", uuid_or_timestamp(), fallback_idx + 1);

                        // Emit Failover event on primary stream
                        let seq = sequence_counter.fetch_add(1, Ordering::SeqCst);
                        let _ = sink_ref.send(ChatStreamEvent::Failover {
                            stream_id: stream_id.clone(),
                            sequence: seq,
                            logical_request_id: request_id.clone(),
                            attempt: (fallback_idx + 2) as u32,
                            from_provider: provider_id_str.clone(),
                            from_model: model_id_str.clone(),
                            to_provider: cand_prov.clone(),
                            to_model: cand_model.clone(),
                            reason: error_envelope.user_message.clone(),
                            new_stream_id: fb_stream_id.clone(),
                            timestamp_ms: SystemTime::now()
                                .duration_since(UNIX_EPOCH)
                                .map(|d| d.as_millis() as u64)
                                .unwrap_or(0),
                            execution_id: Some(execution_id.clone()),
                        });

                        let _ = self.execution_manager.transition_state(&execution_id, ExecutionLifecycleState::Recovering);
                        let _ = self.execution_manager.update_route(
                            &execution_id,
                            cand_prov.clone(),
                            cand_model.clone(),
                            Some(fb_stream_id.clone()),
                            Some(user_message.id.clone()),
                        );
                        let _ = self.execution_manager.transition_state(&execution_id, ExecutionLifecycleState::Streaming);

                        // Emit Started event for new fallback stream (sequence 0)
                        let _ = sink_ref.send(ChatStreamEvent::Started {
                            stream_id: fb_stream_id.clone(),
                            sequence: 0,
                            request_id: request_id.clone(),
                            session_id: session_id.clone(),
                            user_message_id: user_message.id.clone(),
                            provider_id: cand_prov.clone(),
                            model_id: cand_model.clone(),
                            selection_mode: "fallback".to_string(),
                            routing_reason: routing_decision.decision_reason.clone(),
                            slm_confidence: routing_decision.confidence_metadata.slm_analysis_confidence,
                            timestamp_ms: SystemTime::now()
                                .duration_since(UNIX_EPOCH)
                                .map(|d| d.as_millis() as u64)
                                .unwrap_or(0),
                            execution_id: Some(execution_id.clone()),
                        });

                        // Isolated fallback stream counters & buffers
                        let fb_sequence_counter = Arc::new(AtomicU64::new(1));
                        let fb_accumulated_text = Arc::new(Mutex::new(String::new()));
                        let fb_usage_tracker = Arc::new(Mutex::new(None));
                        let fb_finish_reason_tracker = Arc::new(Mutex::new(ProviderFinishReason::Completed));

                        let fb_sink_ref = sink_ref.clone();
                        let fb_stream_id_for_chunk = fb_stream_id.clone();
                        let fb_seq_ref = fb_sequence_counter.clone();
                        let fb_text_ref = fb_accumulated_text.clone();
                        let fb_usage_ref = fb_usage_tracker.clone();
                        let fb_finish_ref = fb_finish_reason_tracker.clone();
                        let fb_cancel_token = cancel_token.clone();

                        let fb_on_chunk = Box::new(move |chunk: ProviderStreamChunk| -> Result<(), crate::providers::errors::ProviderError> {
                            if fb_cancel_token.is_cancelled() {
                                return Err(crate::providers::errors::ProviderError::cancelled(None));
                            }

                            if let Some(text) = chunk.text_delta {
                                if !text.is_empty() {
                                    fb_text_ref.lock().unwrap().push_str(&text);
                                    let seq = fb_seq_ref.fetch_add(1, Ordering::SeqCst);
                                    let _ = fb_sink_ref.send(ChatStreamEvent::Delta {
                                        stream_id: fb_stream_id_for_chunk.clone(),
                                        sequence: seq,
                                        text,
                                    });
                                }
                            }

                            if let Some(usage) = chunk.usage {
                                let prompt_tokens = usage.input_tokens.unwrap_or(0);
                                let completion_tokens = usage.output_tokens.unwrap_or(0);
                                *fb_usage_ref.lock().unwrap() = Some(usage);
                                let seq = fb_seq_ref.fetch_add(1, Ordering::SeqCst);
                                let _ = fb_sink_ref.send(ChatStreamEvent::Usage {
                                    stream_id: fb_stream_id_for_chunk.clone(),
                                    sequence: seq,
                                    prompt_tokens,
                                    completion_tokens,
                                });
                            }

                            if let Some(fr) = chunk.finish_reason {
                                *fb_finish_ref.lock().unwrap() = fr;
                            }

                            Ok(())
                        });

                        let fb_start = Instant::now();
                        let fb_execution_result = fallback_client.execute_stream(fallback_req, &task_context, fb_on_chunk).await;
                        let fb_latency = fb_start.elapsed().as_millis() as u64;

                        match fb_execution_result {
                            Ok(()) => {
                                if cancel_token.is_cancelled() {
                                    let _ = self.execution_manager.finalize_execution(
                                        &execution_id,
                                        ExecutionLifecycleState::Cancelled,
                                        Some(TerminationReason::UserCancelled),
                                        None,
                                    );
                                    let seq = fb_sequence_counter.fetch_add(1, Ordering::SeqCst);
                                    let _ = sink_ref.send(ChatStreamEvent::Cancelled {
                                        stream_id: fb_stream_id.clone(),
                                        sequence: seq,
                                        execution_id: Some(execution_id.clone()),
                                        reason: "Execution was cancelled by user".to_string(),
                                        partial_text: None,
                                        timestamp_ms: SystemTime::now()
                                            .duration_since(UNIX_EPOCH)
                                            .map(|d| d.as_millis() as u64)
                                            .unwrap_or(0),
                                    });
                                    return Ok(());
                                }

                                let fb_full_text = fb_accumulated_text.lock().unwrap().clone();
                                let fb_response_text = fb_full_text.trim().to_string();
                                if fb_response_text.is_empty() {
                                    continue;
                                }

                                let fb_usage = fb_usage_tracker.lock().unwrap().clone();
                                let fb_prompt_tokens = fb_usage.as_ref().and_then(|u| u.input_tokens).unwrap_or(0);
                                let fb_completion_tokens = fb_usage.as_ref().and_then(|u| u.output_tokens).unwrap_or(0);

                                let mut fb_cost = 0.0;
                                if let Some(ref pricing) = fallback_catalog_model.pricing {
                                    if let (Some(in_rate), Some(out_rate)) = (
                                        pricing.input_cost_per_million,
                                        pricing.output_cost_per_million,
                                    ) {
                                        let in_cost = (fb_prompt_tokens as f64 / 1_000_000.0) * in_rate;
                                        let out_cost = (fb_completion_tokens as f64 / 1_000_000.0) * out_rate;
                                        fb_cost = in_cost + out_cost;
                                    }
                                }

                                let assistant_metadata = ChatMessageMetadata {
                                    routed_provider: Some(cand_prov.clone()),
                                    routed_model: Some(cand_model.clone()),
                                    routing_reason: Some(format!(
                                        "{} (Failed over from {}/{}: {})",
                                        routing_decision.decision_reason,
                                        provider_id_str,
                                        model_id_str,
                                        error_envelope.user_message
                                    )),
                                    slm_confidence_score: routing_decision.confidence_metadata.slm_analysis_confidence,
                                    prompt_tokens: fb_prompt_tokens,
                                    completion_tokens: fb_completion_tokens,
                                    latency_ms: latency_ms + fb_latency,
                                    cost_usd: fb_cost,
                                    failover_used: Some(true),
                                    failover_from_provider: Some(provider_id_str.clone()),
                                    failover_from_model: Some(model_id_str.clone()),
                                    failover_reason: Some(error_envelope.user_message.clone()),
                                    failover_attempts: Some((fallback_idx + 2) as u32),
                                };

                                let assistant_message = self.chat_service.append_message(
                                    &session_id,
                                    MessageSender::Assistant,
                                    &fb_response_text,
                                    Some(assistant_metadata),
                                )?;

                                let explanation = self.routing_explanation_service.build_live_explanation(
                                    Some(&assistant_message.id),
                                    Some(&session_id),
                                    &task_analysis,
                                    &scoring_result,
                                    &routing_decision,
                                );
                                self.routing_explanation_service
                                    .store_live_explanation(&assistant_message.id, explanation);

                                let _ = self.telemetry_service.record_event(RecordTelemetryInput {
                                    event_type: Some(TelemetryEventType::ProviderExecution),
                                    session_id: Some(session_id.clone()),
                                    message_id: Some(assistant_message.id.clone()),
                                    provider_id: Some(cand_prov.clone()),
                                    model_id: Some(cand_model.clone()),
                                    outcome: Some(TelemetryOutcome::Succeeded),
                                    latency_ms: Some(fb_latency),
                                    prompt_tokens: Some(fb_prompt_tokens),
                                    completion_tokens: Some(fb_completion_tokens),
                                    cost_usd: Some(fb_cost),
                                    routing_reason: Some(format!("Failover from {}/{}", provider_id_str, model_id_str)),
                                    confidence_score: routing_decision.confidence_metadata.slm_analysis_confidence,
                                    ..Default::default()
                                });

                                let _ = self.execution_manager.finalize_execution(
                                    &execution_id,
                                    ExecutionLifecycleState::Completed,
                                    None,
                                    None,
                                );

                                let finish_reason = finish_reason_tracker.lock().unwrap().clone();
                                let finish_reason_str = match finish_reason {
                                    ProviderFinishReason::Completed => "completed",
                                    ProviderFinishReason::Length => "length",
                                    ProviderFinishReason::ContentFilter => "content_filter",
                                    ProviderFinishReason::Cancelled => "cancelled",
                                    ProviderFinishReason::Other(ref s) => s.as_str(),
                                };

                                let seq = fb_sequence_counter.fetch_add(1, Ordering::SeqCst);
                                let _ = sink_ref.send(ChatStreamEvent::Completed {
                                    stream_id: fb_stream_id,
                                    sequence: seq,
                                    finish_reason: finish_reason_str.to_string(),
                                    latency_ms: latency_ms + fb_latency,
                                    prompt_tokens: fb_prompt_tokens,
                                    completion_tokens: fb_completion_tokens,
                                    cost_usd: fb_cost,
                                    assistant_message,
                                });

                                return Ok(());
                            }
                            Err(_) if cancel_token.is_cancelled() => {
                                let _ = self.execution_manager.finalize_execution(
                                    &execution_id,
                                    ExecutionLifecycleState::Cancelled,
                                    Some(TerminationReason::UserCancelled),
                                    None,
                                );
                                let seq = fb_sequence_counter.fetch_add(1, Ordering::SeqCst);
                                let _ = sink_ref.send(ChatStreamEvent::Cancelled {
                                    stream_id: fb_stream_id,
                                    sequence: seq,
                                    execution_id: Some(execution_id.clone()),
                                    reason: "Execution was cancelled by user".to_string(),
                                    partial_text: None,
                                    timestamp_ms: SystemTime::now()
                                        .duration_since(UNIX_EPOCH)
                                        .map(|d| d.as_millis() as u64)
                                        .unwrap_or(0),
                                });
                                return Ok(());
                            }
                            Err(_) => {
                                continue;
                            }
                        }
                    }
                }

                let _ = self.execution_manager.finalize_execution(
                    &execution_id,
                    ExecutionLifecycleState::Failed,
                    Some(TerminationReason::ProviderFailed),
                    None,
                );

                let seq = sequence_counter.fetch_add(1, Ordering::SeqCst);
                let _ = sink_ref.send(ChatStreamEvent::Failed {
                    stream_id: stream_id.clone(),
                    sequence: seq,
                    code: error_envelope.error_code.clone(),
                    message: error_envelope.user_message.clone(),
                    is_retryable: e.is_retryable(),
                    error: Some(error_envelope),
                });

                return Err(AppError::Internal(format!(
                    "Provider streaming execution failed for '{}/{}': {}",
                    provider_id_str, model_id_str, e
                )));
            }
            Ok(()) => {
                if cancel_token.is_cancelled() {
                    let full_text = accumulated_text.lock().unwrap().clone();
                    let partial_text = if full_text.trim().is_empty() { None } else { Some(full_text.clone()) };

                    let _ = self.execution_manager.finalize_execution(
                        &execution_id,
                        ExecutionLifecycleState::Cancelled,
                        Some(TerminationReason::UserCancelled),
                        partial_text.clone(),
                    );

                    let seq = sequence_counter.fetch_add(1, Ordering::SeqCst);
                    let _ = sink_ref.send(ChatStreamEvent::Cancelled {
                        stream_id: stream_id.clone(),
                        sequence: seq,
                        execution_id: Some(execution_id.clone()),
                        reason: "Prompt generation was cancelled by user".to_string(),
                        partial_text,
                        timestamp_ms: SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .map(|d| d.as_millis() as u64)
                            .unwrap_or(0),
                    });

                    return Ok(());
                }
            }
        }

        // 15. Finalize Stream and Persist to SQLite
        let full_text = accumulated_text.lock().unwrap().clone();
        let response_text = full_text.trim().to_string();

        if response_text.is_empty() {
            let seq = sequence_counter.fetch_add(1, Ordering::SeqCst);
            let _ = sink_ref.send(ChatStreamEvent::Failed {
                stream_id: stream_id.clone(),
                sequence: seq,
                code: "EMPTY_RESPONSE".to_string(),
                message: "Provider returned empty completion content".to_string(),
                is_retryable: false,
            });

            return Err(AppError::Internal(
                "Provider returned empty completion content".to_string(),
            ));
        }

        let (prompt_tokens, completion_tokens) = {
            let usage_opt = usage_tracker.lock().unwrap();
            match *usage_opt {
                Some(ref u) => (u.input_tokens.unwrap_or(0), u.output_tokens.unwrap_or(0)),
                None => (
                    (prompt.len() as u32 / 4).max(1),
                    (response_text.len() as u32 / 4).max(1),
                ),
            }
        };

        let mut cost_usd = 0.0;
        if let Some(ref pricing) = catalog_model.pricing {
            if let (Some(in_rate), Some(out_rate)) = (
                pricing.input_cost_per_million,
                pricing.output_cost_per_million,
            ) {
                let in_cost = (prompt_tokens as f64 / 1_000_000.0) * in_rate;
                let out_cost = (completion_tokens as f64 / 1_000_000.0) * out_rate;
                cost_usd = in_cost + out_cost;
            }
        }

        // 16. Persist Assistant Message to SQLite with Metadata (EXACTLY ONCE)
        let assistant_metadata = ChatMessageMetadata {
            routed_provider: Some(provider_id_str.clone()),
            routed_model: Some(model_id_str.clone()),
            routing_reason: Some(routing_decision.decision_reason.clone()),
            slm_confidence_score: routing_decision.confidence_metadata.slm_analysis_confidence,
            prompt_tokens,
            completion_tokens,
            latency_ms,
            cost_usd,
        };

        let assistant_message = self.chat_service.append_message(
            &session_id,
            MessageSender::Assistant,
            &response_text,
            Some(assistant_metadata),
        )?;

        // Build and store live explanation in memory cache
        let explanation = self.routing_explanation_service.build_live_explanation(
            Some(&assistant_message.id),
            Some(&session_id),
            &task_analysis,
            &scoring_result,
            &routing_decision,
        );
        self.routing_explanation_service
            .store_live_explanation(&assistant_message.id, explanation);

        // 17. Record Operational Telemetry Event
        let _ = self.telemetry_service.record_event(RecordTelemetryInput {
            event_type: Some(TelemetryEventType::ProviderExecution),
            session_id: Some(session_id.clone()),
            message_id: Some(assistant_message.id.clone()),
            provider_id: Some(provider_id_str.clone()),
            model_id: Some(model_id_str.clone()),
            outcome: Some(TelemetryOutcome::Success),
            error_code: None,
            latency_ms: Some(latency_ms),
            prompt_tokens: Some(prompt_tokens),
            completion_tokens: Some(completion_tokens),
            cost_usd: Some(cost_usd),
            routing_reason: Some(routing_decision.decision_reason.clone()),
            confidence_score: routing_decision.confidence_metadata.slm_analysis_confidence,
            ..Default::default()
        });

        // 18. Emit Terminal Completed Event
        let seq = sequence_counter.fetch_add(1, Ordering::SeqCst);
        let fr = *finish_reason_tracker.lock().unwrap();

        let _ = sink_ref.send(ChatStreamEvent::Completed {
            stream_id,
            sequence: seq,
            finish_reason: format!("{:?}", fr),
            latency_ms,
            prompt_tokens,
            completion_tokens,
            cost_usd,
            assistant_message,
        });

        Ok(())
    }
}

/// Helper struct ensuring a cleanup closure executes upon scope exit (even on early return).
struct ScopeGuard<F: FnOnce()> {
    cleanup: Option<F>,
}

impl<F: FnOnce()> ScopeGuard<F> {
    fn new(cleanup: F) -> Self {
        Self {
            cleanup: Some(cleanup),
        }
    }
}

impl<F: FnOnce()> Drop for ScopeGuard<F> {
    fn drop(&mut self) {
        if let Some(cleanup) = self.cleanup.take() {
            cleanup();
        }
    }
}

fn uuid_or_timestamp() -> String {
    use std::time::SystemTime;
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    format!("{:x}", now)
}

