/**
 * TelemetryPerformanceSummarySection — Step 44
 *
 * Renders Overview Performance & Latency KPI Cards:
 * 1. Measured Executions & Latency Coverage (n / eligible, coverage %, sample sufficiency badge)
 * 2. Median Latency (P50) & Interquartile Range (P25 - P75)
 * 3. Average Latency & Fastest / Slowest Recorded Executions (Min / Max)
 * 4. Tail Latency Percentiles (P90, P95, P99 with explicit small-sample safeguards)
 */

import React from "react";
import { Activity, Clock, Gauge, Layers } from "lucide-react";
import { formatLatencyMs } from "../../../services/ipc/telemetry.ts";
import type { TelemetryPerformanceAnalytics } from "../types.ts";

export interface TelemetryPerformanceSummarySectionProps {
  analytics: TelemetryPerformanceAnalytics;
}

export const TelemetryPerformanceSummarySection: React.FC<
  TelemetryPerformanceSummarySectionProps
> = ({ analytics }) => {
  const { summary } = analytics;
  const n = summary.measuredExecutions;

  const sufficiencyBadge = () => {
    if (summary.sampleSufficiency === "sufficient") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          Sufficient sample (n = {n.toLocaleString()})
        </span>
      );
    }
    if (summary.sampleSufficiency === "limited") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
          Limited sample (n = {n.toLocaleString()})
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
        No measured samples (n = 0)
      </span>
    );
  };

  return (
    <section
      className="space-y-4"
      aria-label="Execution Performance & Latency Overview"
      data-testid="telemetry-performance-summary-section"
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Gauge className="w-4 h-4 text-purple-400" />
            <span>Latency, Execution Performance &amp; Benchmark Analytics</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {summary.metricSemanticsLabel} · Population:{" "}
            <span className="text-slate-300 font-medium">
              {summary.populationLabel}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {sufficiencyBadge()}
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-slate-900 text-slate-300 border border-slate-800">
            Provenance: {summary.provenance}
          </span>
        </div>
      </div>

      {/* Limited Sample Banner (Section 101) */}
      {summary.sampleSufficiency === "limited" && (
        <div
          className="bg-amber-950/30 border border-amber-500/30 rounded-lg px-4 py-2.5 text-xs text-amber-200 flex items-center justify-between"
          data-testid="telemetry-limited-latency-sample-banner"
        >
          <span>
            <strong>Limited performance sample:</strong> Only{" "}
            {n.toLocaleString()} valid latency measurement
            {n === 1 ? " is" : "s are"} available for this selection. Tail
            percentiles require n &ge; 5 (P90/P95) and n &ge; 10 (P99).
          </span>
        </div>
      )}

      {/* 4 Headline Performance KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Measured Executions & Latency Coverage */}
        <div
          className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between"
          data-testid="perf-card-measured-executions"
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Measured Executions</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-100 font-mono">
              {n.toLocaleString()}
              <span className="text-sm font-normal text-slate-400 ml-1.5">
                / {summary.totalEligibleExecutions.toLocaleString()} eligible
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-2 flex items-center justify-between">
              <span>Latency Coverage:</span>
              <span className="font-mono text-cyan-300 font-medium">
                {summary.latencyCoveragePercent !== null
                  ? `${summary.latencyCoveragePercent.toFixed(1)}%`
                  : "Unavailable"}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {summary.missingLatencyCount.toLocaleString()} missing ·{" "}
              {summary.invalidLatencyCount.toLocaleString()} invalid rejected
            </div>
          </div>
        </div>

        {/* Card 2: Median Latency (P50) */}
        <div
          className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between"
          data-testid="perf-card-median-latency"
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Median Latency (P50)</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <div
              className="text-2xl font-bold text-purple-300 font-mono"
              title={formatLatencyMs(summary.medianLatencyMs, {
                exactMs: true,
              })}
            >
              {formatLatencyMs(summary.medianLatencyMs)}
            </div>
            <div className="text-xs text-slate-400 mt-2 flex items-center justify-between">
              <span>IQR (P25 – P75):</span>
              <span className="font-mono text-slate-300">
                {summary.p25LatencyMs !== null && summary.p75LatencyMs !== null
                  ? `${formatLatencyMs(summary.p25LatencyMs)} – ${formatLatencyMs(summary.p75LatencyMs)}`
                  : "Requires n ≥ 3"}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Typical midpoint of measured distribution (n ={" "}
              {n.toLocaleString()})
            </div>
          </div>
        </div>

        {/* Card 3: Average Latency & Min/Max Range */}
        <div
          className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between"
          data-testid="perf-card-average-latency"
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Average Latency (Mean)</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <div
              className="text-2xl font-bold text-indigo-300 font-mono"
              title={formatLatencyMs(summary.averageLatencyMs, {
                exactMs: true,
              })}
            >
              {formatLatencyMs(summary.averageLatencyMs)}
            </div>
            <div className="text-xs text-slate-400 mt-2 flex items-center justify-between">
              <span>Fastest / Slowest:</span>
              <span className="font-mono text-slate-300">
                {summary.minLatencyMs !== null && summary.maxLatencyMs !== null
                  ? `${formatLatencyMs(summary.minLatencyMs)} / ${formatLatencyMs(summary.maxLatencyMs)}`
                  : "Unavailable"}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Arithmetic mean across valid observations (outliers preserved)
            </div>
          </div>
        </div>

        {/* Card 4: P95 & P99 Tail Latency */}
        <div
          className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between"
          data-testid="perf-card-tail-percentiles"
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>P95 Tail Latency</span>
            <Gauge className="w-4 h-4 text-teal-400" />
          </div>
          <div>
            <div
              className="text-2xl font-bold text-teal-300 font-mono"
              title={formatLatencyMs(summary.p95LatencyMs, { exactMs: true })}
            >
              {summary.p95LatencyMs !== null
                ? formatLatencyMs(summary.p95LatencyMs)
                : n > 0
                  ? `Unavailable (n=${n}<5)`
                  : "Unavailable"}
            </div>
            <div className="text-xs text-slate-400 mt-2 flex items-center justify-between">
              <span>P90 / P99:</span>
              <span className="font-mono text-slate-300">
                {summary.p90LatencyMs !== null
                  ? formatLatencyMs(summary.p90LatencyMs)
                  : "—"}{" "}
                /{" "}
                {summary.p99LatencyMs !== null
                  ? formatLatencyMs(summary.p99LatencyMs)
                  : n > 0
                    ? `Unavailable (n<10)`
                    : "—"}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              95% of measured observations are at or below P95 (R-7 linear)
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

