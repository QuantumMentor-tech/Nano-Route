/**
//! Nano Route — IPC Types and Contract Definitions
//!
//! Authoritative Request/Response DTOs, Event Payloads, Error Shapes,
//! and Channel Stream contracts across the frontend-to-Rust native boundary.
*/

// --- Core Status & Health DTOs ---

export type CoreStatus = "Ready" | "Degraded" | "Initializing" | "Error";

export interface SubsystemHealth {
  name: string;
  ready: boolean;
  details: string | null;
}

export interface NativeHealthReport {
  status: CoreStatus;
  message: string;
  subsystems: SubsystemHealth[];
  timestamp: string;
}

export interface NativeAppInfo {
  name: string;
  version: string;
  environment: string;
  target_os: string;
  arch: string;
}

export interface NativeHealthResponse {
  status: string;
  isNative: boolean;
}

// --- Diagnostic Ping DTOs ---

export interface IpcPingRequest {
  message: string;
  requestId?: string;
}

export interface IpcPingResponse {
  message: string;
  requestId: string;
  timestamp: string;
  durationMs: number;
}

// --- Task System Contracts (Step 13) ---

export type TaskKind =
  | "Application"
  | "Maintenance"
  | "Background"
  | "Blocking"
  | "CpuBound"
  | "Io";

export type TaskStatus =
  | "Created"
  | "Queued"
  | "Running"
  | "Cancelling"
  | "Completed"
  | "Failed"
  | "Cancelled";

export interface TaskMetadata {
  taskId: string;
  kind: TaskKind;
  status: TaskStatus;
  owner: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  parentTaskId?: string;
  cancellable: boolean;
  errorMessage?: string;
}

export interface ShutdownReport {
  cleanExit: boolean;
  completedCount: number;
  cancelledCount: number;
  abandonedCount: number;
  durationMs: number;
}

// --- Error Contracts (matching AppError) ---

export type IpcErrorCategory =
  | "ServiceUnavailable"
  | "InitializationFailed"
  | "InvalidInput"
  | "Internal";

export type IpcErrorCode =
  | "SERVICE_UNAVAILABLE"
  | "INITIALIZATION_FAILED"
  | "INVALID_INPUT"
  | "INTERNAL_ERROR"
  | "COMMAND_TIMEOUT"
  | "TRANSPORT_UNAVAILABLE"
  | "UNAUTHORIZED";

export interface IpcErrorPayload {
  code: IpcErrorCode | string;
  category: IpcErrorCategory;
  message: string;
  retryable: boolean;
  userActionRequired?: boolean;
  requestId?: string;
}

export interface IpcResult<T> {
  data: T | null;
  error: IpcErrorPayload | null;
  success: boolean;
}

// --- Authoritative Command Registry ---

export const IPC_COMMANDS = {
  HEALTH_CHECK: "cmd_health_check",
  GET_HEALTH: "cmd_get_health",
  GET_APP_INFO: "cmd_get_app_info",
  GET_LICENSE_INFO: "cmd_get_license_info",
  PING: "cmd_ping",
  START_STREAM: "cmd_start_stream",
  CANCEL_STREAM: "cmd_cancel_stream",
  GET_STREAM_STATUS: "cmd_get_stream_status",
  GET_DATABASE_HEALTH: "cmd_get_database_health",
  CREATE_CHAT_SESSION: "cmd_create_chat_session",
  GET_CHAT_SESSION: "cmd_get_chat_session",
  LIST_CHAT_SESSIONS: "cmd_list_chat_sessions",
  RENAME_CHAT_SESSION: "cmd_rename_chat_session",
  SET_CHAT_SESSION_PINNED: "cmd_set_chat_session_pinned",
  DELETE_CHAT_SESSION: "cmd_delete_chat_session",
  APPEND_CHAT_MESSAGE: "cmd_append_chat_message",
  GET_CHAT_MESSAGES: "cmd_get_chat_messages",
  GET_CHAT_CONVERSATION: "cmd_get_chat_conversation",
  DELETE_CHAT_MESSAGE: "cmd_delete_chat_message",
  LIST_HISTORY_SESSIONS: "cmd_list_history_sessions",
  SEARCH_HISTORY: "cmd_search_history",
  GET_HISTORY_FILTER_OPTIONS: "cmd_get_history_filter_options",
  DELETE_HISTORY_SESSIONS_BULK: "cmd_delete_history_sessions_bulk",
  REBUILD_HISTORY_SEARCH_INDEX: "cmd_rebuild_history_search_index",
  SUBMIT_CHAT_PROMPT: "cmd_submit_chat_prompt",
  STREAM_CHAT_PROMPT: "cmd_stream_chat_prompt",
  CANCEL_CHAT_EXECUTION: "cmd_cancel_chat_execution",
  CANCEL_SESSION_CHAT: "cmd_cancel_session_chat",
  GET_EXECUTION_STATE: "cmd_get_execution_state",
  PREFLIGHT_CHECK: "cmd_preflight_check",
  GET_QUOTA_SNAPSHOT: "cmd_get_quota_snapshot",
  RECORD_TELEMETRY_EVENT: "cmd_record_telemetry_event",
  LIST_TELEMETRY_RECORDS: "cmd_list_telemetry_records",
  GET_TELEMETRY_AGGREGATES: "cmd_get_telemetry_aggregates",
  GET_TELEMETRY_DASHBOARD_SNAPSHOT: "cmd_get_telemetry_dashboard_snapshot",
  GET_TELEMETRY_COST_ANALYTICS_SNAPSHOT: "cmd_get_telemetry_cost_analytics_snapshot",
  GET_TELEMETRY_PERFORMANCE_ANALYTICS_SNAPSHOT:
    "cmd_get_telemetry_performance_analytics_snapshot",
  CLEAR_TELEMETRY: "cmd_clear_telemetry",
  SAVE_PROVIDER_CREDENTIAL: "cmd_save_provider_credential",
  GET_PROVIDER_CREDENTIAL_STATUS: "cmd_get_provider_credential_status",
  LIST_PROVIDER_CREDENTIAL_STATUSES: "cmd_list_provider_credential_statuses",
  SET_PROVIDER_ACTIVE: "cmd_set_provider_active",
  DELETE_PROVIDER_CREDENTIAL: "cmd_delete_provider_credential",
  GET_APP_SETTINGS: "cmd_get_app_settings",
  GET_APP_SETTING: "cmd_get_app_setting",
  SET_APP_SETTING: "cmd_set_app_setting",
  RESET_APP_SETTING: "cmd_reset_app_setting",
  RESET_ALL_SETTINGS: "cmd_reset_all_settings",
  GET_SETTINGS_WORKSPACE_SNAPSHOT: "cmd_get_settings_workspace_snapshot",
  GET_PROVIDER_PREFERENCES: "cmd_get_provider_preferences",
  LIST_PROVIDER_PREFERENCES: "cmd_list_provider_preferences",
  UPDATE_PROVIDER_PREFERENCES: "cmd_update_provider_preferences",
  RESET_PROVIDER_PREFERENCES: "cmd_reset_provider_preferences",
  LIST_REGISTERED_PROVIDERS: "cmd_list_registered_providers",
  GET_REGISTERED_PROVIDER: "cmd_get_registered_provider",
  LIST_REGISTERED_MODELS: "cmd_list_registered_models",
  GET_REGISTERED_MODEL: "cmd_get_registered_model",
  RESOLVE_EFFECTIVE_PROVIDERS: "cmd_resolve_effective_providers",
  RESOLVE_HISTORICAL_MODEL: "cmd_resolve_historical_model",
  GET_PROVIDER_HEALTH: "cmd_get_provider_health",
  GET_ALL_PROVIDER_HEALTH: "cmd_get_all_provider_health",
  GET_PROVIDER_CAPABILITIES: "cmd_get_provider_capabilities",
  GET_MODEL_CAPABILITIES: "cmd_get_model_capabilities",
  PREFLIGHT_PROVIDER_REQUEST: "cmd_preflight_provider_request",
  CHECK_PROVIDER_HEALTH: "cmd_check_provider_health",
  GET_LOCAL_RUNTIME_STATUS: "cmd_get_local_runtime_status",
  GET_LOCAL_MODEL_STATUS: "cmd_get_local_model_status",
  INITIALIZE_LOCAL_RUNTIME: "cmd_initialize_local_runtime",
  LOAD_ROUTER_MODEL: "cmd_load_router_model",
  UNLOAD_ROUTER_MODEL: "cmd_unload_router_model",
  GET_LOCAL_RUNTIME_METRICS: "cmd_get_local_runtime_metrics",
  RUN_LOCAL_INFERENCE: "cmd_run_local_inference",
  CLASSIFY_INTENT: "cmd_classify_intent",
  GET_CLASSIFIER_STATUS: "cmd_get_classifier_status",
  EVALUATE_CLASSIFIER: "cmd_evaluate_classifier",
  ANALYZE_TASK: "cmd_analyze_task",
  GET_TASK_ANALYZER_STATUS: "cmd_get_task_analyzer_status",
  SCORE_ROUTING_CANDIDATES: "cmd_score_routing_candidates",
  GET_ROUTING_SCORING_STATUS: "cmd_get_routing_scoring_status",
  GET_SCORING_WEIGHTS: "cmd_get_scoring_weights",
  UPDATE_SCORING_WEIGHTS: "cmd_update_scoring_weights",
  EVALUATE_ROUTING_POLICY: "cmd_evaluate_routing_policy",
  GET_ROUTING_POLICY_CONFIG: "cmd_get_routing_policy_config",
  UPDATE_ROUTING_POLICY_CONFIG: "cmd_update_routing_policy_config",
  VALIDATE_MANUAL_OVERRIDE: "cmd_validate_manual_override",
  GET_ROUTING_EXPLANATION: "cmd_get_routing_explanation",
  CLASSIFY_ERROR: "cmd_classify_error",
  GET_DATA_INVENTORY: "cmd_get_data_inventory",
  RUN_DATA_AUDIT: "cmd_run_data_audit",
  RUN_SAFE_DATA_REPAIR: "cmd_run_safe_data_repair",
  GET_RETENTION_POLICY: "cmd_get_retention_policy",
  UPDATE_RETENTION_POLICY: "cmd_update_retention_policy",
  PREVIEW_DATA_CLEANUP: "cmd_preview_data_cleanup",
  RUN_DATA_CLEANUP: "cmd_run_data_cleanup",
  PREVIEW_FULL_DATA_WIPE: "cmd_preview_full_data_wipe",
  RUN_FULL_DATA_WIPE: "cmd_run_full_data_wipe",
} as const;

