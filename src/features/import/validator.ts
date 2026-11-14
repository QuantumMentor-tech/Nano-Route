/**
 * Nano Route — User Data Import Validator & Conflict Detector
 * File: src/features/import/validator.ts
 *
 * Implements Step 71 untrusted payload parsing, manifest validation,
 * schema allowlist verification, secret-leak interception, and conflict detection.
 */

import {
  type ImportCategory,
  type ImportPreview,
  type ImportValidationStatus,
  type CategoryConflictSummary,
  type CategoryImportPlan,
  EXPORT_PACKAGE_FORMAT,
  EXPORT_SCHEMA_VERSION,
  MAX_IMPORT_PAYLOAD_BYTES,
} from "./types.ts";
import type { ExportPackage } from "../export/types.ts";
import { FORBIDDEN_SECRET_KEYS } from "../export/catalog.ts";
import { listChatSessions } from "../../services/ipc/chat.ts";
import { getAppSettings } from "../../services/ipc/settings.ts";
import { listTelemetryRecords } from "../../services/ipc/telemetry.ts";
import { BUILTIN_PROFILES } from "../profiles/presets.ts";
import type { WorkspaceProfile } from "../profiles/types.ts";
import { EXPORTABLE_PREFERENCE_KEYS } from "../settings/preferencesIO.ts";

/**
 * Scans an untrusted JSON object recursively for forbidden keys or values.
 * Returns count of sensitive keys stripped/detected.
 */
export function sanitizeUntrustedObject(obj: unknown): {
  cleaned: unknown;
  forbiddenKeysFound: string[];
} {
  const forbiddenFound: string[] = [];

  function walk(node: unknown): unknown {
    if (node === null || typeof node !== "object") {
      // Check for raw string bearer token or api key patterns
      if (typeof node === "string") {
        if (/sk-[a-zA-Z0-9]{20,}/.test(node)) {
          forbiddenFound.push("sk-token-pattern");
          return "[REDACTED_API_KEY]";
        }
      }
      return node;
    }

    if (Array.isArray(node)) {
      return node.map((item) => walk(item));
    }

    const cleanedObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      const isForbidden = FORBIDDEN_SECRET_KEYS.some((forbidden) =>
        lowerKey.includes(forbidden.toLowerCase())
      );

      if (isForbidden) {
        forbiddenFound.push(key);
        // Do not copy forbidden secret keys to output
        continue;
      }

      cleanedObj[key] = walk(value);
    }
    return cleanedObj;
  }

  const cleaned = walk(obj);
  return { cleaned, forbiddenKeysFound: forbiddenFound };
}

/**
 * Validates and analyzes an untrusted import JSON payload.
 * Strictly verifies schema, format, manifest, categories, and potential conflicts.
 */
