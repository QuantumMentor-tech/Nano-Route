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