export type IpcCommandName = (typeof IPC_COMMANDS)[keyof typeof IPC_COMMANDS];

// --- Authoritative Event Registry ---

export const IPC_EVENTS = {
  APP_LIFECYCLE_CHANGED: "app_lifecycle_changed",
  DIAGNOSTIC_NOTIFICATION: "diagnostic_notification",
} as const;

export type IpcEventName = (typeof IPC_EVENTS)[keyof typeof IPC_EVENTS];

export interface AppLifecycleEventPayload {
  state: string;
  timestamp: string;
  requestId?: string;
}

export interface DiagnosticEventPayload {
  level: "info" | "warn" | "error";
  message: string;
  timestamp: string;
  requestId?: string;
}

export interface IpcEventPayloadMap {
  [IPC_EVENTS.APP_LIFECYCLE_CHANGED]: AppLifecycleEventPayload;
  [IPC_EVENTS.DIAGNOSTIC_NOTIFICATION]: DiagnosticEventPayload;
}

export type UnlistenFn = () => void;

// --- Channel Contracts (Step 12 Foundation for Step 15 Streaming) ---

export interface ChannelStreamChunk<T> {
  chunkIndex: number;
  data: T;
  isFinal: boolean;
  requestId: string;
}

export interface ChannelStreamError {
  code: string;
  message: string;
  requestId: string;
}

export type StreamConsumer<T> = (chunk: ChannelStreamChunk<T>) => void;

export interface ChannelDescriptor {
  channelName: string;
  purpose: string;
  direction: "RustToFrontend" | "Bidirectional";
  dataType: string;
  plannedStep: number;
}

// ============================================================================
// --- AI Provider Subsystem Contracts (Step 14) ---
// ============================================================================

export type WellKnownProviderId =
  | "openai"
  | "anthropic"
  | "gemini"
  | "deepseek"
  | "mistral"
  | "xai"
  | "groq"
  | "local"
  | "custom";

export type ProviderId = WellKnownProviderId | string;

export type ProviderCapability =
  | "text_generation"
  | "chat_completion"
  | "streaming"
  | "vision"
  | "vision_input"
  | "image_input"
  | "tool_calling"
  | "structured_output"
  | "json_mode"
  | "embeddings"
  | "large_context"
  | "reasoning"
  | "reasoning_tokens"
  | "code_generation"
  | "system_prompts"
  | "system_messages"
  | "file_input"
  | "audio_input"
  | "audio_output"
  | "token_log_probs"
  | "custom_stop_sequences";

export interface ProviderCapabilitiesDto {
  capabilities: ProviderCapability[];
}

export type ModelAvailability =
  | "Available"
  | "Deprecated"
  | "Preview"
  | "RequiresTierUpgrade"
  | "Offline";

export interface ModelPricing {
  promptCostPerMtokenUsd?: number;
  completionCostPerMtokenUsd?: number;
  isFree?: boolean;
  inputCostPerMillion?: number;
  outputCostPerMillion?: number;
  currency?: string;
}

export interface ProviderModel {
  id: string;
  displayName: string;
  providerId: ProviderId;
  capabilities: ProviderCapability[];
  contextWindowTokens: number;
  maxOutputTokens: number;
  pricing: ModelPricing;
  availability: ModelAvailability;
}

export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface ProviderMessage {
  role: MessageRole;
  content: string;
  name?: string;
}

export interface GenerationParams {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  stopSequences?: string[];
  reasoningEffort?: string;
  seed?: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parametersSchemaJson: string;
}

export interface RequestMetadata {
  requestId: string;
  clientSessionId?: string;
  timeoutMs?: number;
  tags?: Record<string, string>;
}

export interface ProviderRequest {
  modelId: string;
  messages: ProviderMessage[];
  params: GenerationParams;
  tools?: ToolDefinition[];
  metadata: RequestMetadata;
}

export type ProviderFinishReason =
  | "stop"
  | "length"
  | "tool_calls"
  | "content_filter"
  | "cancelled"
  | "error"
  | "unknown";

export interface ProviderUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  reasoningTokens?: number;
  estimatedCostUsd?: number;
}

export interface ResponseMetadata {
  latencyMs?: number;
  systemFingerprint?: string;
  throughputTokensPerSec?: number;
}

export interface ProviderResponse {
  id: string;
  providerId: ProviderId;
  modelId: string;
  content: string;
  finishReason: ProviderFinishReason;
  usage: ProviderUsage;
  metadata: ResponseMetadata;
}

export type ProviderHealth =
  | "unknown"
  | "available"
  | "unavailable"
  | "degraded"
  | "unauthorized"
  | "rate_limited"
  | "misconfigured"
  | "disabled";

export interface ProviderHealthReport {
  status: ProviderHealth;
  checkedAtMs: number;
  latencyMs?: number;
  message?: string;
}

export type ProviderErrorKind =
  | "authentication_failed"
  | "rate_limited"
  | "quota_exceeded"
  | "model_not_found"
  | "invalid_request"
  | "context_length_exceeded"
  | "provider_unavailable"
  | "network_error"
  | "timeout"
  | "cancelled"
  | "capability_unsupported"
  | "response_parsing_failed"
  | "internal";

export interface ProviderError {
  providerId?: ProviderId;
  kind: ProviderErrorKind;
  message: string;
  statusCode?: number;
  retryAfterMs?: number;
  sourceCode?: string;
  isRetryable: boolean;
}

export interface ProviderMetadata {
  id: ProviderId;
  name: string;
  description: string;
  docUrl?: string;
  isLocal: boolean;
  isBuiltIn: boolean;
  capabilities: ProviderCapability[];
  models: ProviderModel[];
}

// ============================================================================
// --- Streaming Transport Contracts (Step 15) ---
// ============================================================================

export type StreamLifecycleState =
  | "created"
  | "starting"
  | "streaming"
  | "completed"
  | "cancelled"
  | "failed";

export interface StreamMetadata {
  latencyMs?: number;
  systemFingerprint?: string;
  throughputTokensPerSec?: number;
  extra?: Record<string, string>;
}

export type MockStreamMode =
  | { success: { chunkCount: number; delayMs: number } }
  | "empty"
  | { slow: { delayMs: number } }
  | { failure: { failAtChunk: number } }
  | { largeOutput: { chunkCount: number } };

export interface StreamStartedEvent {
  type: "started";
  streamId: string;
  sequence: number;
  taskId?: string;
  providerId?: ProviderId;
  modelId?: string;
  timestampMs: number;
}

export interface StreamDeltaEvent {
  type: "delta";
  streamId: string;
  sequence: number;
  text: string;
}

export interface StreamMetadataEvent {
  type: "metadata";
  streamId: string;
  sequence: number;
  metadata: StreamMetadata;
}

export interface StreamCompletedEvent {
  type: "completed";
  streamId: string;
  sequence: number;
  finishReason: ProviderFinishReason;
  usage?: ProviderUsage;
  modelId?: string;
}

export interface StreamCancelledEvent {
  type: "cancelled";
  streamId: string;
  sequence: number;
  reason?: string;
}

export interface StreamErrorEvent {
  type: "error";
  streamId: string;
  sequence: number;
  code: string;
  message: string;
  isRetryable: boolean;
}

export type StreamEvent =
  | StreamStartedEvent
  | StreamDeltaEvent
  | StreamMetadataEvent
  | StreamCompletedEvent
  | StreamCancelledEvent
  | StreamErrorEvent;

export interface StreamRequest {
  streamId: string;
  sessionId?: string;
  messageId?: string;
  providerId?: ProviderId;
  modelId: string;
  prompt?: string;
  testMode?: MockStreamMode;
}

export interface StreamStartResult {
  streamId: string;
  accepted: boolean;
  taskId?: string;
}

// ============================================================================
// --- SQLite Persistence & Database Contracts (Step 16) ---
// ============================================================================

export type DatabaseStatus = "Initializing" | "Ready" | "Degraded" | "Failed";

export interface DatabaseHealthReport {
  status: DatabaseStatus;
  schemaVersion: number;
  migrationsApplied: number;
  integrityOk: boolean;
  walEnabled: boolean;
  databasePath: string;
  latencyMs: number;
}

// ============================================================================
// --- Chat Session & Message Persistence Contracts (Step 17) ---
// ============================================================================

export type MessageSender = "user" | "assistant" | "system";

export interface ChatMessageMetadata {
  routedProvider?: string | null;
  routedModel?: string | null;
  routingReason?: string | null;
  slmConfidenceScore?: number | null;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  costUsd: number;
  failoverUsed?: boolean | null;
  failoverFromProvider?: string | null;
  failoverFromModel?: string | null;
  failoverReason?: string | null;
  failoverAttempts?: number | null;
  retryCount?: number | null;
  totalAttempts?: number | null;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  sender: MessageSender;
  content: string;
  metadata: ChatMessageMetadata;
  createdAt: number;
  isStreaming?: boolean;
  isFailed?: boolean;
  isCancelled?: boolean;
  status?: "pending" | "streaming" | "completed" | "failed" | "cancelled";
  error?: ErrorEnvelope;
}

export interface ChatConversation {
  session: ChatSession;
  messages: ChatMessage[];
}

export interface CreateChatSessionRequest {
  title?: string;
  pinned?: boolean;
}

export interface AppendChatMessageRequest {
  sessionId: string;
  sender: MessageSender;
  content: string;
  metadata?: Partial<ChatMessageMetadata>;
}

export interface ListChatSessionsRequest {
  limit?: number;
  offset?: number;
}

export interface GetChatMessagesRequest {
  sessionId: string;
  limit?: number;
  offset?: number;
}

export interface ChatManualRouteOverrideDto {
  providerId: string;
  modelId: string;
}

export interface ChatSubmissionRequest {
  requestId?: string;
  executionId?: string;
  sessionId: string;
  prompt: string;
  manualOverride?: ChatManualRouteOverrideDto;
}

export interface ChatSubmissionResult {
  requestId: string;
  executionId?: string;
  sessionId: string;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  routedProvider: string;
  routedModel: string;
  selectionMode: string;
  routingReason: string;
  slmConfidence: number | null;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  status: string;
}