export async function validateImportPayload(
  rawJson: string
): Promise<{ preview: ImportPreview; sanitizedPackage?: ExportPackage }> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const defaultConflictSummary = (cat: ImportCategory): CategoryConflictSummary => ({
    category: cat,
    totalRecordsInPackage: 0,
    conflictingCount: 0,
    identicalCount: 0,
    newCount: 0,
    conflictDetails: [],
  });

  const defaultPlan = (cat: ImportCategory): CategoryImportPlan => ({
    category: cat,
    selected: true,
    totalInPackage: 0,
    toImportCount: 0,
    toSkipCount: 0,
    conflictsCount: 0,
    strategy: "SKIP_DUPLICATES",
  });

  const conflicts: Record<ImportCategory, CategoryConflictSummary> = {
    chat_history: defaultConflictSummary("chat_history"),
    user_preferences: defaultConflictSummary("user_preferences"),
    workspace_profiles: defaultConflictSummary("workspace_profiles"),
    telemetry_and_analytics: defaultConflictSummary("telemetry_and_analytics"),
  };

  const plans: Record<ImportCategory, CategoryImportPlan> = {
    chat_history: defaultPlan("chat_history"),
    user_preferences: defaultPlan("user_preferences"),
    workspace_profiles: defaultPlan("workspace_profiles"),
    telemetry_and_analytics: defaultPlan("telemetry_and_analytics"),
  };

  // 1. File Size Verification
  if (!rawJson || typeof rawJson !== "string") {
    errors.push("Provided payload is empty or invalid string.");
    return {
      preview: {
        isValid: false,
        validationStatus: "MALFORMED",
        format: "unknown",
        sourceApp: "unknown",
        sourceAppVersion: "unknown",
        availableCategories: [],
        plans,
        conflicts,
        preflightErrors: errors,
        preflightWarnings: warnings,
        payloadSizeBytes: 0,
        secretsDetectedCount: 0,
        strippedSecretsCount: 0,
      },
    };
  }

  const payloadSizeBytes = new TextEncoder().encode(rawJson).length;
  if (payloadSizeBytes > MAX_IMPORT_PAYLOAD_BYTES) {
    errors.push(
      `Payload size (${(payloadSizeBytes / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of ${MAX_IMPORT_PAYLOAD_BYTES / (1024 * 1024)} MB.`
    );
    return {
      preview: {
        isValid: false,
        validationStatus: "MALFORMED",
        format: "unknown",
        sourceApp: "unknown",
        sourceAppVersion: "unknown",
        availableCategories: [],
        plans,
        conflicts,
        preflightErrors: errors,
        preflightWarnings: warnings,
        payloadSizeBytes,
        secretsDetectedCount: 0,
        strippedSecretsCount: 0,
      },
    };
  }

  // 2. JSON Parsing
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err: unknown) {
    errors.push(`JSON syntax error: ${err instanceof Error ? err.message : String(err)}`);
    return {
      preview: {
        isValid: false,
        validationStatus: "MALFORMED",
        format: "unknown",
        sourceApp: "unknown",
        sourceAppVersion: "unknown",
        availableCategories: [],
        plans,
        conflicts,
        preflightErrors: errors,
        preflightWarnings: warnings,
        payloadSizeBytes,
        secretsDetectedCount: 0,
        strippedSecretsCount: 0,
      },
    };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    errors.push("Root JSON element must be a JSON object.");
    return {
      preview: {
        isValid: false,
        validationStatus: "MALFORMED",
        format: "unknown",
        sourceApp: "unknown",
        sourceAppVersion: "unknown",
        availableCategories: [],
        plans,
        conflicts,
        preflightErrors: errors,
        preflightWarnings: warnings,
        payloadSizeBytes,
        secretsDetectedCount: 0,
        strippedSecretsCount: 0,
      },
    };
  }

  // 3. Scan & Strip Secrets at Boundary
  const { cleaned, forbiddenKeysFound } = sanitizeUntrustedObject(parsed);
  const pkg = cleaned as Partial<ExportPackage>;

  if (forbiddenKeysFound.length > 0) {
    warnings.push(
      `Package contained ${forbiddenKeysFound.length} forbidden credential/secret key(s) [${forbiddenKeysFound.slice(0, 3).join(", ")}${forbiddenKeysFound.length > 3 ? "..." : ""}]. They were permanently stripped and will not be imported.`
    );
  }

  // 4. Manifest & Schema Verification
  const manifest = pkg.manifest;
  if (!manifest) {
    errors.push("Missing required 'manifest' envelope in export package.");
    return {
      preview: {
        isValid: false,
        validationStatus: "MALFORMED",
        format: "unknown",
        sourceApp: "unknown",
        sourceAppVersion: "unknown",
        availableCategories: [],
        plans,
        conflicts,
        preflightErrors: errors,
        preflightWarnings: warnings,
        payloadSizeBytes,
        secretsDetectedCount: forbiddenKeysFound.length,
        strippedSecretsCount: forbiddenKeysFound.length,
      },
    };
  }

  if (manifest.format !== EXPORT_PACKAGE_FORMAT) {
    errors.push(
      `Incompatible package format '${String(manifest.format)}'. Expected '${EXPORT_PACKAGE_FORMAT}'.`
    );
  }

  if (manifest.application && manifest.application !== "Nano Route") {
    warnings.push(
      `Package originated from '${manifest.application}', expected 'Nano Route'. Data will be validated with caution.`
    );
  }

  if (typeof manifest.exportSchemaVersion === "number") {
    if (manifest.exportSchemaVersion > EXPORT_SCHEMA_VERSION) {
      errors.push(
        `Package schema version (${manifest.exportSchemaVersion}) is newer than supported version (${EXPORT_SCHEMA_VERSION}). Please update Nano Route.`
      );
    }
  }

  const availableCategories: ImportCategory[] = [];

  // 5. Category Analysis & Conflict Detection
  // (a) Chat History
  if (pkg.chat && (Array.isArray(pkg.chat.sessions) || Array.isArray(pkg.chat.messages))) {
    availableCategories.push("chat_history");
    const sessions = pkg.chat.sessions || [];
    const messages = pkg.chat.messages || [];

    const existingSessions = await listChatSessions({ limit: 1000 });
    const existingSessionMap = new Map(existingSessions.map((s) => [s.id, s]));

    let confCount = 0;
    let identCount = 0;
    let newCount = 0;
    const details: string[] = [];

    for (const s of sessions) {
      if (!s.id || typeof s.title !== "string") {
        warnings.push(`Chat session has missing or invalid fields, skipping item.`);
        continue;
      }
      const existing = existingSessionMap.get(s.id);
      if (existing) {
        if (existing.title === s.title) {
          identCount++;
        } else {
          confCount++;
          details.push(`Session ID '${s.id}' exists with title "${existing.title}" vs imported "${s.title}".`);
        }
      } else {
        newCount++;
      }
    }

    conflicts.chat_history = {
      category: "chat_history",
      totalRecordsInPackage: sessions.length + messages.length,
      conflictingCount: confCount,
      identicalCount: identCount,
      newCount,
      conflictDetails: details.slice(0, 5),
    };

    plans.chat_history = {
      category: "chat_history",
      selected: true,
      totalInPackage: sessions.length + messages.length,
      toImportCount: newCount + confCount,
      toSkipCount: identCount,
      conflictsCount: confCount,
      strategy: "SKIP_DUPLICATES",
      requiresReindex: true,
    };
  }

  // (b) User Preferences
  if (pkg.preferences && typeof pkg.preferences === "object") {
    availableCategories.push("user_preferences");
    const prefEntries = Object.entries(pkg.preferences);
    const existingSnapshot = await getAppSettings();
    const existingMap = new Map<string, string>();

    // Map existing settings to string representation
    if (existingSnapshot.themeMode) existingMap.set("appearance.theme_mode", existingSnapshot.themeMode);
    if (existingSnapshot.density) existingMap.set("appearance.density", existingSnapshot.density);
    if (existingSnapshot.startupRoute) existingMap.set("workspace.startup_route", existingSnapshot.startupRoute);
    if (existingSnapshot.sidebarCollapsed !== undefined) existingMap.set("workspace.sidebar_collapsed", String(existingSnapshot.sidebarCollapsed));

    let confCount = 0;
    let identCount = 0;
    let newCount = 0;
    const details: string[] = [];

    for (const [key, val] of prefEntries) {
      if (!EXPORTABLE_PREFERENCE_KEYS.includes(key as any)) {
        continue; // Will be skipped during import
      }
      const existingVal = existingMap.get(key);
      if (existingVal !== undefined) {
        if (existingVal === String(val)) {
          identCount++;
        } else {
          confCount++;
          details.push(`Setting '${key}': current="${existingVal}", imported="${val}".`);
        }
      } else {
        newCount++;
      }
    }

    conflicts.user_preferences = {
      category: "user_preferences",
      totalRecordsInPackage: prefEntries.length,
      conflictingCount: confCount,
      identicalCount: identCount,
      newCount,
      conflictDetails: details.slice(0, 5),
    };

    plans.user_preferences = {
      category: "user_preferences",
      selected: true,
      totalInPackage: prefEntries.length,
      toImportCount: newCount + confCount,
      toSkipCount: identCount,
      conflictsCount: confCount,
      strategy: "KEEP_EXISTING",
    };
  }

  // (c) Workspace Profiles
  if (Array.isArray(pkg.profiles) && pkg.profiles.length > 0) {
    availableCategories.push("workspace_profiles");
    const existingSnapshot = await getAppSettings();
    let customProfiles: WorkspaceProfile[] = [];
    try {
      if (existingSnapshot.customProfilesJson) {
        customProfiles = JSON.parse(existingSnapshot.customProfilesJson);
      }
    } catch {
      customProfiles = [];
    }

    const allProfiles = [...BUILTIN_PROFILES, ...customProfiles];
    const existingMap = new Map(allProfiles.map((p) => [p.id, p]));
    const existingNameMap = new Map(allProfiles.map((p) => [p.name.toLowerCase(), p]));

    let confCount = 0;
    let identCount = 0;
    let newCount = 0;
    const details: string[] = [];

    for (const prof of pkg.profiles) {
      const byId = existingMap.get(prof.id);
      const byName = existingNameMap.get((prof.name || "").toLowerCase());
      if (byId || byName) {
        confCount++;
        details.push(`Profile "${prof.name}" (${prof.id}) matches existing profile.`);
      } else {
        newCount++;
      }
    }

    conflicts.workspace_profiles = {
      category: "workspace_profiles",
      totalRecordsInPackage: pkg.profiles.length,
      conflictingCount: confCount,
      identicalCount: identCount,
      newCount,
      conflictDetails: details.slice(0, 5),
    };

    plans.workspace_profiles = {
      category: "workspace_profiles",
      selected: true,
      totalInPackage: pkg.profiles.length,
      toImportCount: newCount + confCount,
      toSkipCount: 0,
      conflictsCount: confCount,
      strategy: "IMPORT_AS_NEW",
    };
  }

  // (d) Telemetry & Analytics
  if (Array.isArray(pkg.telemetry) && pkg.telemetry.length > 0) {
    availableCategories.push("telemetry_and_analytics");
    const existingTelemetry = await listTelemetryRecords();
    const existingIds = new Set(existingTelemetry.map((t) => t.id));

    let confCount = 0;
    let newCount = 0;

    for (const item of pkg.telemetry) {
      if (existingIds.has(item.id)) {
        confCount++;
      } else {
        newCount++;
      }
    }

    conflicts.telemetry_and_analytics = {
      category: "telemetry_and_analytics",
      totalRecordsInPackage: pkg.telemetry.length,
      conflictingCount: confCount,
      identicalCount: confCount,
      newCount,
      conflictDetails: confCount > 0 ? [`${confCount} telemetry record(s) already exist by ID.`] : [],
    };

    plans.telemetry_and_analytics = {
      category: "telemetry_and_analytics",
      selected: false, // Default unselected for analytics to preserve local device metrics
      totalInPackage: pkg.telemetry.length,
      toImportCount: newCount,
      toSkipCount: confCount,
      conflictsCount: confCount,
      strategy: "SKIP_DUPLICATES",
    };
  }

  if (availableCategories.length === 0 && errors.length === 0) {
    warnings.push("Package contains no importable data categories.");
  }

  let validationStatus: ImportValidationStatus = "VALID";
  if (errors.length > 0) {
    validationStatus = "INCOMPATIBLE";
  } else if (warnings.length > 0) {
    validationStatus = "COMPATIBLE_WITH_WARNINGS";
  }

  const preview: ImportPreview = {
    isValid: errors.length === 0,
    validationStatus,
    format: manifest.format || "unknown",
    sourceApp: manifest.application || "unknown",
    sourceAppVersion: manifest.appVersion || "unknown",
    exportedAtIso: manifest.exportedAtIso,
    sourceManifest: manifest as any,
    availableCategories,
    plans,
    conflicts,
    preflightErrors: errors,
    preflightWarnings: warnings,
    payloadSizeBytes,
    secretsDetectedCount: forbiddenKeysFound.length,
    strippedSecretsCount: forbiddenKeysFound.length,
  };

  return {
    preview,
    sanitizedPackage: errors.length === 0 ? (pkg as ExportPackage) : undefined,
  };
}
