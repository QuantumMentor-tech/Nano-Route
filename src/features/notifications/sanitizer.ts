/**
 * Nano Route — Notification Sanitization & Deduplication Utilities
 * File: src/features/notifications/sanitizer.ts
 *
 * Enforces zero secret leakage (API keys, DPAPI blobs, tokens) and
 * generates stable deduplication keys to prevent notification storms.
 */

import { sanitizeErrorMessage } from "../../services/ipc/errors.ts";
import type { NotificationSeverity, NotificationSource } from "./types.ts";

/**
 * Strips secret tokens, credentials, and sensitive filesystem paths from message text.
 */
export function sanitizeNotificationText(text: string): string {
  if (!text) return "";
  return sanitizeErrorMessage(text);
}

/**
 * Generates a stable deterministic deduplication key.
 * Coalesces identical notifications from repeated render cycles or periodic polling.
 */
export function buildDedupeKey(
  source: NotificationSource,
  severity: NotificationSeverity,
  title: string,
  identifier?: string
): string {
  const normTitle = title.trim().toLowerCase().replace(/\s+/g, "_");
  const normId = identifier ? `_${identifier.trim().toLowerCase()}` : "";
  return `${source.toLowerCase()}_${severity}_${normTitle}${normId}`;
}