// ============================================================================
// --- Chat Streaming Contracts (Step 33) ---
// ============================================================================

export type ChatStreamEventType = "started" | "delta" | "usage" | "completed" | "failed" | "cancelled" | "failover" | "retry";

export interface ChatStreamStartedEvent {
  type: "started";
  streamId: string;
  sequence: number;
  requestId: string;
  sessionId: string;
  userMessageId: string;
  providerId: string;
  modelId: string;
  selectionMode: string;
  routingReason: string;
  slmConfidence: number | null;
  timestampMs: number;
  executionId?: string;
}

export interface ChatStreamDeltaEvent {
  type: "delta";
  streamId: string;
  sequence: number;
  text: string;
}

export interface ChatStreamUsageEvent {
  type: "usage";
  streamId: string;
  sequence: number;
  promptTokens: number;
  completionTokens: number;
}

export interface ChatStreamCompletedEvent {
  type: "completed";
  streamId: string;
  sequence: number;
  finishReason: string;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  assistantMessage: ChatMessage;
}

export interface ChatStreamFailedEvent {
  type: "failed";
  streamId: string;
  sequence: number;
  code: string;
  message: string;
  isRetryable: boolean;
  error?: ErrorEnvelope;
}

export interface ChatStreamCancelledEvent {
  type: "cancelled";
  streamId: string;
  sequence: number;
  executionId?: string;
  reason: string;
  partialText?: string;
  timestampMs: number;
}

export interface ChatStreamFailoverEvent {
  type: "failover";
  streamId: string;
  sequence: number;
  logicalRequestId?: string;
  attempt: number;
  fromProvider: string;
  fromModel: string;
  toProvider: string;
  toModel: string;
  reason: string;
  newStreamId: string;
  timestampMs: number;
  executionId?: string;
}

export interface ChatStreamRetryEvent {
  type: "retry";
  streamId: string;
  sequence: number;
  logicalRequestId?: string;
  attempt: number;
  maxRetries: number;
  delayMs: number;
  providerId: string;
  modelId: string;
  reason: string;
  timestampMs: number;
  executionId?: string;
}

export type ChatStreamEvent =
  | ChatStreamStartedEvent
  | ChatStreamDeltaEvent
  | ChatStreamUsageEvent
  | ChatStreamCompletedEvent
  | ChatStreamFailedEvent
  | ChatStreamCancelledEvent
  | ChatStreamFailoverEvent
  | ChatStreamRetryEvent;

// ============================================================================
// --- Execution Lifecycle & Cancellation Contracts (Step 35) ---
// ============================================================================

export type ExecutionLifecycleState =
  | "created"
  | "validating"
  | "routing"
  | "route_resolved"
  | "executing"
  | "streaming"
  | "cancelling"
  | "cancelled"
  | "completed"
  | "failed"
  | "recovering";

export type TerminationReasonDto =
  | "user_cancelled"
  | "session_changed"
  | "view_disposed"
  | "application_interrupted"
  | "transport_interrupted"
  | "stream_closed"
  | "execution_aborted"
  | "provider_failed"
  | "unknown_interruption";

export interface CancellationResultDto {
  executionId: string;
  previousState: ExecutionLifecycleState;
  state: ExecutionLifecycleState;
  cancelled: boolean;
  reason: TerminationReasonDto;
  durationMs: number;
  message?: string;
}

export interface ExecutionStateDto {
  executionId: string;
  requestId: string;
  sessionId: string;
  state: ExecutionLifecycleState;
  providerId?: string;
  modelId?: string;
  streamId?: string;
  startedAtMs: number;
  endedAtMs?: number;
  durationMs: number;
  isActive: boolean;
  isTerminal: boolean;
  canCancel: boolean;
  terminationReason?: TerminationReasonDto;
}

export interface RecoveryContextDto {
  executionId: string;
  sessionId: string;
  providerId?: string;
  modelId?: string;
  streamId?: string;
  terminationReason: TerminationReasonDto;
  wasStreaming: boolean;
  startedAtMs: number;
  endedAtMs: number;
  durationMs: number;
  partialTextLen: number;
  errorMessage?: string;
}

// ============================================================================
// --- Telemetry Persistence & Analytics Contracts (Step 18) ---
// ============================================================================

export type TelemetryEventType =
  | "routing_decision"
  | "provider_execution"
  | "stream_lifecycle"
  | "fallback_transition"
  | "system_event";

export type TelemetryOutcome =
  | "success"
  | "failure"
  | "cancelled"
  | "timeout"
  | "rate_limited"
  | "unavailable"
  | "fallback";

export interface TelemetryRecord {
  id: string;
  eventType: TelemetryEventType;
  occurredAt: number;
  sessionId?: string | null;
  messageId?: string | null;
  taskId?: string | null;
  streamId?: string | null;
  providerId?: string | null;
  modelId?: string | null;
  outcome: TelemetryOutcome;
  errorCode?: string | null;
  latencyMs?: number | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  costUsd?: number | null;
  confidence?: number | null;
  routingReason?: string | null;
}

export interface TelemetryFilter {
  startTime?: number;
  endTime?: number;
  sessionId?: string;
  providerId?: string;
  modelId?: string;
  eventType?: TelemetryEventType;
  outcome?: TelemetryOutcome;
}

export interface TelemetryAggregateReport {
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalCostUsd: number;
  avgLatencyMs?: number | null;
  minLatencyMs?: number | null;
  maxLatencyMs?: number | null;
}

export interface RecordTelemetryInput {
  eventType?: TelemetryEventType;
  sessionId?: string;
  messageId?: string;
  taskId?: string;
  streamId?: string;
  providerId?: string;
  modelId?: string;
  outcome?: TelemetryOutcome;
  errorCode?: string;
  latencyMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  costUsd?: number;
  confidence?: number;
  routingReason?: string;
}

// ============================================================================
// --- Windows DPAPI Credential Vault Contracts (Step 19) ---
// ============================================================================

export interface ProviderCredentialStatus {
  providerId: string;
  isConfigured: boolean;
  isActive: boolean;
  priorityWeight: number;
  baseUrl?: string | null;
  monthlyBudgetLimit?: number | null;
  currentMonthSpend: number;
  updatedAt: number;
}

export interface SaveCredentialRequest {
  providerId: string;
  apiKey: string;
  baseUrl?: string | null;
  isActive?: boolean;
  priorityWeight?: number;
  monthlyBudgetLimit?: number | null;
}

// ============================================================================
// --- Application Settings & Provider Preferences Contracts (Step 20) ---
// ============================================================================

export type RoutingPreferenceMode = "quality" | "balanced" | "cost_saving";

export type AppSettingKeyString =
  | "routing.preference_mode"
  | "telemetry.enabled"
  | "history.retention_days"
  | "window.start_maximized"
  | "routing.manual_override_enabled"
  | "routing.manual_override_provider"
  | "routing.manual_override_model";

export interface AppSettingsSnapshot {
  routingPreferenceMode: RoutingPreferenceMode;
  telemetryEnabled: boolean;
  historyRetentionDays: number;
  windowStartMaximized: boolean;
  manualOverrideEnabled?: boolean;
  manualOverrideProvider?: string;
  manualOverrideModel?: string;
}

export interface ProviderSettingsSummaryDto {
  providerId: string;
  displayName: string;
  description: string;
  defaultBaseUrl: string;
  documentationUrl?: string | null;
  configuredBaseUrl?: string | null;
  isConfigured: boolean;
  isActive: boolean;
  priorityWeight: number;
  monthlyBudgetLimit?: number | null;
  currentMonthSpend: number;
  healthState: string;
  healthCheckedAtMs?: number | null;
  modelCount: number;
  defaultModelId: string;
  capabilities: string[];
}

export interface ModelSettingsSummaryDto {
  providerId: string;
  modelId: string;
  displayName: string;
  isActive: boolean;
  contextWindow: number;
  maxOutputTokens: number;
  isDefault: boolean;
  capabilities: string[];
}

export interface SecurityStatusSummaryDto {
  dpapiProtectionActive: boolean;
  localStorageType: string;
  plaintextKeysProhibited: boolean;
  remoteSyncDisabled: boolean;
  lastAuditTimeMs?: number | null;
}

export interface SettingsWorkspaceSnapshotDto {
  appSettings: AppSettingsSnapshot;
  providers: ProviderSettingsSummaryDto[];
  models: ModelSettingsSummaryDto[];
  routingPolicy: RoutingPolicyConfigDto;
  securityStatus: SecurityStatusSummaryDto;
}

export interface UpdateProviderPreferencesRequest {
  providerId: string;
  baseUrl?: string | null;
  isActive?: boolean;
  priorityWeight?: number;
  monthlyBudgetLimit?: number | null;
}

// ============================================================================
// --- Provider & Model Registry Contracts (Step 21) ---
// ============================================================================

export type ProviderImplementationState = "planned" | "implemented" | "unavailable";
export type ProviderLifecycleState = "active" | "deprecated" | "disabled";

export interface ProviderDescriptorDto {
  providerId: string;
  displayName: string;
  description: string;
  defaultBaseUrl: string;
  documentationUrl?: string | null;
  capabilities: { capabilities: ProviderCapability[] };
  implementationState: ProviderImplementationState;
  lifecycleState: ProviderLifecycleState;
  defaultModelId?: string | null;
  credentialRequired: boolean;
}

export interface ModelDescriptorDto {
  providerId: string;
  modelId: string;
  displayName: string;
  description?: string | null;
  contextWindow: number;
  maxOutputTokens?: number | null;
  capabilities: { capabilities: ProviderCapability[] };
  pricing?: ModelPricing | null;
  availability: ModelAvailability;
  isDefault: boolean;
}

export interface EffectiveProviderDto {
  providerId: string;
  displayName: string;
  description: string;
  defaultBaseUrl: string;
  effectiveBaseUrl: string;
  documentationUrl?: string | null;
  isActive: boolean;
  priorityWeight: number;
  monthlyBudgetLimit?: number | null;
  currentMonthSpend: number;
  isCredentialConfigured: boolean;
  credentialRequired: boolean;
  implementationState: ProviderImplementationState;
  lifecycleState: ProviderLifecycleState;
  defaultModelId?: string | null;
  models: ModelDescriptorDto[];
}

export interface HistoricalModelDto {
  providerId: string;
  modelId: string;
  displayName: string;
  isKnownInActiveRegistry: boolean;
}

