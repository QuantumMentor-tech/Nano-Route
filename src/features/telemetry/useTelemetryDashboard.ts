/**
//! Nano Route — Step 42 Telemetry Dashboard State Hook
//! File: src/features/telemetry/useTelemetryDashboard.ts
//!
//! Coordinates local telemetry snapshot queries, date/provider/model/outcome filters,
//! stale-response rejection, non-destructive refresh, and navigation lifecycle safety.
//! Never initiates background polling, SLM inference, or provider network calls.
*/

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { getTelemetryDashboardSnapshot } from "../../services/ipc/telemetry.ts";
import {
  resolveTelemetryDateRangeBounds,
  resolveTelemetryFreshnessStatus,
} from "./timestamp.ts";
import type {
  TelemetryDashboardError,
  TelemetryDashboardFilters,
  TelemetryDashboardSnapshot,
  TelemetryDatePreset,
  TelemetryEventType,
} from "./types.ts";

export function useTelemetryDashboard() {
  // Filter state
  const [datePreset, setDatePreset] = useState<TelemetryDatePreset>("all");
  const [customDateFrom, setCustomDateFrom] = useState<string>("");
  const [customDateTo, setCustomDateTo] = useState<string>("");
  const [providerFilter, setProviderFilter] = useState<string>("");
  const [modelFilter, setModelFilter] = useState<string>("");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("");

  // Snapshot & lifecycle state
  const [snapshot, setSnapshot] = useState<TelemetryDashboardSnapshot | null>(
    null
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<TelemetryDashboardError | null>(null);
  const [lastUpdatedAtMs, setLastUpdatedAtMs] = useState<number | null>(null);
  const [isStale, setIsStale] = useState<boolean>(false);

  // Monotonic sequence guard for stale-response rejection & unmount safety
  const querySeqRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      querySeqRef.current += 1;
    };
  }, []);

  const dateRangeResolution = useMemo(
    () =>
      resolveTelemetryDateRangeBounds(datePreset, customDateFrom, customDateTo),
    [datePreset, customDateFrom, customDateTo]
  );

  const hasActiveFilters = useMemo(
    () =>
      datePreset !== "all" ||
      Boolean(providerFilter.trim()) ||
      Boolean(modelFilter.trim()) ||
      Boolean(outcomeFilter.trim()) ||
      Boolean(eventTypeFilter.trim()),
    [datePreset, providerFilter, modelFilter, outcomeFilter, eventTypeFilter]
  );

  const activeFilters: TelemetryDashboardFilters = useMemo(
    () => ({
      startTime: dateRangeResolution.startTime,
      endTime: dateRangeResolution.endTime,
      timeBucket: dateRangeResolution.timeBucket,
      providerId: providerFilter.trim() || null,
      modelId: modelFilter.trim() || null,
      outcome: outcomeFilter.trim() || null,
      eventType: (eventTypeFilter.trim() as TelemetryEventType) || null,
    }),
    [
      dateRangeResolution.startTime,
      dateRangeResolution.endTime,
      dateRangeResolution.timeBucket,
      providerFilter,
      modelFilter,
      outcomeFilter,
      eventTypeFilter,
    ]
  );

  const executeSnapshotQuery = useCallback(
    async (isManualRefresh: boolean) => {
      if (!dateRangeResolution.isValid) {
        setError({
          operation: "filter",
          message:
            dateRangeResolution.validationError ??
            "Selected date range is invalid.",
        });
        return;
      }

      const seq = ++querySeqRef.current;
      const queryId = `tdq_${seq}`;

      if (snapshot === null && !isManualRefresh) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      try {
        const result = await getTelemetryDashboardSnapshot({
          ...activeFilters,
          queryId,
        });

        // Stale response protection: discard if a newer request superseded this one
        // or if the component navigated away.
        if (!isMountedRef.current || seq !== querySeqRef.current) {
          return;
        }

        setSnapshot(result);
        setLastUpdatedAtMs(result.generatedAtMs || Date.now());
        setIsStale(false);
        setError(null);
      } catch (err) {
        if (!isMountedRef.current || seq !== querySeqRef.current) {
          return;
        }

        // Preserve existing snapshot on refresh/filter failure (Section 24)
        setIsStale((prev) => prev || snapshot !== null);
        setError({
          operation: isManualRefresh
            ? "refresh"
            : snapshot === null
            ? "initial_load"
            : "filter",
          message:
            err instanceof Error
              ? err.message
              : "Failed to load local telemetry dashboard data.",
        });
      } finally {
        if (isMountedRef.current && seq === querySeqRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [activeFilters, dateRangeResolution, snapshot]
  );

  // Trigger query whenever active filters change
  useEffect(() => {
    void executeSnapshotQuery(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilters, dateRangeResolution.isValid]);

  const refresh = useCallback(async () => {
    await executeSnapshotQuery(true);
  }, [executeSnapshotQuery]);

  const resetFilters = useCallback(() => {
    setDatePreset("all");
    setCustomDateFrom("");
    setCustomDateTo("");
    setProviderFilter("");
    setModelFilter("");
    setOutcomeFilter("");
    setEventTypeFilter("");
  }, []);

  const freshness = useMemo(
    () =>
      resolveTelemetryFreshnessStatus(
        lastUpdatedAtMs,
        loading,
        Boolean(error)
      ),
    [lastUpdatedAtMs, loading, error]
  );

  return {
    // Filters
    datePreset,
    customDateFrom,
    customDateTo,
    providerFilter,
    modelFilter,
    outcomeFilter,
    eventTypeFilter,
    hasActiveFilters,
    dateRangeLabel: dateRangeResolution.label,
    dateRangeValidationError: dateRangeResolution.validationError,
    timeBucket: dateRangeResolution.timeBucket,

    // Snapshot & lifecycle
    snapshot,
    loading,
    refreshing,
    error,
    clearError: () => setError(null),
    lastUpdatedAtMs,
    isStale,
    freshness,

    // Actions
    setDatePreset,
    setCustomDateFrom,
    setCustomDateTo,
    setProviderFilter,
    setModelFilter,
    setOutcomeFilter,
    setEventTypeFilter,
    resetFilters,
    refresh,
  };
}

