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
  RECORD_TELEMETRY_EVENT: "cmd_record_telemetry_event",
  LIST_TELEMETRY_RECORDS: "cmd_list_telemetry_records",
  GET_TELEMETRY_AGGREGATES: "cmd_get_telemetry_aggregates",
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
  promptCostPerMtokenUsd: number;
  completionCostPerMtokenUsd: number;
  isFree: boolean;
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
  | "window.start_maximized";

export interface AppSettingsSnapshot {
  routingPreferenceMode: RoutingPreferenceMode;
  telemetryEnabled: boolean;
  historyRetentionDays: number;
  windowStartMaximized: boolean;
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















