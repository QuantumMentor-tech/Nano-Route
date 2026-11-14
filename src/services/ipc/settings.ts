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
  type ModelSettingsSummaryDto,
  type ProviderCredentialStatus,
  type ProviderSettingsSummaryDto,
  type SecurityStatusSummaryDto,
  type SettingsWorkspaceSnapshotDto,
  type UpdateProviderPreferencesRequest,
  type ProviderDescriptorDto,
  type ModelDescriptorDto,
  type PreferenceSection,
} from "./types.ts";
import { IpcError } from "./errors.ts";
import { listRegisteredProviders, listRegisteredModels } from "./registry.ts";
import { getAllProviderHealth } from "./provider_health.ts";
import { DEFAULT_ROUTING_POLICY_CONFIG } from "./routing_policy.ts";
import { __internalGetMockCredentialStore } from "./credentials.ts";

// --- Virtual Application Defaults ---

export const DEFAULT_APP_SETTINGS: Readonly<AppSettingsSnapshot> = {
  routingPreferenceMode: "balanced",
  telemetryEnabled: true,
  historyRetentionDays: 0, // 0 = indefinite/unlimited local retention
  windowStartMaximized: false,
  manualOverrideEnabled: false,
  manualOverrideProvider: "",
  manualOverrideModel: "",

  // Step 66: User Preferences & Workspace Personalization
  themeMode: "dark",
  density: "comfortable",
  reducedMotion: "system",
  textScale: "100%",
  enhancedFocus: false,
  startupRoute: "overview",
  sidebarCollapsed: false,
  confirmChatClear: true,
  chatShowTimestamps: false,
  chatCompactSpacing: false,
  chatEnterToSend: true,
  chatAutoScroll: true,
  notificationEnableNonCriticalToasts: true,
  notificationToastDurationMs: 5000,
  paletteShowDescriptions: true,
  paletteShowShortcuts: true,

  // Step 67: Local Workspace Profiles
  activeProfileId: "prof_default",
  customProfilesJson: "[]",

  // Step 68: Session Continuity & Crash-Safe Restoration
  sessionStateJson: "",
  lastExitStatus: "clean_exit",
  restorePreviousSession: true,
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

export function __internalGetMockSettingsStore(): Map<string, string> {
  return mockAppSettings;
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
    case "routing.manual_override_enabled": {
      const lower = trimmed.toLowerCase();
      if (lower === "true" || lower === "false") {
        return lower;
      }
      throw invalidInputError(`Invalid boolean value '${trimmed}' for routing.manual_override_enabled. Allowed: [true, false]`);
    }
    case "routing.manual_override_provider": {
      if (trimmed.length > 64) {
        throw invalidInputError("Manual override provider ID exceeds 64 characters");
      }
      return trimmed;
    }
    case "routing.manual_override_model": {
      if (trimmed.length > 128) {
        throw invalidInputError("Manual override model ID exceeds 128 characters");
      }
      return trimmed;
    }
    // --- Step 66: Appearance ---
    case "appearance.theme_mode": {
      const mode = trimmed.toLowerCase();
      if (mode === "dark" || mode === "light" || mode === "system") {
        return mode;
      }
      throw invalidInputError(`Invalid theme mode '${trimmed}'. Allowed: [dark, light, system]`);
    }
    case "appearance.density": {
      const density = trimmed.toLowerCase();
      if (density === "comfortable" || density === "compact") {
        return density;
      }
      throw invalidInputError(`Invalid interface density '${trimmed}'. Allowed: [comfortable, compact]`);
    }
    case "appearance.reduced_motion": {
      const motion = trimmed.toLowerCase();
      if (motion === "system" || motion === "reduced" || motion === "standard") {
        return motion;
      }
      throw invalidInputError(`Invalid motion preference '${trimmed}'. Allowed: [system, reduced, standard]`);
    }
    case "appearance.text_scale": {
      if (trimmed === "100%" || trimmed === "110%" || trimmed === "125%") {
        return trimmed;
      }
      throw invalidInputError(`Invalid text scale '${trimmed}'. Allowed: [100%, 110%, 125%]`);
    }
    case "appearance.enhanced_focus": {
      const lower = trimmed.toLowerCase();
      if (lower === "true" || lower === "false") {
        return lower;
      }
      throw invalidInputError(`Invalid boolean value '${trimmed}' for appearance.enhanced_focus. Allowed: [true, false]`);
    }
    // --- Step 66: Workspace & Startup ---
    case "workspace.startup_route": {
      const route = trimmed.toLowerCase();
      if (route === "overview" || route === "chat") {
        return route;
      }
      throw invalidInputError(`Invalid startup route '${trimmed}'. Allowed: [overview, chat]`);
    }
    case "workspace.sidebar_collapsed": {
      const lower = trimmed.toLowerCase();
      if (lower === "true" || lower === "false") {
        return lower;
      }
      throw invalidInputError(`Invalid boolean value '${trimmed}' for workspace.sidebar_collapsed. Allowed: [true, false]`);
    }
    case "workspace.confirm_chat_clear": {
      const lower = trimmed.toLowerCase();
      if (lower === "true" || lower === "false") {
        return lower;
      }
      throw invalidInputError(`Invalid boolean value '${trimmed}' for workspace.confirm_chat_clear. Allowed: [true, false]`);
    }
    // --- Step 66: Chat ---
    case "chat.show_timestamps": {
      const lower = trimmed.toLowerCase();
      if (lower === "true" || lower === "false") {
        return lower;
      }
      throw invalidInputError(`Invalid boolean value '${trimmed}' for chat.show_timestamps. Allowed: [true, false]`);
    }
    case "chat.compact_spacing": {
      const lower = trimmed.toLowerCase();
      if (lower === "true" || lower === "false") {
        return lower;
      }
      throw invalidInputError(`Invalid boolean value '${trimmed}' for chat.compact_spacing. Allowed: [true, false]`);
    }
    case "chat.enter_to_send": {
      const lower = trimmed.toLowerCase();
      if (lower === "true" || lower === "false") {
        return lower;
      }
      throw invalidInputError(`Invalid boolean value '${trimmed}' for chat.enter_to_send. Allowed: [true, false]`);
    }
    case "chat.auto_scroll_to_bottom": {
      const lower = trimmed.toLowerCase();
      if (lower === "true" || lower === "false") {
        return lower;
      }
      throw invalidInputError(`Invalid boolean value '${trimmed}' for chat.auto_scroll_to_bottom. Allowed: [true, false]`);
    }
    // --- Step 66: Notifications ---
    case "notifications.enable_non_critical_toasts": {
      const lower = trimmed.toLowerCase();
      if (lower === "true" || lower === "false") {
        return lower;
      }
      throw invalidInputError(`Invalid boolean value '${trimmed}' for notifications.enable_non_critical_toasts. Allowed: [true, false]`);
    }
    case "notifications.toast_duration_ms": {
      const num = parseInt(trimmed, 10);
      if (!Number.isNaN(num) && num >= 1000 && num <= 30000 && String(num) === trimmed) {
        return String(num);
      }
      throw invalidInputError(`Invalid toast duration '${trimmed}'. Must be an integer between 1000 and 30000 ms`);
    }
    // --- Step 66: Command Palette ---
    case "palette.show_descriptions": {
      const lower = trimmed.toLowerCase();
      if (lower === "true" || lower === "false") {
        return lower;
      }
      throw invalidInputError(`Invalid boolean value '${trimmed}' for palette.show_descriptions. Allowed: [true, false]`);
    }
    case "palette.show_shortcuts": {
      const lower = trimmed.toLowerCase();
      if (lower === "true" || lower === "false") {
        return lower;
      }
      throw invalidInputError(`Invalid boolean value '${trimmed}' for palette.show_shortcuts. Allowed: [true, false]`);
    }
    // --- Step 67: Local Workspace Profiles ---
    case "workspace.active_profile_id": {
      if (trimmed.length < 1 || trimmed.length > 64) {
        throw invalidInputError("Active profile ID must be between 1 and 64 characters");
      }
      if (!/^[a-zA-Z0-9_.-]+$/.test(trimmed)) {
        throw invalidInputError("Active profile ID contains invalid characters. Allowed: [a-zA-Z0-9_.-]");
      }
      return trimmed;
    }
    case "workspace.profiles": {
      if (trimmed.length > 32768) {
        throw invalidInputError("Workspace profiles JSON payload exceeds maximum size of 32KB");
      }
      try {
        const parsed = JSON.parse(trimmed);
        if (!Array.isArray(parsed)) {
          throw new Error("Profiles payload must be a JSON array");
        }
      } catch (err: unknown) {
        throw invalidInputError(`Invalid workspace profiles JSON: ${err instanceof Error ? err.message : String(err)}`);
      }
      return trimmed;
    }
    // --- Step 68: Session Continuity & Crash-Safe Restoration ---
    case "workspace.session_state": {
      if (trimmed.length > 8192) {
        throw invalidInputError("Workspace session state payload exceeds maximum size of 8KB");
      }
      if (trimmed.length > 0) {
        try {
          const parsed = JSON.parse(trimmed);
          if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
            throw new Error("Session state payload must be a JSON object");
          }
        } catch (err: unknown) {
          throw invalidInputError(`Invalid workspace session state JSON: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      return trimmed;
    }
    case "workspace.last_exit_status": {
      const lower = trimmed.toLowerCase();
      if (lower === "clean_exit" || lower === "unexpected_exit" || lower === "startup_recovery" || lower === "unknown") {
        return lower;
      }
      throw invalidInputError(`Invalid exit status '${trimmed}'. Allowed: [clean_exit, unexpected_exit, startup_recovery, unknown]`);
    }
    case "workspace.restore_previous_session": {
      const lower = trimmed.toLowerCase();
      if (lower === "true" || lower === "false") {
        return lower;
      }
      throw invalidInputError(`Invalid boolean value '${trimmed}' for workspace.restore_previous_session. Allowed: [true, false]`);
    }
    default:
      throw invalidInputError(`Unknown application setting key '${key}'`);
  }
}

// --- Application Settings API ---

/**
 * Helper to safely parse stored values or fallback to default.
 */
function safeGetBool(map: Map<string, string>, key: AppSettingKeyString, defaultVal: boolean): boolean {
  const val = map.get(key);
  if (val === undefined) return defaultVal;
  return val.toLowerCase() === "true";
}

function safeGetEnum<T extends string>(map: Map<string, string>, key: AppSettingKeyString, allowed: readonly T[], defaultVal: T): T {
  const val = map.get(key);
  if (val && allowed.includes(val as T)) {
    return val as T;
  }
  return defaultVal;
}

function safeGetInt(map: Map<string, string>, key: AppSettingKeyString, defaultVal: number, min?: number, max?: number): number {
  const val = map.get(key);
  if (val === undefined) return defaultVal;
  const num = parseInt(val, 10);
  if (Number.isNaN(num)) return defaultVal;
  if (min !== undefined && num < min) return defaultVal;
  if (max !== undefined && num > max) return defaultVal;
  return num;
}

/**
 * Retrieves the full snapshot of typed application settings with virtual defaults resolved.
 */
export async function getAppSettings(): Promise<AppSettingsSnapshot> {
  if (!isTauriContext()) {
    const routingMode = safeGetEnum(mockAppSettings, "routing.preference_mode", ["quality", "balanced", "cost_saving"] as const, DEFAULT_APP_SETTINGS.routingPreferenceMode);
    const telemetryEnabled = safeGetBool(mockAppSettings, "telemetry.enabled", DEFAULT_APP_SETTINGS.telemetryEnabled);
    const historyRetentionDays = safeGetInt(mockAppSettings, "history.retention_days", DEFAULT_APP_SETTINGS.historyRetentionDays, 0, 365);
    const windowStartMaximized = safeGetBool(mockAppSettings, "window.start_maximized", DEFAULT_APP_SETTINGS.windowStartMaximized);
    const manualOverrideEnabled = safeGetBool(mockAppSettings, "routing.manual_override_enabled", DEFAULT_APP_SETTINGS.manualOverrideEnabled ?? false);
    const manualOverrideProvider = mockAppSettings.get("routing.manual_override_provider") ?? DEFAULT_APP_SETTINGS.manualOverrideProvider;
    const manualOverrideModel = mockAppSettings.get("routing.manual_override_model") ?? DEFAULT_APP_SETTINGS.manualOverrideModel;

    // Step 66 preferences
    const themeMode = safeGetEnum(mockAppSettings, "appearance.theme_mode", ["dark", "light", "system"] as const, DEFAULT_APP_SETTINGS.themeMode ?? "dark");
    const density = safeGetEnum(mockAppSettings, "appearance.density", ["comfortable", "compact"] as const, DEFAULT_APP_SETTINGS.density ?? "comfortable");
    const reducedMotion = safeGetEnum(mockAppSettings, "appearance.reduced_motion", ["system", "reduced", "standard"] as const, DEFAULT_APP_SETTINGS.reducedMotion ?? "system");
    const textScale = safeGetEnum(mockAppSettings, "appearance.text_scale", ["100%", "110%", "125%"] as const, DEFAULT_APP_SETTINGS.textScale ?? "100%");
    const enhancedFocus = safeGetBool(mockAppSettings, "appearance.enhanced_focus", DEFAULT_APP_SETTINGS.enhancedFocus ?? false);
    const startupRoute = safeGetEnum(mockAppSettings, "workspace.startup_route", ["overview", "chat"] as const, DEFAULT_APP_SETTINGS.startupRoute ?? "overview");
    const sidebarCollapsed = safeGetBool(mockAppSettings, "workspace.sidebar_collapsed", DEFAULT_APP_SETTINGS.sidebarCollapsed ?? false);
    const confirmChatClear = safeGetBool(mockAppSettings, "workspace.confirm_chat_clear", DEFAULT_APP_SETTINGS.confirmChatClear ?? true);
    const chatShowTimestamps = safeGetBool(mockAppSettings, "chat.show_timestamps", DEFAULT_APP_SETTINGS.chatShowTimestamps ?? false);
    const chatCompactSpacing = safeGetBool(mockAppSettings, "chat.compact_spacing", DEFAULT_APP_SETTINGS.chatCompactSpacing ?? false);
    const chatEnterToSend = safeGetBool(mockAppSettings, "chat.enter_to_send", DEFAULT_APP_SETTINGS.chatEnterToSend ?? true);
    const chatAutoScroll = safeGetBool(mockAppSettings, "chat.auto_scroll_to_bottom", DEFAULT_APP_SETTINGS.chatAutoScroll ?? true);
    const notificationEnableNonCriticalToasts = safeGetBool(mockAppSettings, "notifications.enable_non_critical_toasts", DEFAULT_APP_SETTINGS.notificationEnableNonCriticalToasts ?? true);
    const notificationToastDurationMs = safeGetInt(mockAppSettings, "notifications.toast_duration_ms", DEFAULT_APP_SETTINGS.notificationToastDurationMs ?? 5000, 1000, 30000);
    const paletteShowDescriptions = safeGetBool(mockAppSettings, "palette.show_descriptions", DEFAULT_APP_SETTINGS.paletteShowDescriptions ?? true);
    const paletteShowShortcuts = safeGetBool(mockAppSettings, "palette.show_shortcuts", DEFAULT_APP_SETTINGS.paletteShowShortcuts ?? true);

    // Step 67: Local Workspace Profiles
    const activeProfileId = mockAppSettings.get("workspace.active_profile_id") ?? DEFAULT_APP_SETTINGS.activeProfileId;
    const customProfilesJson = mockAppSettings.get("workspace.profiles") ?? DEFAULT_APP_SETTINGS.customProfilesJson;

    // Step 68: Session Continuity & Crash-Safe Restoration
    const sessionStateJson = mockAppSettings.get("workspace.session_state") ?? DEFAULT_APP_SETTINGS.sessionStateJson;
    const lastExitStatus = mockAppSettings.get("workspace.last_exit_status") ?? DEFAULT_APP_SETTINGS.lastExitStatus;
    const restorePreviousSession = safeGetBool(mockAppSettings, "workspace.restore_previous_session", DEFAULT_APP_SETTINGS.restorePreviousSession ?? true);

    return {
      routingPreferenceMode: routingMode,
      telemetryEnabled,
      historyRetentionDays,
      windowStartMaximized,
      manualOverrideEnabled,
      manualOverrideProvider,
      manualOverrideModel,
      themeMode,
      density,
      reducedMotion,
      textScale,
      enhancedFocus,
      startupRoute,
      sidebarCollapsed,
      confirmChatClear,
      chatShowTimestamps,
      chatCompactSpacing,
      chatEnterToSend,
      chatAutoScroll,
      notificationEnableNonCriticalToasts,
      notificationToastDurationMs,
      paletteShowDescriptions,
      paletteShowShortcuts,
      activeProfileId,
      customProfilesJson,
      sessionStateJson,
      lastExitStatus,
      restorePreviousSession,
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
      case "routing.manual_override_enabled":
        return String(DEFAULT_APP_SETTINGS.manualOverrideEnabled ?? false);
      case "routing.manual_override_provider":
        return DEFAULT_APP_SETTINGS.manualOverrideProvider ?? "";
      case "routing.manual_override_model":
        return DEFAULT_APP_SETTINGS.manualOverrideModel ?? "";
      case "appearance.theme_mode":
        return DEFAULT_APP_SETTINGS.themeMode ?? "dark";
      case "appearance.density":
        return DEFAULT_APP_SETTINGS.density ?? "comfortable";
      case "appearance.reduced_motion":
        return DEFAULT_APP_SETTINGS.reducedMotion ?? "system";
      case "appearance.text_scale":
        return DEFAULT_APP_SETTINGS.textScale ?? "100%";
      case "appearance.enhanced_focus":
        return String(DEFAULT_APP_SETTINGS.enhancedFocus ?? false);
      case "workspace.startup_route":
        return DEFAULT_APP_SETTINGS.startupRoute ?? "overview";
      case "workspace.sidebar_collapsed":
        return String(DEFAULT_APP_SETTINGS.sidebarCollapsed ?? false);
      case "workspace.confirm_chat_clear":
        return String(DEFAULT_APP_SETTINGS.confirmChatClear ?? true);
      case "chat.show_timestamps":
        return String(DEFAULT_APP_SETTINGS.chatShowTimestamps ?? false);
      case "chat.compact_spacing":
        return String(DEFAULT_APP_SETTINGS.chatCompactSpacing ?? false);
      case "chat.enter_to_send":
        return String(DEFAULT_APP_SETTINGS.chatEnterToSend ?? true);
      case "chat.auto_scroll_to_bottom":
        return String(DEFAULT_APP_SETTINGS.chatAutoScroll ?? true);
      case "notifications.enable_non_critical_toasts":
        return String(DEFAULT_APP_SETTINGS.notificationEnableNonCriticalToasts ?? true);
      case "notifications.toast_duration_ms":
        return String(DEFAULT_APP_SETTINGS.notificationToastDurationMs ?? 5000);
      case "palette.show_descriptions":
        return String(DEFAULT_APP_SETTINGS.paletteShowDescriptions ?? true);
      case "palette.show_shortcuts":
        return String(DEFAULT_APP_SETTINGS.paletteShowShortcuts ?? true);
      case "workspace.active_profile_id":
        return DEFAULT_APP_SETTINGS.activeProfileId ?? "prof_default";
      case "workspace.profiles":
        return DEFAULT_APP_SETTINGS.customProfilesJson ?? "[]";
      // Step 68: Session Continuity & Crash-Safe Restoration
      case "workspace.session_state":
        return DEFAULT_APP_SETTINGS.sessionStateJson ?? "";
      case "workspace.last_exit_status":
        return DEFAULT_APP_SETTINGS.lastExitStatus ?? "clean_exit";
      case "workspace.restore_previous_session":
        return String(DEFAULT_APP_SETTINGS.restorePreviousSession ?? true);
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

/**
 * Resets all application settings to virtual defaults.
 * Preserves credentials, chat history, and telemetry.
 */
export async function resetAllAppSettings(): Promise<number> {
  if (!isTauriContext()) {
    const count = mockAppSettings.size;
    mockAppSettings.clear();
    return count;
  }

  return safeInvoke<number>(IPC_COMMANDS.RESET_ALL_SETTINGS);
}

/**
 * Mapping of preference sections to their constituent canonical setting keys.
 */
export const SECTION_SETTING_KEYS: Record<Exclude<PreferenceSection, "all_preferences">, AppSettingKeyString[]> = {
  appearance: [
    "appearance.theme_mode",
    "appearance.density",
    "appearance.reduced_motion",
    "appearance.text_scale",
    "appearance.enhanced_focus",
  ],
  workspace: [
    "workspace.startup_route",
    "workspace.sidebar_collapsed",
    "workspace.confirm_chat_clear",
  ],
  chat: [
    "chat.show_timestamps",
    "chat.compact_spacing",
    "chat.enter_to_send",
    "chat.auto_scroll_to_bottom",
  ],
  notifications: [
    "notifications.enable_non_critical_toasts",
    "notifications.toast_duration_ms",
  ],
  palette: [
    "palette.show_descriptions",
    "palette.show_shortcuts",
  ],
  general: [
    "routing.preference_mode",
    "telemetry.enabled",
    "window.start_maximized",
  ],
};

/**
 * Safely resets a specific section or all user preferences to virtual defaults.
 * Strictly guarantees that credentials, chat history, and telemetry remain untouched.
 */
export async function resetSettingsSection(section: PreferenceSection): Promise<number> {
  const keysToReset: AppSettingKeyString[] =
    section === "all_preferences"
      ? (Object.values(SECTION_SETTING_KEYS).flat() as AppSettingKeyString[])
      : (SECTION_SETTING_KEYS[section] ?? []);

  let resetCount = 0;
  for (const key of keysToReset) {
    const reset = await resetAppSetting(key);
    if (reset) {
      resetCount++;
    }
  }

  return resetCount;
}

/**
 * Resets all user workspace and presentation preferences.
 * Convenience alias for resetSettingsSection("all_preferences").
 */
export async function resetAllUserPreferences(): Promise<number> {
  return resetSettingsSection("all_preferences");
}

/**
 * Retrieves the unified settings workspace snapshot combining application settings,
 * provider configurations, health states, model registry, routing policy, and security status.
 */
export async function getSettingsWorkspaceSnapshot(): Promise<SettingsWorkspaceSnapshotDto> {
  if (!isTauriContext()) {
    const appSettings = await getAppSettings();
    const providers = await listRegisteredProviders();
    const allModels = await listRegisteredModels();
    const healthSnapshots = await getAllProviderHealth();
    const healthMap = new Map(healthSnapshots.map((h) => [h.providerId, h]));

    const providerSummaries: ProviderSettingsSummaryDto[] = providers.map((p: ProviderDescriptorDto) => {
      const pref = mockProviderPreferences.get(p.providerId) ?? __internalGetMockCredentialStore().get(p.providerId);
      const health = healthMap.get(p.providerId);
      const pModels = allModels.filter((m: ModelDescriptorDto) => m.providerId === p.providerId);

      return {
        providerId: p.providerId,
        displayName: p.displayName,
        description: p.description,
        defaultBaseUrl: p.defaultBaseUrl,
        documentationUrl: p.documentationUrl ?? null,
        configuredBaseUrl: pref?.baseUrl ?? null,
        isConfigured: pref?.isConfigured ?? false,
        isActive: pref?.isActive ?? (p.lifecycleState === "active"),
        priorityWeight: pref?.priorityWeight ?? 5,
        monthlyBudgetLimit: pref?.monthlyBudgetLimit ?? null,
        currentMonthSpend: pref?.currentMonthSpend ?? 0.0,
        healthState: health?.state ?? "unknown",
        healthCheckedAtMs: health?.lastObservedAtMs ?? null,
        modelCount: pModels.length,
        defaultModelId: p.defaultModelId ?? (pModels[0]?.modelId ?? ""),
        capabilities: p.capabilities.capabilities,
      };
    });

    const modelSummaries: ModelSettingsSummaryDto[] = allModels.map((m: ModelDescriptorDto) => ({
      providerId: m.providerId,
      modelId: m.modelId,
      displayName: m.displayName,
      isActive: m.availability === "Available",
      contextWindow: m.contextWindow,
      maxOutputTokens: m.maxOutputTokens ?? 4096,
      isDefault: m.isDefault,
      capabilities: m.capabilities.capabilities,
    }));

    const securityStatus: SecurityStatusSummaryDto = {
      dpapiProtectionActive: true,
      localStorageType: "Protected SQLite + Windows DPAPI",
      plaintextKeysProhibited: true,
      remoteSyncDisabled: true,
      lastAuditTimeMs: null,
    };

    return {
      appSettings,
      providers: providerSummaries,
      models: modelSummaries,
      routingPolicy: structuredClone(DEFAULT_ROUTING_POLICY_CONFIG),
      securityStatus,
    };
  }

  return safeInvoke<SettingsWorkspaceSnapshotDto>(IPC_COMMANDS.GET_SETTINGS_WORKSPACE_SNAPSHOT);
}

// --- Provider Preferences API ---

/**
 * Retrieves safe non-secret configuration preferences for a specific provider.
 */
export async function getProviderPreferences(providerId: string): Promise<ProviderCredentialStatus | null> {
  const validatedId = validateProviderId(providerId);

  if (!isTauriContext()) {
    return mockProviderPreferences.get(validatedId) ?? __internalGetMockCredentialStore().get(validatedId) ?? null;
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
    const merged = new Map<string, ProviderCredentialStatus>();
    for (const [id, s] of __internalGetMockCredentialStore()) {
      merged.set(id, s);
    }
    for (const [id, s] of mockProviderPreferences) {
      merged.set(id, s);
    }
    return Array.from(merged.values()).sort(
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
    const existing = mockProviderPreferences.get(validatedId) ?? __internalGetMockCredentialStore().get(validatedId);
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
    __internalGetMockCredentialStore().set(validatedId, updated);
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
    const existing = mockProviderPreferences.get(validatedId) ?? __internalGetMockCredentialStore().get(validatedId);
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
    __internalGetMockCredentialStore().set(validatedId, reset);
    return reset;
  }

  return safeInvoke<ProviderCredentialStatus>(IPC_COMMANDS.RESET_PROVIDER_PREFERENCES, {
    providerId: validatedId,
  });
}
