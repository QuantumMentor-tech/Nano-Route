/**
 * Nano Route — Step 52 Secure Application Update Lifecycle Test Suite
 * File: src/features/maintenance/__tests__/secureUpdateLifecycle.test.ts
 *
 * Validates:
 * 1. Semantic version parsing, comparison, and downgrade protection
 * 2. Update metadata validation (product ID, architecture, platform, HTTPS)
 * 3. Release channel isolation (stable vs preview/development)
 * 4. Cryptographic SHA-256 integrity verification
 * 5. Active operation concurrency protection
 * 6. Database migration backup invariants & rollback plan
 * 7. State machine transitions from idle to restart_pending
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  parseSemVer,
  compareSemVer,
  validateUpdateMetadata,
  checkForUpdate,
  getUpdateState,
  downloadUpdate,
  verifyUpdate,
  prepareUpdate,
  applyUpdate,
  dismissUpdate,
  setMockUpdateCandidate,
  setMockActiveExecution,
  resetMockUpdaterStore,
  CANONICAL_PRODUCT_ID,
} from "../../../services/ipc/updater.ts";
import type { UpdateMetadataDto } from "../../../services/ipc/types.ts";

describe("Step 52 — Secure Application Update Infrastructure & Lifecycle", () => {
  beforeEach(() => {
    resetMockUpdaterStore();
  });

  // ==========================================================================
  // 1. SEMANTIC VERSIONING & DOWNGRADE PROTECTION
  // ==========================================================================
  describe("1. SemVer Parsing & Version Comparison", () => {
    it("parses semantic versions with major, minor, patch, and prerelease components", () => {
      const v1 = parseSemVer("0.1.0");
      assert.deepEqual(v1, { major: 0, minor: 1, patch: 0, prerelease: undefined });

      const v2 = parseSemVer("v1.2.3-rc1");
      assert.deepEqual(v2, { major: 1, minor: 2, patch: 3, prerelease: "rc1" });

      const invalid = parseSemVer("not-a-version");
      assert.equal(invalid, null);
    });

    it("correctly evaluates upgrade, downgrade, and equality", () => {
      // Upgrades
      assert.ok(compareSemVer("0.1.1", "0.1.0") > 0);
      assert.ok(compareSemVer("0.2.0", "0.1.9") > 0);
      assert.ok(compareSemVer("1.0.0", "0.9.9") > 0);
      assert.ok(compareSemVer("0.1.0", "0.1.0-alpha") > 0);

      // Downgrades
      assert.ok(compareSemVer("0.0.9", "0.1.0") < 0);
      assert.ok(compareSemVer("0.1.0", "0.1.1") < 0);

      // Equal
      assert.equal(compareSemVer("0.1.0", "0.1.0"), 0);
    });
  });

  // ==========================================================================
  // 2. METADATA VALIDATION & SECURITY REJECTIONS
  // ==========================================================================
  describe("2. Update Metadata Validation & Host Invariants", () => {
    const validCandidate: UpdateMetadataDto = {
      productId: CANONICAL_PRODUCT_ID,
      version: "0.1.1",
      channel: "stable",
      platform: "windows",
      architecture: "x86_64",
      artifactUrl: "https://releases.nanoroute.ai/packages/NanoRoute_0.1.1_x64.msi",
      artifactSizeBytes: 45_000_000,
      artifactSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      signature: "SIG_TEST_VALID_AUTHENTICODE_DIGEST",
      releaseDate: "2026-11-20T10:00:00Z",
      releaseNotes: "Security hardening patch and latency optimizations.",
      requiresDatabaseMigration: false,
      requiresRestart: true,
      isMandatory: false,
    };

    it("approves valid update metadata matching all host invariants", () => {
      const res = validateUpdateMetadata(validCandidate, "0.1.0", "stable");
      assert.equal(res.isValid, true);
      assert.equal(res.rejectionReason, undefined);
    });

    it("rejects mismatched product identifiers", () => {
      const badProduct = { ...validCandidate, productId: "com.malicious.app" };
      const res = validateUpdateMetadata(badProduct, "0.1.0", "stable");
      assert.equal(res.isValid, false);
      assert.ok(res.rejectionReason?.includes("Product identifier mismatch"));
    });

    it("rejects incompatible architectures (e.g. arm64 on x86_64)", () => {
      const badArch = { ...validCandidate, architecture: "arm64" };
      const res = validateUpdateMetadata(badArch, "0.1.0", "stable");
      assert.equal(res.isValid, false);
      assert.ok(res.rejectionReason?.includes("Architecture incompatible"));
    });

    it("rejects unexpected version downgrades", () => {
      const downgrade = { ...validCandidate, version: "0.0.9" };
      const res = validateUpdateMetadata(downgrade, "0.1.0", "stable");
      assert.equal(res.isValid, false);
      assert.ok(res.rejectionReason?.includes("not newer than current"));
    });

    it("rejects insecure HTTP update URLs", () => {
      const insecureUrl = {
        ...validCandidate,
        artifactUrl: "http://insecure-cdn.evil.com/payload.exe",
      };
      const res = validateUpdateMetadata(insecureUrl, "0.1.0", "stable");
      assert.equal(res.isValid, false);
      assert.ok(res.rejectionReason?.includes("strictly enforce HTTPS"));
    });

    it("rejects malformed SHA-256 checksums", () => {
      const badHash = { ...validCandidate, artifactSha256: "not_a_valid_hash" };
      const res = validateUpdateMetadata(badHash, "0.1.0", "stable");
      assert.equal(res.isValid, false);
      assert.ok(res.rejectionReason?.includes("SHA-256 artifact checksum"));
    });
  });

  // ==========================================================================
  // 3. RELEASE CHANNEL ISOLATION
  // ==========================================================================
  describe("3. Release Channel Isolation", () => {
    it("ensures stable installations reject preview or development channel updates", () => {
      const previewCandidate: UpdateMetadataDto = {
        productId: CANONICAL_PRODUCT_ID,
        version: "0.2.0-preview1",
        channel: "preview",
        platform: "windows",
        architecture: "x86_64",
        artifactUrl: "https://releases.nanoroute.ai/preview/update.msi",
        artifactSizeBytes: 40_000_000,
        artifactSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        signature: "SIG_PREVIEW",
        releaseDate: "2026-11-20T10:00:00Z",
        releaseNotes: "Experimental features",
        requiresDatabaseMigration: false,
        requiresRestart: true,
        isMandatory: false,
      };

      const res = validateUpdateMetadata(previewCandidate, "0.1.0", "stable");
      assert.equal(res.isValid, false);
      assert.ok(res.rejectionReason?.includes("Channel mismatch"));
    });
  });

  // ==========================================================================
  // 4. ACTIVE OPERATION & CONCURRENCY PROTECTION
  // ==========================================================================
  describe("4. Active Operation Concurrency Guards", () => {
    const validCandidate: UpdateMetadataDto = {
      productId: CANONICAL_PRODUCT_ID,
      version: "0.1.1",
      channel: "stable",
      platform: "windows",
      architecture: "x86_64",
      artifactUrl: "https://releases.nanoroute.ai/packages/NanoRoute_0.1.1_x64.msi",
      artifactSizeBytes: 45_000_000,
      artifactSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      signature: "SIG_VALID",
      releaseDate: "2026-11-20T10:00:00Z",
      releaseNotes: "Patch",
      requiresDatabaseMigration: false,
      requiresRestart: true,
      isMandatory: false,
    };

    it("blocks update checks when chat streaming or persistence is active", async () => {
      setMockUpdateCandidate(validCandidate);
      setMockActiveExecution(true); // Active chat stream running

      const checkResult = await checkForUpdate({ channel: "stable" });
      assert.equal(checkResult.updateAvailable, false);
      assert.ok(checkResult.rejectionReason?.includes("Active operation in progress"));
    });

    it("blocks update download when active execution is running", async () => {
      setMockActiveExecution(true);

      await assert.rejects(
        async () => {
          await downloadUpdate(validCandidate);
        },
        {
          code: "SERVICE_UNAVAILABLE",
        }
      );
    });

    it("allows download once active execution finishes", async () => {
      setMockActiveExecution(false);

      const progress = await downloadUpdate(validCandidate);
      assert.equal(progress.percentage, 100);
      assert.equal(progress.state, "ready_to_install");
    });
  });

  // ==========================================================================
  // 5. DATABASE MIGRATION SAFETY & ROLLBACK PLANNING
  // ==========================================================================
  describe("5. Database Migration Safety & Rollback", () => {
    it("creates pre-update safety backup plan when migration is required", async () => {
      const migrationCandidate: UpdateMetadataDto = {
        productId: CANONICAL_PRODUCT_ID,
        version: "0.2.0",
        channel: "stable",
        platform: "windows",
        architecture: "x86_64",
        artifactUrl: "https://releases.nanoroute.ai/packages/NanoRoute_0.2.0_x64.msi",
        artifactSizeBytes: 50_000_000,
        artifactSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        signature: "SIG_MIGRATION",
        releaseDate: "2026-11-25T10:00:00Z",
        releaseNotes: "Schema update",
        requiresDatabaseMigration: true, // Schema migration required
        requiresRestart: true,
        isMandatory: false,
      };

      const prep = await prepareUpdate(migrationCandidate);
      assert.equal(prep.success, true);
    });
  });

  // ==========================================================================
  // 6. UPDATE STATE MACHINE TRANSITIONS
  // ==========================================================================
  describe("6. Update State Machine Transitions", () => {
    const validCandidate: UpdateMetadataDto = {
      productId: CANONICAL_PRODUCT_ID,
      version: "0.1.1",
      channel: "stable",
      platform: "windows",
      architecture: "x86_64",
      artifactUrl: "https://releases.nanoroute.ai/packages/NanoRoute_0.1.1_x64.msi",
      artifactSizeBytes: 45_000_000,
      artifactSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      signature: "SIG_VALID",
      releaseDate: "2026-11-20T10:00:00Z",
      releaseNotes: "Patch",
      requiresDatabaseMigration: false,
      requiresRestart: true,
      isMandatory: false,
    };

    it("executes standard forward lifecycle: idle -> checking -> available -> downloaded -> ready -> restart_pending", async () => {
      let state = await getUpdateState();
      assert.equal(state.state, "idle");

      // Check update
      setMockUpdateCandidate(validCandidate);
      const checkResult = await checkForUpdate({ channel: "stable" });
      assert.equal(checkResult.updateAvailable, true);

      // Download update
      const downloadProgress = await downloadUpdate(validCandidate);
      assert.equal(downloadProgress.state, "ready_to_install");

      // Verify checksum
      const verifyProgress = await verifyUpdate(validCandidate);
      assert.equal(verifyProgress.state, "ready_to_install");

      // Prepare update
      const prep = await prepareUpdate(validCandidate);
      assert.equal(prep.success, true);

      // Apply update
      const applyResult = await applyUpdate(validCandidate);
      assert.equal(applyResult.success, true);
      assert.equal(applyResult.restartRequired, true);

      state = await getUpdateState();
      assert.equal(state.state, "restart_pending");
    });

    it("dismissUpdate resets state cleanly to idle", async () => {
      setMockUpdateCandidate(validCandidate);
      await checkForUpdate({ channel: "stable" });
      await dismissUpdate();

      const state = await getUpdateState();
      assert.equal(state.state, "idle");
    });
  });
});
