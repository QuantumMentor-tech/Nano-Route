/**
//! Nano Route — Strongly-Typed IPC Commands Boundary
//!
//! Responsibility:
//! - Provides strongly-typed frontend functions mapping directly to registered Rust commands.
//! - Validates arguments before transmitting across the IPC boundary.
//! - Attaches correlation request IDs and handles safe browser fallback defaults.
//! - Preserves backward compatibility with existing Dashboard / Shell health-checks.
*/

import { safeInvoke, isTauriContext, generateRequestId } from "./client.ts";
import { IpcError } from "./errors.ts";
import {
  IPC_COMMANDS,
  type NativeHealthResponse,
  type NativeHealthReport,
  type NativeAppInfo,
  type IpcPingResponse,
  type IpcPingRequest,
  type DatabaseHealthReport,
} from "./types.ts";

/**
 * Maximum permitted ping message length in bytes (256 bytes).
 */
export const MAX_PING_MESSAGE_LEN = 256;

/**
 * Client-side validation for ping messages to catch frontend bugs early.
 */
export function validatePingMessage(message: string): void {
  const trimmed = message.trim();
  if (!trimmed) {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: "Ping message cannot be empty or whitespace only",
      retryable: false,
      userActionRequired: true,
    });
  }

  if (message.length > MAX_PING_MESSAGE_LEN) {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: `Ping message exceeds maximum permitted length of ${MAX_PING_MESSAGE_LEN} characters`,
      retryable: false,
      userActionRequired: true,
    });
  }
}

/**
 * Backward-compatible smoke-test IPC command.
 * Used by ApplicationStateContext during desktop shell bootstrap.
 */
export async function checkNativeHealth(): Promise<NativeHealthResponse> {
  if (!isTauriContext()) {
    return {
      status: "Browser Dev Mode (IPC inactive)",
      isNative: false,
    };
  }

  try {
    const status = await safeInvoke<string>(IPC_COMMANDS.HEALTH_CHECK);
    return {
      status,
      isNative: true,
    };
  } catch {
    return {
      status: "Native core unreachable",
      isNative: false,
    };
  }
}

/**
 * Structured health report IPC command.
 * Fetches domain-level health from Rust HealthService.
 */
export async function getNativeHealthReport(): Promise<NativeHealthReport | null> {
  if (!isTauriContext()) {
    return null;
  }

  try {
    return await safeInvoke<NativeHealthReport>(IPC_COMMANDS.GET_HEALTH);
  } catch {
    return null;
  }
}

/**
 * Application metadata and runtime environment IPC command.
 * Fetches application version and OS details from Rust AppService.
 */
export async function getNativeAppInfo(): Promise<NativeAppInfo | null> {
  if (!isTauriContext()) {
    return null;
  }

  try {
    return await safeInvoke<NativeAppInfo>(IPC_COMMANDS.GET_APP_INFO);
  } catch {
    return null;
  }
}

/**
 * Validated diagnostic ping command.
 * Demonstrates request validation, request ID correlation, and structured error returns.
 */
export async function pingNative(
  message: string,
  requestId?: string
): Promise<IpcPingResponse> {
  // 1. Client-side validation
  validatePingMessage(message);

  const reqId = requestId || generateRequestId();

  // 2. Safe browser fallback if not in Tauri
  if (!isTauriContext()) {
    return {
      message: message.trim(),
      requestId: reqId,
      timestamp: new Date().toISOString(),
      durationMs: 1,
    };
  }

  // 3. Invocation of Rust cmd_ping
  const payload: { request: IpcPingRequest } = {
    request: {
      message: message.trim(),
      requestId: reqId,
    },
  };

  return await safeInvoke<IpcPingResponse>(IPC_COMMANDS.PING, payload as unknown as Record<string, unknown>, {
    requestId: reqId,
  });
}

/**
 * Queries the diagnostic health report of the SQLite database.
 * Used by native diagnostics and development audit tools.
 */
export async function getDatabaseHealth(requestId?: string): Promise<DatabaseHealthReport> {
  const reqId = requestId || generateRequestId();

  if (!isTauriContext()) {
    return {
      status: "Ready",
      schemaVersion: 1,
      migrationsApplied: 1,
      integrityOk: true,
      walEnabled: true,
      databasePath: ":memory: (browser mock)",
      latencyMs: 1,
    };
  }

  return await safeInvoke<DatabaseHealthReport>(IPC_COMMANDS.GET_DATABASE_HEALTH, undefined, {
    requestId: reqId,
  });
}

