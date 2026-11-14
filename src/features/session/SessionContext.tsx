/**
 * Nano Route — Workspace Session Continuity & Restoration Context
 * File: src/features/session/SessionContext.tsx
 *
 * Implements Step 68 React context provider for workspace session restoration,
 * debounced snapshot persistence, crash marker lifecycle, and safe route coordination.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  type WorkspaceSessionSnapshot,
  type SessionExitStatus,
  type SessionRestoreResult,
} from "./types.ts";
import {
  serializeSessionSnapshot,
  parseAndValidateSessionSnapshot,
  resolveStartupRoute,
  validateSafeRoute,
} from "./engine.ts";
import { usePreferences } from "../settings/PreferencesContext.tsx";
import { useNotifications } from "../notifications/NotificationContext.tsx";
import { getStoredOnboardingProgress } from "../onboarding/onboardingStorage.ts";

export interface SessionContextValue {
  sessionSnapshot: WorkspaceSessionSnapshot | null;
  lastExitStatus: SessionExitStatus;
  restoreResult: SessionRestoreResult | null;
  isRestored: boolean;
  saveSessionState: (partial: Partial<WorkspaceSessionSnapshot>) => Promise<void>;
  clearSessionState: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings, updatePreference } = usePreferences();
  const { publish } = useNotifications();

  const [sessionSnapshot, setSessionSnapshot] = useState<WorkspaceSessionSnapshot | null>(null);
  const [lastExitStatus, setLastExitStatus] = useState<SessionExitStatus>("clean_exit");
  const [restoreResult, setRestoreResult] = useState<SessionRestoreResult | null>(null);
  const [isRestored, setIsRestored] = useState(false);

  const pendingSaveRef = useRef<NodeJS.Timeout | null>(null);
  const currentSnapshotRef = useRef<WorkspaceSessionSnapshot | null>(null);

  // Keep ref updated
  useEffect(() => {
    currentSnapshotRef.current = sessionSnapshot;
  }, [sessionSnapshot]);

  // Initial startup evaluation & restoration
  useEffect(() => {
    const initializeSessionContinuity = async () => {
      try {
        const rawExitStatus = (settings.lastExitStatus as SessionExitStatus) ?? "clean_exit";
        setLastExitStatus(rawExitStatus);

        const rawSessionJson = settings.sessionStateJson;
        let parsedSnapshot: WorkspaceSessionSnapshot | null = null;
        let wasCorrupted = false;

        if (rawSessionJson && rawSessionJson.trim().length > 0) {
          const { snapshot, isValid } = parseAndValidateSessionSnapshot(rawSessionJson);
          if (isValid && snapshot) {
            parsedSnapshot = snapshot;
          } else {
            wasCorrupted = true;
          }
        }

        setSessionSnapshot(parsedSnapshot);

        // Check if onboarding is incomplete
        let isOnboardingMandatory = false;
        try {
          const ob = getStoredOnboardingProgress();
          isOnboardingMandatory = ob.state !== "COMPLETED";
        } catch {
          // Fall through
        }

        const precedence = resolveStartupRoute({
          isOnboardingMandatory,
          restorePreviousSession: settings.restorePreviousSession ?? true,
          userStartupPreference: settings.startupRoute ?? "overview",
          sessionSnapshot: parsedSnapshot,
          lastExitStatus: rawExitStatus,
        });

        const wasUnexpected = rawExitStatus === "unexpected_exit" || rawExitStatus === "startup_recovery";

        const result: SessionRestoreResult = {
          restored: precedence.reason.includes("Restored"),
          route: precedence.targetRoute,
          activeProfileId: parsedSnapshot?.activeProfileId ?? settings.activeProfileId ?? "prof_default",
          sidebarCollapsed: parsedSnapshot?.sidebarCollapsed ?? settings.sidebarCollapsed ?? false,
          activeChatSessionId: parsedSnapshot?.activeChatSessionId,
          exitStatus: rawExitStatus,
          wasUnexpectedExit: wasUnexpected,
          reason: precedence.reason,
        };

        setRestoreResult(result);
        setIsRestored(true);

        // Step 64 Notification alerts only for abnormal events
        if (wasUnexpected) {
          publish({
            title: "Workspace Recovered",
            message: "Application restarted after an unexpected termination. Safe workspace context has been restored.",
            severity: "warning",
            source: "System",
          });
        } else if (wasCorrupted) {
          publish({
            title: "Session Reset",
            message: "Previous session snapshot was corrupted or incompatible and has been safely reset to defaults.",
            severity: "info",
            source: "System",
          });
        }

        // Arm crash marker for current session (if app terminates abnormally, it stays 'unexpected_exit')
        await updatePreference("workspace.last_exit_status", "unexpected_exit");
      } catch (err: unknown) {
        console.error("Session continuity initialization error:", err);
        setIsRestored(true);
      }
    };

    initializeSessionContinuity();
    // Run once on initial settings load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Persists updated session state to SQLite via debounced write.
   */
  const saveSessionState = useCallback(
    async (partial: Partial<WorkspaceSessionSnapshot>) => {
      const merged: WorkspaceSessionSnapshot = {
        format: "nano-route-workspace-session-v1",
        schemaVersion: 1,
        savedAt: Date.now(),
        route: validateSafeRoute(partial.route ?? currentSnapshotRef.current?.route ?? "/"),
        activeProfileId: partial.activeProfileId ?? currentSnapshotRef.current?.activeProfileId,
        sidebarCollapsed: partial.sidebarCollapsed ?? currentSnapshotRef.current?.sidebarCollapsed,
        activeChatSessionId: partial.activeChatSessionId ?? currentSnapshotRef.current?.activeChatSessionId,
        settingsTab: partial.settingsTab ?? currentSnapshotRef.current?.settingsTab,
        historyFilter: partial.historyFilter ?? currentSnapshotRef.current?.historyFilter,
        helpArticleId: partial.helpArticleId ?? currentSnapshotRef.current?.helpArticleId,
        windowState: partial.windowState ?? currentSnapshotRef.current?.windowState,
      };

      setSessionSnapshot(merged);

      if (pendingSaveRef.current) {
        clearTimeout(pendingSaveRef.current);
      }

      pendingSaveRef.current = setTimeout(async () => {
        try {
          const json = serializeSessionSnapshot(merged);
          await updatePreference("workspace.session_state", json);
        } catch (err: unknown) {
          console.error("Failed to persist workspace session snapshot:", err);
        }
      }, 500); // 500ms debounce
    },
    [updatePreference]
  );

  /**
   * Clears saved session state.
   */
  const clearSessionState = useCallback(async () => {
    setSessionSnapshot(null);
    await updatePreference("workspace.session_state", "");
  }, [updatePreference]);

  // Flush clean exit marker on graceful beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Synchronously flush clean exit if possible
      try {
        if (currentSnapshotRef.current) {
          const json = serializeSessionSnapshot(currentSnapshotRef.current);
          updatePreference("workspace.session_state", json);
        }
        updatePreference("workspace.last_exit_status", "clean_exit");
      } catch {
        // Fallback
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [updatePreference]);

  const value = useMemo<SessionContextValue>(
    () => ({
      sessionSnapshot,
      lastExitStatus,
      restoreResult,
      isRestored,
      saveSessionState,
      clearSessionState,
    }),
    [sessionSnapshot, lastExitStatus, restoreResult, isRestored, saveSessionState, clearSessionState]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export function useSessionContinuity(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSessionContinuity must be used within a SessionProvider");
  }
  return context;
}

