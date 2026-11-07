// ============================================================================
// Nano Route - Application Settings & Provider Preferences IPC Service
// File: src/services/ipc/settings.ts
// ============================================================================
// Authoritative frontend client for application settings and non-secret
// provider preferences. Plaintext credentials and ciphertexts NEVER enter this layer.
// ============================================================================

import { safeInvoke, isTauriContext } from "./client.ts";
import {
  IPC_COMMANDS,
  type AppSettingKeyString,
  type AppSettingsSnapshot,
  type ProviderCredentialStatus,
  type RoutingPreferenceMode,
  type UpdateProviderPreferencesRequest,
} from "./types.ts";
import { IpcError } from "./errors.ts";

// --- Virtual Application Defaults ---

export const DEFAULT_APP_SETTINGS: Readonly<AppSettingsSnapshot> = {
  routingPreferenceMode: "balanced",
  telemetryEnabled: true,
  historyRetentionDays: 0, // 0 = indefinite/unlimited local retention
  windowStartMaximized: false,
};

// --- In-Memory Mock Store for Testing & Browser Mode ---

const mockAppSettings = new Map<string, string>();
const mockProviderPreferences = new Map<string, ProviderCredentialStatus>();

/**
 * Resets the in-memory mock settings and provider preferences store.
 */
export function clearMockSettings(): void {
  mockAppSettings.clear();
  mockProviderPreferences.clear();
}

/**
 * Seeds a mock provider status into the test mock store (e.g. for testing preference updates).
 */
export function seedMockProviderPreference(status: ProviderCredentialStatus): void {
  mockProviderPreferences.set(status.providerId, { ...status });
}

// --- Validation Utilities ---

function invalidInputError(message: string): IpcError {
  return new IpcError({
    code: "INVALID_INPUT",
    category: "InvalidInput",
    message,
    retryable: false,
    userActionRequired: true,
  });
}

export function validateProviderId(providerId: string): string {
  const trimmed = providerId.trim();
  if (trimmed.length < 2 || trimmed.length > 64) {
    throw invalidInputError(`Provider ID must be between 2 and 64 characters; got ${trimmed.length}`);
  }
  const first = trimmed.charAt(0);
  if (!/[a-z0-9]/.test(first)) {
    throw invalidInputError("Provider ID must start with a lowercase alphanumeric character");
  }
  if (!/^[a-z0-9._-]+$/.test(trimmed)) {
    throw invalidInputError("Provider ID contains invalid characters. Allowed: [a-z0-9._-]");
  }
  return trimmed;
}

export function validateBaseUrl(url?: string | null): string | null {
  if (!url || url.trim().length === 0) {
    return null;
  }
  const trimmed = url.trim();
  if (trimmed.length > 512) {
    throw invalidInputError("Base URL exceeds maximum length of 512 characters");
  }
  if (trimmed.includes("@")) {
    throw invalidInputError("Base URL must not contain embedded user credentials");
  }

  const lower = trimmed.toLowerCase();
  if (lower.startsWith("https://") || lower.startsWith("http://localhost") || lower.startsWith("http://127.0.0.1")) {
    return trimmed;
  }
  throw invalidInputError("Base URL must use HTTPS, or HTTP for localhost/127.0.0.1 development endpoints");
}

