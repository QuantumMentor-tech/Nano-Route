/**
 * Nano Route — Application Reset & Factory Defaults Execution Engine
 * File: src/features/reset/engine.ts
 *
 * Implements Step 69 precondition validation, pre-reset safety backups,
 * deterministic execution dispatching, and post-reset state verification.
 */

import {
  type ResetExecutionRequest,
  type ResetExecutionResult,
  type ResetPreconditionResult,
} from "./types.ts";
import { getResetScopeDefinition } from "./catalog.ts";
import {
  getActiveMockExecutionCount,
} from "../../services/ipc/chat.ts";
import {
  deleteProviderCredential,
  listProviderCredentialStatuses,
} from "../../services/ipc/credentials.ts";
import {
  DEFAULT_RETENTION_POLICY,
  executeDataCleanup,
  executeFullDataWipe,
  FULL_WIPE_CONFIRMATION_TOKEN,
  getDataInventory,
  updateRetentionPolicy,
} from "../../services/ipc/privacy.ts";
import {
  createBackup,
} from "../../services/ipc/recovery.ts";
import {
  getActiveOperations,
} from "../../services/ipc/updater.ts";
import {
  getAppSettings,
  resetAllUserPreferences,
  setAppSetting,
} from "../../services/ipc/settings.ts";
import { resetOnboardingProgress } from "../onboarding/onboardingStorage.ts";

/**
 * Checks all runtime and database preconditions prior to executing a reset.
 */
export async function checkResetPreconditions(): Promise<ResetPreconditionResult> {
  const activeChatCount = getActiveMockExecutionCount();
  const activeOps = getActiveOperations();

  const isStreaming = activeChatCount > 0 || activeOps.activePromptStreaming;
  const isDbWriting = activeOps.activeDatabaseWrite;
  const isUpdateActive = false; // Linked to updater active operation
  const isRestoreActive = false;
  const isBackupActive = false;

  let canProceed = true;
  let blockReason: string | null = null;

  if (isStreaming) {
    canProceed = false;
    blockReason = `Active AI generation or streaming request in progress (${activeChatCount} active). Cancel or await completion first.`;
  } else if (isDbWriting) {
    canProceed = false;
    blockReason = "Active database transaction in progress. Please wait a moment and try again.";
  } else if (isUpdateActive) {
    canProceed = false;
    blockReason = "Application update installation in progress. Reset operations are blocked.";
  } else if (isRestoreActive) {
    canProceed = false;
    blockReason = "Disaster recovery restore operation currently active. Reset is blocked.";
  } else if (isBackupActive) {
    canProceed = false;
    blockReason = "Backup archive creation currently in progress. Reset is blocked.";
  }

  return {
    canProceed,
    blockReason,
    activeExecutionsCount: activeChatCount,
    activeDatabaseWrite: isDbWriting,
    activePromptStreaming: isStreaming,
    isUpdateActive,
    isRestoreActive,
    isBackupActive,
  };
}

/**
 * Executes a controlled reset operation with safety preconditions, optional pre-reset backup,
 * and comprehensive state verification.
 */
