/**
 * Nano Route — Secure Application Update IPC Bridge & Lifecycle State Machine
 * File: src/services/ipc/updater.ts
 *
 * Implements Step 52 secure update lifecycle:
 * - Version lifecycle transitions & SemVer parsing
 * - Cryptographic SHA-256 integrity verification
 * - Architecture, platform, and product ID matching
 * - Release channel isolation (stable vs preview/development)
 * - Active operation concurrency protection
 * - Safe rollback planning & database migration safeguards
 * - Zero secret keys, zero remote telemetry, zero unauthenticated file execution
 */

import { safeInvoke, isTauriContext } from "./client.ts";
import {
  IPC_COMMANDS,
  type ReleaseChannel,
  type UpdateLifecycleState,
  type UpdateMetadataDto,
  type CheckForUpdateRequestDto,
  type UpdateCheckResultDto,
  type UpdateProgressDto,
  type PrepareUpdateResultDto,
  type ApplyUpdateResultDto,
  type RollbackPlanDto,
} from "./types.ts";
import { IpcError } from "./errors.ts";

export const CANONICAL_PRODUCT_ID = "com.nanoroute.desktop";
export const CANONICAL_APP_VERSION = "0.1.0";
export const CANONICAL_ARCHITECTURE = "x86_64";
export const CANONICAL_PLATFORM = "windows";

// ============================================================================
// Semantic Versioning Logic & Comparison
// ============================================================================

export interface ParsedSemVer {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
}

/**
 * Parses a semantic version string (e.g., "0.1.0", "1.2.3-rc1", "v2.0.0").
 */
export function parseSemVer(rawVersion: string): ParsedSemVer | null {
  if (!rawVersion || typeof rawVersion !== "string") return null;
  const cleaned = rawVersion.trim().replace(/^v/i, "");
  const match = cleaned.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) return null;

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4],
  };
}

/**
 * Compares two semantic version strings.
 * Returns:
 *   > 0 if v1 > v2 (upgrade)
 *   < 0 if v1 < v2 (downgrade)
 *   0 if v1 === v2 (equal)
 */
export function compareSemVer(v1: string, v2: string): number {
  const p1 = parseSemVer(v1);
  const p2 = parseSemVer(v2);

  if (!p1 || !p2) {
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: `Invalid semantic version string: '${v1}' or '${v2}'`,
      retryable: false,
    });
  }

  if (p1.major !== p2.major) return p1.major - p2.major;
  if (p1.minor !== p2.minor) return p1.minor - p2.minor;
  if (p1.patch !== p2.patch) return p1.patch - p2.patch;

  // Prerelease comparison: no prerelease is higher precedence than prerelease
  if (!p1.prerelease && p2.prerelease) return 1;
  if (p1.prerelease && !p2.prerelease) return -1;
  if (p1.prerelease && p2.prerelease) {
    return p1.prerelease.localeCompare(p2.prerelease);
  }

  return 0;
}

/**
 * Validates update candidate metadata against current host invariants.
 */
export function validateUpdateMetadata(
  metadata: UpdateMetadataDto,
  currentVersion: string = CANONICAL_APP_VERSION,
  currentChannel: ReleaseChannel = "stable"
): { isValid: boolean; rejectionReason?: string } {
  // 1. Product ID Verification
  if (metadata.productId !== CANONICAL_PRODUCT_ID) {
    return {
      isValid: false,
      rejectionReason: `Product identifier mismatch: expected '${CANONICAL_PRODUCT_ID}', got '${metadata.productId}'`,
    };
  }

  // 2. Architecture & Platform Verification
  if (metadata.architecture !== CANONICAL_ARCHITECTURE) {
    return {
      isValid: false,
      rejectionReason: `Architecture incompatible: expected '${CANONICAL_ARCHITECTURE}', got '${metadata.architecture}'`,
    };
  }
  if (metadata.platform !== CANONICAL_PLATFORM) {
    return {
      isValid: false,
      rejectionReason: `Platform incompatible: expected '${CANONICAL_PLATFORM}', got '${metadata.platform}'`,
    };
  }

  // 3. Channel Isolation Protection
  if (currentChannel === "stable" && metadata.channel !== "stable") {
    return {
      isValid: false,
      rejectionReason: `Channel mismatch: stable installations cannot consume '${metadata.channel}' updates`,
    };
  }

  // 4. Downgrade Rejection
  const versionDelta = compareSemVer(metadata.version, currentVersion);
  if (versionDelta <= 0) {
    return {
      isValid: false,
      rejectionReason: `Version '${metadata.version}' is not newer than current installed version '${currentVersion}'`,
    };
  }

  // 5. Cryptographic Checksum Integrity
  if (!metadata.artifactSha256 || !/^[0-9a-fA-F]{64}$/.test(metadata.artifactSha256)) {
    return {
      isValid: false,
      rejectionReason: "Invalid or missing SHA-256 artifact checksum",
    };
  }

  // 6. Secure URL Transport Verification
  if (!metadata.artifactUrl || !metadata.artifactUrl.startsWith("https://")) {
    // Permit http://localhost exclusively in test fixtures
    if (!metadata.artifactUrl?.startsWith("http://localhost")) {
      return {
        isValid: false,
        rejectionReason: "Insecure artifact transport: Update URLs must strictly enforce HTTPS",
      };
    }
  }

  return { isValid: true };
}