// ============================================================================
// --- Provider Runtime Health & Capability Intelligence Contracts (Step 25) ---
// ============================================================================

export type RuntimeHealthState =
  | "unknown"
  | "ready"
  | "degraded"
  | "rate_limited"
  | "authentication_failed"
  | "authorization_failed"
  | "provider_unavailable"
  | "endpoint_misconfigured"
  | "credential_missing"
  | "provider_disabled"
  | "model_unavailable"
  | "request_rejected"
  | "ready_pending_verification"
  | "stale";

export interface RateLimitInfoDto {
  isLimited: boolean;
  retryAfterAtMs?: number | null;
  remainingRequests?: number | null;
  remainingTokens?: number | null;
  resetRequestsAtMs?: number | null;
  resetTokensAtMs?: number | null;
}

export interface ModelHealthSnapshotDto {
  providerId: string;
  modelId: string;
  state: RuntimeHealthState;
  lastObservedAtMs?: number | null;
  lastSuccessAtMs?: number | null;
  lastFailureAtMs?: number | null;
  lastErrorCategory?: string | null;
}

export interface ProviderHealthSnapshotDto {
  providerId: string;
  displayName: string;
  state: RuntimeHealthState;
  isEnabled: boolean;
  isCredentialConfigured: boolean;
  isAdapterImplemented: boolean;
  reasonCode?: string | null;
  lastObservedAtMs?: number | null;
  lastSuccessAtMs?: number | null;
  lastFailureAtMs?: number | null;
  lastLatencyMs?: number | null;
  lastHttpStatus?: number | null;
  lastProviderRequestId?: string | null;
  rateLimitInfo: RateLimitInfoDto;
  models: ModelHealthSnapshotDto[];
}

export interface RequestRequirementsDto {
  requiresText?: boolean;
  requiresStreaming?: boolean;
  requiresSystemMessages?: boolean;
  requiresTools?: boolean;
  requiresVision?: boolean;
  requiresAudio?: boolean;
  requiresStructuredOutput?: boolean;
  requiredContextTokens?: number | null;
}

export type PreflightBlockReason =
  | "provider_not_found"
  | "adapter_not_implemented"
  | "provider_disabled"
  | "credential_missing"
  | "endpoint_misconfigured"
  | "model_not_found"
  | "model_retired_or_unavailable"
  | "capability_unsupported"
  | "context_length_exceeded"
  | "authentication_failed"
  | "rate_limited"
  | "provider_unavailable"
  | "model_runtime_unavailable";

export interface PreflightEvaluationDto {
  allowed: boolean;
  blockReason?: PreflightBlockReason | null;
  message: string;
  evaluatedAtMs: number;
}

export interface CheckProviderHealthResultDto {
  providerId: string;
  modelId?: string | null;
  status: RuntimeHealthState;
  latencyMs?: number | null;
  httpStatus?: number | null;
  errorCategory?: string | null;
  checkedAtMs: number;
}

// ============================================================================
// --- Local SLM Runtime & On-Device Inference Engine Contracts (Step 26) ---
// ============================================================================

export type LocalRuntimeState =
  | "uninitialized"
  | "initializing"
  | "ready"
  | "loading_model"
  | "running"
  | "unloading"
  | "failed"
  | "shutting_down";

export type LocalModelStatus =
  | "not_installed"
  | "not_loaded"
  | "loaded"
  | "integrity_failed"
  | "load_failed";

export type InferenceBackendType = "onnx" | "gguf" | "mock";
export type ExecutionProviderType = "cpu" | "direct_ml" | "cuda" | "simulated";

export interface LocalRuntimeStatusDto {
  state: LocalRuntimeState;
  backend: InferenceBackendType;
  executionProvider: ExecutionProviderType;
  modelId?: string | null;
  modelVersion?: string | null;
  modelStatus: LocalModelStatus;
  runtimeVersion: string;
  isBusy: boolean;
  queueDepth: number;
  lastInferenceAtMs?: number | null;
  lastLatencyMs?: number | null;
  lastError?: string | null;
}

export interface LocalRuntimeMetricsDto {
  totalInferences: number;
  successfulInferences: number;
  failedInferences: number;
  cancelledInferences: number;
  lastTokenizationMs: number;
  lastQueueWaitMs: number;
  lastInferenceMs: number;
  lastTotalMs: number;
  lastInputTokens: number;
  averageInferenceMs: number;
  coldLoadMs?: number | null;
}

export interface LocalInferenceResultDto {
  requestId: string;
  modelId: string;
  outputShape: number[];
  logitsPreview: number[];
  latencyMs: number;
  tokenCount: number;
}

// ============================================================================
// --- Step 27 Intent Classifier Subsystem Contracts ---
// ============================================================================

export type UserIntent =
  | "software_engineering"
  | "code_debugging"
  | "reasoning_math"
  | "general_conversation"
  | "research_retrieval"
  | "writing"
  | "data_analysis"
  | "translation"
  | "summarization"
  | "creative_generation"
  | "other"
  | "unknown";

export type AmbiguityState =
  | "not_ambiguous"
  | "ambiguous"
  | "multi_intent"
  | "unknown";

export type ClassifierAvailability =
  | "available"
  | "not_installed"
  | "model_invalid"
  | "runtime_unavailable"
  | "model_incompatible"
  | "failed";

export interface IntentCandidateDto {
  intent: UserIntent;
  normalizedScore: number;
  rawScore: number;
}

export interface IntentClassificationRequestDto {
  requestId?: string;
  text: string;
  conversationContext?: string[];
  languageHint?: string;
}

export interface IntentClassificationResultDto {
  requestId: string;
  primaryIntent: UserIntent;
  confidence: number;
  alternatives: IntentCandidateDto[];
  ambiguity: AmbiguityState;
  classifierModelId: string;
  classifierModelVersion: string;
  classifierSchemaVersion: string;
  inferenceLatencyMs: number;
  totalLatencyMs: number;
  explanation: string;
}

export interface ClassifierStatusDto {
  availability: ClassifierAvailability;
  modelId: string | null;
  modelVersion: string | null;
  schemaVersion: string;
  supportedIntents: UserIntent[];
  runtimeState: LocalRuntimeState;
  lastLatencyMs: number | null;
  lastError: string | null;
}

export interface ClassifierEvalReportDto {
  datasetVersion: string;
  totalSamples: number;
  correctPrimaryCount: number;
  accuracyPercentage: number;
  ambiguityCount: number;
  multiIntentCount: number;
  unknownCount: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
}

// ============================================================================
// --- Step 28 Task Analysis Subsystem Contracts ---
// ============================================================================

export type TaskComplexity =
  | "trivial"
  | "low"
  | "moderate"
  | "high"
  | "very_high"
  | "unknown";

export type TaskDomain =
  | "software_engineering"
  | "mathematics"
  | "research"
  | "long_form_writing"
  | "business"
  | "data_analysis"
  | "education"
  | "translation"
  | "planning"
  | "technical_documentation"
  | "creative"
  | "general"
  | "other"
  | "unknown";

export type AnalysisSource =
  | "model"
  | "explicit_user_requirement"
  | "strong_structural_signal"
  | "heuristic"
  | "derived"
  | "unknown";

export type TaskCapabilityRequirement =
  | "text_generation"
  | "long_context"
  | "multi_turn_context"
  | "code_understanding"
  | "code_generation"
  | "mathematical_reasoning"
  | "deep_reasoning"
  | "structured_output"
  | "document_analysis"
  | "large_document_ingestion"
  | "web_retrieval"
  | "image_input"
  | "audio_input"
  | "video_input"
  | "tool_calling"
  | "file_handling"
  | "citation_support"
  | "search_grounding"
  | "translation"
  | "summarization";

export type RequirementStrength =
  | "required"
  | "preferred"
  | "not_required"
  | "unknown";

export interface TaskCapabilityAssessmentDto {
  capability: TaskCapabilityRequirement;
  strength: RequirementStrength;
  confidence: number;
  source: AnalysisSource;
  reasonCode: string;
}

export interface DomainCandidateDto {
  domain: TaskDomain;
  confidence: number;
  source: AnalysisSource;
}

export interface AnalysisEvidenceDto {
  code: string;
  description: string;
  source: AnalysisSource;
  weight: number;
}

export interface AnalysisConflictDto {
  dimension: string;
  modelSignal: string | null;
  explicitSignal: string;
  resolution: string;
}

export type AnalysisCompleteness =
  | "complete"
  | "partial"
  | "uncertain"
  | "failed";

export type AnalysisAmbiguity = "low" | "medium" | "high" | "unknown";

export interface ComplexityAnalysisDto {
  level: TaskComplexity;
  confidence: number;
  source: AnalysisSource;
  score: number;
  evidenceCodes: string[];
}

export interface IntentSummaryDto {
  primaryIntent: UserIntent;
  confidence: number;
  ambiguity: AmbiguityState;
  secondaryIntents: UserIntent[];
}

export interface TaskAnalysisRequestDto {
  requestId?: string;
  text: string;
  conversationContext?: string[];
  attachmentCount?: number;
  languageHint?: string;
}

export interface TaskAnalysisResultDto {
  requestId: string;
  intent: IntentSummaryDto;
  complexity: ComplexityAnalysisDto;
  primaryDomain: DomainCandidateDto;
  secondaryDomains: DomainCandidateDto[];
  capabilities: TaskCapabilityAssessmentDto[];
  evidence: AnalysisEvidenceDto[];
  conflicts: AnalysisConflictDto[];
  ambiguity: AnalysisAmbiguity;
  completeness: AnalysisCompleteness;
  analyzerModelId: string;
  analyzerModelVersion: string;
  analysisSchemaVersion: string;
  inferenceLatencyMs: number;
  totalLatencyMs: number;
  explanation: string;
}

export interface TaskAnalyzerStatusDto {
  isAvailable: boolean;
  modelId: string | null;
  modelVersion: string | null;
  schemaVersion: string;
  supportedDomains: TaskDomain[];
  supportedCapabilities: TaskCapabilityRequirement[];
  lastLatencyMs: number | null;
  lastError: string | null;
}

// --- Step 29: Routing Scoring DTOs ---

