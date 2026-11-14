/**
 * Nano Route — User Data Export Execution Engine
 * File: src/features/export/engine.ts
 *
 * Implements Step 70 read-only data extraction, multi-format serialization,
 * strict allowlist enforcement, secret leak scanning, and integrity validation.
 */

import {
  type ExportExecutionRequest,
  type ExportExecutionResult,
  type ExportManifest,
  type ExportPackage,
  EXPORT_PACKAGE_FORMAT,
  EXPORT_SCHEMA_VERSION,
} from "./types.ts";
import {
  EXPORT_CATEGORIES_CATALOG,
  FORBIDDEN_SECRET_KEYS,
} from "./catalog.ts";
import { formatRecordsToCsv } from "./csvSanitizer.ts";
import {
  listChatSessions,
  getChatMessages,
} from "../../services/ipc/chat.ts";
import {
  getAppSettings,
} from "../../services/ipc/settings.ts";
import {
  listRegisteredProviders,
} from "../../services/ipc/registry.ts";
import {
  listProviderCredentialStatuses,
} from "../../services/ipc/credentials.ts";
import {
  listTelemetryRecords,
} from "../../services/ipc/telemetry.ts";

/**
 * Computes a lightweight checksum string from package data.
 */
function computeChecksum(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `chk_${Math.abs(hash).toString(16).padStart(8, "0")}_${content.length}`;
}

/**
 * Scans a serialized payload for forbidden secret key names or leaked credential tokens.
 */
export function scanForSecretLeaks(payload: string): { hasLeak: boolean; matchedKeys: string[] } {
  const lower = payload.toLowerCase();
  const matchedKeys: string[] = [];

  for (const forbidden of FORBIDDEN_SECRET_KEYS) {
    // Look for JSON keys matching forbidden keywords: e.g. "api_key": or "secret":
    const keyPattern = new RegExp(`"${forbidden}"\\s*:`, "i");
    if (keyPattern.test(lower)) {
      matchedKeys.push(forbidden);
    }
  }

  // Also check for raw bearer tokens or sk- pattern
  if (/"sk-[a-zA-Z0-9]{20,}"/.test(payload)) {
    matchedKeys.push("openai_api_key_pattern");
  }

  return {
    hasLeak: matchedKeys.length > 0,
    matchedKeys,
  };
}

/**
 * Executes a controlled, read-only data export operation according to user-selected categories.
 */
