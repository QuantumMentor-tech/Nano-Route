/**
 * Nano Route — Workspace Profile & Preset Types
 * File: src/features/profiles/types.ts
 *
 * Implements Step 67 local workspace profiles, preference presets,
 * validation results, setting diffs, and serialization schemas.
 * Plaintext secrets or credentials are strictly excluded.
 */

export const PROFILE_SCHEMA_FORMAT = "nano-route-workspace-profile-v1";
export const PROFILE_SCHEMA_VERSION = 1;

export const MAX_PROFILES_COUNT = 10;
export const MAX_PROFILE_NAME_LENGTH = 40;
export const MAX_PROFILE_DESC_LENGTH = 120;
export const MAX_PROFILE_PAYLOAD_BYTES = 16384; // 16KB

export interface WorkspaceProfile {
  id: string;
  name: string;
  description: string;
  isBuiltin: boolean;
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
  preferences: Record<string, string>;
}

export interface ProfileSettingDiff {
  key: string;
  label: string;
  currentValue: string;
  targetValue: string;
  willChange: boolean;
}

export interface ProfileValidationResult {
  isValid: boolean;
  schemaVersion: number;
  supportedKeysCount: number;
  unsupportedKeys: string[];
  invalidValues: Array<{ key: string; error: string }>;
  errors: string[];
}

export interface ProfileExportFile {
  format: string;
  schemaVersion: number;
  exportedAt: number;
  appName: string;
  profile: {
    id: string;
    name: string;
    description: string;
    preferences: Record<string, string>;
  };
}

export interface ProfileImportPreview {
  profile: WorkspaceProfile;
  diffs: ProfileSettingDiff[];
  validation: ProfileValidationResult;
  isExistingName: boolean;
  existingProfileId?: string;
}