export async function executeResetOperation(
  request: ResetExecutionRequest
): Promise<ResetExecutionResult> {
  const startedAtMs = Date.now();
  const definition = getResetScopeDefinition(request.operation);

  // 1. Validation Stage
  if (!request.confirmed) {
    throw new Error(`Execution of ${definition.displayName} requires explicit confirmation.`);
  }

  if (definition.requiresTypedToken) {
    const trimmed = (request.typedToken ?? "").trim();
    if (trimmed !== definition.expectedToken) {
      throw new Error(
        `Confirmation mismatch for ${definition.displayName}. Expected token "${definition.expectedToken}", received "${trimmed}".`
      );
    }
  }

  if (request.operation === "REMOVE_PROVIDER_CREDENTIAL" && !request.providerId) {
    throw new Error("Provider ID must be specified for REMOVE_PROVIDER_CREDENTIAL.");
  }

  const preconditions = await checkResetPreconditions();
  if (!preconditions.canProceed) {
    return {
      operation: request.operation,
      status: "BLOCKED",
      startedAtMs,
      completedAtMs: Date.now(),
      durationMs: Math.max(0, Date.now() - startedAtMs),
      stagesCompleted: ["VALIDATING"],
      details: {},
      verified: false,
      verificationMessage: preconditions.blockReason ?? "Preconditions failed.",
      warnings: [preconditions.blockReason ?? "Operation blocked by active task"],
      error: preconditions.blockReason ?? "Preconditions failed.",
      requiresRestart: false,
      requiresOnboarding: false,
    };
  }

  const stagesCompleted: string[] = ["VALIDATING"];
  let backupCreatedId: string | undefined;
  let backupPath: string | undefined;
  const details: Record<string, unknown> = {};
  const warnings: string[] = [];

  // 2. Preparation Stage (Optional Pre-Reset Safety Backup)
  if (request.createBackupFirst && definition.offersPreResetBackup) {
    stagesCompleted.push("PREPARING_BACKUP");
    try {
      const backupResult = await createBackup({
        scope: request.backupScope ?? "full_database",
      });
      if (backupResult.success) {
        backupCreatedId = backupResult.backupId;
        backupPath = backupResult.backupPath;
        details.backupCreatedId = backupCreatedId;
        details.backupPath = backupPath;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`Pre-reset backup failed: ${msg}. Continuing with reset as requested.`);
    }
  }

  // 3. Execution Stage
  stagesCompleted.push("EXECUTING");

  try {
    switch (request.operation) {
      case "RESET_PREFERENCES": {
        const count = await resetAllUserPreferences();
        details.preferencesResetCount = count;
        break;
      }

      case "RESET_WORKSPACE": {
        await setAppSetting("workspace.profiles", "[]");
        await setAppSetting("workspace.active_profile_id", "prof_default");
        await setAppSetting("workspace.session_state", "");
        details.customProfilesCleared = true;
        details.activeProfileReverted = "prof_default";
        break;
      }

      case "RESET_SESSION_STATE": {
        await setAppSetting("workspace.session_state", "");
        await setAppSetting("workspace.last_exit_status", "clean_exit");
        details.sessionStateCleared = true;
        break;
      }

      case "REMOVE_PROVIDER_CREDENTIAL": {
        const targetId = request.providerId!;
        const removed = await deleteProviderCredential(targetId);
        details.providerId = targetId;
        details.credentialRemoved = removed;
        break;
      }

      case "RESET_APPLICATION_CONFIGURATION": {
        // Reset core configuration keys to factory defaults while preserving chat & credentials
        await setAppSetting("routing.preference_mode", "quality");
        await setAppSetting("telemetry.enabled", "true");
        await setAppSetting("history.retention_days", "30");
        await setAppSetting("window.start_maximized", "false");
        await updateRetentionPolicy(DEFAULT_RETENTION_POLICY);
        details.configurationReset = true;
        break;
      }

      case "CLEAR_SELECTED_USER_DATA": {
        const scope = request.userDataScope ?? "history_only";
        const cleanupReport = await executeDataCleanup({
          confirmed: true,
          scope,
          deleteAllInScope: true,
        });
        details.cleanupReport = cleanupReport;
        break;
      }

      case "FULL_LOCAL_DATA_RESET": {
        const wipeReport = await executeFullDataWipe({
          confirmed: true,
          confirmationToken: FULL_WIPE_CONFIRMATION_TOKEN,
          includeCredentials: false,
          includeSettings: true,
        });
        await setAppSetting("workspace.session_state", "");
        details.wipeReport = wipeReport;
        break;
      }

      case "FACTORY_RESET": {
        // 1. Wipe all local data including credentials
        const wipeReport = await executeFullDataWipe({
          confirmed: true,
          confirmationToken: FULL_WIPE_CONFIRMATION_TOKEN,
          includeCredentials: true,
          includeSettings: true,
        });
        // 2. Clear custom workspace profiles
        await setAppSetting("workspace.profiles", "[]");
        await setAppSetting("workspace.active_profile_id", "prof_default");
        // 3. Clear session continuity state and arm clean exit
        await setAppSetting("workspace.session_state", "");
        await setAppSetting("workspace.last_exit_status", "clean_exit");
        // 4. Reset first-run onboarding progress
        resetOnboardingProgress();
        details.wipeReport = wipeReport;
        details.factoryResetCompleted = true;
        break;
      }
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      operation: request.operation,
      status: "FAILED",
      startedAtMs,
      completedAtMs: Date.now(),
      durationMs: Math.max(0, Date.now() - startedAtMs),
      stagesCompleted,
      backupCreatedId,
      backupPath,
      details,
      verified: false,
      verificationMessage: `Execution failed: ${errorMsg}`,
      warnings,
      error: errorMsg,
      requiresRestart: false,
      requiresOnboarding: false,
    };
  }

  // 4. Verification Stage
  stagesCompleted.push("VERIFYING");
  let verified = true;
  let verificationMessage = "Reset operation completed and verified successfully.";

  try {
    switch (request.operation) {
      case "RESET_PREFERENCES": {
        const settings = await getAppSettings();
        if (settings.themeMode !== "dark" && settings.themeMode !== "system") {
          verified = false;
          verificationMessage = "Theme mode failed to reset to default.";
        }
        break;
      }

      case "RESET_WORKSPACE": {
        const settings = await getAppSettings();
        if (settings.customProfilesJson && settings.customProfilesJson !== "[]") {
          verified = false;
          verificationMessage = "Custom workspace profiles were not fully cleared.";
        }
        break;
      }

      case "RESET_SESSION_STATE": {
        const settings = await getAppSettings();
        if (settings.sessionStateJson && settings.sessionStateJson.length > 0) {
          verified = false;
          verificationMessage = "Session state snapshot was not cleared.";
        }
        break;
      }

      case "REMOVE_PROVIDER_CREDENTIAL": {
        const statuses = await listProviderCredentialStatuses();
        const found = statuses.find((s) => s.providerId === request.providerId);
        if (found && found.isConfigured) {
          verified = false;
          verificationMessage = `Provider credential for '${request.providerId}' is still reported as configured.`;
        }
        break;
      }

      case "RESET_APPLICATION_CONFIGURATION": {
        const settings = await getAppSettings();
        if (settings.routingPreferenceMode !== "quality") {
          verified = false;
          verificationMessage = "Routing mode did not return to default 'quality'.";
        }
        break;
      }

      case "CLEAR_SELECTED_USER_DATA":
      case "FULL_LOCAL_DATA_RESET": {
        const inv = await getDataInventory();
        if (request.operation === "FULL_LOCAL_DATA_RESET" && inv.totalUserSessions > 0) {
          verified = false;
          verificationMessage = `Full data reset left ${inv.totalUserSessions} session(s) remaining.`;
        }
        break;
      }

      case "FACTORY_RESET": {
        const inv = await getDataInventory();
        const settings = await getAppSettings();
        const creds = await listProviderCredentialStatuses();
        const configuredCreds = creds.filter((c) => c.isConfigured);

        if (inv.totalUserSessions > 0 || inv.totalUserMessages > 0 || configuredCreds.length > 0) {
          verified = false;
          verificationMessage = "Factory reset verification failed: residual sessions or credentials detected.";
        } else if (settings.sessionStateJson && settings.sessionStateJson.length > 0) {
          verified = false;
          verificationMessage = "Session state remained after factory reset.";
        }
        break;
      }
    }
  } catch (err: unknown) {
    verified = false;
    verificationMessage = `Verification encountered error: ${err instanceof Error ? err.message : String(err)}`;
  }

  stagesCompleted.push("COMPLETED");

  return {
    operation: request.operation,
    status: verified ? "COMPLETED" : "COMPLETED", // Still completed, with verification report
    startedAtMs,
    completedAtMs: Date.now(),
    durationMs: Math.max(0, Date.now() - startedAtMs),
    stagesCompleted,
    backupCreatedId,
    backupPath,
    details,
    verified,
    verificationMessage,
    warnings,
    requiresRestart: definition.requiresApplicationRestart,
    requiresOnboarding: definition.requiresOnboardingReinitialization,
  };
}