export function validateSetting(key: AppSettingKeyString, value: string): string {
  const trimmed = value.trim();

  switch (key) {
    case "routing.preference_mode": {
      const mode = trimmed.toLowerCase();
      if (mode === "quality" || mode === "balanced" || mode === "cost_saving") {
        return mode;
      }
      throw invalidInputError(`Invalid routing preference mode '${trimmed}'. Allowed: [quality, balanced, cost_saving]`);
    }
    case "telemetry.enabled": {
      const lower = trimmed.toLowerCase();
      if (lower === "true" || lower === "false") {
        return lower;
      }
      throw invalidInputError(`Invalid boolean value '${trimmed}' for telemetry.enabled. Allowed: [true, false]`);
    }
    case "history.retention_days": {
      const num = parseInt(trimmed, 10);
      if (!Number.isNaN(num) && num >= 0 && num <= 365 && String(num) === trimmed) {
        return String(num);
      }
      throw invalidInputError(`Invalid retention days '${trimmed}'. Must be an integer between 0 and 365`);
    }
    case "window.start_maximized": {
      const lower = trimmed.toLowerCase();
      if (lower === "true" || lower === "false") {
        return lower;
      }
      throw invalidInputError(`Invalid boolean value '${trimmed}' for window.start_maximized. Allowed: [true, false]`);
    }
    default:
      throw invalidInputError(`Unknown application setting key '${key}'`);
  }
}

// --- Application Settings API ---

/**
 * Retrieves the full snapshot of typed application settings with virtual defaults resolved.
 */
export async function getAppSettings(): Promise<AppSettingsSnapshot> {
  if (!isTauriContext()) {
    const routingMode = (mockAppSettings.get("routing.preference_mode") as RoutingPreferenceMode) || DEFAULT_APP_SETTINGS.routingPreferenceMode;
    const telemetryVal = mockAppSettings.get("telemetry.enabled");
    const telemetryEnabled = telemetryVal !== undefined ? telemetryVal === "true" : DEFAULT_APP_SETTINGS.telemetryEnabled;
    const retentionVal = mockAppSettings.get("history.retention_days");
    const historyRetentionDays = retentionVal !== undefined ? parseInt(retentionVal, 10) : DEFAULT_APP_SETTINGS.historyRetentionDays;
    const windowVal = mockAppSettings.get("window.start_maximized");
    const windowStartMaximized = windowVal !== undefined ? windowVal === "true" : DEFAULT_APP_SETTINGS.windowStartMaximized;

    return {
      routingPreferenceMode: routingMode,
      telemetryEnabled,
      historyRetentionDays,
      windowStartMaximized,
    };
  }

  return safeInvoke<AppSettingsSnapshot>(IPC_COMMANDS.GET_APP_SETTINGS);
}

/**
 * Retrieves a single application setting value by key, returning its virtual default if unset.
 */
export async function getAppSetting(key: AppSettingKeyString): Promise<string> {
  if (!isTauriContext()) {
    const stored = mockAppSettings.get(key);
    if (stored !== undefined) {
      return stored;
    }
    switch (key) {
      case "routing.preference_mode":
        return DEFAULT_APP_SETTINGS.routingPreferenceMode;
      case "telemetry.enabled":
        return String(DEFAULT_APP_SETTINGS.telemetryEnabled);
      case "history.retention_days":
        return String(DEFAULT_APP_SETTINGS.historyRetentionDays);
      case "window.start_maximized":
        return String(DEFAULT_APP_SETTINGS.windowStartMaximized);
    }
  }

  return safeInvoke<string>(IPC_COMMANDS.GET_APP_SETTING, { key });
}

/**
 * Sets and persists a typed application setting value after domain validation.
 */
export async function setAppSetting(key: AppSettingKeyString, value: string): Promise<boolean> {
  const validated = validateSetting(key, value);

  if (!isTauriContext()) {
    mockAppSettings.set(key, validated);
    return true;
  }

  return safeInvoke<boolean>(IPC_COMMANDS.SET_APP_SETTING, { key, value: validated });
}

/**
 * Resets a single application setting to its virtual default.
 */
export async function resetAppSetting(key: AppSettingKeyString): Promise<boolean> {
  if (!isTauriContext()) {
    const existed = mockAppSettings.delete(key);
    return existed;
  }

  return safeInvoke<boolean>(IPC_COMMANDS.RESET_APP_SETTING, { key });
}

// --- Provider Preferences API ---

/**
 * Retrieves safe non-secret configuration preferences for a specific provider.
 */