export type IneligibilityReasonDto =
  | { provider_not_found: { provider_id: string } }
  | { adapter_not_implemented: { provider_id: string } }
  | { provider_disabled: { provider_id: string } }
  | { credential_missing: { provider_id: string } }
  | { endpoint_misconfigured: { message: string } }
  | { model_not_found: { model_id: string } }
  | { model_retired_or_unavailable: { model_id: string } }
  | { missing_required_capability: { capability: string } }
  | { context_length_exceeded: { requested: number; limit: number } }
  | { authentication_failed: { provider_id: string } }
  | { rate_limited: { provider_id: string; retry_after_ms: number | null } }
  | { provider_unavailable: { provider_id: string } }
  | { model_runtime_unavailable: { model_id: string } }
  | { preflight_blocked: { reason: string } }
  | { explicitly_excluded: { reason: string } };

export interface ScoreBreakdownDto {
  intent_fit: number;
  complexity_fit: number;
  domain_fit: number;
  capability_fit: number;
  context_fit: number;
  modality_fit: number;
  preference_fit: number;
  cost_fit: number;
  latency_fit: number;
  reliability_fit: number;
  profile_fit: number;
}

export interface ScoreAdjustmentDto {
  dimension: string;
  delta: number;
  reason: string;
}

export interface CandidateScoreDto {
  provider_id: string;
  model_id: string;
  display_name: string;
  is_eligible: boolean;
  ineligibility_reasons: IneligibilityReasonDto[];
  total_score: number | null;
  breakdown: ScoreBreakdownDto | null;
  adjustments: ScoreAdjustmentDto[];
  explanation: string;
  context_window: number;
  pricing_known: boolean;
  latency_known: boolean;
}

export interface RoutingScoringWeightsDto {
  intent_weight: number;
  complexity_weight: number;
  domain_weight: number;
  capability_weight: number;
  context_weight: number;
  modality_weight: number;
  preference_weight: number;
  cost_weight: number;
  latency_weight: number;
  reliability_weight: number;
  profile_weight: number;
}

export interface RoutingScoreRequestDto {
  request_id?: string;
  task_analysis: TaskAnalysisResultDto;
  required_capabilities_override?: string[];
  preferred_providers?: string[];
  estimated_input_tokens?: number;
  estimated_output_tokens?: number;
  max_candidates?: number;
}

export interface RoutingScoreResultDto {
  request_id: string;
  candidates: CandidateScoreDto[];
  eligible_count: number;
  ineligible_count: number;
  evaluated_candidates_count: number;
  weights_applied: RoutingScoringWeightsDto;
  scoring_latency_ms: number;
  explanation_summary: string;
}

export interface RoutingScoringStatusDto {
  is_available: boolean;
  registered_models_count: number;
  configured_profiles_count: number;
  active_weights: RoutingScoringWeightsDto;
  last_scoring_latency_ms: number | null;
}

// --- Step 30: Routing Policy Contracts ---

export type SelectionMode =
  | "automatic"
  | "manual_override"
  | "no_route_available"
  | "override_rejected"
  | "blocked";

export type OverrideState =
  | "none"
  | "requested"
  | "validated"
  | "accepted"
  | "rejected";

export type CandidateSelectionStatus =
  | "selected_primary"
  | "eligible_fallback"
  | "disqualified_hard_constraint"
  | "filtered_policy_threshold"
  | "override_rejected_conflict";

export interface ManualRouteOverrideDto {
  provider_id: string;
  model_id: string;
  enabled: boolean;
  reason?: string;
}

export interface OverrideValidationResultDto {
  is_valid: boolean;
  rejection_reason?: unknown;
  message: string;
}

export interface SelectedRouteCandidateDto {
  provider_id: string;
  model_id: string;
  display_name: string;
  score: number | null;
  selection_margin: number | null;
  context_window: number;
}

export interface FallbackCandidateDto {
  rank: number;
  provider_id: string;
  model_id: string;
  display_name: string;
  score: number;
  reason: string;
}

export interface RankedCandidateDto {
  rank: number;
  provider_id: string;
  model_id: string;
  display_name: string;
  score: number | null;
  status: CandidateSelectionStatus;
  rejection_reasons: string[];
}

export interface RoutingDecisionExplanationDto {
  mode: SelectionMode;
  summary: string;
  primary_reason: string;
  score_reason?: string | null;
  policy_reason?: string | null;
  override_reason?: string | null;
  eligibility_reason?: string | null;
  fallback_reason?: string | null;
}

export interface RoutingConfidenceMetadataDto {
  slm_analysis_confidence: number | null;
  selected_score: number | null;
  selection_margin: number | null;
  is_ambiguous: boolean;
}

export interface RoutingPolicyDiagnosticsDto {
  total_candidates_evaluated: number;
  eligible_candidates_count: number;
  policy_filtered_count: number;
  decision_duration_ms: number;
  policy_version: string;
}

export interface OverrideResolutionDto {
  requested_provider_id: string;
  requested_model_id: string;
  state: OverrideState;
  reason: string;
}

export interface RoutingDecisionDto {
  decision_id: string;
  request_id: string;
  policy_version: string;
  scoring_algorithm_version: string;
  selection_mode: SelectionMode;
  selected_candidate: SelectedRouteCandidateDto | null;
  fallback_candidates: FallbackCandidateDto[];
  candidate_ranking: RankedCandidateDto[];
  decision_reason: string;
  structured_explanation: RoutingDecisionExplanationDto;
  override_metadata: OverrideResolutionDto | null;
  confidence_metadata: RoutingConfidenceMetadataDto;
  diagnostics: RoutingPolicyDiagnosticsDto;
  generated_at_ms: number;
}

export interface RoutingPolicyConfigDto {
  policy_version: string;
  minimum_accepted_score: number;
  tie_tolerance: number;
  max_fallback_candidates: number;
  allow_degraded_providers: boolean;
  enforce_strict_override_capabilities: boolean;
  preference_profile: RoutingPreferenceMode;
  fallback_on_rejected_override: boolean;
}

export interface RoutingPolicyRequestDto {
  request_id?: string;
  scoring_result?: RoutingScoreResultDto;
  task_analysis?: TaskAnalysisResultDto;
  manual_override?: ManualRouteOverrideDto;
  estimated_input_tokens?: number;
  estimated_output_tokens?: number;
}

// --- Step 34: Routing Explanation Contracts ---

export interface SelectedRouteExplanationDto {
  providerId: string;
  providerName: string;
  modelId: string;
  modelName: string;
  isLocal: boolean;
  contextWindow?: number | null;
}

export interface TaskRequirementExplanationDto {
  capability: string;
  label: string;
  isMatchedBySelectedModel: boolean;
}

export interface TaskAnalysisSummaryDto {
  primaryIntent: string;
  intentLabel: string;
  intentConfidence: number;
  complexity: string;
  complexityLabel: string;
  complexityScore: number;
  domains: string[];
  requiredCapabilities: TaskRequirementExplanationDto[];
  isAmbiguous: boolean;
  ambiguityLevel: string;
  completeness: string;
}

export interface ScoreDimensionExplanationDto {
  key: string;
  label: string;
  score: number;
  weightPercent?: number | null;
  weightedContribution?: number | null;
  explanation: string;
  status: string;
}

export interface ScoreAdjustmentExplanationDto {
  dimension: string;
  delta: number;
  reason: string;
}

export interface ScoreBreakdownExplanationDto {
  overallScore?: number | null;
  dimensions: ScoreDimensionExplanationDto[];
  adjustments: ScoreAdjustmentExplanationDto[];
}

export interface ConfidenceSummaryExplanationDto {
  slmConfidence?: number | null;
  slmConfidenceLevel: string;
  routingFit?: number | null;
  selectionMargin?: number | null;
  description: string;
}

export interface SelectionMarginExplanationDto {
  margin?: number | null;
  runnerUpModel?: string | null;
  runnerUpScore?: number | null;
  description: string;
}

export interface AlternativeCandidateExplanationDto {
  rank: number;
  providerId: string;
  providerName: string;
  modelId: string;
  displayName: string;
  score?: number | null;
  isEligible: boolean;
  ineligibilityReason?: string | null;
  status: string;
}

export interface PolicyFactorExplanationDto {
  factor: string;
  label: string;
  description: string;
}

export interface ExplanationEvidenceDto {
  source: string;
  label: string;
  detail: string;
}

export interface RoutingExplanationDto {
  schemaVersion: string;
  scoringAlgorithmVersion: string;
  policyVersion: string;
  classifierVersion?: string | null;
  messageId?: string | null;
  sessionId?: string | null;
  selectionMode: string;
  summary: string;
  decisionReason: string;
  isHistorical: boolean;
  selectedRoute: SelectedRouteExplanationDto;
  taskSummary?: TaskAnalysisSummaryDto | null;
  scoreBreakdown?: ScoreBreakdownExplanationDto | null;
  confidenceSummary: ConfidenceSummaryExplanationDto;
  selectionMargin?: SelectionMarginExplanationDto | null;
  alternatives: AlternativeCandidateExplanationDto[];
  policyFactors: PolicyFactorExplanationDto[];
  evidence: ExplanationEvidenceDto[];
  generatedAtMs: number;
}

// ============================================================================
// --- Step 36: Error Classification & Normalized Failure Handling Contracts ---
// ============================================================================

export type ErrorCategory =
  | "cancelled"
  | "credential_missing"
  | "credential_invalid_configuration"
  | "provider_disabled"
  | "endpoint_misconfigured"
  | "model_configuration_invalid"
  | "unsupported_provider_configuration"
  | "authentication_failed"
  | "authorization_failed"
  | "rate_limited"
  | "context_limit_exceeded"
  | "input_too_large"
  | "output_limit_exceeded"
  | "invalid_request"
  | "unsupported_capability"
  | "model_unavailable"
  | "provider_unavailable"
  | "network_unreachable"
  | "dns_resolution_failed"
  | "connection_failed"
  | "tls_failed"
  | "connection_reset"
  | "transport_closed"
  | "network_unknown"
  | "timeout"
  | "stream_interrupted"
  | "malformed_provider_response"
  | "provider_response_parse_failed"
  | "unexpected_provider_response"
  | "local_model_unavailable"
  | "local_model_load_failed"
  | "local_inference_failed"
  | "local_model_input_invalid"
  | "local_model_output_invalid"
  | "local_model_runtime_unavailable"
  | "intent_classification_failed"
  | "task_analysis_failed"
  | "routing_scoring_failed"
  | "routing_policy_failed"
  | "no_eligible_route"
  | "database_failure"
  | "persistence_failure"
  | "chat_history_write_failed"
  | "telemetry_write_failed"
  | "internal_error"
  | "unknown";

