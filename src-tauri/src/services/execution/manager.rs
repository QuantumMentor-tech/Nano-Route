// ============================================================================
// Nano Route - Execution Lifecycle Manager
// File: src-tauri/src/services/execution/manager.rs
// ============================================================================
// Composition engine providing lifecycle control, cooperative cancellation,
// request ownership tracking, and single-finalization invariants.
// Strictly non-blocking and thread-safe.
// ============================================================================

use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};
use tokio_util::sync::CancellationToken;

use crate::errors::AppError;
use crate::services::execution::types::{
    CancellationResultDto, ExecutionContext, ExecutionLifecycleState, ExecutionStateDto,
    RecoveryContext, TerminationReason,
};

fn current_epoch_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Central native coordinator for prompt execution lifecycles and cancellation.
pub struct ExecutionManager {
    executions: RwLock<HashMap<String, Arc<RwLock<ExecutionContext>>>>,
    session_to_execution: RwLock<HashMap<String, String>>,
}

impl ExecutionManager {
    /// Constructs a new, empty ExecutionManager.
    pub fn new() -> Self {
        Self {
            executions: RwLock::new(HashMap::new()),
            session_to_execution: RwLock::new(HashMap::new()),
        }
    }

    /// Registers a new execution context, enforcing single active execution per session.
    /// Acquires locks in strict global order: executions -> session_to_execution -> ctx_arc
    /// and holds write locks across check-and-insert to eliminate TOCTOU concurrency races.
    pub fn create_execution(
        &self,
        execution_id: String,
        session_id: String,
        request_id: String,
        is_streaming: bool,
    ) -> Result<(Arc<RwLock<ExecutionContext>>, CancellationToken), AppError> {
        let now_ms = current_epoch_ms();
        let context = ExecutionContext::new(
            execution_id.clone(),
            session_id.clone(),
            request_id,
            is_streaming,
            now_ms,
        );
        let token = context.cancellation_token.clone();
        let context_arc = Arc::new(RwLock::new(context));

        // Acquire locks in canonical order: executions -> session_to_execution
        let mut exec_map = self.executions.write().map_err(|_| {
            AppError::Internal("Failed to acquire execution write lock".to_string())
        })?;
        let mut session_map = self.session_to_execution.write().map_err(|_| {
            AppError::Internal("Failed to acquire session execution write lock".to_string())
        })?;

        // 1. Atomic single-active-request guard per session (no TOCTOU window)
        if let Some(existing_exec_id) = session_map.get(&session_id) {
            if let Some(existing_ctx) = exec_map.get(existing_exec_id) {
                let lock = existing_ctx.read().map_err(|_| {
                    AppError::Internal("Failed to read existing execution context".to_string())
                })?;
                if lock.state.is_active() {
                    return Err(AppError::InvalidInput(format!(
                        "A prompt submission is already actively executing for session '{}'",
                        session_id
                    )));
                }
            }
        }

        // 2. Register atomically in thread-safe registry
        exec_map.insert(execution_id.clone(), context_arc.clone());
        session_map.insert(session_id, execution_id);

        Ok((context_arc, token))
    }

    /// Retrieves an execution context by its stable execution ID.
    pub fn get_execution(&self, execution_id: &str) -> Option<Arc<RwLock<ExecutionContext>>> {
        self.executions
            .read()
            .ok()
            .and_then(|map| map.get(execution_id).cloned())
    }

    /// Retrieves the active execution context for a given session ID, if one exists.
    /// Strict lock order: executions -> session_to_execution -> ctx_arc.
    pub fn get_active_execution_for_session(
        &self,
        session_id: &str,
    ) -> Option<Arc<RwLock<ExecutionContext>>> {
        let exec_map = self.executions.read().ok()?;
        let session_map = self.session_to_execution.read().ok()?;
        let exec_id = session_map.get(session_id)?;
        let ctx_arc = exec_map.get(exec_id)?;

        let lock = ctx_arc.read().ok()?;
        if lock.state.is_active() {
            Some(ctx_arc.clone())
        } else {
            None
        }
    }

