/**
 * TelemetryLatencyDistributionTrendSection — Step 44
 *
 * Renders:
 * 1. Latency Distribution Histogram (8 bins from <100 ms to 10 s+ with sample count n,
 *    exact count & percentage tooltips, and accessible table fallback)
 * 2. Latency Trend Over Time Chart (Median P50 and P95 latency per hour/day bucket,
 *    with accessible table fallback)
 */

import React from "react";
import { BarChart2, TrendingUp } from "lucide-react";
import { formatLatencyMs } from "../../../services/ipc/telemetry.ts";
import { formatTimeSeriesBucketLabel } from "../timestamp.ts";
import type {
  TelemetryLatencyHistogram,
  TelemetryLatencyTrendPoint,
  TelemetryTimeBucket,
} from "../types.ts";

export interface TelemetryLatencyDistributionTrendSectionProps {
  distribution: TelemetryLatencyHistogram;
  timeSeries: TelemetryLatencyTrendPoint[];
  timeBucket: TelemetryTimeBucket;
}

export const TelemetryLatencyDistributionTrendSection: React.FC<
  TelemetryLatencyDistributionTrendSectionProps
> = ({ distribution, timeSeries, timeBucket }) => {
  const maxBinCount = Math.max(
    1,
    ...distribution.buckets.map((b) => b.count)
  );

  const maxTrendLatencyMs = Math.max(
    1,
    ...timeSeries.map((pt) =>
      Math.max(
        pt.p95LatencyMs ?? 0,
        pt.averageLatencyMs ?? 0,
        pt.medianLatencyMs ?? 0
      )
    )
  );

  return (
    <div
      className="grid grid-cols-1 xl:grid-cols-2 gap-6"
      data-testid="telemetry-latency-distribution-trend-section"
    >
      {/* 1. Latency Distribution Histogram */}
      <section
        className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5"
        aria-label="Latency Distribution Histogram"
        data-testid="telemetry-latency-histogram"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-slate-200">
              Execution Latency Distribution Histogram
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            n = {distribution.measuredSampleCount.toLocaleString()} valid
            observations
          </span>
        </div>

        {distribution.measuredSampleCount === 0 ? (
          <div className="h-44 flex items-center justify-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
            No valid latency measurements in selected filter window
          </div>
        ) : (
          <div className="space-y-2.5">
            {distribution.buckets.map((bucket) => {
              const widthPct = Math.max(
                bucket.count > 0 ? 3 : 0,
                Math.round((bucket.count / maxBinCount) * 100)
              );
              const pctLabel =
                bucket.percentage !== null
                  ? `${bucket.percentage.toFixed(1)}%`
                  : "0.0%";

              return (
                <div
                  key={bucket.bucketKey}
                  className="grid grid-cols-12 items-center gap-2 text-xs"
                  title={`${bucket.label}: ${bucket.count.toLocaleString()} executions (${pctLabel} of n=${distribution.measuredSampleCount.toLocaleString()})`}
                >
                  <div className="col-span-3 font-mono text-slate-300 truncate">
                    {bucket.label}
                  </div>
                  <div className="col-span-6 bg-slate-950/80 rounded-full h-3 overflow-hidden border border-slate-800/70">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500/80 to-cyan-400/80 rounded-full transition-all duration-200"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <div className="col-span-3 text-right font-mono text-slate-300">
                    {bucket.count.toLocaleString()}{" "}
                    <span className="text-slate-500">({pctLabel})</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Accessible Screen-Reader Table Fallback */}
        <table className="sr-only">
          <caption>
            Latency distribution across {distribution.measuredSampleCount} valid
            observations
          </caption>
          <thead>
            <tr>
              <th>Latency Range</th>
              <th>Executions</th>
              <th>Share</th>
            </tr>
          </thead>
          <tbody>
            {distribution.buckets.map((b) => (
              <tr key={b.bucketKey}>
                <td>{b.label}</td>
                <td>{b.count}</td>
                <td>
                  {b.percentage !== null ? `${b.percentage.toFixed(1)}%` : "0%"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 2. Latency Trend Over Time (Median P50 & P95) */}
      <section
        className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5"
        aria-label="Latency Over Time Trend"
        data-testid="telemetry-latency-trend-chart"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-slate-200">
              Latency Over Time ({timeBucket === "hour" ? "Hourly" : "Daily"}{" "}
              Median P50 &amp; P95)
            </h3>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-purple-400/85 inline-block" />
              Median (P50)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-teal-400/75 inline-block" />
              P95 (n &ge; 5)
            </span>
          </div>
        </div>

        {timeSeries.length === 0 ? (
          <div className="h-44 flex items-center justify-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
            No time-series latency data for the selected period
          </div>
        ) : (
          <div className="space-y-3">
            <div className="h-44 flex items-end gap-1.5 pt-4 pb-2 px-2 bg-slate-950/50 border border-slate-800/60 rounded-lg overflow-x-auto">
              {timeSeries.map((pt) => {
                const label = formatTimeSeriesBucketLabel(
                  pt.bucketStartMs,
                  timeBucket
                );
                const medH =
                  pt.medianLatencyMs !== null
                    ? Math.max(
                        6,
                        Math.round(
                          (pt.medianLatencyMs / maxTrendLatencyMs) * 120
                        )
                      )
                    : 0;
                const p95H =
                  pt.p95LatencyMs !== null
                    ? Math.max(
                        6,
                        Math.round((pt.p95LatencyMs / maxTrendLatencyMs) * 120)
                      )
                    : 0;

                return (
                  <div
                    key={pt.bucketStartMs}
                    className="flex-1 min-w-[36px] flex flex-col items-center gap-1 group"
                    title={`${label} (n=${pt.measuredCount}): Median ${formatLatencyMs(pt.medianLatencyMs, { exactMs: true })}, Mean ${formatLatencyMs(pt.averageLatencyMs, { exactMs: true })}, P95 ${formatLatencyMs(pt.p95LatencyMs, { exactMs: true })}`}
                  >
                    <div className="w-full flex items-end justify-center gap-0.5 h-[124px]">
                      <div
                        className="w-2.5 bg-purple-400/85 rounded-t transition-all"
                        style={{ height: `${medH}px` }}
                      />
                      {pt.p95LatencyMs !== null && (
                        <div
                          className="w-2.5 bg-teal-400/75 rounded-t transition-all"
                          style={{ height: `${p95H}px` }}
                        />
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 truncate max-w-[54px]">
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Accessible Tabular Summary */}
            <div className="overflow-x-auto max-h-36 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                    <th className="py-1.5 pr-2 font-medium">Bucket</th>
                    <th className="py-1.5 px-2 font-medium text-right">n</th>
                    <th className="py-1.5 px-2 font-medium text-right">
                      Median (P50)
                    </th>
                    <th className="py-1.5 px-2 font-medium text-right">
                      Average
                    </th>
                    <th className="py-1.5 pl-2 font-medium text-right">P95</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 font-mono">
                  {timeSeries.map((pt) => (
                    <tr key={pt.bucketStartMs}>
                      <td className="py-1.5 pr-2 text-slate-300">
                        {formatTimeSeriesBucketLabel(
                          pt.bucketStartMs,
                          timeBucket
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-right text-slate-400">
                        {pt.measuredCount.toLocaleString()}
                      </td>
                      <td className="py-1.5 px-2 text-right text-purple-300">
                        {formatLatencyMs(pt.medianLatencyMs)}
                      </td>
                      <td className="py-1.5 px-2 text-right text-indigo-300">
                        {formatLatencyMs(pt.averageLatencyMs)}
                      </td>
                      <td className="py-1.5 pl-2 text-right text-teal-300">
                        {formatLatencyMs(pt.p95LatencyMs)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

