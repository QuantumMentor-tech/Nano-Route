/**
 * Nano Route — Workspace Profiles Context & Atomic Dispatcher
 * File: src/features/profiles/ProfilesContext.tsx
 *
 * Implements Step 67 profile registry, atomic activation with rollback,
 * profile creation, safe deletion, and integration with Step 64 notifications.
 */

import React, { createContext, useContext, useState, useMemo, useCallback } from "react";
import {
  type WorkspaceProfile,
  type ProfileImportPreview,
  MAX_PROFILES_COUNT,
  PROFILE_SCHEMA_VERSION,
} from "./types.ts";
import { BUILTIN_PROFILES, getDefaultProfile } from "./presets.ts";
import {
  computeProfileDiff,
  exportProfileToJson,
  parseAndValidateImport,
  sanitizeProfileName,
  sanitizeProfileDescription,
} from "./engine.ts";
import { usePreferences } from "../settings/PreferencesContext.tsx";
import { useNotifications } from "../notifications/NotificationContext.tsx";
import { type AppSettingKeyString } from "../../services/ipc/index.ts";

export interface ProfilesContextValue {
  profiles: WorkspaceProfile[];
  activeProfile: WorkspaceProfile;
  activeProfileId: string;
  loading: boolean;
  createProfile: (name: string, description?: string) => Promise<WorkspaceProfile>;
  activateProfile: (id: string) => Promise<boolean>;
  deleteProfile: (id: string) => Promise<boolean>;
  exportProfile: (id: string) => string;
  previewProfile: (jsonString: string) => ProfileImportPreview;
  importProfile: (jsonString: string, overwriteMode?: "copy" | "replace") => Promise<WorkspaceProfile>;
}

const ProfilesContext = createContext<ProfilesContextValue | null>(null);

