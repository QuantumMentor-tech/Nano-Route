/**
 * Nano Route — Workspace Profile Engine & Validation
 * File: src/features/profiles/engine.ts
 *
 * Implements Step 67 profile validation, diff calculation, sanitization,
 * allowlisted export, and untrusted import verification.
 * Strictly guarantees zero secret leakage.
 */

import {
  type WorkspaceProfile,
  type ProfileValidationResult,
  type ProfileSettingDiff,
  type ProfileExportFile,
  PROFILE_SCHEMA_FORMAT,
  PROFILE_SCHEMA_VERSION,
  MAX_PROFILE_NAME_LENGTH,
  MAX_PROFILE_DESC_LENGTH,
  MAX_PROFILE_PAYLOAD_BYTES,
} from "./types.ts";
import {
  type AppSettingsSnapshot,
  type AppSettingKeyString,
  validateSetting,
} from "../../services/ipc/index.ts";
import { EXPORTABLE_PREFERENCE_KEYS } from "../settings/preferencesIO.ts";

export const SETTING_LABELS: Record<string, string> = {
  "appearance.theme_mode": "Theme Mode",
  "appearance.density": "Interface Density",
  "appearance.reduced_motion": "Animation & Motion",
  "appearance.text_scale": "Text Scale",
  "appearance.enhanced_focus": "Enhanced Focus Ring",
  "workspace.startup_route": "Initial Startup Route",
  "workspace.sidebar_collapsed": "Sidebar Default State",
  "workspace.confirm_chat_clear": "Confirm Clear Chat",
  "chat.show_timestamps": "Show Timestamps",
  "chat.compact_spacing": "Compact Message Spacing",
  "chat.enter_to_send": "Enter to Send Shortcut",
  "chat.auto_scroll_to_bottom": "Auto-scroll Output",
  "notifications.enable_non_critical_toasts": "Non-Critical Toasts",
  "notifications.toast_duration_ms": "Toast Duration (ms)",
  "palette.show_descriptions": "Palette Descriptions",
  "palette.show_shortcuts": "Palette Shortcuts",
  "routing.preference_mode": "Routing Preference Profile",
  "telemetry.enabled": "Local Telemetry",
  "window.start_maximized": "Start Maximized",
};

/**
 * Sanitizes a user-specified profile name.
 */
