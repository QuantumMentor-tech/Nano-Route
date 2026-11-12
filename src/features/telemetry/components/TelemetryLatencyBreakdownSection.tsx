/**
 * TelemetryLatencyBreakdownSection — Step 44
 *
 * Renders:
 * 1. Provider Latency Breakdown (Provider, Measured n / Eligible, Coverage, Median P50,
 *    Average, P95, P99, Min / Max, with History Explorer cross-link)
 * 2. Model Latency Breakdown (Model, Provider, Measured n, Median P50, Average, P95, P99,
 *    Min / Max, Coverage, with History Explorer cross-link)
 * 3. Outcome Latency Distribution (Success, Failure, Cancelled, Timeout, Rate Limited, etc.)
 *
 * Strictly descriptive (Section 29, 73): never labels any provider/model as "Best" or "Winner".
 */

import React from "react";
import { Cpu, ExternalLink, Server, ShieldAlert } from "lucide-react";
import { formatLatencyMs } from "../../../services/ipc/telemetry.ts";
import type {
  TelemetryModelLatencySummary,
  TelemetryOutcomeLatencySummary,
  TelemetryProviderLatencySummary,
} from "../types.ts";

export interface TelemetryLatencyBreakdownSectionProps {
  providers: TelemetryProviderLatencySummary[];
  models: TelemetryModelLatencySummary[];
  outcomes: TelemetryOutcomeLatencySummary[];
  onViewHistory: (providerId?: string, modelId?: string) => void;
}

export const TelemetryLatencyBreakdownSection: React.FC<
  TelemetryLatencyBreakdownSectionProps
