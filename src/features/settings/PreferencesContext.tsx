/**
 * Nano Route — User Preferences & Presentation Context
 * File: src/features/settings/PreferencesContext.tsx
 *
 * Implements Step 66 reactive user preferences, live DOM design token binding
 * (theme, density, reduced motion, text scale, enhanced focus), system media query
 * synchronization, and non-sensitive preference dispatching.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import {
  type AppSettingsSnapshot,
  type AppSettingKeyString,
  type PreferenceSection,
  getAppSettings,
  setAppSetting,
  resetSettingsSection,
  DEFAULT_APP_SETTINGS,
} from "../../services/ipc";
import { exportPreferencesToJson, importPreferencesFromJson, type ImportPreferencesResult } from "./preferencesIO.ts";

export interface PreferencesContextValue {
  settings: AppSettingsSnapshot;
  loading: boolean;
  error: string | null;
  updatePreference: (key: AppSettingKeyString, value: string) => Promise<void>;
  resetSection: (section: PreferenceSection) => Promise<number>;
  resetAll: () => Promise<number>;
  reloadPreferences: () => Promise<void>;
  exportPreferences: () => string;
  importPreferences: (jsonString: string) => Promise<ImportPreferencesResult>;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettingsSnapshot>(DEFAULT_APP_SETTINGS);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load preferences from SQLite on bootstrap
  const reloadPreferences = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const snapshot = await getAppSettings();
      setSettings(snapshot);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadPreferences();
  }, [reloadPreferences]);

  // Reactive DOM attributes driver
  useEffect(() => {
    if (typeof document === "undefined") return;

    const root = document.documentElement;

    // 1. Theme Mode Resolution
    const themeMode = settings.themeMode ?? "dark";
    if (themeMode === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const applySystemTheme = (isDark: boolean) => {
        root.setAttribute("data-theme", isDark ? "dark" : "light");
      };
      applySystemTheme(mediaQuery.matches);

      const listener = (e: MediaQueryListEvent) => applySystemTheme(e.matches);
      mediaQuery.addEventListener("change", listener);
      return () => mediaQuery.removeEventListener("change", listener);
    } else {
      root.setAttribute("data-theme", themeMode);
    }

    // 2. Interface Density
    root.setAttribute("data-density", settings.density ?? "comfortable");

    // 3. Reduced Motion
    const motionPref = settings.reducedMotion ?? "system";
    if (motionPref === "system") {
      const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      const applySystemMotion = (matches: boolean) => {
        root.setAttribute("data-reduced-motion", matches ? "reduced" : "standard");
      };
      applySystemMotion(motionQuery.matches);

      const motionListener = (e: MediaQueryListEvent) => applySystemMotion(e.matches);
      motionQuery.addEventListener("change", motionListener);
      return () => motionQuery.removeEventListener("change", motionListener);
    } else {
      root.setAttribute("data-reduced-motion", motionPref);
    }

    // 4. Text Scaling
    root.setAttribute("data-text-scale", settings.textScale ?? "100%");

    // 5. Enhanced Focus Ring
    root.setAttribute("data-enhanced-focus", settings.enhancedFocus ? "true" : "false");
  }, [settings.themeMode, settings.density, settings.reducedMotion, settings.textScale, settings.enhancedFocus]);

  const updatePreference = useCallback(async (key: AppSettingKeyString, value: string) => {
    await setAppSetting(key, value);
    // Instant local state update for zero lag
    const fresh = await getAppSettings();
    setSettings(fresh);
  }, []);

  const resetSection = useCallback(async (section: PreferenceSection): Promise<number> => {
    const count = await resetSettingsSection(section);
    const fresh = await getAppSettings();
    setSettings(fresh);
    return count;
  }, []);

  const resetAll = useCallback(async (): Promise<number> => {
    const count = await resetSettingsSection("all_preferences");
    const fresh = await getAppSettings();
    setSettings(fresh);
    return count;
  }, []);

  const exportPreferences = useCallback((): string => {
    return exportPreferencesToJson(settings);
  }, [settings]);

  const importPreferences = useCallback(async (jsonString: string): Promise<ImportPreferencesResult> => {
    const result = await importPreferencesFromJson(jsonString);
    if (result.appliedCount > 0) {
      const fresh = await getAppSettings();
      setSettings(fresh);
    }
    return result;
  }, []);

  const contextValue = useMemo<PreferencesContextValue>(
    () => ({
      settings,
      loading,
      error,
      updatePreference,
      resetSection,
      resetAll,
      reloadPreferences,
      exportPreferences,
      importPreferences,
    }),
    [
      settings,
      loading,
      error,
      updatePreference,
      resetSection,
      resetAll,
      reloadPreferences,
      exportPreferences,
      importPreferences,
    ]
  );

  return <PreferencesContext.Provider value={contextValue}>{children}</PreferencesContext.Provider>;
};

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used within a PreferencesProvider");
  }
  return context;
}

