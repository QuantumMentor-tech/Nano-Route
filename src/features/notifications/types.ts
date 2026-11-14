/**
 * Nano Route — Unified Notification System Types
 * File: src/features/notifications/types.ts
 *
 * Implements Step 64 typed notification model, delivery categories,
 * deduplication keys, persistence modes, and actionable user communications.
 */

export type NotificationSeverity = "info" | "success" | "warning" | "error" | "critical";

export type NotificationDelivery = "toast" | "banner" | "dialog" | "persistent";

export type NotificationSource =
  | "Routing"
  | "Provider"
  | "SLM"
  | "Database"
  | "Update"
  | "Recovery"
  | "Diagnostics"
  | "Security"
  | "Settings"
  | "System";

export type NotificationStatus = "unread" | "read" | "dismissed" | "resolved";

export type NotificationActionTarget =
  | { type: "route"; path: string; label: string }
  | { type: "diagnostic"; testId?: string; label: string }
  | { type: "help"; articleId?: string; label: string }
  | { type: "retry"; label: string; actionKey: string }
  | { type: "dismiss"; label: string };

export interface AppNotification {
  id: string;
  dedupeKey: string;
  severity: NotificationSeverity;
  delivery: NotificationDelivery;
  source: NotificationSource;
  title: string;
  message: string;
  technicalDetails?: string;
  createdAt: number;
  status: NotificationStatus;
  isPersistent: boolean;
  durationMs?: number; // For transient toasts (0 or undefined = persistent until dismissed)
  actions?: NotificationActionTarget[];
  isNetworkAction?: boolean; // Discloses if action performs outbound network calls
  occurrenceCount: number;
  resolvedAt?: number;
}

export interface NotificationFilter {
  severity?: NotificationSeverity;
  source?: NotificationSource;
  status?: "all" | "unread" | "active";
}

