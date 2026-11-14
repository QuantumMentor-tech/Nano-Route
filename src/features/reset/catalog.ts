/**
 * Nano Route — Reset Scope Catalog & Authority Mapping
 * File: src/features/reset/catalog.ts
 *
 * Implements Step 69 authoritative scope definitions for all 8 reset operations.
 * Defines exact boundaries: what will change, what will be deleted, what will remain,
 * and recovery guidance.
 */

import {
  type ResetOperationType,
  type ResetScopeDefinition,
  FACTORY_RESET_CONFIRMATION_TOKEN,
  FULL_LOCAL_WIPE_TOKEN,
  CONFIG_RESET_TOKEN,
} from "./types.ts";

export const RESET_CATALOG: Readonly<Record<ResetOperationType, ResetScopeDefinition>> = Object.freeze({
  RESET_PREFERENCES: {
    operation: "RESET_PREFERENCES",
    displayName: "Reset Interface Preferences",
    shortDescription: "Restore appearance, theme, density, text scaling, notifications, and palette settings to default values.",
    classification: "NON_DESTRUCTIVE_RESET",
    willChange: [
      "Theme mode (resets to dark / system preference)",
      "Interface density (resets to comfortable)",
      "Font family & text scaling (resets to standard)",
      "Reduced motion & high-contrast focus preferences",
      "Notification toast durations and position",
      "Command Palette display preferences",
    ],
    willBeDeleted: [],
    willRemain: [
      "All conversation sessions and chat messages",
      "All provider API credentials & DPAPI secrets",
      "Registered provider configurations & custom endpoints",
      "Routing policies and candidate model priorities",
      "Telemetry, cost, and latency analytics records",
      "Custom workspace profiles & presets",
      "Existing database backup archives",
    ],
    cannotBeRecoveredAutomatically: [
      "Custom visual appearance tweaks must be re-applied manually",
    ],
    recoveryOption: "You can re-customize preferences anytime in Settings > Appearance / General, or import a saved preferences JSON file.",
    requiresTypedToken: false,
    expectedToken: null,
    offersPreResetBackup: false,
    requiresApplicationRestart: false,
    requiresOnboardingReinitialization: false,
  },

  RESET_WORKSPACE: {
    operation: "RESET_WORKSPACE",
    displayName: "Reset Workspace Profiles & Layout",
    shortDescription: "Remove all custom workspace profiles, revert to the default preset, and clear saved layout state.",
    classification: "CONFIGURATION_RESET",
    willChange: [
      "Active workspace profile reverts to 'Default Balanced'",
      "Sidebar collapsed / expanded visual state",
      "Active view pane arrangement",
    ],
    willBeDeleted: [
      "All user-created custom workspace profiles",
      "Saved workspace presentation state",
    ],
    willRemain: [
      "All built-in workspace profiles (Default, Focus, Compact, Accessible)",
      "All conversation sessions and chat messages",
      "All DPAPI provider credentials",
      "Provider endpoints & model registry",
      "Telemetry and cost analytics records",
      "Database backup files",
    ],
    cannotBeRecoveredAutomatically: [
      "Custom workspace profile JSON definitions that were not previously exported",
    ],
    recoveryOption: "Built-in profiles remain available immediately. Custom profiles can be re-imported from JSON files if previously exported.",
    requiresTypedToken: false,
    expectedToken: null,
    offersPreResetBackup: false,
    requiresApplicationRestart: false,
    requiresOnboardingReinitialization: false,
  },

  RESET_SESSION_STATE: {
    operation: "RESET_SESSION_STATE",
    displayName: "Reset Workspace Session & Navigation",
    shortDescription: "Clear saved route location, active query filters, and exit markers, resetting startup to the Dashboard.",
    classification: "NON_DESTRUCTIVE_RESET",
    willChange: [
      "Next application startup route resets to Dashboard ('/')",
      "Exit status marker resets to 'clean_exit'",
      "Selected history search query resets to empty",
      "Active settings tab selection resets to 'General'",
    ],
    willBeDeleted: [
      "Saved session snapshot payload ('workspace.session_state')",
    ],
    willRemain: [
      "All chat history, sessions, and messages",
      "All user preferences and workspace profiles",
      "All DPAPI credentials and provider settings",
      "All telemetry data and backups",
    ],
    cannotBeRecoveredAutomatically: [],
    recoveryOption: "Simply navigate to any desired view; your new navigation state will be saved automatically.",
    requiresTypedToken: false,
    expectedToken: null,
    offersPreResetBackup: false,
    requiresApplicationRestart: false,
    requiresOnboardingReinitialization: false,
  },

  REMOVE_PROVIDER_CREDENTIAL: {
    operation: "REMOVE_PROVIDER_CREDENTIAL",
    displayName: "Remove Provider Credential",
    shortDescription: "Securely erase the Windows DPAPI-encrypted API key for a specified external AI provider.",
    classification: "SECURITY_SENSITIVE",
    willChange: [
      "Provider readiness status transitions from configured to unconfigured",
      "Provider will be excluded from intelligent routing candidate sets",
    ],
    willBeDeleted: [
      "DPAPI encrypted credential blob for the specified provider",
      "Stored API key in Windows credential vault",
    ],
    willRemain: [
      "Provider definition, display name, and model descriptors in registry",
      "Chat history previously generated through this provider",
      "Historical cost, token, and latency telemetry for this provider",
      "Credentials for all other configured AI providers",
    ],
    cannotBeRecoveredAutomatically: [
      "The plaintext API key cannot be recovered from the application once deleted",
    ],
    recoveryOption: "You must re-enter your API key from the provider's developer console in Settings > Providers to resume using this provider.",
    requiresTypedToken: false,
    expectedToken: null,
    offersPreResetBackup: false,
    requiresApplicationRestart: false,
    requiresOnboardingReinitialization: false,
  },

  RESET_APPLICATION_CONFIGURATION: {
    operation: "RESET_APPLICATION_CONFIGURATION",
    displayName: "Reset Application Configuration",
    shortDescription: "Revert routing preference modes, telemetry switches, retention policies, and model overrides to factory defaults.",
    classification: "CONFIGURATION_RESET",
    willChange: [
      "Routing preference mode (reverts to 'quality')",
      "Telemetry collection switch (reverts to enabled)",
      "History retention policy (reverts to disabled / infinite)",
      "Provider custom base URLs and priority weights (reverts to defaults)",
      "Model routing overrides and parameter limits",
    ],
    willBeDeleted: [
      "Custom provider endpoint overrides and manual model routing rules",
    ],
    willRemain: [
      "All conversation sessions and chat messages",
      "All DPAPI provider credentials (API keys remain safe and intact)",
      "All telemetry and cost records",
      "Custom workspace profiles",
      "Database backup files",
    ],
    cannotBeRecoveredAutomatically: [
      "Custom provider endpoint URLs and model routing weight overrides",
    ],
    recoveryOption: "You can re-configure routing parameters and provider priorities in Settings > Models & Routing.",
    requiresTypedToken: true,
    expectedToken: CONFIG_RESET_TOKEN,
    offersPreResetBackup: true,
    requiresApplicationRestart: false,
    requiresOnboardingReinitialization: false,
  },

  CLEAR_SELECTED_USER_DATA: {
    operation: "CLEAR_SELECTED_USER_DATA",
    displayName: "Clear Selected User Data",
    shortDescription: "Selectively purge conversation history, telemetry records, or rebuild the full-text search index.",
    classification: "DATA_DELETION",
    willChange: [
      "Analytics summaries update immediately to reflect remaining data",
      "FTS5 full-text search index re-synchronizes with database records",
    ],
    willBeDeleted: [
      "Selected data category records (e.g. all chat sessions and messages, or all telemetry events)",
    ],
    willRemain: [
      "Application settings and user preferences",
      "All DPAPI credentials and provider keys",
      "Workspace profiles and presentation options",
      "Categories not explicitly targeted for deletion",
      "Database backup files on disk",
    ],
    cannotBeRecoveredAutomatically: [
      "Deleted conversation messages and telemetry records cannot be undone from SQLite",
    ],
    recoveryOption: "If a backup was created prior to deletion, you can restore conversation history via Disaster Recovery.",
    requiresTypedToken: false,
    expectedToken: null,
    offersPreResetBackup: true,
    requiresApplicationRestart: false,
    requiresOnboardingReinitialization: false,
  },

  FULL_LOCAL_DATA_RESET: {
    operation: "FULL_LOCAL_DATA_RESET",
    displayName: "Erase All Local User Data",
    shortDescription: "Permanently delete all chat sessions, messages, search index entries, and telemetry records, and reset settings.",
    classification: "DATA_DELETION",
    willChange: [
      "All application settings reset to factory defaults",
      "Cost, token, and latency analytics reset to zero",
    ],
    willBeDeleted: [
      "All local chat sessions, prompt texts, and assistant responses",
      "All FTS5 search index entries",
      "All operational and routing telemetry records",
      "Saved session state snapshots",
    ],
    willRemain: [
      "Existing database backup archives (*.db in AppData)",
      "Application binaries and system dependencies",
      "Provider credentials (preserved unless explicitly chosen to wipe)",
    ],
    cannotBeRecoveredAutomatically: [
      "All local chat history and analytics are permanently removed from the local database",
    ],
    recoveryOption: "Create a verified SQLite backup archive before proceeding. You can restore data later from that backup.",
    requiresTypedToken: true,
    expectedToken: FULL_LOCAL_WIPE_TOKEN,
    offersPreResetBackup: true,
    requiresApplicationRestart: false,
    requiresOnboardingReinitialization: false,
  },

  FACTORY_RESET: {
    operation: "FACTORY_RESET",
    displayName: "Factory Reset Nano Route",
    shortDescription: "Complete return to post-install pristine baseline. Erases all chats, telemetry, DPAPI credentials, settings, and profiles.",
    classification: "IRREVERSIBLE_OR_PRACTICALLY_IRREVERSIBLE",
    willChange: [
      "Application returns completely to initial post-installation state",
      "Onboarding wizard re-activates for next application launch",
      "All routing, models, and provider configurations revert to baseline",
    ],
    willBeDeleted: [
      "All conversation history, prompt submissions, and assistant responses",
      "All operational telemetry, cost analytics, and latency metrics",
      "All Windows DPAPI-encrypted provider API credentials",
      "All custom workspace profiles and preference configurations",
      "All saved session states and navigation cache",
      "Onboarding completion markers",
    ],
    willRemain: [
      "Application binaries, Tauri native core, and runtime libraries",
      "Independent backup archives in local AppData (not deleted by default)",
    ],
    cannotBeRecoveredAutomatically: [
      "All local user data, custom profiles, and configured credentials will be permanently erased",
    ],
    recoveryOption: "A complete safety backup can be created before executing Factory Reset. After restart, you must re-enter your API keys or restore from a backup.",
    requiresTypedToken: true,
    expectedToken: FACTORY_RESET_CONFIRMATION_TOKEN,
    offersPreResetBackup: true,
    requiresApplicationRestart: true,
    requiresOnboardingReinitialization: true,
  },
});

/**
 * Returns the scope definition for a given operation.
 */
export function getResetScopeDefinition(operation: ResetOperationType): ResetScopeDefinition {
  const def = RESET_CATALOG[operation];
  if (!def) {
    throw new Error(`Unknown reset operation: ${operation}`);
  }
  return def;
}

