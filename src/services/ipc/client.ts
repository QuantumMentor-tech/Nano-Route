/**
//! Nano Route — Low-Level Tauri IPC Client Transport
//!
//! Responsibility:
//! - Encapsulates Tauri `invoke` calls and transport execution.
//! - Attaches correlation request IDs to all native operations.
//! - Performs structured diagnostic logging without leaking payload data.
//! - Normalizes native failures into typed IpcError instances.
//! - Provides deterministic test mock registry for headless unit tests.
*/

import { invoke } from "@tauri-apps/api/core";
import { normalizeIpcError, IpcError } from "./errors.ts";

// --- Request ID Generator ---

let counter = 0;

/**
 * Generates a safe, non-secret correlation identifier for an IPC operation.
 */
export function generateRequestId(): string {
  counter = (counter + 1) % 100000;
  const time = Date.now().toString(36);
  const rnd = Math.random().toString(36).substring(2, 7);
  return `req_${time}_${rnd}_${counter}`;
}

// --- Environment Detection & Mock Support ---

let mockTauriContextOverride: boolean | null = null;
const mockHandlers = new Map<string, (args?: Record<string, unknown>) => unknown>();

/**
 * Checks whether the application is running inside an active Tauri WebView environment.
 */
export function isTauriContext(): boolean {
  if (mockTauriContextOverride !== null) {
    return mockTauriContextOverride;
  }
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window ||
      ("isTauri" in window && !!(window as unknown as { isTauri: boolean }).isTauri))
  );
}

/**
 * Test utility: Overrides the Tauri context detection for testing.
 */
export function setMockTauriContext(active: boolean | null): void {
  mockTauriContextOverride = active;
}

/**
 * Test utility: Registers a mock handler for an IPC command.
 */
export function registerMockCommandHandler<T>(
  command: string,
  handler: (args?: Record<string, unknown>) => Promise<T> | T
): void {
  mockHandlers.set(command, handler as (args?: Record<string, unknown>) => unknown);
}

/**
 * Test utility: Clears all registered mock command handlers.
 */
export function clearMockCommandHandlers(): void {
  mockHandlers.clear();
  mockTauriContextOverride = null;
}

// --- Structured Diagnostic Logging ---

interface IpcLogDetails {
  command: string;
  requestId: string;
  durationMs?: number;
  errorCode?: string;
}

function logIpcLifecycle(phase: "start" | "success" | "error", details: IpcLogDetails): void {
  // Only log diagnostic metadata (never log payload contents or user input)
  if (process.env.NODE_ENV === "development" || typeof window !== "undefined") {
    const prefix = `[IPC ${phase.toUpperCase()}]`;
    if (phase === "error") {
      console.warn(`${prefix} ${details.command} (${details.requestId}) code=${details.errorCode}`);
    }
  }
}

// --- Core safeInvoke Transport Wrapper ---

export interface SafeInvokeOptions {
  requestId?: string;
}

/**
 * Safe transport wrapper around Tauri's native `invoke`.
 *
 * Guaranteed Behaviors:
 * 1. Attaches or generates a correlation `requestId`.
 * 2. Checks test mock registry first for deterministic testing.
 * 3. Intercepts failures and normalizes them into typed `IpcError`.
 * 4. Measures command latency and records lifecycle diagnostics.
 */
export async function safeInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
  options?: SafeInvokeOptions
): Promise<T> {
  const requestId = options?.requestId || generateRequestId();
  const startTime = performance.now();

  logIpcLifecycle("start", { command, requestId });

  // 1. Check for registered test mock handlers
  if (mockHandlers.has(command)) {
    try {
      const handler = mockHandlers.get(command)!;
      const result = await handler(args);
      const durationMs = Math.round(performance.now() - startTime);
      logIpcLifecycle("success", { command, requestId, durationMs });
      return result as T;
    } catch (err) {
      const durationMs = Math.round(performance.now() - startTime);
      const normalized = normalizeIpcError(err, command, requestId);
      logIpcLifecycle("error", { command, requestId, durationMs, errorCode: normalized.code });
      throw normalized;
    }
  }

  // 2. Browser dev mode check
  if (!isTauriContext()) {
    const error = new IpcError({
      code: "TRANSPORT_UNAVAILABLE",
      category: "ServiceUnavailable",
      message: `[${command}] Tauri native runtime unavailable in browser environment`,
      retryable: false,
      requestId,
    });
    logIpcLifecycle("error", { command, requestId, errorCode: error.code });
    throw error;
  }

  // 3. Native Tauri invocation
  try {
    const result = await invoke<T>(command, args);
    const durationMs = Math.round(performance.now() - startTime);
    logIpcLifecycle("success", { command, requestId, durationMs });
    return result;
  } catch (err) {
    const durationMs = Math.round(performance.now() - startTime);
    const normalized = normalizeIpcError(err, command, requestId);
    logIpcLifecycle("error", { command, requestId, durationMs, errorCode: normalized.code });
    throw normalized;
  }
}