export type ErrorSeverity = "info" | "warning" | "error" | "critical";

export type RetryabilityHint =
  | "unknown"
  | "not_applicable"
  | "likely_transient"
  | "likely_permanent"
  | "user_action_required";

export type FailoverHint =
  | "unknown"
  | "potentially_eligible"
  | "usually_not_eligible"
  | "not_applicable";

export type UserAction =
  | "none"
  | "configure_provider"
  | "update_credential"
  | "check_provider_access"
  | "reduce_input"
  | "change_unsupported_option"
  | "wait_and_retry_later"
  | "check_network"
  | "contact_provider";

export type ClassificationProvenance =
  | "provider_specific"
  | "http_status"
  | "transport"
  | "stream_protocol"
  | "local_runtime"
  | "routing"
  | "persistence"
  | "application"
  | "cancellation"
  | "fallback_unknown";

export interface ErrorEnvelope {
  errorId: string;
  errorCode: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  userMessage: string;
  technicalMessage: string;
  executionId?: string;
  correlationId?: string;
  providerId?: string;
  modelId?: string;
  providerRequestId?: string;
  providerErrorCode?: string;
  httpStatus?: number;
  retryAfterMs?: number;
  isTerminal: boolean;
  retryabilityHint: RetryabilityHint;
  failoverHint: FailoverHint;
  userAction: UserAction;
  provenance: ClassificationProvenance;
  schemaVersion: number;
  occurredAtMs: number;
}

// ============================================================================
// --- Step 39: Context, Quota & Availability Control Contracts ---
// ============================================================================

export type ContextStatus = "sufficient" | "near_limit" | "exceeds_limit" | "unsupported";

export type TokenCountProvenance = "exact" | "estimated" | "unknown";

export interface ContextCheckResultDto {
  inputTokens: number;
  requestedOutputTokens: number;
  totalRequiredTokens: number;
  contextWindowLimit: number;
  maxOutputTokensLimit: number;
  safetyMarginTokens: number;
  availableHeadroom: number;
  status: ContextStatus;
  provenance: TokenCountProvenance;
  reason?: string;
}

export type QuotaScope = "provider" | "model" | "account";

export interface QuotaSnapshotDto {
  scope: QuotaScope;
  providerId: string;
  modelId?: string;
  monthlyBudgetLimit?: number;
  currentMonthSpend: number;
  isExhausted: boolean;
  isStale: boolean;
  observedAtMs: number;
  resetAtMs?: number;
}

export type PreflightReasonCode =
  | "context_exceeded"
  | "output_limit_exceeded"
  | "capability_mismatch"
  | "credential_missing"
  | "provider_disabled"
  | "model_unavailable"
  | "endpoint_misconfigured"
  | "local_budget_exceeded"
  | "provider_quota_exhausted"
  | "provider_unavailable"
  | "already_attempted";

export interface ExecutionPreflightDto {
  eligible: boolean;
  reasonCode?: PreflightReasonCode;
  rejectionReason?: any;
  userMessage?: string;
  contextCheck?: ContextCheckResultDto;
  estimatedCostUsd?: number;
}

// ============================================================================
// --- Step 41: History Explorer, Search & Conversation Management Contracts ---
// ============================================================================

export type HistorySortMode =
  | "most_recent"
  | "oldest"
  | "recently_created"
  | "oldest_created"
  | "pinned_first";

export type HistoryMatchType = "session_title" | "message_content";

export type HistorySearchEngine = "fts5" | "sql_indexed_fallback";

export interface HistoryFilter {
  query?: string | null;
  providerId?: string | null;
  modelId?: string | null;
  pinnedOnly?: boolean | null;
  dateFrom?: number | null;
  dateTo?: number | null;
}

export interface HistoryPagination {
  limit: number;
  offset: number;
}

export interface HistorySearchRequest {
  query?: string | null;
  filter?: HistoryFilter | null;
  sort?: HistorySortMode | null;
  limit?: number | null;
  offset?: number | null;
  queryId?: string | null;
}

export interface HistorySessionDto {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  messageCount: number;
  providersUsed: string[];
  modelsUsed: string[];
}

export interface HistoryMessageMatchPreview {
  messageId: string;
  sessionId: string;
  sender: MessageSender;
  matchType: HistoryMatchType;
  previewText: string;
  matchStartOffset: number | null;
  matchLength: number | null;
  routedProvider: string | null;
  routedModel: string | null;
  createdAt: number;
}

export interface HistorySearchResult {
  session: HistorySessionDto;
  matchTypes: HistoryMatchType[];
  titleMatch: boolean;
  titleMatchStart: number | null;
  titleMatchLength: number | null;
  matchedMessageCount: number;
  matchedMessageIds: string[];
  previews: HistoryMessageMatchPreview[];
}

export interface HistoryPageInfo {
  limit: number;
  offset: number;
  totalCount: number | null;
  totalCountIsExact: boolean;
  hasMore: boolean;
}

export interface HistoryPage {
  items: HistorySessionDto[];
  pageInfo: HistoryPageInfo;
  queryId?: string | null;
}

export interface HistorySearchResponse {
  queryId?: string | null;
  items: HistorySearchResult[];
  pageInfo: HistoryPageInfo;
  searchEngineUsed: HistorySearchEngine;
  durationMs: number;
}

export interface HistoryFilterOptions {
  providers: string[];
  models: string[];
}

export interface BulkDeleteResult {
  requestedCount: number;
  deletedCount: number;
  deletedSessionIds: string[];
  missingSessionIds: string[];
}

// ============================================================================
// --- Step 42: Telemetry Dashboard & Operational Routing Insights Contracts ---
// ============================================================================

export type TelemetryTimeBucket = "hour" | "day";

export interface TelemetryDashboardFilters {
  startTime?: number | null;
  endTime?: number | null;
  timeBucket?: TelemetryTimeBucket | null;
  providerId?: string | null;
  modelId?: string | null;
  outcome?: string | null;
  eventType?: TelemetryEventType | null;
  queryId?: string | null;
  baselineProviderId?: string | null;
  baselineModelId?: string | null;
}

export interface TelemetryDashboardSummary {
  totalRoutedRequests: number;
  successfulExecutions: number;
  failedExecutions: number;
  cancelledExecutions: number;
  fallbackExecutions: number;
  terminalExecutions: number;
  successRatePercent: number | null;
}

export interface TelemetryTimeSeriesPoint {
  bucketStartMs: number;
  bucketLabel: string;
  requestCount: number;
  successCount: number;
  failureCount: number;
  cancelledCount: number;
}

export interface TelemetryProviderSummary {
  providerId: string;
  displayName: string;
  isHistoricalOrUnrecorded: boolean;
  requestCount: number;
  successCount: number;
  failureCount: number;
  cancelledCount: number;
  percentageOfTotal: number | null;
}

export interface TelemetryModelSummary {
  providerId: string;
  providerDisplayName: string;
  modelId: string;
  isHistoricalOrUnrecorded: boolean;
  requestCount: number;
  successCount: number;
  failureCount: number;
  cancelledCount: number;
  percentageOfTotal: number | null;
}

export interface TelemetryOutcomeSummary {
  outcome: string;
  label: string;
  count: number;
  percentageOfTotal: number | null;
}

export interface TelemetryRetryFailoverSummary {
  failoverDataAvailable: boolean;
  failoverInvolvedCount: number;
  fallbackSuccessCount: number;
  fallbackFailureCount: number;
  timeoutOutcomeCount: number;
  rateLimitedOutcomeCount: number;
  retryDataAvailable: boolean;
  retryExecutionCount: number | null;
}

export interface TelemetryConfidenceBucket {
  bucketKey: string;
  label: string;
  minInclusive: number;
  maxInclusive: number;
  count: number;
  percentageOfAvailable: number | null;
}

export interface TelemetryConfidenceDistribution {
  availableCount: number;
  missingCount: number;
  minConfidence: number | null;
  maxConfidence: number | null;
  buckets: TelemetryConfidenceBucket[];
}

export interface TelemetryCompletenessSummary {
  totalRecords: number;
  providerRecordedCount: number;
  providerRecordedPercent: number | null;
  modelRecordedCount: number;
  modelRecordedPercent: number | null;
  outcomeRecordedCount: number;
  outcomeRecordedPercent: number | null;
  routingReasonRecordedCount: number;
  routingReasonRecordedPercent: number | null;
  confidenceRecordedCount: number;
  confidenceRecordedPercent: number | null;
  sessionCorrelationCount: number;
  sessionCorrelationPercent: number | null;
  completeMetadataCount: number;
  completeMetadataPercent: number | null;
  incompleteRecordsCount: number;
  earliestRecordAtMs: number | null;
  latestRecordAtMs: number | null;
}

export interface TelemetryProviderOption {
  providerId: string;
  displayName: string;
  isHistorical: boolean;
}

export interface TelemetryModelOption {
  providerId: string | null;
  modelId: string;
}

export interface TelemetryFilterOptionsDto {
  providers: TelemetryProviderOption[];
  models: TelemetryModelOption[];
  outcomes: string[];
}

export interface TelemetryDashboardSnapshot {
  queryId?: string | null;
  generatedAtMs: number;
  appliedFilters: TelemetryDashboardFilters;
  filterOptions: TelemetryFilterOptionsDto;
  summary: TelemetryDashboardSummary;
  timeSeries: TelemetryTimeSeriesPoint[];
  providerDistribution: TelemetryProviderSummary[];
  modelDistribution: TelemetryModelSummary[];
  outcomeDistribution: TelemetryOutcomeSummary[];
  retryFailover: TelemetryRetryFailoverSummary;
  confidenceDistribution: TelemetryConfidenceDistribution;
  completeness: TelemetryCompletenessSummary;
  financialAnalytics: TelemetryFinancialAnalytics;
  performanceAnalytics: TelemetryPerformanceAnalytics;
}

// ============================================================================
// --- Step 43: Token Usage, Cost Analytics & Routing Savings Engine Contracts ---
// ============================================================================

export type TokenDataSource = "recorded" | "unavailable";

export type CostAvailabilityState =
  | "exact"
  | "derived"
  | "estimated"
  | "unavailable"
  | "not_applicable";