    /// Transitions an execution to the next lifecycle state according to the state machine.
    pub fn transition_state(
        &self,
        execution_id: &str,
        next_state: ExecutionLifecycleState,
    ) -> Result<(), AppError> {
        let ctx_arc = self
            .get_execution(execution_id)
            .ok_or_else(|| AppError::NotFound(format!("Execution '{}' not found", execution_id)))?;

        let mut ctx = ctx_arc.write().map_err(|_| {
            AppError::Internal("Failed to acquire execution write lock for state transition".to_string())
        })?;

        if !ctx.state.can_transition_to(next_state) {
            return Err(AppError::InvalidInput(format!(
                "Illegal lifecycle transition from '{}' to '{}' for execution '{}'",
                ctx.state.as_str(),
                next_state.as_str(),
                execution_id
            )));
        }

        ctx.state = next_state;
        Ok(())
    }

    /// Updates route metadata on an active execution context.
    pub fn update_route(
        &self,
        execution_id: &str,
        provider_id: String,
        model_id: String,
        stream_id: Option<String>,
        user_message_id: Option<String>,
    ) -> Result<(), AppError> {
        let ctx_arc = self
            .get_execution(execution_id)
            .ok_or_else(|| AppError::NotFound(format!("Execution '{}' not found", execution_id)))?;

        let mut ctx = ctx_arc.write().map_err(|_| {
            AppError::Internal("Failed to acquire execution write lock".to_string())
        })?;

        ctx.provider_id = Some(provider_id);
        ctx.model_id = Some(model_id);
        if stream_id.is_some() {
            ctx.stream_id = stream_id;
        }
        if user_message_id.is_some() {
            ctx.user_message_id = user_message_id;
        }

        Ok(())
    }

    /// Requests cooperative cancellation for an execution by stable ID.
    /// Strictly idempotent: safe to call repeatedly without error or side-effects.
    pub fn request_cancellation(
        &self,
        execution_id: &str,
        reason: TerminationReason,
    ) -> Result<CancellationResultDto, AppError> {
        let ctx_arc = self
            .get_execution(execution_id)
            .ok_or_else(|| AppError::NotFound(format!("Execution '{}' not found", execution_id)))?;

        let mut ctx = ctx_arc.write().map_err(|_| {
            AppError::Internal("Failed to acquire execution write lock for cancellation".to_string())
        })?;

        let session_id = ctx.session_id.clone();

        // 1. Idempotent check for already-terminal executions
        if ctx.terminal_finalized || ctx.state.is_terminal() {
            return Ok(CancellationResultDto {
                execution_id: execution_id.to_string(),
                session_id,
                state: ctx.state,
                is_already_terminal: true,
                message: format!(
                    "Execution is already in a terminal state ('{}')",
                    ctx.state.as_str()
                ),
            });
        }

        // 2. Mark cancellation requested and trigger cooperative token
        ctx.cancellation_requested = true;
        ctx.termination_reason = Some(reason);
        ctx.state = ExecutionLifecycleState::Cancelling;
        ctx.cancellation_token.cancel();

        Ok(CancellationResultDto {
            execution_id: execution_id.to_string(),
            session_id,
            state: ExecutionLifecycleState::Cancelling,
            is_already_terminal: false,
            message: "Cancellation successfully requested; terminating active tasks".to_string(),
        })
    }

    /// Requests cancellation for whichever execution is actively running in the given session.
    pub fn request_cancellation_for_session(
        &self,
        session_id: &str,
        reason: TerminationReason,
    ) -> Result<Option<CancellationResultDto>, AppError> {
        let maybe_ctx = self.get_active_execution_for_session(session_id);
        match maybe_ctx {
            Some(ctx_arc) => {
                let exec_id = ctx_arc
                    .read()
                    .map_err(|_| AppError::Internal("Lock error".to_string()))?
                    .execution_id
                    .clone();
                self.request_cancellation(&exec_id, reason).map(Some)
            }
            None => Ok(None),
        }
    }