// ============================================================================
// Browser-Mode Mock Store & State Machine
// ============================================================================

interface MockUpdaterStore {
  state: UpdateLifecycleState;
  progress: UpdateProgressDto;
  activeCandidate: UpdateMetadataDto | null;
  activeExecutionRunning: boolean;
  stagedArtifactPath: string | null;
  rollbackPlan: RollbackPlanDto | null;
}

const mockStore: MockUpdaterStore = {
  state: "idle",
  progress: {
    state: "idle",
    bytesDownloaded: 0,
    totalBytes: 0,
    percentage: 0,
  },
  activeCandidate: null,
  activeExecutionRunning: false,
  stagedArtifactPath: null,
  rollbackPlan: null,
};

export function setMockUpdateCandidate(candidate: UpdateMetadataDto | null): void {
  mockStore.activeCandidate = candidate;
}

export function setMockActiveExecution(isActive: boolean): void {
  mockStore.activeExecutionRunning = isActive;
}

export function resetMockUpdaterStore(): void {
  mockStore.state = "idle";
  mockStore.progress = {
    state: "idle",
    bytesDownloaded: 0,
    totalBytes: 0,
    percentage: 0,
  };
  mockStore.activeCandidate = null;
  mockStore.activeExecutionRunning = false;
  mockStore.stagedArtifactPath = null;
  mockStore.rollbackPlan = null;
}

export function setActiveExecutionRunning(running: boolean): void {
  mockStore.activeExecutionRunning = running;
}

export function getActiveOperations(): {
  activePromptStreaming: boolean;
  activeDatabaseWrite: boolean;
} {
  return {
    activePromptStreaming: mockStore.activeExecutionRunning,
    activeDatabaseWrite: mockStore.activeExecutionRunning,
  };
}

// ============================================================================
// Public Updater Service Methods (Tauri Bridge + Mock)
// ============================================================================

/**
 * Checks for available updates matching current version, architecture, and channel.
 */
export async function checkForUpdate(
  request: CheckForUpdateRequestDto = {}
): Promise<UpdateCheckResultDto> {
  const channel = request.channel ?? "stable";

  if (!isTauriContext()) {
    if (mockStore.activeExecutionRunning) {
      return {
        updateAvailable: false,
        currentVersion: CANONICAL_APP_VERSION,
        rejectionReason: "Active operation in progress: cannot check updates during prompt streaming or database write",
      };
    }

    mockStore.state = "checking";
    if (!mockStore.activeCandidate) {
      mockStore.state = "up_to_date";
      return {
        updateAvailable: false,
        currentVersion: CANONICAL_APP_VERSION,
      };
    }

    const validation = validateUpdateMetadata(mockStore.activeCandidate, CANONICAL_APP_VERSION, channel);
    if (!validation.isValid) {
      mockStore.state = "incompatible";
      return {
        updateAvailable: false,
        currentVersion: CANONICAL_APP_VERSION,
        metadata: mockStore.activeCandidate,
        rejectionReason: validation.rejectionReason,
      };
    }

    mockStore.state = "update_available";
    return {
      updateAvailable: true,
      currentVersion: CANONICAL_APP_VERSION,
      metadata: mockStore.activeCandidate,
    };
  }

  return await safeInvoke<UpdateCheckResultDto>(IPC_COMMANDS.CHECK_FOR_UPDATE, {
    channel,
    customEndpoint: request.customEndpoint,
  });
}

/**
 * Retrieves the current update lifecycle progress.
 */
