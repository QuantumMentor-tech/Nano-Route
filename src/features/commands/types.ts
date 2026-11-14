/**
 * Nano Route — Global Command Palette & Quick Actions Types
 * File: src/features/commands/types.ts
 *
 * Implements Step 65 command registry schema, category taxonomy,
 * availability evaluation states, keyboard shortcut definitions, and execution contracts.
 */

export type CommandCategory =
  | "Navigation"
  | "Actions"
  | "Settings"
  | "Diagnostics"
  | "Help"
  | "Recovery"
  | "System";

export type CommandAvailability =
  | "AVAILABLE"
  | "UNAVAILABLE"
  | "DISABLED"
  | "REQUIRES_CONTEXT";

export type CommandActionType =
  | { type: "route"; path: string }
  | { type: "function"; handlerKey: string }
  | { type: "help"; articleId: string }
  | { type: "diagnostic"; testId?: string };

export interface CommandDefinition {
  id: string;
  title: string;
  description: string;
  category: CommandCategory;
  keywords: string[];
  shortcut?: string; // Display string, e.g. "Ctrl+K", "Ctrl+D", "F1"
  shortcutKey?: string; // e.g. "k", "d", "F1"
  requiresCtrl?: boolean;
  requiresShift?: boolean;
  requiresAlt?: boolean;
  availability: CommandAvailability;
  action: CommandActionType;
  dangerous?: boolean;
  helpArticleId?: string;
  sourceContext?: string; // Optional context constraint, e.g. "chat", "history"
}

export interface CommandMatch {
  command: CommandDefinition;
  score: number;
  matchedFields: Array<"title" | "keyword" | "description" | "category">;
}

export interface CommandPaletteState {
  isOpen: boolean;
  query: string;
  selectedIndex: number;
  selectedCategory?: CommandCategory;
  activeContext?: string;
}