export async function getProviderPreferences(providerId: string): Promise<ProviderCredentialStatus | null> {
  const validatedId = validateProviderId(providerId);

  if (!isTauriContext()) {
    return mockProviderPreferences.get(validatedId) ?? null;
  }

  return safeInvoke<ProviderCredentialStatus | null>(IPC_COMMANDS.GET_PROVIDER_PREFERENCES, {
    providerId: validatedId,
  });
}

/**
 * Lists safe non-secret configuration preferences for all configured providers.
 */
export async function listProviderPreferences(): Promise<ProviderCredentialStatus[]> {
  if (!isTauriContext()) {
    return Array.from(mockProviderPreferences.values()).sort(
      (a, b) => b.priorityWeight - a.priorityWeight || a.providerId.localeCompare(b.providerId)
    );
  }

  return safeInvoke<ProviderCredentialStatus[]>(IPC_COMMANDS.LIST_PROVIDER_PREFERENCES);
}

/**
 * Atomically updates non-secret provider preferences.
 * Strictly preserves encrypted API keys and current spend.
 */
export async function updateProviderPreferences(
  request: UpdateProviderPreferencesRequest
): Promise<ProviderCredentialStatus> {
  const validatedId = validateProviderId(request.providerId);
  const validatedUrl = validateBaseUrl(request.baseUrl);

  if (request.priorityWeight !== undefined) {
    if (!Number.isInteger(request.priorityWeight) || request.priorityWeight < 1 || request.priorityWeight > 10) {
      throw invalidInputError(`Priority weight must be an integer between 1 and 10; got ${request.priorityWeight}`);
    }
  }

  if (request.monthlyBudgetLimit !== undefined && request.monthlyBudgetLimit !== null) {
    if (!Number.isFinite(request.monthlyBudgetLimit) || request.monthlyBudgetLimit < 0) {
      throw invalidInputError("Monthly budget limit must be a non-negative finite number");
    }
  }

  if (!isTauriContext()) {
    const existing = mockProviderPreferences.get(validatedId);
    if (!existing) {
      throw invalidInputError(`Cannot update preferences for unconfigured provider '${validatedId}'`);
    }

    const updated: ProviderCredentialStatus = {
      ...existing,
      baseUrl: validatedUrl !== undefined ? validatedUrl : existing.baseUrl,
      isActive: request.isActive !== undefined ? request.isActive : existing.isActive,
      priorityWeight: request.priorityWeight !== undefined ? request.priorityWeight : existing.priorityWeight,
      monthlyBudgetLimit: request.monthlyBudgetLimit !== undefined ? request.monthlyBudgetLimit : existing.monthlyBudgetLimit,
      updatedAt: Date.now(),
    };

    mockProviderPreferences.set(validatedId, updated);
    return updated;
  }

  return safeInvoke<ProviderCredentialStatus>(IPC_COMMANDS.UPDATE_PROVIDER_PREFERENCES, {
    input: {
      providerId: validatedId,
      baseUrl: validatedUrl,
      isActive: request.isActive,
      priorityWeight: request.priorityWeight,
      monthlyBudgetLimit: request.monthlyBudgetLimit,
    },
  });
}

/**
 * Resets provider preferences to documented defaults while preserving credentials.
 */
export async function resetProviderPreferences(providerId: string): Promise<ProviderCredentialStatus> {
  const validatedId = validateProviderId(providerId);

  if (!isTauriContext()) {
    const existing = mockProviderPreferences.get(validatedId);
    if (!existing) {
      throw invalidInputError(`Cannot reset preferences for unconfigured provider '${validatedId}'`);
    }

    const reset: ProviderCredentialStatus = {
      ...existing,
      baseUrl: null,
      isActive: true,
      priorityWeight: 5,
      monthlyBudgetLimit: null,
      updatedAt: Date.now(),
    };

    mockProviderPreferences.set(validatedId, reset);
    return reset;
  }

  return safeInvoke<ProviderCredentialStatus>(IPC_COMMANDS.RESET_PROVIDER_PREFERENCES, {
    providerId: validatedId,
  });
}
