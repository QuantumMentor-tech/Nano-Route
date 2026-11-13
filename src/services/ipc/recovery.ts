/**
//! Nano Route — Disaster Recovery, Backup & Continuity Service
//!
//! Responsibility:
//! - Coordinates user-data backup creation and SHA-256 integrity verification.
//! - Validates backup manifests, schema versions, and architecture matching.
//! - Previews restore operations with warnings and safety snapshot planning.
//! - Enforces active-operation concurrency locks during backup and restore.
//! - Handles mock in-memory stores for browser/test environments.
*/

import { isTauriContext, safeInvoke } from "./client.ts";
import {
  IPC_COMMANDS,
  type BackupManifestDto,
  type BackupValidationReportDto,
  type CreateBackupRequestDto,
  type CreateBackupResultDto,
  type RestoreBackupRequestDto,
  type RestoreBackupResultDto,
  type RestorePreviewDto,
} from "./types.ts";
import { getActiveOperations } from "./updater.ts";

export type { BackupManifestDto };

export const RESTORE_CONFIRMATION_TOKEN = "RESTORE";

// In-memory mock storage for browser testing / dev environment
interface MockBackupStore {
  backups: Map<string, { manifest: BackupManifestDto; data: string; corrupted?: boolean }>;
  activeOperation: boolean;
}

const mockStore: MockBackupStore = {
  backups: new Map(),
  activeOperation: false,
};

/**
 * Resets the in-memory mock store (for testing).
 */
export function resetMockRecoveryStore(): void {
  mockStore.backups.clear();
  mockStore.activeOperation = false;
}

/**
 * Validates a backup manifest for compatibility with Nano Route.
 */
export function validateBackupManifest(
  manifest: BackupManifestDto,
  currentSupportedSchema: number = 6
): { isValid: boolean; reason?: string; requiresMigration: boolean } {
  if (manifest.applicationName !== "Nano Route") {
    return {
      isValid: false,
      reason: `Mismatched application name: '${manifest.applicationName}' (expected 'Nano Route')`,
      requiresMigration: false,
    };
  }

  if (manifest.architecture !== "x86_64") {
    return {
      isValid: false,
      reason: `Incompatible target architecture: '${manifest.architecture}' (expected 'x86_64')`,
      requiresMigration: false,
    };
  }

  if (manifest.databaseSchemaVersion > currentSupportedSchema) {
    return {
      isValid: false,
      reason: `Backup schema version (${manifest.databaseSchemaVersion}) is newer than application supported version (${currentSupportedSchema})`,
      requiresMigration: false,
    };
  }

  if (!manifest.sha256Checksum || manifest.sha256Checksum.length !== 64) {
    return {
      isValid: false,
      reason: "Invalid or missing SHA-256 integrity checksum",
      requiresMigration: false,
    };
  }

  const requiresMigration = manifest.databaseSchemaVersion < currentSupportedSchema;

  return {
    isValid: true,
    requiresMigration,
  };
}

/**
 * Creates a verified SQLite backup snapshot.
 */
export async function createBackup(
  request: CreateBackupRequestDto
): Promise<CreateBackupResultDto> {
  const activeOps = getActiveOperations();
  if (activeOps.activePromptStreaming) {
    throw new Error("Cannot create backup while active prompt streaming is in progress");
  }
  if (activeOps.activeDatabaseWrite) {
    throw new Error("Cannot create backup while active database write is in progress");
  }

  if (isTauriContext()) {
    return await safeInvoke<CreateBackupResultDto>(IPC_COMMANDS.CREATE_BACKUP, { request });
  }

  // Mock implementation for browser/test
  const now = Date.now();
  const backupId = `backup_${now}`;
  const mockChecksum = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

  const manifest: BackupManifestDto = {
    backupId,
    backupFormatVersion: 1,
    applicationName: "Nano Route",
    applicationVersion: "0.1.0",
    databaseSchemaVersion: 6,
    backupScope: request.scope,
    createdAtMs: now,
    artifactFilename: `${backupId}.db`,
    artifactSizeBytes: 10240,
    sha256Checksum: mockChecksum,
    sessionsCount: 3,
    messagesCount: 12,
    telemetryRecordsCount: 25,
    containsDpapiBlob: true,
    platform: "windows",
    architecture: "x86_64",
  };

  const validation: BackupValidationReportDto = {
    status: "valid",
    isValid: true,
    checksumMatches: true,
    schemaCompatible: true,
    requiresMigration: false,
    manifest,
    computedSha256: mockChecksum,
    expectedSha256: mockChecksum,
  };

  mockStore.backups.set(backupId, {
    manifest,
    data: "mock_sqlite_data",
  });

  return {
    success: true,
    backupId,
    backupPath: `C:\\Users\\User\\AppData\\Local\\Nano Route\\backups\\${manifest.artifactFilename}`,
    manifest,
    validation,
  };
}