export async function executeDataExport(
  request: ExportExecutionRequest
): Promise<ExportExecutionResult> {
  const startedAtMs = Date.now();
  const warnings: string[] = [];
  const selectedCategories = new Set(request.categories);

  const packageData: ExportPackage = {
    manifest: null as any,
  };

  const recordCounts = {
    sessionsCount: 0,
    messagesCount: 0,
    telemetryCount: 0,
    preferencesCount: 0,
    profilesCount: 0,
    providersCount: 0,
  };

  // 1. Collect Chat History & Messages
  if (selectedCategories.has("chat_history")) {
    const sessions = await listChatSessions({ limit: 1000 });
    const exportedSessions: Array<{
      id: string;
      title: string;
      createdAt: number;
      updatedAt: number;
      pinned: boolean;
    }> = [];
    const exportedMessages: Array<{
      id: string;
      sessionId: string;
      sender: string;
      content: string;
      createdAt: number;
      provider?: string;
      model?: string;
      tokens?: number;
      latencyMs?: number;
    }> = [];

    for (const session of sessions) {
      exportedSessions.push({
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        pinned: session.pinned,
      });

      try {
        const msgs = await getChatMessages({ sessionId: session.id, limit: 1000 });
        for (const m of msgs) {
          const totalTokens = (m.metadata?.promptTokens ?? 0) + (m.metadata?.completionTokens ?? 0);
          exportedMessages.push({
            id: m.id,
            sessionId: m.sessionId,
            sender: m.sender,
            content: m.content,
            createdAt: m.createdAt,
            provider: m.metadata?.routedProvider ?? undefined,
            model: m.metadata?.routedModel ?? undefined,
            tokens: totalTokens > 0 ? totalTokens : undefined,
            latencyMs: m.metadata?.latencyMs ?? undefined,
          });
        }
      } catch {
        warnings.push(`Could not fetch messages for session ${session.id}`);
      }
    }

    packageData.chat = {
      sessions: exportedSessions,
      messages: exportedMessages,
    };
    recordCounts.sessionsCount = exportedSessions.length;
    recordCounts.messagesCount = exportedMessages.length;
  }

  // 2. Collect User Interface Preferences
  if (selectedCategories.has("user_preferences")) {
    const appSettings = await getAppSettings();
    const safePrefs: Record<string, string> = {};

    // Map allowlisted keys from snapshot
    if (appSettings.themeMode) safePrefs["appearance.theme_mode"] = appSettings.themeMode;
    if (appSettings.density) safePrefs["appearance.density"] = appSettings.density;
    if (appSettings.reducedMotion) safePrefs["appearance.reduced_motion"] = appSettings.reducedMotion;
    if (appSettings.textScale) safePrefs["appearance.text_scale"] = appSettings.textScale;
    if (appSettings.enhancedFocus !== undefined) safePrefs["appearance.enhanced_focus"] = String(appSettings.enhancedFocus);
    if (appSettings.startupRoute) safePrefs["workspace.startup_route"] = appSettings.startupRoute;
    if (appSettings.sidebarCollapsed !== undefined) safePrefs["workspace.sidebar_collapsed"] = String(appSettings.sidebarCollapsed);
    if (appSettings.confirmChatClear !== undefined) safePrefs["workspace.confirm_chat_clear"] = String(appSettings.confirmChatClear);
    if (appSettings.routingPreferenceMode) safePrefs["routing.preference_mode"] = appSettings.routingPreferenceMode;
    if (appSettings.telemetryEnabled !== undefined) safePrefs["telemetry.enabled"] = String(appSettings.telemetryEnabled);

    packageData.preferences = safePrefs;
    recordCounts.preferencesCount = Object.keys(safePrefs).length;
  }

  // 3. Collect Workspace Profiles
  if (selectedCategories.has("workspace_profiles")) {
    const appSettings = await getAppSettings();
    let profilesList: Array<{
      id: string;
      name: string;
      description?: string;
      isBuiltin: boolean;
      createdAt: number;
      preferences: Record<string, string>;
    }> = [];

    try {
      if (appSettings.customProfilesJson) {
        const parsed = JSON.parse(appSettings.customProfilesJson);
        if (Array.isArray(parsed)) {
          profilesList = parsed.map((p: any) => ({
            id: String(p.id || ""),
            name: String(p.name || ""),
            description: p.description ? String(p.description) : undefined,
            isBuiltin: Boolean(p.isBuiltin),
            createdAt: Number(p.createdAt || Date.now()),
            preferences: typeof p.preferences === "object" && p.preferences !== null ? p.preferences : {},
          }));
        }
      }
    } catch {
      warnings.push("Failed to parse custom workspace profiles during export");
    }

    packageData.profiles = profilesList;
    recordCounts.profilesCount = profilesList.length;
  }

  // 4. Collect Telemetry & Analytics
  if (selectedCategories.has("telemetry_and_analytics")) {
    const rawTelemetry = await listTelemetryRecords({}, 5000, 0);
    const safeTelemetry = rawTelemetry.map((r) => {
      const totalTokens = (r.promptTokens ?? 0) + (r.completionTokens ?? 0);
      return {
        id: r.id,
        occurredAt: r.occurredAt,
        eventType: r.eventType,
        providerId: r.providerId ?? undefined,
        modelId: r.modelId ?? undefined,
        totalTokens: totalTokens > 0 ? totalTokens : undefined,
        costUsd: r.costUsd ?? undefined,
        latencyMs: r.latencyMs ?? undefined,
        outcome: r.outcome,
      };
    });

    packageData.telemetry = safeTelemetry;
    recordCounts.telemetryCount = safeTelemetry.length;
  }

  // 5. Collect Provider Registry Metadata
  if (selectedCategories.has("provider_registry_metadata")) {
    const providers = await listRegisteredProviders();
    const credStatuses = await listProviderCredentialStatuses();
    const credMap = new Map(credStatuses.map((c) => [c.providerId, c.isConfigured]));

    const safeProviders = providers.map((p) => ({
      providerId: p.providerId,
      displayName: p.displayName,
      defaultModelId: p.defaultModelId ?? undefined,
      credentialRequired: p.credentialRequired,
      isConfigured: credMap.get(p.providerId) ?? false,
    }));

    packageData.providers = safeProviders;
    recordCounts.providersCount = safeProviders.length;
  }

  // Build CSV outputs if requested
  const csvFiles: Record<string, string> = {};
  if (request.format === "csv" || request.format === "json_and_csv") {
    if (packageData.chat?.messages) {
      csvFiles["messages.csv"] = formatRecordsToCsv(
        [
          { key: "sessionId", label: "Session ID" },
          { key: "id", label: "Message ID" },
          { key: "sender", label: "Sender" },
          { key: "content", label: "Content" },
          { key: "createdAt", label: "Created Timestamp" },
          { key: "provider", label: "Provider" },
          { key: "model", label: "Model" },
          { key: "tokens", label: "Tokens" },
          { key: "latencyMs", label: "Latency (ms)" },
        ],
        packageData.chat.messages
      );
    }

    if (packageData.chat?.sessions) {
      csvFiles["sessions.csv"] = formatRecordsToCsv(
        [
          { key: "id", label: "Session ID" },
          { key: "title", label: "Title" },
          { key: "createdAt", label: "Created At" },
          { key: "updatedAt", label: "Updated At" },
          { key: "pinned", label: "Pinned" },
        ],
        packageData.chat.sessions
      );
    }

    if (packageData.telemetry) {
      csvFiles["telemetry.csv"] = formatRecordsToCsv(
        [
          { key: "id", label: "Record ID" },
          { key: "occurredAt", label: "Occurred At" },
          { key: "eventType", label: "Event Type" },
          { key: "providerId", label: "Provider" },
          { key: "modelId", label: "Model" },
          { key: "totalTokens", label: "Tokens" },
          { key: "costUsd", label: "Cost (USD)" },
          { key: "latencyMs", label: "Latency (ms)" },
          { key: "outcome", label: "Outcome" },
        ],
        packageData.telemetry
      );
    }
  }

  packageData.csvData = Object.keys(csvFiles).length > 0 ? csvFiles : undefined;

  // Build Manifest Envelope
  const nowIso = new Date(startedAtMs).toISOString();
  const totalEstimatedRecords =
    recordCounts.sessionsCount +
    recordCounts.messagesCount +
    recordCounts.telemetryCount +
    recordCounts.preferencesCount +
    recordCounts.profilesCount +
    recordCounts.providersCount;

  const contentWarning = selectedCategories.has("chat_history")
    ? EXPORT_CATEGORIES_CATALOG.chat_history.warningNotice
    : undefined;

  const serializedForHash = JSON.stringify({
    categories: Array.from(selectedCategories),
    recordCounts,
    records: totalEstimatedRecords,
  });

  const manifest: ExportManifest = {
    format: EXPORT_PACKAGE_FORMAT,
    application: "Nano Route",
    appVersion: "0.1.0",
    exportSchemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAtMs: startedAtMs,
    exportedAtIso: nowIso,
    categories: Array.from(selectedCategories),
    formatType: request.format,
    recordCounts,
    totalEstimatedRecords,
    contentWarning,
    checksum: computeChecksum(serializedForHash),
  };

  packageData.manifest = manifest;

  const serializedJson = JSON.stringify(packageData, null, 2);
  const totalSizeBytes = new TextEncoder().encode(serializedJson).length;

  // Post-Export Security Scan
  const leakScan = scanForSecretLeaks(serializedJson);
  let verificationPassed = true;
  let verificationReport = "Export package verified: 0 credentials or secret tokens detected.";

  if (leakScan.hasLeak) {
    verificationPassed = false;
    verificationReport = `SECURITY ALERT: Secret leak detected in export payload! Matched keys: [${leakScan.matchedKeys.join(", ")}]. Package blocked.`;
    return {
      success: false,
      status: "FAILED",
      manifest,
      packageData: { manifest },
      totalSizeBytes: 0,
      durationMs: Date.now() - startedAtMs,
      verificationPassed: false,
      verificationReport,
      warnings,
      error: verificationReport,
    };
  }

  return {
    success: true,
    status: "COMPLETED",
    manifest,
    packageData,
    serializedJson,
    csvFiles: Object.keys(csvFiles).length > 0 ? csvFiles : undefined,
    totalSizeBytes,
    durationMs: Math.max(0, Date.now() - startedAtMs),
    verificationPassed,
    verificationReport,
    warnings,
  };
}