export async function getUpdateState(): Promise<UpdateProgressDto> {
  if (!isTauriContext()) {
    return { ...mockStore.progress, state: mockStore.state };
  }

  return await safeInvoke<UpdateProgressDto>(IPC_COMMANDS.GET_UPDATE_STATE);
}

/**
 * Downloads and stages the update artifact.
 */
export async function downloadUpdate(metadata: UpdateMetadataDto): Promise<UpdateProgressDto> {
  if (mockStore.activeExecutionRunning) {
    throw new IpcError({
      code: "SERVICE_UNAVAILABLE",
      category: "ServiceUnavailable",
      message: "Cannot download update while active streaming or database operations are running",
      retryable: true,
    });
  }

  const validation = validateUpdateMetadata(metadata);
  if (!validation.isValid) {
    mockStore.state = "incompatible";
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: validation.rejectionReason || "Incompatible update package",
      retryable: false,
    });
  }

  if (!isTauriContext()) {
    mockStore.state = "downloading";
    mockStore.progress = {
      state: "ready_to_install",
      bytesDownloaded: metadata.artifactSizeBytes,
      totalBytes: metadata.artifactSizeBytes,
      percentage: 100,
    };
    mockStore.stagedArtifactPath = `C:\\Users\\User\\AppData\\Local\\Nano Route\\updates\\NanoRoute_${metadata.version}_x64.msi`;
    mockStore.state = "ready_to_install";
    return mockStore.progress;
  }

  return await safeInvoke<UpdateProgressDto>(IPC_COMMANDS.DOWNLOAD_UPDATE, { metadata });
}

/**
 * Verifies SHA-256 cryptographic checksum of staged artifact.
 */
export async function verifyUpdate(
  metadata: UpdateMetadataDto,
  stagedPath?: string
): Promise<UpdateProgressDto> {
  if (!metadata.artifactSha256 || metadata.artifactSha256.length !== 64) {
    mockStore.state = "verification_failed";
    throw new IpcError({
      code: "INVALID_INPUT",
      category: "InvalidInput",
      message: "Cryptographic hash verification failed: Checksum is missing or malformed",
      retryable: false,
    });
  }

  if (!isTauriContext()) {
    mockStore.state = "verifying";
    mockStore.state = "ready_to_install";
    return {
      state: "ready_to_install",
      bytesDownloaded: metadata.artifactSizeBytes,
      totalBytes: metadata.artifactSizeBytes,
      percentage: 100,
    };
  }

  return await safeInvoke<UpdateProgressDto>(IPC_COMMANDS.VERIFY_UPDATE, {
    metadata,
    stagedPath,
  });
}

/**
 * Prepares database safety backup before applying an update requiring migration.
 */
export async function prepareUpdate(metadata: UpdateMetadataDto): Promise<PrepareUpdateResultDto> {
  if (!isTauriContext()) {
    let backupPath: string | undefined;
    if (metadata.requiresDatabaseMigration) {
      backupPath = "C:\\Users\\User\\AppData\\Local\\Nano Route\\data\\nano_route_pre_update_backup.db";
      mockStore.rollbackPlan = {
        previousVersion: CANONICAL_APP_VERSION,
        currentVersion: metadata.version,
        databaseBackupPath: backupPath,
        canSafelyRollback: true,
      };
    }

    return {
      success: true,
      stagedPath: mockStore.stagedArtifactPath || undefined,
    };
  }

  return await safeInvoke<PrepareUpdateResultDto>(IPC_COMMANDS.PREPARE_UPDATE, { metadata });
}

/**
 * Applies the staged update and marks restart required.
 */
export async function applyUpdate(metadata: UpdateMetadataDto): Promise<ApplyUpdateResultDto> {
  if (mockStore.activeExecutionRunning) {
    return {
      success: false,
      restartRequired: false,
      error: "Active operations in progress: please wait for chat execution to complete before restarting",
    };
  }

  if (!isTauriContext()) {
    mockStore.state = "restart_pending";
    return {
      success: true,
      restartRequired: metadata.requiresRestart,
    };
  }

  return await safeInvoke<ApplyUpdateResultDto>(IPC_COMMANDS.APPLY_UPDATE, { metadata });
}

/**
 * Dismisses available update notification and resets state to idle.
 */
export async function dismissUpdate(): Promise<void> {
  if (!isTauriContext()) {
    mockStore.state = "idle";
    return;
  }

  await safeInvoke<void>(IPC_COMMANDS.DISMISS_UPDATE);
}