/**
 * Previews a restore operation for a given backup ID.
 */
export async function previewRestore(backupId: string): Promise<RestorePreviewDto> {
  if (isTauriContext()) {
    return await safeInvoke<RestorePreviewDto>(IPC_COMMANDS.PREVIEW_RESTORE, { backupId });
  }

  const record = mockStore.backups.get(backupId);
  if (!record) {
    throw new Error(`Backup with ID '${backupId}' not found`);
  }

  const validation = validateBackupManifest(record.manifest);
  if (!validation.isValid || record.corrupted) {
    return {
      canProceed: false,
      rejectionReason: record.corrupted ? "Cryptographic checksum mismatch" : validation.reason,
      manifest: record.manifest,
      currentAppVersion: "0.1.0",
      currentSchemaVersion: 6,
      targetSchemaVersion: record.manifest.databaseSchemaVersion,
      requiresMigration: validation.requiresMigration,
      warningNotice: "Backup failed validation. Restoring is blocked to protect data.",
    };
  }

  return {
    canProceed: true,
    manifest: record.manifest,
    currentAppVersion: "0.1.0",
    currentSchemaVersion: 6,
    targetSchemaVersion: record.manifest.databaseSchemaVersion,
    requiresMigration: validation.requiresMigration,
    safetySnapshotPath: `safety_snapshot_pre_restore_${Date.now()}.db`,
    warningNotice:
      "Restoring will replace current conversation history and settings. DPAPI credentials will remain bound to current Windows user account.",
  };
}

/**
 * Restores the database from a verified backup artifact.
 */
export async function restoreBackup(
  request: RestoreBackupRequestDto
): Promise<RestoreBackupResultDto> {
  if (request.confirmationToken !== RESTORE_CONFIRMATION_TOKEN) {
    throw new Error(`Invalid confirmation token. Type '${RESTORE_CONFIRMATION_TOKEN}' to confirm.`);
  }

  const activeOps = getActiveOperations();
  if (activeOps.activePromptStreaming) {
    throw new Error("Cannot restore backup while active prompt streaming is in progress");
  }
  if (activeOps.activeDatabaseWrite) {
    throw new Error("Cannot restore backup while active database write is in progress");
  }

  if (isTauriContext()) {
    return await safeInvoke<RestoreBackupResultDto>(IPC_COMMANDS.RESTORE_BACKUP, { request });
  }

  const record = mockStore.backups.get(request.backupId);
  if (!record) {
    throw new Error(`Backup with ID '${request.backupId}' not found`);
  }

  if (record.corrupted) {
    throw new Error("Restore rejected: Cryptographic SHA-256 digest does not match manifest");
  }

  const validation = validateBackupManifest(record.manifest);
  if (!validation.isValid) {
    throw new Error(`Restore rejected: ${validation.reason}`);
  }

  const safetyId = `safety_snapshot_pre_restore_${Date.now()}`;

  return {
    success: true,
    backupId: request.backupId,
    restoredSessionsCount: record.manifest.sessionsCount,
    restoredMessagesCount: record.manifest.messagesCount,
    restoredTelemetryCount: record.manifest.telemetryRecordsCount,
    restoredSchemaVersion: record.manifest.databaseSchemaVersion,
    safetySnapshotCreated: safetyId,
    ftsRebuilt: true,
  };
}

/**
 * Lists available backups.
 */
export async function listBackups(): Promise<BackupManifestDto[]> {
  if (isTauriContext()) {
    return await safeInvoke<BackupManifestDto[]>(IPC_COMMANDS.LIST_BACKUPS);
  }

  const list: BackupManifestDto[] = [];
  for (const item of mockStore.backups.values()) {
    list.push(item.manifest);
  }
  return list.sort((a, b) => b.createdAtMs - a.createdAtMs);
}

/**
 * Sets corruption flag on a mock backup for testing.
 */
export function setMockBackupCorrupted(backupId: string, corrupted: boolean): void {
  const item = mockStore.backups.get(backupId);
  if (item) {
    item.corrupted = corrupted;
  }
}