export type SavingsComparisonStatus =
  | "below_baseline"
  | "at_baseline"
  | "above_baseline"
  | "unavailable";

export interface TelemetryTokenSummary {
  logicalRequestCount: number;
  physicalAttemptCount: number;
  duplicateOrIntermediateEventsExcluded: number;
  inputTokensAvailableCount: number;
  outputTokensAvailableCount: number;
  bothTokensAvailableCount: number;
  missingTokenRecordsCount: number;
  totalInputTokens: number | null;
  totalOutputTokens: number | null;
  totalTokens: number | null;
  tokenDataSource: TokenDataSource;
}

export interface TelemetryActualCostSummary {
  currency: string;
  costAvailabilityState: CostAvailabilityState;
  eligibleAttemptCount: number;
  eligibleLogicalRequestCount: number;
  missingCostAttemptCount: number;
  zeroCostAttemptCount: number;
  totalActualCostUsd: number | null;
  averageCostPerLogicalRequestUsd: number | null;
  averageCostPerAttemptUsd: number | null;
  costPerThousandTokensUsd: number | null;
  costPerMillionTokensUsd: number | null;
  costPerTokenCompatibleRecordCount: number;
  costPerTokenCompatibleTotalTokens: number;
}

export interface TelemetryBaselineSummary {
  baselineProviderId: string;
  baselineProviderDisplayName: string;
  baselineModelId: string;
  baselineModelDisplayName: string;
  methodology: string;
  methodologyLabel: string;
  pricingVersionUsed: string | null;
  pricingVersionsUsed: string[];
  baselineAvailable: boolean;
  baselineCostUsd: number | null;
}

export interface TelemetrySavingsSummary {
  savingsState: CostAvailabilityState;
  comparisonStatus: SavingsComparisonStatus;
  eligibleRecordCount: number;
  ineligibleRecordCount: number;
  missingTokenDataCount: number;
  missingActualCostCount: number;
  missingBaselinePricingCount: number;
  eligibleActualCostUsd: number | null;
  baselineCostUsd: number | null;
  estimatedSavingsUsd: number | null;
  savingsPercent: number | null;
  allTimeEligibleRecordCount: number;
  allTimeActualCostUsd: number | null;
  allTimeBaselineCostUsd: number | null;
  allTimeEstimatedSavingsUsd: number | null;
  allTimeSavingsPercent: number | null;
}

export interface TelemetryTokenTrendPoint {
  bucketStartMs: number;
  bucketLabel: string;
  attemptCount: number;
  tokenEligibleCount: number;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}

export interface TelemetryCostTrendPoint {
  bucketStartMs: number;
  bucketLabel: string;
  attemptCount: number;
  costEligibleCount: number;
  actualCostUsd: number | null;
  savingsEligibleCount: number;
  baselineCostUsd: number | null;
  estimatedSavingsUsd: number | null;
}

export interface TelemetryProviderTokenSummary {
  providerId: string;
  displayName: string;
  isHistoricalOrUnrecorded: boolean;
  attemptCount: number;
  logicalRequestCount: number;
  tokenEligibleCount: number;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  shareOfTotalTokensPercent: number | null;
}

export interface TelemetryModelTokenSummary {
  providerId: string;
  providerDisplayName: string;
  modelId: string;
  isHistoricalOrUnrecorded: boolean;
  attemptCount: number;
  logicalRequestCount: number;
  tokenEligibleCount: number;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  shareOfTotalTokensPercent: number | null;
}

export interface TelemetryProviderCostSummary {
  providerId: string;
  displayName: string;
  isHistoricalOrUnrecorded: boolean;
  attemptCount: number;
  costEligibleCount: number;
  actualCostUsd: number | null;
  averageCostPerEligibleAttemptUsd: number | null;
  totalTokens: number | null;
  shareOfTotalCostPercent: number | null;
  savingsEligibleCount: number;
  eligibleActualCostUsd: number | null;
  baselineCostUsd: number | null;
  estimatedSavingsUsd: number | null;
  savingsPercent: number | null;
}

export interface TelemetryModelCostSummary {
  providerId: string;
  providerDisplayName: string;
  modelId: string;
  isHistoricalOrUnrecorded: boolean;
  attemptCount: number;
  costEligibleCount: number;
  actualCostUsd: number | null;
  averageCostPerEligibleAttemptUsd: number | null;
  totalTokens: number | null;
  shareOfTotalCostPercent: number | null;
  savingsEligibleCount: number;
  eligibleActualCostUsd: number | null;
  baselineCostUsd: number | null;
  estimatedSavingsUsd: number | null;
  savingsPercent: number | null;
}

export interface TelemetryFinancialCoverageSummary {
  totalPhysicalAttempts: number;
  totalLogicalRequests: number;
  tokenCoverageCount: number;
  tokenCoveragePercent: number | null;
  costCoverageCount: number;
  costCoveragePercent: number | null;
  baselinePricingCoverageCount: number;
  baselinePricingCoveragePercent: number | null;
  savingsCoverageCount: number;
  savingsCoveragePercent: number | null;
  completeFinancialAnalyticsCount: number;
  completeFinancialAnalyticsPercent: number | null;
}

export interface TelemetryFinancialExportRow {
  bucketStartMs: number;
  providerId: string;
  modelId: string;
  attemptCount: number;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  actualCostUsd: number | null;
  baselineCostUsd: number | null;
  estimatedSavingsUsd: number | null;
}

export interface TelemetryFinancialAnalytics {
  queryId?: string | null;
  generatedAtMs: number;
  currency: string;
  tokenSummary: TelemetryTokenSummary;
  actualCostSummary: TelemetryActualCostSummary;
  baselineSummary: TelemetryBaselineSummary;
  savingsSummary: TelemetrySavingsSummary;
  tokenTrend: TelemetryTokenTrendPoint[];
  costTrend: TelemetryCostTrendPoint[];
  providerTokenBreakdown: TelemetryProviderTokenSummary[];
  modelTokenBreakdown: TelemetryModelTokenSummary[];
  providerCostBreakdown: TelemetryProviderCostSummary[];
  modelCostBreakdown: TelemetryModelCostSummary[];
  coverage: TelemetryFinancialCoverageSummary;
  exportRows: TelemetryFinancialExportRow[];
}

// ============================================================================
// --- Step 44: Latency, Execution Performance & Benchmark Analytics Contracts ---
// ============================================================================

export type LatencyProvenanceState =
  | "recorded"
  | "derived"
  | "unavailable"
  | "not_applicable";

export type LatencySampleSufficiency = "empty" | "limited" | "sufficient";

export interface TelemetryLatencySummary {
  populationLabel: string;
  metricSemanticsLabel: string;
  percentileMethodology: string;
  totalEligibleExecutions: number;
  measuredExecutions: number;
  missingLatencyCount: number;
  invalidLatencyCount: number;
  latencyCoveragePercent: number | null;
  sampleSufficiency: LatencySampleSufficiency;
  provenance: LatencyProvenanceState;
  averageLatencyMs: number | null;
  medianLatencyMs: number | null;
  p25LatencyMs: number | null;
  p50LatencyMs: number | null;
  p75LatencyMs: number | null;
  p90LatencyMs: number | null;
  p95LatencyMs: number | null;
  p99LatencyMs: number | null;
  minLatencyMs: number | null;
  maxLatencyMs: number | null;
}

export interface TelemetryLatencyHistogramBucket {
  bucketKey: string;
  label: string;
  minBoundMs: number;
  maxBoundMs: number | null;
  count: number;
  percentage: number | null;
}

export interface TelemetryLatencyHistogram {
  measuredSampleCount: number;
  buckets: TelemetryLatencyHistogramBucket[];
}

export interface TelemetryLatencyTrendPoint {
  bucketStartMs: number;
  bucketLabel: string;
  eligibleCount: number;
  measuredCount: number;
  averageLatencyMs: number | null;
  medianLatencyMs: number | null;
  p95LatencyMs: number | null;
  minLatencyMs: number | null;
  maxLatencyMs: number | null;
}

export interface TelemetryProviderLatencySummary {
  providerId: string;
  displayName: string;
  isHistoricalOrUnrecorded: boolean;
  totalEligibleCount: number;
  measuredCount: number;
  coveragePercent: number | null;
  sampleSufficiency: LatencySampleSufficiency;
  averageLatencyMs: number | null;
  medianLatencyMs: number | null;
  p25LatencyMs: number | null;
  p75LatencyMs: number | null;
  p90LatencyMs: number | null;
  p95LatencyMs: number | null;
  p99LatencyMs: number | null;
  minLatencyMs: number | null;
  maxLatencyMs: number | null;
}

export interface TelemetryModelLatencySummary {
  providerId: string;
  providerDisplayName: string;
  modelId: string;
  isHistoricalOrUnrecorded: boolean;
  totalEligibleCount: number;
  measuredCount: number;
  coveragePercent: number | null;
  sampleSufficiency: LatencySampleSufficiency;
  averageLatencyMs: number | null;
  medianLatencyMs: number | null;
  p25LatencyMs: number | null;
  p75LatencyMs: number | null;
  p90LatencyMs: number | null;
  p95LatencyMs: number | null;
  p99LatencyMs: number | null;
  minLatencyMs: number | null;
  maxLatencyMs: number | null;
}

export interface TelemetryOutcomeLatencySummary {
  outcome: string;
  displayLabel: string;
  totalCount: number;
  measuredCount: number;
  averageLatencyMs: number | null;
  medianLatencyMs: number | null;
  p95LatencyMs: number | null;
  minLatencyMs: number | null;
  maxLatencyMs: number | null;
}

export interface TelemetryRoutingOverheadSummary {
  totalRoutingEvents: number;
  measuredRoutingEvents: number;
  provenance: LatencyProvenanceState;
  averageRoutingLatencyMs: number | null;
  medianRoutingLatencyMs: number | null;
  p95RoutingLatencyMs: number | null;
  minRoutingLatencyMs: number | null;
  maxRoutingLatencyMs: number | null;
  slmClassificationProvenance: LatencyProvenanceState;
  slmClassificationNote: string;
}

