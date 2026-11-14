/**
 * Nano Route — Command Palette State & Keyboard Context
 * File: src/features/commands/CommandPaletteContext.tsx
 *
 * Implements global Ctrl+K shortcut listener, open/close lifecycle,
 * command execution dispatch, and integration with notifications & routing.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../notifications/NotificationContext.tsx";
import { useProfiles } from "../profiles/ProfilesContext.tsx";
import type { CommandDefinition } from "./types.ts";

export interface CommandPaletteContextValue {
  isOpen: boolean;
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
  activeContext?: string;
  setActiveContext: (context?: string) => void;
  executeCommand: (command: CommandDefinition) => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export const CommandPaletteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeContext, setActiveContext] = useState<string | undefined>(undefined);
  const navigate = useNavigate();
  const { setIsCenterOpen, publish } = useNotifications();
  const { activateProfile } = useProfiles();

  const openPalette = useCallback(() => setIsOpen(true), []);
  const closePalette = useCallback(() => setIsOpen(false), []);
  const togglePalette = useCallback(() => setIsOpen((prev) => !prev), []);

  const executeCommand = useCallback(
    (command: CommandDefinition) => {
      setIsOpen(false);

      if (command.availability !== "AVAILABLE") {
        publish({
          title: "Command Unavailable",
          message: `The command "${command.title}" is currently not available in this context.`,
          severity: "warning",
          source: "System",
        });
        return;
      }

      if (command.action.type === "route") {
        navigate(command.action.path);
      } else if (command.action.type === "help") {
        navigate(`/help?article=${command.action.articleId}`);
      } else if (command.action.type === "diagnostic") {
        navigate("/diagnostics");
      } else if (command.action.type === "function") {
        if (command.action.handlerKey === "openNotificationCenter") {
          setIsCenterOpen(true);
        } else if (command.action.handlerKey?.startsWith("activateProfile:")) {
          const profileId = command.action.handlerKey.split(":")[1];
          activateProfile(profileId);
        }
      }
    },
    [navigate, setIsCenterOpen, publish, activateProfile]
  );

  // Global keyboard shortcut listeners (Ctrl+K to toggle, Ctrl+D for Diagnostics, F1 for Help, etc.)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Ctrl+K or Cmd+K: Toggle Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        togglePalette();
        return;
      }

      // If palette is already open, let the palette modal handle keyboard navigation
      if (isOpen) return;

      // 2. F1: Open Help Center
      if (e.key === "F1") {
        e.preventDefault();
        navigate("/help");
        return;
      }

      // 3. Ctrl+D: Open Diagnostics
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d" && !e.shiftKey) {
        // Prevent default browser bookmark shortcut
        e.preventDefault();
        navigate("/diagnostics");
        return;
      }

      // 4. Ctrl+1, Ctrl+2, Ctrl+3: Quick section jumps
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        if (e.key === "1") {
          e.preventDefault();
          navigate("/");
        } else if (e.key === "2") {
          e.preventDefault();
          navigate("/chat");
        } else if (e.key === "3") {
          e.preventDefault();
          navigate("/history");
        } else if (e.key === ",") {
          e.preventDefault();
          navigate("/settings");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, togglePalette, navigate]);

  const value = useMemo<CommandPaletteContextValue>(
    () => ({
      isOpen,
      openPalette,
      closePalette,
      togglePalette,
      activeContext,
      setActiveContext,
      executeCommand,
    }),
    [isOpen, openPalette, closePalette, togglePalette, activeContext, executeCommand]
  );

  return <CommandPaletteContext.Provider value={value}>{children}</CommandPaletteContext.Provider>;
};

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) {
    throw new Error("useCommandPalette must be used within a CommandPaletteProvider");
  }
  return ctx;
}
