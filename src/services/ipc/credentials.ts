/**
//! Nano Route — Windows DPAPI Credential Vault IPC Boundary
//! File: src/services/ipc/credentials.ts
//!
//! Responsibility:
//! - Strongly-typed frontend client for provider credential entry, status inspection, and lifecycle management.
//! - Input validation, correlation ID generation, and sanitized error normalization.
//! - In-memory mock store for browser dev mode and isolated automated testing.
//! - ZERO exposure of plaintext API keys from native core back to frontend.
*/

import { isTauriContext, safeInvoke, generateRequestId } from "./client.ts";
import { IpcError } from "./errors.ts";
import {
  IPC_COMMANDS,
  type ProviderCredentialStatus,
  type SaveCredentialRequest,
} from "./types.ts";

// ============================================================================
// Browser In-Memory Mock Store (enables development without running Tauri native core)
// ============================================================================

const mockStatuses = new Map<string, ProviderCredentialStatus>();

export function resetCredentialMockStore(): void {
  mockStatuses.clear();
}

// ============================================================================
// Input Validation Helpers
// ============================================================================

function validateProviderId(providerId: string): string {
  const trimmed = providerId?.trim();
  if (!trimmed || trimmed.length < 2 || trimmed.length > 64) {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: `Provider ID length must be between 2 and 64 characters; got ${trimmed?.length ?? 0}`,
      retryable: false,
      userActionRequired: true,
    });
  }

  const firstChar = trimmed[0];
  if (!/[a-z0-9]/.test(firstChar)) {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: "Provider ID must start with a lowercase alphanumeric character",
      retryable: false,
      userActionRequired: true,
    });
  }

  if (!/^[a-z0-9._-]+$/.test(trimmed)) {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: "Provider ID contains invalid characters. Permitted: [a-z0-9._-]",
      retryable: false,
      userActionRequired: true,
    });
  }

  return trimmed;
}

function validateApiKey(apiKey: string): string {
  const trimmed = apiKey?.trim();
  if (!trimmed) {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: "API key cannot be empty or whitespace only",
      retryable: false,
      userActionRequired: true,
    });
  }

  if (trimmed.length > 4096) {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: "API key exceeds maximum permitted length of 4096 characters",
      retryable: false,
      userActionRequired: true,
    });
  }

  return trimmed;
}

function validateBaseUrl(url?: string | null): string | null {
  if (!url || !url.trim()) return null;
  const trimmed = url.trim();

  if (trimmed.length > 512) {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: "Base URL exceeds maximum length of 512 characters",
      retryable: false,
      userActionRequired: true,
    });
  }

  if (trimmed.includes("@")) {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: "Base URL must not contain embedded user credentials",
      retryable: false,
      userActionRequired: true,
    });
  }

  const lower = trimmed.toLowerCase();
  if (lower.startsWith("https://") || lower.startsWith("http://localhost") || lower.startsWith("http://127.0.0.1")) {
    return trimmed;
  }

  throw new IpcError({
    code: "INVALID_INPUT",
    category: "InvalidInput",
    message: "Base URL must use HTTPS, or HTTP for localhost/127.0.0.1 development endpoints",
    retryable: false,
    userActionRequired: true,
  });
}

function validatePriorityWeight(priority?: number): number {
  if (priority === undefined || priority === null) return 5;
  if (!Number.isInteger(priority) || priority < 1 || priority > 10) {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: `Priority weight must be an integer between 1 and 10; got ${priority}`,
      retryable: false,
      userActionRequired: true,
    });
  }
  return priority;
}

function validateBudgetLimit(limit?: number | null): number | null {
  if (limit === undefined || limit === null) return null;
  if (Number.isNaN(limit) || !Number.isFinite(limit) || limit < 0) {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: `Monthly budget limit cannot be negative or invalid number; got ${limit}`,
      retryable: false,
      userActionRequired: true,
    });
  }
  return limit;
}

// ============================================================================
// Public Credential Vault IPC API
// ============================================================================