export interface TelemetryStreamingPerformanceSummary {
  totalStreamingExecutions: number;
  measuredStreamingCompletionCount: number;
  completionProvenance: LatencyProvenanceState;
  averageStreamCompletionLatencyMs: number | null;
  medianStreamCompletionLatencyMs: number | null;
  p95StreamCompletionLatencyMs: number | null;
  minStreamCompletionLatencyMs: number | null;
  maxStreamCompletionLatencyMs: number | null;
  ttftMeasuredCount: number;
  averageTtftMs: number | null;
  medianTtftMs: number | null;
  ttftProvenance: LatencyProvenanceState;
  ttftMethodologyNote: string;
}

export interface TelemetryLogicalLatencySummary {
  totalLogicalRequests: number;
  measuredLogicalRequests: number;
  singleAttemptLogicalRequests: number;
  multiAttemptLogicalRequests: number;
  singleAttemptMedianLatencyMs: number | null;
  singleAttemptAverageLatencyMs: number | null;
  singleAttemptP95LatencyMs: number | null;
  multiAttemptMedianLatencyMs: number | null;
  multiAttemptAverageLatencyMs: number | null;
  multiAttemptP95LatencyMs: number | null;
  logicalCumulativeMedianLatencyMs: number | null;
  logicalCumulativeAverageLatencyMs: number | null;
  logicalCumulativeP95LatencyMs: number | null;
  logicalCumulativeMinLatencyMs: number | null;
  logicalCumulativeMaxLatencyMs: number | null;
  initialAttemptMeasuredCount: number;
  initialAttemptMedianLatencyMs: number | null;
  initialAttemptAverageLatencyMs: number | null;
  retryOrFailoverAttemptMeasuredCount: number;
  retryOrFailoverAttemptMedianLatencyMs: number | null;
  retryOrFailoverAttemptAverageLatencyMs: number | null;
}

export interface TelemetryLatencyDataQualitySummary {
  totalEligibleRecords: number;
  validLatencyRecords: number;
  missingLatencyRecords: number;
  invalidLatencyRecords: number;
  duplicateOrIntermediateEventsExcluded: number;
  coveragePercent: number | null;
  distinctProvidersCount: number;
  distinctModelsCount: number;
  earliestMeasuredAtMs: number | null;
  latestMeasuredAtMs: number | null;
}

export interface TelemetryPerformanceAnalytics {
  queryId?: string | null;
  generatedAtMs: number;
  summary: TelemetryLatencySummary;
  distribution: TelemetryLatencyHistogram;
  timeSeries: TelemetryLatencyTrendPoint[];
  providerBreakdown: TelemetryProviderLatencySummary[];
  modelBreakdown: TelemetryModelLatencySummary[];
  outcomeBreakdown: TelemetryOutcomeLatencySummary[];
  routingOverhead: TelemetryRoutingOverheadSummary;
  streamingPerformance: TelemetryStreamingPerformanceSummary;
  logicalVsPhysical: TelemetryLogicalLatencySummary;
  dataQuality: TelemetryLatencyDataQualitySummary;
}

// ============================================================================
// --- Step 45: Telemetry Audit, Data Cleanup, Retention & Privacy Contracts ---
// ============================================================================

export type DataCategory =
  | "user_content"
  | "secret"
  | "operational_telemetry"
  | "configuration"
  | "search_index"
  | "application_metadata";

export type DeletionPolicy =
  | "user_only"
  | "retention_eligible"
  | "rebuildable"
  | "credential_sensitive"
  | "selectively_deletable"
  | "system_owned";

export interface SafeCredentialInventoryItem {
  providerId: string;
  isActive: boolean;
  hasCredential: boolean;
  updatedAt: number;
}

export interface DataInventoryItem {
  storeId: string;
  displayName: string;
  tableOrLocation: string;
  category: DataCategory;
  deletionPolicy: DeletionPolicy;
  recordCount: number;
  containsSensitiveData: boolean;
  includedInRetentionCleanup: boolean;
  includedInFullWipe: boolean;
  description: string;
}

export interface DataInventorySnapshot {
  generatedAtMs: number;
  databasePath: string;
  storageSemanticsNote: string;
  providerBoundaryNote: string;
  items: DataInventoryItem[];
  credentials: SafeCredentialInventoryItem[];
  totalUserSessions: number;
  totalUserMessages: number;
  totalTelemetryRecords: number;
  totalSearchIndexEntries: number;
  totalConfiguredCredentials: number;
  totalAppSettings: number;
  activeExecutionsCount: number;
}

export type AuditHealthState =
  | "healthy"
  | "healthy_with_warnings"
  | "needs_attention"
  | "corrupted"
  | "unavailable";

export type AuditCheckMode = "quick" | "full";

export interface DataAuditFinding {
  code: string;
  severity: "info" | "warning" | "error";
  category: string;
  message: string;
  affectedCount: number;
  safeRepairAvailable: boolean;
}

export interface OrphanAuditSummary {
  orphanedMessagesCount: number;
  emptySessionsCount: number;
  expectedSearchIndexEntries: number;
  actualSearchIndexEntries: number;
  searchIndexMismatchCount: number;
  searchIndexInSync: boolean;
  unlinkedSessionTelemetryCount: number;
}

export interface TelemetryConsistencyAuditSummary {
  totalRecordsChecked: number;
  missingTimestampCount: number;
  futureTimestampAnomalyCount: number;
  negativeLatencyCount: number;
  negativeTokenCount: number;
  negativeCostCount: number;
  invalidConfidenceCount: number;
  missingProviderOrModelCount: number;
}

export interface DataAuditReport {
  auditedAtMs: number;
  mode: AuditCheckMode;
  durationMs: number;
  healthState: AuditHealthState;
  sqliteIntegrityOk: boolean;
  sqliteIntegrityMessage: string;
  foreignKeysOk: boolean;
  foreignKeyViolationsCount: number;
  schemaVersion: number;
  expectedSchemaVersion: number;
  walEnabled: boolean;
  orphanSummary: OrphanAuditSummary;
  telemetryConsistency: TelemetryConsistencyAuditSummary;
  invalidSettingsCount: number;
  credentialRecordsValid: boolean;
  privacyIsolationVerified: boolean;
  findings: DataAuditFinding[];
}

export type SafeRepairAction =
  | "rebuild_search_index"
  | "remove_orphaned_records_and_rebuild_index";

export interface SafeRepairResult {
  executedAtMs: number;
  durationMs: number;
  action: SafeRepairAction;
  searchIndexEntriesRebuilt: number;
  orphanedMessagesRemoved: number;
  verificationPassed: boolean;
  message: string;
}

export interface RetentionPolicyConfig {
  historyRetentionEnabled: boolean;
  historyRetentionDays: number;
  excludePinnedSessions: boolean;
  telemetryRetentionEnabled: boolean;
  telemetryRetentionDays: number;
  cleanupConfirmationRequired: boolean;
}

export type CleanupTargetScope =
  | "telemetry_only"
  | "history_only"
  | "retention_policy"
  | "search_index_rebuild";

export interface CleanupPreviewRequest {
  scope: CleanupTargetScope;
  olderThanDays?: number | null;
  excludePinnedSessions?: boolean | null;
  deleteAllInScope?: boolean | null;
}

export interface CleanupPreviewResult {
  generatedAtMs: number;
  scope: CleanupTargetScope;
  cutoffTimestampMs: number | null;
  olderThanDays: number | null;
  excludePinnedSessions: boolean;
  eligibleSessionsCount: number;
  eligibleMessagesCount: number;
  eligibleTelemetryRecordsCount: number;
  affectedSearchIndexEntriesCount: number;
  excludedPinnedSessionsCount: number;
  skippedActiveSessionsCount: number;
  skippedFutureTimestampCount: number;
  preservesCredentials: boolean;
  preservesSettings: boolean;
  summaryMessage: string;
}

export interface CleanupExecutionRequest {
  scope: CleanupTargetScope;
  olderThanDays?: number | null;
  excludePinnedSessions?: boolean | null;
  deleteAllInScope?: boolean | null;
  confirmed: boolean;
}

export type CleanupVerificationStatus =
  | "verified"
  | "verified_with_warnings"
  | "verification_failed";

export interface CleanupOperationResult {
  operationId: string;
  scope: CleanupTargetScope;
  startedAtMs: number;
  completedAtMs: number;
  durationMs: number;
  deletedSessionsCount: number;
  deletedMessagesCount: number;
  deletedTelemetryRecordsCount: number;
  rebuiltSearchIndexEntriesCount: number;
  excludedPinnedSessionsCount: number;
  skippedActiveSessionsCount: number;
  skippedFutureTimestampCount: number;
  remainingSessionsCount: number;
  remainingMessagesCount: number;
  remainingTelemetryRecordsCount: number;
  remainingSearchIndexEntriesCount: number;
  verificationStatus: CleanupVerificationStatus;
  storageNote: string;
  warnings: string[];
}

export interface FullWipePreviewResult {
  generatedAtMs: number;
  sessionsToDelete: number;
  messagesToDelete: number;
  telemetryRecordsToDelete: number;
  searchIndexEntriesToDelete: number;
  appSettingsToReset: number;
  providerCredentialsToDelete: number;
  configuredProviderIds: string[];
  activeExecutionsCount: number;
  canProceed: boolean;
  blockReason: string | null;
  requiredConfirmationToken: string;
  providerBoundaryWarning: string;
}

export interface FullWipeRequest {
  confirmationToken: string;
  confirmed: boolean;
  includeCredentials?: boolean | null;
  includeSettings?: boolean | null;
}

export interface FullWipeReport {
  operationId: string;
  startedAtMs: number;
  completedAtMs: number;
  durationMs: number;
  deletedSessionsCount: number;
  deletedMessagesCount: number;
  deletedTelemetryRecordsCount: number;
  clearedSearchIndexEntriesCount: number;
  resetSettingsCount: number;
  deletedCredentialsCount: number;
  remainingSessionsCount: number;
  remainingMessagesCount: number;
  remainingTelemetryRecordsCount: number;
  remainingSearchIndexEntriesCount: number;
  remainingCredentialsCount: number;
  verificationStatus: CleanupVerificationStatus;
  storageNote: string;
}

// ============================================================================
// Step 47: License, About & Contact Models
// ============================================================================

export interface LicenseInfoDto {
  productName: string;
  edition: string;
  licenseType: string;
  status: string;
  statusExplanation: string;
  copyright: string;
  validFrom: string;
  validUntil: string | null;
  activationRequired: boolean;
  isCommercialAllowed: boolean;
  entitlements: string[];
  licenseNotice: string;
}