export function sanitizeProfileName(name: string): string {
  if (!name || typeof name !== "string") return "";
  const sanitized = name
    .replace(/[<>]/g, "")
    .replace(/[\x00-\x1F\x7F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_PROFILE_NAME_LENGTH);
  return sanitized;
}

/**
 * Sanitizes an optional profile description.
 */
export function sanitizeProfileDescription(desc?: string): string {
  if (!desc || typeof desc !== "string") return "";
  return desc
    .replace(/[<>]/g, "")
    .replace(/[\x00-\x1F\x7F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_PROFILE_DESC_LENGTH);
}

/**
 * Validates a profile object against the Step 66 preference catalog.
 */
export function validateProfile(profile: unknown): ProfileValidationResult {
  const result: ProfileValidationResult = {
    isValid: true,
    schemaVersion: 1,
    supportedKeysCount: 0,
    unsupportedKeys: [],
    invalidValues: [],
    errors: [],
  };

  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    result.isValid = false;
    result.errors.push("Profile payload must be a JSON object.");
    return result;
  }

  const p = profile as Partial<WorkspaceProfile>;

  const cleanName = sanitizeProfileName(p.name ?? "");
  if (!cleanName || cleanName.length < 2) {
    result.isValid = false;
    result.errors.push("Profile name must be between 2 and 40 characters.");
  }

  if (p.schemaVersion !== undefined && typeof p.schemaVersion === "number") {
    result.schemaVersion = p.schemaVersion;
    if (p.schemaVersion > PROFILE_SCHEMA_VERSION) {
      result.errors.push(`Profile schema version ${p.schemaVersion} is newer than current supported version ${PROFILE_SCHEMA_VERSION}.`);
    }
  }

  if (!p.preferences || typeof p.preferences !== "object" || Array.isArray(p.preferences)) {
    result.isValid = false;
    result.errors.push("Missing or malformed 'preferences' dictionary.");
    return result;
  }

  for (const [rawKey, rawVal] of Object.entries(p.preferences)) {
    const key = rawKey as AppSettingKeyString;

    // Allowlist check
    if (!EXPORTABLE_PREFERENCE_KEYS.includes(key)) {
      result.unsupportedKeys.push(rawKey);
      continue;
    }

    if (typeof rawVal !== "string") {
      result.isValid = false;
      result.invalidValues.push({ key: rawKey, error: "Value must be a string." });
      continue;
    }

    try {
      validateSetting(key, rawVal);
      result.supportedKeysCount++;
    } catch (valErr: unknown) {
      result.isValid = false;
      result.invalidValues.push({
        key: rawKey,
        error: valErr instanceof Error ? valErr.message : String(valErr),
      });
    }
  }

  if (result.invalidValues.length > 0 || result.errors.length > 0) {
    result.isValid = false;
  }

  return result;
}

/**
 * Computes user-facing diff between current active settings and a target profile.
 */
export function computeProfileDiff(
  currentSettings: AppSettingsSnapshot,
  targetProfile: WorkspaceProfile
): ProfileSettingDiff[] {
  const currentMap: Record<string, string> = {
    "appearance.theme_mode": currentSettings.themeMode ?? "dark",
    "appearance.density": currentSettings.density ?? "comfortable",
    "appearance.reduced_motion": currentSettings.reducedMotion ?? "system",
    "appearance.text_scale": currentSettings.textScale ?? "100%",
    "appearance.enhanced_focus": String(currentSettings.enhancedFocus ?? false),
    "workspace.startup_route": currentSettings.startupRoute ?? "overview",
    "workspace.sidebar_collapsed": String(currentSettings.sidebarCollapsed ?? false),
    "workspace.confirm_chat_clear": String(currentSettings.confirmChatClear ?? true),
    "chat.show_timestamps": String(currentSettings.chatShowTimestamps ?? false),
    "chat.compact_spacing": String(currentSettings.chatCompactSpacing ?? false),
    "chat.enter_to_send": String(currentSettings.chatEnterToSend ?? true),
    "chat.auto_scroll_to_bottom": String(currentSettings.chatAutoScroll ?? true),
    "notifications.enable_non_critical_toasts": String(currentSettings.notificationEnableNonCriticalToasts ?? true),
    "notifications.toast_duration_ms": String(currentSettings.notificationToastDurationMs ?? 5000),
    "palette.show_descriptions": String(currentSettings.paletteShowDescriptions ?? true),
    "palette.show_shortcuts": String(currentSettings.paletteShowShortcuts ?? true),
  };

  const diffs: ProfileSettingDiff[] = [];

  for (const [key, targetVal] of Object.entries(targetProfile.preferences)) {
    const currentVal = currentMap[key] ?? "";
    const willChange = currentVal !== targetVal;
    diffs.push({
      key,
      label: SETTING_LABELS[key] ?? key,
      currentValue: currentVal,
      targetValue: targetVal,
      willChange,
    });
  }

  return diffs;
}

/**
 * Serializes a WorkspaceProfile into a clean, non-sensitive JSON export file.
 * Strictly uses an allowlist; credentials, tokens, and history are NEVER included.
 */
export function exportProfileToJson(profile: WorkspaceProfile): string {
  const allowlistedPrefs: Record<string, string> = {};

  for (const key of EXPORTABLE_PREFERENCE_KEYS) {
    if (profile.preferences[key] !== undefined) {
      allowlistedPrefs[key] = profile.preferences[key];
    }
  }

  const exportPayload: ProfileExportFile = {
    format: PROFILE_SCHEMA_FORMAT,
    schemaVersion: PROFILE_SCHEMA_VERSION,
    exportedAt: Date.now(),
    appName: "Nano Route",
    profile: {
      id: profile.id,
      name: sanitizeProfileName(profile.name),
      description: sanitizeProfileDescription(profile.description),
      preferences: allowlistedPrefs,
    },
  };

  return JSON.stringify(exportPayload, null, 2);
}

/**
 * Parses and verifies an imported JSON profile string.
 * Strictly treats the file as untrusted input.
 */
export function parseAndValidateImport(jsonString: string): {
  profile: WorkspaceProfile;
  validation: ProfileValidationResult;
} {
  if (!jsonString || typeof jsonString !== "string" || jsonString.trim().length === 0) {
    throw new Error("Empty profile file provided.");
  }

  if (jsonString.length > MAX_PROFILE_PAYLOAD_BYTES) {
    throw new Error(`Profile file exceeds maximum allowed size limit of ${MAX_PROFILE_PAYLOAD_BYTES} bytes.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err: unknown) {
    throw new Error(`Invalid JSON syntax: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Root JSON payload must be an object.");
  }

  const file = parsed as Partial<ProfileExportFile>;

  if (file.format !== PROFILE_SCHEMA_FORMAT) {
    throw new Error(`Missing 'nano-route-workspace-profile-v1' or unsupported format '${String(file.format)}'.`);
  }

  if (file.schemaVersion !== undefined && typeof file.schemaVersion === "number" && file.schemaVersion > PROFILE_SCHEMA_VERSION) {
    throw new Error(`Unsupported profile schema version ${file.schemaVersion}. Current supported version is ${PROFILE_SCHEMA_VERSION}.`);
  }

  if (!file.profile || typeof file.profile !== "object" || Array.isArray(file.profile)) {
    throw new Error("Missing or malformed 'profile' object in file.");
  }

  const rawProfile = file.profile as Partial<WorkspaceProfile>;
  const cleanName = sanitizeProfileName(rawProfile.name ?? "Imported Profile");
  const cleanDesc = sanitizeProfileDescription(rawProfile.description);

  const validation = validateProfile({
    name: cleanName,
    description: cleanDesc,
    schemaVersion: file.schemaVersion ?? PROFILE_SCHEMA_VERSION,
    preferences: rawProfile.preferences ?? {},
  });

  if (!validation.isValid) {
    const errorDetails = [
      ...validation.errors,
      ...validation.invalidValues.map((v) => `${v.key}: ${v.error}`),
    ].join("; ");
    throw new Error(`Profile validation failed: contains invalid setting values (${errorDetails})`);
  }

  // Construct valid profile containing ONLY allowlisted preferences
  const sanitizedPreferences: Record<string, string> = {};
  for (const [key, val] of Object.entries(rawProfile.preferences ?? {})) {
    if (EXPORTABLE_PREFERENCE_KEYS.includes(key as any) && typeof val === "string") {
      sanitizedPreferences[key] = val;
    }
  }

  const validProfile: WorkspaceProfile = {
    id: `prof_custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: cleanName,
    description: cleanDesc,
    isBuiltin: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    schemaVersion: PROFILE_SCHEMA_VERSION,
    preferences: sanitizedPreferences,
  };

  return {
    profile: validProfile,
    validation,
  };
}

