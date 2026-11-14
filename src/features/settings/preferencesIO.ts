/**
 * Nano Route — User Preferences Import & Export Engine
 * File: src/features/settings/preferencesIO.ts
 *
 * Implements Step 66 safe, non-sensitive JSON preference serialization,
 * schema validation, integrity checks, and zero-leakage security boundaries.
 * Plaintext secrets or credentials are strictly excluded and rejected.
 */

import {
  type AppSettingsSnapshot,
  type AppSettingKeyString,
  setAppSetting,
  validateSetting,
  SECTION_SETTING_KEYS,
} from "../../services/ipc/index.ts";

export const PREFERENCES_SCHEMA_FORMAT = "nano-route-preferences-v1";
export const PREFERENCES_SCHEMA_VERSION = "1.0.0";

export interface ExportedPreferencesFile {
  format: string;
  version: string;
  exportedAt: number;
  appName: string;
  preferences: Record<string, string>;
}

export interface ImportPreferencesResult {
  success: boolean;
  appliedCount: number;
  errors: string[];
}

/**
 * Whitelist of safe, user-configurable preference keys that may be exported or imported.
 * API credentials, tokens, paths, session info, and database internal keys are strictly excluded.
 */
export const EXPORTABLE_PREFERENCE_KEYS: readonly AppSettingKeyString[] = Object.freeze(
  Object.values(SECTION_SETTING_KEYS).flat()
);

/**
 * Serializes current user preferences to a clean, non-sensitive JSON string.
 */
export function exportPreferencesToJson(snapshot: AppSettingsSnapshot): string {
  const preferences: Record<string, string> = {
    // Appearance
    "appearance.theme_mode": snapshot.themeMode ?? "dark",
    "appearance.density": snapshot.density ?? "comfortable",
    "appearance.reduced_motion": snapshot.reducedMotion ?? "system",
    "appearance.text_scale": snapshot.textScale ?? "100%",
    "appearance.enhanced_focus": String(snapshot.enhancedFocus ?? false),

    // Workspace & Startup
    "workspace.startup_route": snapshot.startupRoute ?? "overview",
    "workspace.sidebar_collapsed": String(snapshot.sidebarCollapsed ?? false),
    "workspace.confirm_chat_clear": String(snapshot.confirmChatClear ?? true),

    // Chat
    "chat.show_timestamps": String(snapshot.chatShowTimestamps ?? false),
    "chat.compact_spacing": String(snapshot.chatCompactSpacing ?? false),
    "chat.enter_to_send": String(snapshot.chatEnterToSend ?? true),
    "chat.auto_scroll_to_bottom": String(snapshot.chatAutoScroll ?? true),

    // Notifications
    "notifications.enable_non_critical_toasts": String(snapshot.notificationEnableNonCriticalToasts ?? true),
    "notifications.toast_duration_ms": String(snapshot.notificationToastDurationMs ?? 5000),

    // Command Palette
    "palette.show_descriptions": String(snapshot.paletteShowDescriptions ?? true),
    "palette.show_shortcuts": String(snapshot.paletteShowShortcuts ?? true),

    // General
    "routing.preference_mode": snapshot.routingPreferenceMode ?? "balanced",
    "telemetry.enabled": String(snapshot.telemetryEnabled ?? true),
    "window.start_maximized": String(snapshot.windowStartMaximized ?? false),
  };

  const payload: ExportedPreferencesFile = {
    format: PREFERENCES_SCHEMA_FORMAT,
    version: PREFERENCES_SCHEMA_VERSION,
    exportedAt: Date.now(),
    appName: "Nano Route",
    preferences,
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Validates and imports user preferences from a JSON string.
 * Strictly verifies schema, key whitelisting, and value domain validation before applying.
 */
export async function importPreferencesFromJson(jsonString: string): Promise<ImportPreferencesResult> {
  const errors: string[] = [];

  if (!jsonString || typeof jsonString !== "string" || jsonString.trim().length === 0) {
    return { success: false, appliedCount: 0, errors: ["Empty preference file provided."] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err: unknown) {
    return {
      success: false,
      appliedCount: 0,
      errors: [`Invalid JSON format: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { success: false, appliedCount: 0, errors: ["Root JSON payload must be an object."] };
  }

  const file = parsed as Partial<ExportedPreferencesFile>;

  if (file.format !== PREFERENCES_SCHEMA_FORMAT) {
    return {
      success: false,
      appliedCount: 0,
      errors: [`Unsupported format '${String(file.format)}'. Expected '${PREFERENCES_SCHEMA_FORMAT}'`],
    };
  }

  if (!file.preferences || typeof file.preferences !== "object" || Array.isArray(file.preferences)) {
    return {
      success: false,
      appliedCount: 0,
      errors: ["Missing or malformed 'preferences' dictionary in configuration file."],
    };
  }

  const entriesToApply: Array<{ key: AppSettingKeyString; value: string }> = [];

  // Validate each entry before modifying application state
  for (const [rawKey, rawValue] of Object.entries(file.preferences)) {
    const key = rawKey as AppSettingKeyString;

    // Security check: reject non-whitelisted keys
    if (!EXPORTABLE_PREFERENCE_KEYS.includes(key)) {
      errors.push(`Ignored unsupported or restricted key '${rawKey}'.`);
      continue;
    }

    // Security check: reject non-string values or suspicious executable strings
    if (typeof rawValue !== "string") {
      errors.push(`Key '${rawKey}' has invalid non-string value.`);
      continue;
    }

    try {
      const validated = validateSetting(key, rawValue);
      entriesToApply.push({ key, value: validated });
    } catch (valErr: unknown) {
      errors.push(`Validation failed for '${rawKey}': ${valErr instanceof Error ? valErr.message : String(valErr)}`);
    }
  }

  // Atomically apply validated settings
  let appliedCount = 0;
  for (const entry of entriesToApply) {
    try {
      await setAppSetting(entry.key, entry.value);
      appliedCount++;
    } catch (applyErr: unknown) {
      errors.push(`Failed to persist '${entry.key}': ${applyErr instanceof Error ? applyErr.message : String(applyErr)}`);
    }
  }

  return {
    success: appliedCount > 0,
    appliedCount,
    errors,
  };
}

