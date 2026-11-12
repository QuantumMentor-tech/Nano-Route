/**
//! Nano Route — Telemetry Dashboard Timestamp & Date-Range Utilities
//! File: src/features/telemetry/timestamp.ts
//!
//! Single authoritative boundary for converting local calendar presets and custom
//! date ranges into Unix epoch milliseconds (`i64`) and formatting time-series buckets.
*/

import { parseLocalDateBoundaries } from "../history/timestamp.ts";
import type {
  TelemetryDatePreset,
  TelemetryFreshnessStatus,
  TelemetryTimeBucket,
} from "./types.ts";

export interface TelemetryDateRangeResolution {
  startTime: number | null;
  endTime: number | null;
  timeBucket: TelemetryTimeBucket;
  label: string;
  isValid: boolean;
  validationError: string | null;
}

/**
 * Resolves a dashboard date preset + optional custom YYYY-MM-DD strings into
 * inclusive `[startTime, endTime]` Unix millisecond bounds and a deterministic
 * time-series bucket (`"hour"` for short ranges `<= 48h`, `"day"` otherwise).
 */
export function resolveTelemetryDateRangeBounds(
  preset: TelemetryDatePreset,
  customFrom?: string,
  customTo?: string,
  nowMs: number = Date.now()
): TelemetryDateRangeResolution {
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
      return {
        startTime: todayStart,
        endTime: todayEnd,
        timeBucket: "hour",
        label: "Today (local time)",
        isValid: true,
        validationError: null,
      };

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
      return {
        startTime: start7,
        endTime: todayEnd,
        timeBucket: "day",
        label: "Last 7 days",
        isValid: true,
        validationError: null,
      };
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
      return {
        startTime: start30,
        endTime: todayEnd,
        timeBucket: "day",
        label: "Last 30 days",
        isValid: true,
        validationError: null,
      };
    }

    case "custom": {
      const trimmedFrom = customFrom?.trim() || "";
      const trimmedTo = customTo?.trim() || "";

      const fromParsed = trimmedFrom
        ? parseLocalDateBoundaries(trimmedFrom)
        : null;
      const toParsed = trimmedTo ? parseLocalDateBoundaries(trimmedTo) : null;

      if (trimmedFrom && !fromParsed) {
        return {
          startTime: null,
          endTime: null,
          timeBucket: "day",
          label: "Custom range (invalid start date)",
          isValid: false,
          validationError: "Start date must be a valid YYYY-MM-DD calendar date.",
        };
      }

      if (trimmedTo && !toParsed) {
        return {
          startTime: null,
          endTime: null,
          timeBucket: "day",
          label: "Custom range (invalid end date)",
          isValid: false,
          validationError: "End date must be a valid YYYY-MM-DD calendar date.",
        };
      }

      const startTime = fromParsed ? fromParsed.startOfDayMs : null;
      const endTime = toParsed ? toParsed.endOfDayMs : null;

      if (startTime !== null && endTime !== null && startTime > endTime) {
        return {
          startTime,
          endTime,
          timeBucket: "day",
          label: "Custom range (inverted bounds)",
          isValid: false,
          validationError: "Start date must be on or before end date.",
        };
      }

      const spanMs =
        startTime !== null && endTime !== null ? endTime - startTime : Infinity;
      const timeBucket: TelemetryTimeBucket =
        spanMs <= 48 * 3_600_000 ? "hour" : "day";

      const rangeText =
        trimmedFrom && trimmedTo
          ? `${trimmedFrom} to ${trimmedTo}`
          : trimmedFrom
          ? `From ${trimmedFrom}`
          : trimmedTo
          ? `Until ${trimmedTo}`
          : "Custom range";

      return {
        startTime,
        endTime,
        timeBucket,
        label: rangeText,
        isValid: true,
        validationError: null,
      };
    }

    case "all":
    default:
      return {
        startTime: null,
        endTime: null,
        timeBucket: "day",
        label: "All available data",
        isValid: true,
        validationError: null,
      };
  }
}

/**
 * Formats a time-series bucket start timestamp into a concise, unambiguous label.
 */
export function formatTimeSeriesBucketLabel(
  bucketStartMs: number,
  bucketMode: TelemetryTimeBucket
): string {
  if (!Number.isFinite(bucketStartMs) || bucketStartMs <= 0) {
    return "Unknown";
  }
  const date = new Date(bucketStartMs);
  if (bucketMode === "hour") {
    return date.toLocaleTimeString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Determines the lightweight freshness status of the current dashboard snapshot.
 */
export function resolveTelemetryFreshnessStatus(
  lastUpdatedAtMs: number | null,
  isLoading: boolean,
  hasError: boolean,
  nowMs: number = Date.now()
): { status: TelemetryFreshnessStatus; label: string } {
  if (isLoading && lastUpdatedAtMs === null) {
    return { status: "loading", label: "Loading telemetry..." };
  }
  if (hasError && lastUpdatedAtMs === null) {
    return { status: "unavailable", label: "Telemetry unavailable" };
  }
  if (lastUpdatedAtMs === null || !Number.isFinite(lastUpdatedAtMs)) {
    return { status: "unknown", label: "Unknown freshness" };
  }

  const ageMs = Math.max(0, nowMs - lastUpdatedAtMs);
  if (ageMs <= 60_000) {
    return { status: "up_to_date", label: "Up to date" };
  }
  return { status: "updated_recently", label: "Updated recently" };
}