export const ProfilesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings, updatePreference, reloadPreferences } = usePreferences();
  const { publish } = useNotifications();
  const [inProgress, setInProgress] = useState(false);

  // Parse custom profiles from persisted JSON
  const customProfiles: WorkspaceProfile[] = useMemo(() => {
    try {
      const raw = settings.customProfilesJson;
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [settings.customProfilesJson]);

  // Combined list of built-in presets and custom profiles
  const profiles: WorkspaceProfile[] = useMemo(() => {
    return [...BUILTIN_PROFILES, ...customProfiles];
  }, [customProfiles]);

  // Active profile resolution with safe fallback
  const activeProfileId = settings.activeProfileId ?? "prof_default";
  const activeProfile = useMemo(() => {
    const found = profiles.find((p) => p.id === activeProfileId);
    return found ?? getDefaultProfile();
  }, [profiles, activeProfileId]);

  // Persists custom profiles array to SQLite
  const saveCustomProfiles = useCallback(
    async (updated: WorkspaceProfile[]) => {
      const json = JSON.stringify(updated);
      await updatePreference("workspace.profiles", json);
    },
    [updatePreference]
  );

  /**
   * Atomic profile activation with rollback checkpoint on failure.
   */
  const activateProfile = useCallback(
    async (id: string): Promise<boolean> => {
      const target = profiles.find((p) => p.id === id);
      if (!target) {
        publish({
          title: "Profile Activation Failed",
          message: `Workspace profile '${id}' not found.`,
          severity: "error",
          source: "System",
        });
        return false;
      }

      setInProgress(true);

      // 1. Capture current preference values as rollback checkpoint
      const checkpoint: Record<string, string> = {};
      for (const key of Object.keys(target.preferences)) {
        const currentVal = (settings as any)[key] ?? "";
        checkpoint[key] = String(currentVal);
      }

      const appliedKeys: string[] = [];

      try {
        // 2. Stage and apply each setting in the target profile
        for (const [key, val] of Object.entries(target.preferences)) {
          await updatePreference(key as AppSettingKeyString, val);
          appliedKeys.push(key);
        }

        // 3. Mark active profile ID in storage
        await updatePreference("workspace.active_profile_id", target.id);
        await reloadPreferences();

        publish({
          title: "Workspace Profile Activated",
          message: `Switched to "${target.name}".`,
          severity: "info",
          source: "System",
        });

        return true;
      } catch (err: unknown) {
        // Rollback applied keys upon partial failure
        for (const rolledKey of appliedKeys) {
          try {
            if (checkpoint[rolledKey] !== undefined) {
              await updatePreference(rolledKey as AppSettingKeyString, checkpoint[rolledKey]);
            }
          } catch {
            // Ignore rollback error
          }
        }

        publish({
          title: "Profile Activation Error",
          message: `Could not apply "${target.name}". Changes were rolled back safely: ${err instanceof Error ? err.message : String(err)}`,
          severity: "error",
          source: "System",
        });

        return false;
      } finally {
        setInProgress(false);
      }
    },
    [profiles, settings, updatePreference, reloadPreferences, publish]
  );

  /**
   * Creates a new profile from current active preferences.
   */
  const createProfile = useCallback(
    async (name: string, description?: string): Promise<WorkspaceProfile> => {
      const cleanName = sanitizeProfileName(name);
      const cleanDesc = sanitizeProfileDescription(description);

      if (!cleanName || cleanName.length < 2) {
        throw new Error("Profile name must be between 2 and 40 characters.");
      }

      if (profiles.length >= MAX_PROFILES_COUNT) {
        throw new Error(`Profile limit reached (maximum ${MAX_PROFILES_COUNT} profiles allowed).`);
      }

      if (profiles.some((p) => p.name.toLowerCase() === cleanName.toLowerCase())) {
        throw new Error(`A profile with the name "${cleanName}" already exists.`);
      }

      // Snapshot current profileable preferences
      const preferencesSnapshot: Record<string, string> = {
        "appearance.theme_mode": settings.themeMode ?? "dark",
        "appearance.density": settings.density ?? "comfortable",
        "appearance.reduced_motion": settings.reducedMotion ?? "system",
        "appearance.text_scale": settings.textScale ?? "100%",
        "appearance.enhanced_focus": String(settings.enhancedFocus ?? false),
        "workspace.startup_route": settings.startupRoute ?? "overview",
        "workspace.sidebar_collapsed": String(settings.sidebarCollapsed ?? false),
        "workspace.confirm_chat_clear": String(settings.confirmChatClear ?? true),
        "chat.show_timestamps": String(settings.chatShowTimestamps ?? false),
        "chat.compact_spacing": String(settings.chatCompactSpacing ?? false),
        "chat.enter_to_send": String(settings.chatEnterToSend ?? true),
        "chat.auto_scroll_to_bottom": String(settings.chatAutoScroll ?? true),
        "notifications.enable_non_critical_toasts": String(settings.notificationEnableNonCriticalToasts ?? true),
        "notifications.toast_duration_ms": String(settings.notificationToastDurationMs ?? 5000),
        "palette.show_descriptions": String(settings.paletteShowDescriptions ?? true),
        "palette.show_shortcuts": String(settings.paletteShowShortcuts ?? true),
      };

      const newProfile: WorkspaceProfile = {
        id: `prof_custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: cleanName,
        description: cleanDesc,
        isBuiltin: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        schemaVersion: PROFILE_SCHEMA_VERSION,
        preferences: preferencesSnapshot,
      };

      const updated = [...customProfiles, newProfile];
      await saveCustomProfiles(updated);

      publish({
        title: "Workspace Profile Created",
        message: `Profile "${newProfile.name}" saved successfully.`,
        severity: "success",
        source: "System",
      });

      return newProfile;
    },
    [profiles, customProfiles, settings, saveCustomProfiles, publish]
  );

  /**
   * Deletes a custom profile. Reverts active profile to default if deleted.
   */
  const deleteProfile = useCallback(
    async (id: string): Promise<boolean> => {
      const target = profiles.find((p) => p.id === id);
      if (!target) {
        throw new Error(`Profile '${id}' not found.`);
      }

      if (target.isBuiltin) {
        throw new Error("Built-in presets cannot be deleted.");
      }

      const updated = customProfiles.filter((p) => p.id !== id);
      await saveCustomProfiles(updated);

      // If active profile was deleted, safely fallback to default
      if (activeProfileId === id) {
        await activateProfile("prof_default");
      }

      publish({
        title: "Workspace Profile Deleted",
        message: `Profile "${target.name}" was removed.`,
        severity: "info",
        source: "System",
      });

      return true;
    },
    [profiles, customProfiles, activeProfileId, saveCustomProfiles, activateProfile, publish]
  );

  /**
   * Exports profile to JSON string with zero credentials.
   */
  const exportProfile = useCallback(
    (id: string): string => {
      const target = profiles.find((p) => p.id === id);
      if (!target) {
        throw new Error(`Profile '${id}' not found.`);
      }

      const json = exportProfileToJson(target);

      publish({
        title: "Profile Exported",
        message: `Exported "${target.name}" profile.`,
        severity: "info",
        source: "System",
      });

      return json;
    },
    [profiles, publish]
  );

  /**
   * Generates diff preview of an untrusted JSON file without applying it.
   */
  const previewProfile = useCallback(
    (jsonString: string): ProfileImportPreview => {
      const { profile, validation } = parseAndValidateImport(jsonString);
      if (!profile) {
        throw new Error(validation.errors.join("; ") || "Invalid profile file.");
      }

      const diffs = computeProfileDiff(settings, profile);
      const existing = profiles.find(
        (p) => p.name.toLowerCase() === profile.name.toLowerCase()
      );

      return {
        profile,
        diffs,
        validation,
        isExistingName: Boolean(existing),
        existingProfileId: existing?.id,
      };
    },
    [settings, profiles]
  );

  /**
   * Imports a profile from a validated JSON string.
   */
  const importProfile = useCallback(
    async (jsonString: string, overwriteMode: "copy" | "replace" = "copy"): Promise<WorkspaceProfile> => {
      const { profile, validation } = parseAndValidateImport(jsonString);
      if (!profile || !validation.isValid) {
        throw new Error(validation.errors.join("; ") || "Invalid profile payload.");
      }

      const existingIndex = customProfiles.findIndex(
        (p) => p.name.toLowerCase() === profile.name.toLowerCase()
      );

      let finalProfile: WorkspaceProfile = { ...profile };

      if (existingIndex >= 0) {
        if (overwriteMode === "replace") {
          finalProfile = {
            ...profile,
            id: customProfiles[existingIndex].id,
            updatedAt: Date.now(),
          };
          const updated = [...customProfiles];
          updated[existingIndex] = finalProfile;
          await saveCustomProfiles(updated);
        } else {
          // Create copy
          finalProfile = {
            ...profile,
            name: `${profile.name} (Copy)`,
            id: `prof_custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          };
          if (profiles.length >= MAX_PROFILES_COUNT) {
            throw new Error(`Profile limit reached (maximum ${MAX_PROFILES_COUNT} profiles allowed).`);
          }
          await saveCustomProfiles([...customProfiles, finalProfile]);
        }
      } else {
        if (profiles.length >= MAX_PROFILES_COUNT) {
          throw new Error(`Profile limit reached (maximum ${MAX_PROFILES_COUNT} profiles allowed).`);
        }
        await saveCustomProfiles([...customProfiles, finalProfile]);
      }

      publish({
        title: "Workspace Profile Imported",
        message: `Imported "${finalProfile.name}" successfully.`,
        severity: "success",
        source: "System",
      });

      return finalProfile;
    },
    [customProfiles, profiles.length, saveCustomProfiles, publish]
  );

  const contextValue = useMemo<ProfilesContextValue>(
    () => ({
      profiles,
      activeProfile,
      activeProfileId,
      loading: inProgress,
      createProfile,
      activateProfile,
      deleteProfile,
      exportProfile,
      previewProfile,
      importProfile,
    }),
    [
      profiles,
      activeProfile,
      activeProfileId,
      inProgress,
      createProfile,
      activateProfile,
      deleteProfile,
      exportProfile,
      previewProfile,
      importProfile,
    ]
  );

  return <ProfilesContext.Provider value={contextValue}>{children}</ProfilesContext.Provider>;
};

export function useProfiles(): ProfilesContextValue {
  const context = useContext(ProfilesContext);
  if (!context) {
    throw new Error("useProfiles must be used within a ProfilesProvider");
  }
  return context;
}

