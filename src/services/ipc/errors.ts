/**
//! Nano Route — IPC Error Normalization and Sanitization
//!
//! Responsibility:
//! - Normalizes transport failures and native errors into typed IpcError instances.
//! - Strips sensitive metadata (filesystem paths, API keys, credentials) before surfacing to UI.
//! - Maps categories to user-actionable and retryable statuses.
*/

import type {
  IpcErrorCode,
  IpcErrorCategory,
  IpcErrorPayload,
} from "./types.ts";

/**
 * Regex to redact local filesystem paths (Windows drive paths and POSIX home/system paths).
 */
const PATH_REGEX = /(?:[A-Za-z]:\\[^\\/:*?"<>|\r\n\t]+|\/(?:Users|home|var|tmp|etc|usr)[^\s"':;]+)/g;

/**
 * Regex to redact potential authorization headers, API keys, and sensitive tokens.
 */
const SECRET_REGEX = /(?:Bearer\s+[A-Za-z0-9._-]+|sk-[A-Za-z0-9_-]{8,}|(?:key|secret|password|token)=[^\s&"']+)/gi;

/**
 * Sanitizes an error message by stripping filesystem paths and secret tokens.
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message) return "An unknown error occurred";
  return message
    .replace(SECRET_REGEX, "[REDACTED_SECRET]")
    .replace(PATH_REGEX, "[REDACTED_PATH]");
}

/**
 * Typed Nano Route IPC Error
 */
export class IpcError extends Error implements IpcErrorPayload {
  public readonly code: IpcErrorCode | string;
  public readonly category: IpcErrorCategory;
  public readonly retryable: boolean;
  public readonly userActionRequired: boolean;
  public readonly requestId?: string;

  constructor(payload: IpcErrorPayload) {
    const sanitizedMsg = sanitizeErrorMessage(payload.message);
    super(sanitizedMsg);
    this.name = "IpcError";
    this.code = payload.code;
    this.category = payload.category;
    this.retryable = payload.retryable;
    this.userActionRequired = payload.userActionRequired ?? false;
    this.requestId = payload.requestId;

    // Maintains proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, IpcError);
    }
  }

  public toJSON(): IpcErrorPayload {
    return {
      code: this.code,
      category: this.category,
      message: this.message,
      retryable: this.retryable,
      userActionRequired: this.userActionRequired,
      requestId: this.requestId,
    };
  }
}

/**
 * Normalizes any unknown rejection or error from Tauri into a sanitized IpcError.
 */
export function normalizeIpcError(
  raw: unknown,
  command?: string,
  requestId?: string
): IpcError {
  if (raw instanceof IpcError) {
    return raw;
  }

  let rawMessage = "Unknown native error";
  let category: IpcErrorCategory = "Internal";
  let code: IpcErrorCode = "INTERNAL_ERROR";
  let retryable = false;

  if (typeof raw === "string") {
    rawMessage = raw;
    // Check if Rust AppError formatted string
    if (raw.includes("Service unavailable:")) {
      category = "ServiceUnavailable";
      code = "SERVICE_UNAVAILABLE";
      retryable = true;
    } else if (raw.includes("Initialization failed:")) {
      category = "InitializationFailed";
      code = "INITIALIZATION_FAILED";
    } else if (raw.includes("Invalid input:")) {
      category = "InvalidInput";
      code = "INVALID_INPUT";
    }
  } else if (raw && typeof raw === "object") {
    // Check if Rust AppError serialized as JSON object { kind: "...", message: "..." }
    const obj = raw as Record<string, unknown>;
    if (typeof obj.message === "string") {
      rawMessage = obj.message;
    } else if (typeof obj.msg === "string") {
      rawMessage = obj.msg;
    } else if (raw instanceof Error) {
      rawMessage = raw.message;
    }

    if (obj.kind === "ServiceUnavailable" || obj.category === "ServiceUnavailable") {
      category = "ServiceUnavailable";
      code = "SERVICE_UNAVAILABLE";
      retryable = true;
    } else if (obj.kind === "InitializationFailed") {
      category = "InitializationFailed";
      code = "INITIALIZATION_FAILED";
    } else if (obj.kind === "InvalidInput") {
      category = "InvalidInput";
      code = "INVALID_INPUT";
    }
  }

  const prefix = command ? `[${command}] ` : "";

  return new IpcError({
    code,
    category,
    message: `${prefix}${rawMessage}`,
    retryable,
    userActionRequired: category === "InvalidInput",
    requestId,
  });
}
