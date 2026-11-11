/**
//! Nano Route — Authoritative History Timestamp Utilities
//! File: src/features/history/timestamp.ts
//!
//! Single conversion boundary between UI local calendar dates and the SQLite
//! Unix millisecond (`i64`) timestamp convention used across `chat_sessions`
//! and `chat_messages`. Prevents timezone and midnight boundary drift.
*/

import type { HistoryDatePreset } from "./types.ts";

export interface TimestampRangeBounds {
  dateFrom: number | null;
  dateTo: number | null;
}

/**
 * Parses a local YYYY-MM-DD calendar date string into local midnight [start, end] ms.
 * Uses local year/month/day constructor (`new Date(y, m - 1, d)`) so DST transitions
 * and UTC offsets never shift the selected calendar day.
 */
export function parseLocalDateBoundaries(
  dateStr: string
): { startOfDayMs: number; endOfDayMs: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (
    start.getFullYear() !== year ||
    start.getMonth() !== month - 1 ||
    start.getDate() !== day
  ) {
    return null;
  }

  const end = new Date(year, month - 1, day, 23, 59, 59, 999);
  return {
    startOfDayMs: start.getTime(),
    endOfDayMs: end.getTime(),
  };
}

/**
 * Resolves a History date preset + optional custom YYYY-MM-DD strings into
 * authoritative Unix millisecond bounds `[dateFrom, dateTo]`.
 */
export function resolveDateRangeBounds(
  preset: HistoryDatePreset,
  customFrom?: string,
  customTo?: string,
  nowMs: number = Date.now()
): TimestampRangeBounds {
  const ref = new Date(nowMs);
  const todayStart = new Date(
    ref.getFullYear(),
    ref.getMonth(),
    ref.getDate(),
    0,
    0,
    0,
    0
  ).getTime();
  const todayEnd = new Date(
    ref.getFullYear(),
    ref.getMonth(),
    ref.getDate(),
    23,
    59,
    59,
    999
  ).getTime();

  switch (preset) {
    case "today":
      return { dateFrom: todayStart, dateTo: todayEnd };

    case "last_7_days": {
      const start7 = new Date(
        ref.getFullYear(),
        ref.getMonth(),
        ref.getDate() - 6,
        0,
        0,
        0,
        0
      ).getTime();
      return { dateFrom: start7, dateTo: todayEnd };
    }

    case "last_30_days": {
      const start30 = new Date(
        ref.getFullYear(),
        ref.getMonth(),
        ref.getDate() - 29,
        0,
        0,
        0,
        0
      ).getTime();
      return { dateFrom: start30, dateTo: todayEnd };
    }

    case "custom": {
      const fromParsed = customFrom ? parseLocalDateBoundaries(customFrom) : null;
      const toParsed = customTo ? parseLocalDateBoundaries(customTo) : null;
      return {
        dateFrom: fromParsed ? fromParsed.startOfDayMs : null,
        dateTo: toParsed ? toParsed.endOfDayMs : null,
      };
    }

    case "all":
    default:
      return { dateFrom: null, dateTo: null };
  }
}

/**
 * Formats a Unix ms timestamp cleanly for compact History Explorer cards.
 */
export function formatHistoryTimestamp(epochMs: number): string {
  if (!Number.isFinite(epochMs) || epochMs <= 0) return "Unknown time";
  const date = new Date(epochMs);
  const now = new Date();

  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/**
 * Formats a full unambiguous local date-time string for conversation headers and tooltips.
 */
export function formatFullHistoryTimestamp(epochMs: number): string {
  if (!Number.isFinite(epochMs) || epochMs <= 0) return "Not recorded";
  return new Date(epochMs).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