> = ({ providers, models, outcomes, onViewHistory }) => {
  return (
    <div
      className="space-y-6"
      data-testid="telemetry-latency-breakdown-section"
    >
      {/* Provider & Model Latency Breakdowns */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Provider Latency Table */}
        <section
          className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5"
          aria-label="Provider Latency Breakdown"
          data-testid="telemetry-provider-latency-table"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-slate-200">
                Observed Latency by Provider
              </h3>
            </div>
            <span className="text-xs text-slate-400">
              {providers.length} provider{providers.length === 1 ? "" : "s"}
            </span>
          </div>

          {providers.length === 0 ? (
            <div className="h-28 flex items-center justify-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
              No provider latency records in selected filter window
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="py-2 pr-2 font-medium">Provider</th>
                    <th className="py-2 px-2 font-medium text-right">
                      n / Eligible
                    </th>
                    <th className="py-2 px-2 font-medium text-right">
                      Median (P50)
                    </th>
                    <th className="py-2 px-2 font-medium text-right">
                      Average
                    </th>
                    <th className="py-2 px-2 font-medium text-right">P95</th>
                    <th className="py-2 px-2 font-medium text-right">P99</th>
                    <th className="py-2 pl-2 font-medium text-right">
                      Min / Max
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {providers.map((row) => (
                    <tr
                      key={row.providerId}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-slate-200">
                            {row.displayName}
                          </span>
                          {row.sampleSufficiency === "limited" && (
                            <span
                              className="px-1.5 py-0.2 rounded text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30"
                              title="Limited sample (n < 5)"
                            >
                              Limited sample
                            </span>
                          )}
                          {!row.isHistoricalOrUnrecorded &&
                            row.providerId !== "unrecorded" && (
                              <button
                                type="button"
                                onClick={() => onViewHistory(row.providerId)}
                                className="text-slate-400 hover:text-cyan-400 transition-colors"
                                title={`Filter History Explorer by ${row.displayName}`}
                              >
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          Coverage:{" "}
                          {row.coveragePercent !== null
                            ? `${row.coveragePercent.toFixed(1)}%`
                            : "—"}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-300">
                        {row.measuredCount.toLocaleString()} /{" "}
                        {row.totalEligibleCount.toLocaleString()}
                      </td>
                      <td
                        className="py-2.5 px-2 text-right font-mono text-purple-300"
                        title={formatLatencyMs(row.medianLatencyMs, {
                          exactMs: true,
                        })}
                      >
                        {formatLatencyMs(row.medianLatencyMs)}
                      </td>
                      <td
                        className="py-2.5 px-2 text-right font-mono text-indigo-300"
                        title={formatLatencyMs(row.averageLatencyMs, {
                          exactMs: true,
                        })}
                      >
                        {formatLatencyMs(row.averageLatencyMs)}
                      </td>
                      <td
                        className="py-2.5 px-2 text-right font-mono text-teal-300"
                        title={formatLatencyMs(row.p95LatencyMs, {
                          exactMs: true,
                        })}
                      >
                        {formatLatencyMs(row.p95LatencyMs)}
                      </td>
                      <td
                        className="py-2.5 px-2 text-right font-mono text-slate-300"
                        title={formatLatencyMs(row.p99LatencyMs, {
                          exactMs: true,
                        })}
                      >
                        {formatLatencyMs(row.p99LatencyMs)}
                      </td>
                      <td className="py-2.5 pl-2 text-right font-mono text-slate-400">
                        {row.minLatencyMs !== null && row.maxLatencyMs !== null
                          ? `${formatLatencyMs(row.minLatencyMs)} / ${formatLatencyMs(row.maxLatencyMs)}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Model Latency Table */}
        <section
          className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5"
          aria-label="Model Latency Breakdown"
          data-testid="telemetry-model-latency-table"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-slate-200">
                Observed Latency by Model
              </h3>
            </div>
            <span className="text-xs text-slate-400">
              {models.length} model{models.length === 1 ? "" : "s"}
            </span>
          </div>

          {models.length === 0 ? (
            <div className="h-28 flex items-center justify-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
              No model latency records in selected filter window
            </div>
          ) : (
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="py-2 pr-2 font-medium">Model</th>
                    <th className="py-2 px-2 font-medium text-right">n</th>
                    <th className="py-2 px-2 font-medium text-right">
                      Median (P50)
                    </th>
                    <th className="py-2 px-2 font-medium text-right">
                      Average
                    </th>
                    <th className="py-2 px-2 font-medium text-right">P95</th>
                    <th className="py-2 px-2 font-medium text-right">P99</th>
                    <th className="py-2 pl-2 font-medium text-right">
                      Min / Max
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {models.map((row) => (
                    <tr
                      key={`${row.providerId}::${row.modelId}`}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 pr-2">
                        <div className="flex items-center gap-1.5">
                          <div>
                            <div className="font-mono text-slate-200 truncate max-w-[175px]">
                              {row.modelId}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {row.providerDisplayName}
                              {row.coveragePercent !== null
                                ? ` · ${row.coveragePercent.toFixed(0)}% cov`
                                : ""}
                            </div>
                          </div>
                          {!row.isHistoricalOrUnrecorded &&
                            row.modelId !== "Not recorded" && (
                              <button
                                type="button"
                                onClick={() =>
                                  onViewHistory(
                                    row.providerId !== "unrecorded"
                                      ? row.providerId
                                      : undefined,
                                    row.modelId
                                  )
                                }
                                className="text-slate-400 hover:text-cyan-400 transition-colors"
                                title={`Filter History Explorer by ${row.modelId}`}
                              >
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            )}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-300">
                        {row.measuredCount.toLocaleString()}
                      </td>
                      <td
                        className="py-2.5 px-2 text-right font-mono text-purple-300"
                        title={formatLatencyMs(row.medianLatencyMs, {
                          exactMs: true,
                        })}
                      >
                        {formatLatencyMs(row.medianLatencyMs)}
                      </td>
                      <td
                        className="py-2.5 px-2 text-right font-mono text-indigo-300"
                        title={formatLatencyMs(row.averageLatencyMs, {
                          exactMs: true,
                        })}
                      >
                        {formatLatencyMs(row.averageLatencyMs)}
                      </td>
                      <td
                        className="py-2.5 px-2 text-right font-mono text-teal-300"
                        title={formatLatencyMs(row.p95LatencyMs, {
                          exactMs: true,
                        })}
                      >
                        {formatLatencyMs(row.p95LatencyMs)}
                      </td>
                      <td
                        className="py-2.5 px-2 text-right font-mono text-slate-300"
                        title={formatLatencyMs(row.p99LatencyMs, {
                          exactMs: true,
                        })}
                      >
                        {formatLatencyMs(row.p99LatencyMs)}
                      </td>
                      <td className="py-2.5 pl-2 text-right font-mono text-slate-400">
                        {row.minLatencyMs !== null && row.maxLatencyMs !== null
                          ? `${formatLatencyMs(row.minLatencyMs)} / ${formatLatencyMs(row.maxLatencyMs)}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Outcome Latency Breakdown (Success vs Failed vs Cancelled vs Timeout vs Rate Limited) */}
      <section
        className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5"
        aria-label="Latency by Execution Outcome"
        data-testid="telemetry-outcome-latency-table"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-slate-200">
              Latency Distribution by Execution Outcome Population
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Separates successful, failed, cancelled, timeout &amp; rate-limited
            populations
          </span>
        </div>

        {outcomes.length === 0 ? (
          <div className="h-20 flex items-center justify-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
            No outcome latency records in selected filter window
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="py-2 pr-2 font-medium">Outcome Population</th>
                  <th className="py-2 px-2 font-medium text-right">
                    Measured (n / Total)
                  </th>
                  <th className="py-2 px-2 font-medium text-right">
                    Median (P50)
                  </th>
                  <th className="py-2 px-2 font-medium text-right">Average</th>
                  <th className="py-2 px-2 font-medium text-right">
                    P95 (n &ge; 5)
                  </th>
                  <th className="py-2 pl-2 font-medium text-right">
                    Fastest / Slowest
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {outcomes.map((row) => (
                  <tr
                    key={row.outcome}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-2 pr-2 font-sans font-medium text-slate-200">
                      {row.displayLabel}{" "}
                      <span className="text-slate-500 font-mono text-[11px]">
                        ({row.outcome})
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right text-slate-300">
                      {row.measuredCount.toLocaleString()} /{" "}
                      {row.totalCount.toLocaleString()}
                    </td>
                    <td className="py-2 px-2 text-right text-purple-300">
                      {formatLatencyMs(row.medianLatencyMs)}
                    </td>
                    <td className="py-2 px-2 text-right text-indigo-300">
                      {formatLatencyMs(row.averageLatencyMs)}
                    </td>
                    <td className="py-2 px-2 text-right text-teal-300">
                      {formatLatencyMs(row.p95LatencyMs)}
                    </td>
                    <td className="py-2 pl-2 text-right text-slate-400">
                      {row.minLatencyMs !== null && row.maxLatencyMs !== null
                        ? `${formatLatencyMs(row.minLatencyMs)} / ${formatLatencyMs(row.maxLatencyMs)}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

