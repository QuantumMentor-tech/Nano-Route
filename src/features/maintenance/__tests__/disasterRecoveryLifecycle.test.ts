/**
//! Step 53 — Disaster Recovery, Backup Validation & Restoration Automated Tests
//!
//! Authoritative validation suite for:
//! 1. Data Classification Tiers & Backup Manifest Integrity
//! 2. Manifest & Architecture Verification (x86_64, product name, schema version)
//! 3. Cryptographic SHA-256 Digest Validation & Corruption Rejection
//! 4. Active Operation Concurrency Locks (Streaming & DB Writes)
//! 5. Staged Non-Destructive Restore Workflow & Safety Snapshot Creation
//! 6. FTS5 Search Index Invalidation & Rebuild Verification
//! 7. Cross-Version Schema Compatibility & Migration Requirements
*/

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  createBackup,
  previewRestore,
  restoreBackup,
  listBackups,
  validateBackupManifest,
  resetMockRecoveryStore,
  setMockBackupCorrupted,
  RESTORE_CONFIRMATION_TOKEN,
  type BackupManifestDto,
} from "../../../services/ipc/recovery.ts";
import {
  setActiveExecutionRunning,
} from "../../../services/ipc/updater.ts";

describe("Step 53 Disaster Recovery, Backup & Continuity Lifecycle", () => {
  beforeEach(() => {
    resetMockRecoveryStore();
    setActiveExecutionRunning(false);
  });

  describe("1. Manifest Structure & Architectural Validation", () => {
    it("accepts valid manifest matching application and architecture", () => {
      const validManifest: BackupManifestDto = {
        backupId: "backup_test_1",
        backupFormatVersion: 1,
        applicationName: "Nano Route",
        applicationVersion: "0.1.0",
        databaseSchemaVersion: 6,
        backupScope: "full_database",
        createdAtMs: Date.now(),
        artifactFilename: "backup_test_1.db",
        artifactSizeBytes: 20480,
        sha256Checksum: "a".repeat(64),
        sessionsCount: 5,
        messagesCount: 20,
        telemetryRecordsCount: 40,
        containsDpapiBlob: true,
        platform: "windows",
        architecture: "x86_64",
      };

      const result = validateBackupManifest(validManifest, 6);
      assert.equal(result.isValid, true);
      assert.equal(result.requiresMigration, false);
    });

    it("rejects manifest with mismatched application name", () => {
      const foreignManifest: BackupManifestDto = {
        backupId: "backup_foreign",
        backupFormatVersion: 1,
        applicationName: "OtherApp",
        applicationVersion: "1.0.0",
        databaseSchemaVersion: 6,
        backupScope: "full_database",
        createdAtMs: Date.now(),
        artifactFilename: "backup_foreign.db",
        artifactSizeBytes: 10240,
        sha256Checksum: "a".repeat(64),
        sessionsCount: 1,
        messagesCount: 1,
        telemetryRecordsCount: 1,
        containsDpapiBlob: false,
        platform: "windows",
        architecture: "x86_64",
      };

      const result = validateBackupManifest(foreignManifest, 6);
      assert.equal(result.isValid, false);
      assert.match(result.reason!, /Mismatched application name/);
    });

    it("rejects manifest with mismatched architecture", () => {
      const armManifest: BackupManifestDto = {
        backupId: "backup_arm",
        backupFormatVersion: 1,
        applicationName: "Nano Route",
        applicationVersion: "0.1.0",
        databaseSchemaVersion: 6,
        backupScope: "full_database",
        createdAtMs: Date.now(),
        artifactFilename: "backup_arm.db",
        artifactSizeBytes: 10240,
        sha256Checksum: "a".repeat(64),
        sessionsCount: 1,
        messagesCount: 1,
        telemetryRecordsCount: 1,
        containsDpapiBlob: true,
        platform: "windows",
        architecture: "arm64",
      };

      const result = validateBackupManifest(armManifest, 6);
      assert.equal(result.isValid, false);
      assert.match(result.reason!, /Incompatible target architecture/);
    });

    it("detects older compatible schema that requires migration", () => {
      const olderManifest: BackupManifestDto = {
        backupId: "backup_v5",
        backupFormatVersion: 1,
        applicationName: "Nano Route",
        applicationVersion: "0.1.0",
        databaseSchemaVersion: 5,
        backupScope: "full_database",
        createdAtMs: Date.now(),
        artifactFilename: "backup_v5.db",
        artifactSizeBytes: 15360,
        sha256Checksum: "b".repeat(64),
        sessionsCount: 2,
        messagesCount: 10,
        telemetryRecordsCount: 20,
        containsDpapiBlob: true,
        platform: "windows",
        architecture: "x86_64",
      };

      const result = validateBackupManifest(olderManifest, 6);
      assert.equal(result.isValid, true);
      assert.equal(result.requiresMigration, true);
    });

    it("rejects unsupported future schema version", () => {
      const futureManifest: BackupManifestDto = {
        backupId: "backup_future",
        backupFormatVersion: 1,
        applicationName: "Nano Route",
        applicationVersion: "0.2.0",
        databaseSchemaVersion: 99,
        backupScope: "full_database",
        createdAtMs: Date.now(),
        artifactFilename: "backup_future.db",
        artifactSizeBytes: 15360,
        sha256Checksum: "c".repeat(64),
        sessionsCount: 2,
        messagesCount: 10,
        telemetryRecordsCount: 20,
        containsDpapiBlob: true,
        platform: "windows",
        architecture: "x86_64",
      };

      const result = validateBackupManifest(futureManifest, 6);
      assert.equal(result.isValid, false);
      assert.match(result.reason!, /newer than application supported version/);
    });
  });

  describe("2. Backup Creation & Manifest Generation", () => {
    it("creates verified backup snapshot with cryptographic SHA-256 and manifest", async () => {
      const res = await createBackup({
        scope: "full_database",
        note: "Pre-upgrade snapshot",
      });

      assert.equal(res.success, true);
      assert.ok(res.backupId.startsWith("backup_"));
      assert.equal(res.manifest.applicationName, "Nano Route");
      assert.equal(res.manifest.architecture, "x86_64");
      assert.equal(res.validation.isValid, true);
      assert.equal(res.validation.checksumMatches, true);
      assert.equal(res.validation.schemaCompatible, true);
    });

    it("discovers created backups in reverse chronological order", async () => {
      await createBackup({ scope: "full_database" });
      const backups = await listBackups();
      assert.ok(backups.length >= 1);
      assert.equal(backups[0].applicationName, "Nano Route");
    });
  });

  describe("3. Concurrency Protection", () => {
    it("rejects backup creation during active prompt streaming", async () => {
      setActiveExecutionRunning(true);
      await assert.rejects(
        async () => {
          await createBackup({ scope: "full_database" });
        },
        /Cannot create backup while active prompt streaming is in progress/
      );
    });

    it("rejects restore execution during active database write", async () => {
      const backupRes = await createBackup({ scope: "full_database" });
      setActiveExecutionRunning(true);

      await assert.rejects(
        async () => {
          await restoreBackup({
            backupId: backupRes.backupId,
            confirmationToken: RESTORE_CONFIRMATION_TOKEN,
          });
        },
        /Cannot restore backup while active prompt streaming is in progress/
      );
    });
  });

  describe("4. Restore Preflight, Validation & Corruption Detection", () => {
    it("provides accurate preview for valid backup with safety snapshot warning", async () => {
      const backupRes = await createBackup({ scope: "full_database" });
      const preview = await previewRestore(backupRes.backupId);

      assert.equal(preview.canProceed, true);
      assert.equal(preview.targetSchemaVersion, 6);
      assert.ok(preview.safetySnapshotPath);
      assert.match(preview.warningNotice, /DPAPI credentials will remain bound/);
    });

    it("blocks preview when backup has corrupted checksum", async () => {
      const backupRes = await createBackup({ scope: "full_database" });
      setMockBackupCorrupted(backupRes.backupId, true);

      const preview = await previewRestore(backupRes.backupId);
      assert.equal(preview.canProceed, false);
      assert.match(preview.rejectionReason!, /checksum mismatch/);
    });

    it("strictly rejects restore when confirmation token is incorrect", async () => {
      const backupRes = await createBackup({ scope: "full_database" });
      await assert.rejects(
        async () => {
          await restoreBackup({
            backupId: backupRes.backupId,
            confirmationToken: "WRONG_TOKEN",
          });
        },
        /Invalid confirmation token/
      );
    });

    it("strictly rejects restore of corrupted backup file", async () => {
      const backupRes = await createBackup({ scope: "full_database" });
      setMockBackupCorrupted(backupRes.backupId, true);

      await assert.rejects(
        async () => {
          await restoreBackup({
            backupId: backupRes.backupId,
            confirmationToken: RESTORE_CONFIRMATION_TOKEN,
          });
        },
        /Cryptographic SHA-256 digest does not match manifest/
      );
    });
  });

  describe("5. Staged Restoration & Rollback Invariants", () => {
    it("executes restore safely, creates pre-restore safety snapshot, and rebuilds FTS5 index", async () => {
      const backupRes = await createBackup({ scope: "full_database" });
      const restoreRes = await restoreBackup({
        backupId: backupRes.backupId,
        confirmationToken: RESTORE_CONFIRMATION_TOKEN,
      });

      assert.equal(restoreRes.success, true);
      assert.equal(restoreRes.backupId, backupRes.backupId);
      assert.ok(restoreRes.safetySnapshotCreated.startsWith("safety_snapshot_pre_restore_"));
      assert.equal(restoreRes.ftsRebuilt, true);
      assert.equal(restoreRes.restoredSessionsCount, backupRes.manifest.sessionsCount);
    });
  });
});