    /// Finalizes an execution into an irreversible terminal state (Single-Finalization Invariant).
    /// Returns `Ok(Some(RecoveryContext))` on first win; subsequent calls return `Ok(None)`.
    pub fn finalize_execution(
        &self,
        execution_id: &str,
        terminal_state: ExecutionLifecycleState,
        reason: Option<TerminationReason>,
        partial_content: Option<String>,
    ) -> Result<Option<RecoveryContext>, AppError> {
        let ctx_arc = self
            .get_execution(execution_id)
            .ok_or_else(|| AppError::NotFound(format!("Execution '{}' not found", execution_id)))?;

        let mut ctx = ctx_arc.write().map_err(|_| {
            AppError::Internal("Failed to acquire execution write lock for finalization".to_string())
        })?;

        // Single-Finalization Invariant: exactly one terminal path wins
        if ctx.terminal_finalized {
            return Ok(None);
        }

        ctx.terminal_finalized = true;
        ctx.state = terminal_state;
        let now_ms = current_epoch_ms();
        ctx.ended_at_ms = Some(now_ms);

        if let Some(r) = reason {
            ctx.termination_reason = Some(r);
        }
        if partial_content.is_some() {
            ctx.partial_content = partial_content;
        }

        // Guarantee cooperative token is cancelled so no background tasks linger
        ctx.cancellation_token.cancel();

        let term_reason = ctx
            .termination_reason
            .unwrap_or(if terminal_state == ExecutionLifecycleState::Cancelled {
                TerminationReason::UserCancelled
            } else if terminal_state == ExecutionLifecycleState::Completed {
                TerminationReason::ExecutionAborted
            } else {
                TerminationReason::ProviderFailed
            });

        let recovery = RecoveryContext {
            execution_id: ctx.execution_id.clone(),
            session_id: ctx.session_id.clone(),
            provider_id: ctx.provider_id.clone(),
            model_id: ctx.model_id.clone(),
            stream_id: ctx.stream_id.clone(),
            termination_reason: term_reason,
            was_streaming: ctx.is_streaming,
            started_at_ms: ctx.started_at_ms,
            ended_at_ms: now_ms,
            cancellation_requested: ctx.cancellation_requested,
            partial_output_available: ctx
                .partial_content
                .as_ref()
                .map(|s| !s.is_empty())
                .unwrap_or(false),
            cleanup_completed: true,
        };

        // Remove session mapping so future submissions for this session are unblocked
        if let Ok(mut session_map) = self.session_to_execution.write() {
            if let Some(registered_exec_id) = session_map.get(&ctx.session_id) {
                if registered_exec_id == execution_id {
                    session_map.remove(&ctx.session_id);
                }
            }
        }

        Ok(Some(recovery))
    }

    /// Queries the public state snapshot of an execution for IPC.
    pub fn get_execution_state(&self, execution_id: &str) -> Option<ExecutionStateDto> {
        let ctx_arc = self.get_execution(execution_id)?;
        let ctx = ctx_arc.read().ok()?;

        Some(ExecutionStateDto {
            execution_id: ctx.execution_id.clone(),
            session_id: ctx.session_id.clone(),
            state: ctx.state,
            is_streaming: ctx.is_streaming,
            provider_id: ctx.provider_id.clone(),
            model_id: ctx.model_id.clone(),
            cancellation_requested: ctx.cancellation_requested,
            started_at_ms: ctx.started_at_ms,
            ended_at_ms: ctx.ended_at_ms,
        })
    }

    /// Cleans up and removes a completed or cancelled execution from in-memory tracking.
    pub fn cleanup(&self, execution_id: &str) {
        if let Ok(mut exec_map) = self.executions.write() {
            if let Some(ctx_arc) = exec_map.remove(execution_id) {
                if let Ok(ctx) = ctx_arc.read() {
                    if let Ok(mut session_map) = self.session_to_execution.write() {
                        if session_map.get(&ctx.session_id).map(|s| s == execution_id).unwrap_or(false) {
                            session_map.remove(&ctx.session_id);
                        }
                    }
                }
            }
        }
    }

    /// Returns the number of currently tracked executions (useful for leak tests).
    pub fn get_active_count(&self) -> usize {
        self.executions
            .read()
            .map(|map| {
                map.values()
                    .filter(|ctx| {
                        ctx.read().map(|c| c.state.is_active()).unwrap_or(false)
                    })
                    .count()
            })
            .unwrap_or(0)
    }

    /// Returns all session IDs that currently have an active (non-terminal) execution.
    pub fn get_active_session_ids(&self) -> Vec<String> {
        self.executions
            .read()
            .map(|map| {
                let mut ids: Vec<String> = map
                    .values()
                    .filter_map(|ctx| {
                        let c = ctx.read().ok()?;
                        if c.state.is_active() {
                            Some(c.session_id.clone())
                        } else {
                            None
                        }
                    })
                    .collect();
                ids.sort();
                ids.dedup();
                ids
            })
            .unwrap_or_default()
    }

    /// Returns total registered execution count (including terminal before cleanup).
    pub fn get_total_count(&self) -> usize {
        self.executions.read().map(|map| map.len()).unwrap_or(0)
    }
}