/**
 * Encrypts and persists a provider API key using Windows DPAPI, returning safe status metadata.
 * Plaintext API key is consumed natively and NEVER returned to frontend.
 */
export async function saveProviderCredential(
  request: SaveCredentialRequest
): Promise<ProviderCredentialStatus> {
  const providerId = validateProviderId(request.providerId);
  const validApiKey = validateApiKey(request.apiKey);
  const baseUrl = validateBaseUrl(request.baseUrl);
  const priorityWeight = validatePriorityWeight(request.priorityWeight);
  const monthlyBudgetLimit = validateBudgetLimit(request.monthlyBudgetLimit);
  const isActive = request.isActive ?? true;

  if (!isTauriContext()) {
    const now = Date.now();
    const status: ProviderCredentialStatus = {
      providerId,
      isConfigured: true,
      isActive,
      priorityWeight,
      baseUrl,
      monthlyBudgetLimit,
      currentMonthSpend: 0.0,
      updatedAt: now,
    };
    mockStatuses.set(providerId, status);
    return status;
  }

  return await safeInvoke<ProviderCredentialStatus>(
    IPC_COMMANDS.SAVE_PROVIDER_CREDENTIAL,
    {
      input: {
        providerId,
        apiKey: validApiKey,
        baseUrl,
        isActive,
        priorityWeight,
        monthlyBudgetLimit,
      },
    },
    { requestId: generateRequestId() }
  );
}

/**
 * Retrieves non-secret credential configuration status for a specific provider.
 */
export async function getProviderCredentialStatus(
  providerId: string
): Promise<ProviderCredentialStatus | null> {
  const cleanId = validateProviderId(providerId);

  if (!isTauriContext()) {
    return mockStatuses.get(cleanId) ?? null;
  }

  return await safeInvoke<ProviderCredentialStatus | null>(
    IPC_COMMANDS.GET_PROVIDER_CREDENTIAL_STATUS,
    { providerId: cleanId },
    { requestId: generateRequestId() }
  );
}

/**
 * Lists non-secret credential statuses for all configured providers.
 */
export async function listProviderCredentialStatuses(): Promise<ProviderCredentialStatus[]> {
  if (!isTauriContext()) {
    const statuses = Array.from(mockStatuses.values()).sort(
      (a, b) => b.priorityWeight - a.priorityWeight || a.providerId.localeCompare(b.providerId)
    );
    return statuses;
  }

  return await safeInvoke<ProviderCredentialStatus[]>(
    IPC_COMMANDS.LIST_PROVIDER_CREDENTIAL_STATUSES,
    undefined,
    { requestId: generateRequestId() }
  );
}

/**
 * Toggles or updates the active state of a configured provider credential.
 */
export async function setProviderActive(
  providerId: string,
  isActive: boolean
): Promise<ProviderCredentialStatus> {
  const cleanId = validateProviderId(providerId);

  if (!isTauriContext()) {
    const existing = mockStatuses.get(cleanId);
    if (!existing) {
      throw new IpcError({
        code: "NOT_FOUND",
        category: "InvalidInput",
        message: `Provider '${cleanId}' has no configured credentials`,
        retryable: false,
        userActionRequired: true,
      });
    }

    const updated: ProviderCredentialStatus = {
      ...existing,
      isActive,
      updatedAt: Date.now(),
    };
    mockStatuses.set(cleanId, updated);
    return updated;
  }

  return await safeInvoke<ProviderCredentialStatus>(
    IPC_COMMANDS.SET_PROVIDER_ACTIVE,
    { providerId: cleanId, isActive },
    { requestId: generateRequestId() }
  );
}

/**
 * Deletes a provider credential and its associated metadata.
 */
export async function deleteProviderCredential(providerId: string): Promise<boolean> {
  const cleanId = validateProviderId(providerId);

  if (!isTauriContext()) {
    return mockStatuses.delete(cleanId);
  }

  return await safeInvoke<boolean>(
    IPC_COMMANDS.DELETE_PROVIDER_CREDENTIAL,
    { providerId: cleanId },
    { requestId: generateRequestId() }
  );
}

