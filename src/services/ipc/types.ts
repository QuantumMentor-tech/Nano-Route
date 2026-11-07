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

