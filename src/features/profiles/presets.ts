/**
 * Nano Route — Built-in Workspace Presets
 * File: src/features/profiles/presets.ts
 *
 * Implements canonical, read-only workspace presets adhering strictly to
 * Step 66 preference virtual defaults and accessibility standards.
 */

import { type WorkspaceProfile, PROFILE_SCHEMA_VERSION } from "./types.ts";

export const BUILTIN_PROFILES: readonly WorkspaceProfile[] = Object.freeze([
  {
    id: "prof_default",
    name: "Default Workspace",
    description: "Balanced desktop ergonomics with dark theme, comfortable density, and full toast communications.",
    isBuiltin: true,
    createdAt: 1731580000000,
    updatedAt: 1731580000000,
    schemaVersion: PROFILE_SCHEMA_VERSION,
    preferences: {
      "appearance.theme_mode": "dark",
      "appearance.density": "comfortable",
      "appearance.reduced_motion": "system",
      "appearance.text_scale": "100%",
      "appearance.enhanced_focus": "false",
      "workspace.startup_route": "overview",
      "workspace.sidebar_collapsed": "false",
      "workspace.confirm_chat_clear": "true",
      "chat.show_timestamps": "false",
      "chat.compact_spacing": "false",
      "chat.enter_to_send": "true",
      "chat.auto_scroll_to_bottom": "true",
      "notifications.enable_non_critical_toasts": "true",
      "notifications.toast_duration_ms": "5000",
      "palette.show_descriptions": "true",
      "palette.show_shortcuts": "true",
    },
  },
  {
    id: "prof_focus",
    name: "Focus & Deep Work",
    description: "Distraction-free environment: boots straight to Chat, suppresses routine toasts, and keeps UI clean.",
    isBuiltin: true,
    createdAt: 1731580000000,
    updatedAt: 1731580000000,
    schemaVersion: PROFILE_SCHEMA_VERSION,
    preferences: {
      "appearance.theme_mode": "dark",
      "appearance.density": "comfortable",
      "appearance.reduced_motion": "standard",
      "appearance.text_scale": "100%",
      "appearance.enhanced_focus": "false",
      "workspace.startup_route": "chat",
      "workspace.sidebar_collapsed": "true",
      "workspace.confirm_chat_clear": "true",
      "chat.show_timestamps": "false",
      "chat.compact_spacing": "false",
      "chat.enter_to_send": "true",
      "chat.auto_scroll_to_bottom": "true",
      "notifications.enable_non_critical_toasts": "false",
      "notifications.toast_duration_ms": "3000",
      "palette.show_descriptions": "true",
      "palette.show_shortcuts": "true",
    },
  },
  {
    id: "prof_compact",
    name: "Compact High-Density",
    description: "Maximizes visible canvas area: compact spacing, audit timestamps on, and condensed turn layout.",
    isBuiltin: true,
    createdAt: 1731580000000,
    updatedAt: 1731580000000,
    schemaVersion: PROFILE_SCHEMA_VERSION,
    preferences: {
      "appearance.theme_mode": "dark",
      "appearance.density": "compact",
      "appearance.reduced_motion": "system",
      "appearance.text_scale": "100%",
      "appearance.enhanced_focus": "false",
      "workspace.startup_route": "overview",
      "workspace.sidebar_collapsed": "true",
      "workspace.confirm_chat_clear": "true",
      "chat.show_timestamps": "true",
      "chat.compact_spacing": "true",
      "chat.enter_to_send": "true",
      "chat.auto_scroll_to_bottom": "true",
      "notifications.enable_non_critical_toasts": "true",
      "notifications.toast_duration_ms": "5000",
      "palette.show_descriptions": "false",
      "palette.show_shortcuts": "true",
    },
  },
  {
    id: "prof_accessibility",
    name: "High-Visibility Accessibility",
    description: "Accessible light canvas (15.4:1 contrast), reduced animations, 110% text scaling, and 3px focus rings.",
    isBuiltin: true,
    createdAt: 1731580000000,
    updatedAt: 1731580000000,
    schemaVersion: PROFILE_SCHEMA_VERSION,
    preferences: {
      "appearance.theme_mode": "light",
      "appearance.density": "comfortable",
      "appearance.reduced_motion": "reduced",
      "appearance.text_scale": "110%",
      "appearance.enhanced_focus": "true",
      "workspace.startup_route": "overview",
      "workspace.sidebar_collapsed": "false",
      "workspace.confirm_chat_clear": "true",
      "chat.show_timestamps": "true",
      "chat.compact_spacing": "false",
      "chat.enter_to_send": "true",
      "chat.auto_scroll_to_bottom": "true",
      "notifications.enable_non_critical_toasts": "true",
      "notifications.toast_duration_ms": "8000",
      "palette.show_descriptions": "true",
      "palette.show_shortcuts": "true",
    },
  },
]);

export function getDefaultProfile(): WorkspaceProfile {
  return BUILTIN_PROFILES[0];
}

export function getFocusProfile(): WorkspaceProfile {
  return BUILTIN_PROFILES[1];
}

export function getCompactProfile(): WorkspaceProfile {
  return BUILTIN_PROFILES[2];
}

export function getAccessibilityProfile(): WorkspaceProfile {
  return BUILTIN_PROFILES[3];
}

export function getBuiltinProfiles(): WorkspaceProfile[] {
  return [...BUILTIN_PROFILES];
}

