/**
 * TelemetryFinancialBreakdownSection — Step 43
 *
 * Displays Provider and Model financial breakdowns:
 * - Provider Cost & Savings Breakdown (actual cost, cost share, avg cost, savings vs baseline)
 * - Model Cost & Savings Breakdown (with History Explorer cross-link)
 * - Provider Token Burn Breakdown (input, output, total tokens, token share, avg tokens per attempt)
 * - Model Token Burn Breakdown (with History Explorer cross-link)
 */

import React from "react";
import type {
  TelemetryProviderCostSummary,
  TelemetryModelCostSummary,
  TelemetryProviderTokenSummary,
  TelemetryModelTokenSummary,
} from "../types";
import {
  formatCompactTokens,
  formatExactTokens,
  formatUsdCurrency,
} from "../../../services/ipc/pricing";
import { DollarSign, Cpu, ExternalLink, Coins } from "lucide-react";

interface TelemetryFinancialBreakdownSectionProps {
  providerCosts: TelemetryProviderCostSummary[];
  modelCosts: TelemetryModelCostSummary[];
  providerTokens: TelemetryProviderTokenSummary[];
  modelTokens: TelemetryModelTokenSummary[];
  onViewHistory: (providerId?: string, modelId?: string) => void;
}

export const TelemetryFinancialBreakdownSection: React.FC<
  TelemetryFinancialBreakdownSectionProps
> = ({
  providerCosts,
  modelCosts,
  providerTokens,
  modelTokens,
  onViewHistory,
}) => {
  return (
    <div
      className="space-y-6"
      data-testid="telemetry-financial-breakdown-section"
    >
      {/* Provider & Model Cost + Savings Breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Provider Cost & Savings Table */}
        <section
          className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5"
          aria-label="Provider Cost & Savings Breakdown"
          data-testid="telemetry-provider-cost-table"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-slate-200">
                Cost &amp; Savings by Provider
              </h3>
            </div>
            <span className="text-xs text-slate-400">
              {providerCosts.length} provider
              {providerCosts.length === 1 ? "" : "s"}
            </span>
          </div>

          {providerCosts.length === 0 ? (
            <div className="h-28 flex items-center justify-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
              No provider cost records in selected filter window
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="py-2 pr-2 font-medium">Provider</th>
                    <th className="py-2 px-2 font-medium text-right">
                      Attempts
                    </th>
                    <th className="py-2 px-2 font-medium text-right">
                      Actual Cost
                    </th>
                    <th className="py-2 px-2 font-medium text-right">Share</th>
                    <th className="py-2 px-2 font-medium text-right">
                      Avg / Attempt
                    </th>
                    <th className="py-2 pl-2 font-medium text-right">
                      Savings vs Baseline
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {providerCosts.map((row) => {
                    const isNegative =
                      row.estimatedSavingsUsd !== null &&
                      row.estimatedSavingsUsd < 0;
                    return (
                      <tr
                        key={row.providerId}
                        className="hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-2.5 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-200">
                              {row.displayName}
                            </span>
                            {!row.isHistoricalOrUnrecorded &&
                              row.providerId !== "unassigned" && (
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
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-slate-300">
                          {row.attemptCount.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-emerald-300">
                          {row.actualCostUsd !== null
                            ? formatUsdCurrency(row.actualCostUsd)
                            : "Unavailable"}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-slate-400">
                          {row.shareOfTotalCostPercent !== null
                            ? `${row.shareOfTotalCostPercent.toFixed(1)}%`
                            : "—"}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-slate-300">
                          {row.averageCostPerEligibleAttemptUsd !== null
                            ? formatUsdCurrency(
                                row.averageCostPerEligibleAttemptUsd
                              )
                            : "—"}
                        </td>
                        <td
                          className={`py-2.5 pl-2 text-right font-mono ${
                            row.estimatedSavingsUsd === null
                              ? "text-slate-500"
                              : isNegative
                                ? "text-amber-300"
                                : "text-teal-300"
                          }`}
                        >
                          {row.estimatedSavingsUsd !== null
                            ? formatUsdCurrency(row.estimatedSavingsUsd)
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Model Cost & Savings Table */}
        <section
          className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5"
          aria-label="Model Cost & Savings Breakdown"
          data-testid="telemetry-model-cost-table"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-teal-400" />
              <h3 className="text-sm font-semibold text-slate-200">
                Cost &amp; Savings by Model
              </h3>
            </div>
            <span className="text-xs text-slate-400">
              {modelCosts.length} model{modelCosts.length === 1 ? "" : "s"}
            </span>
          </div>

          {modelCosts.length === 0 ? (
            <div className="h-28 flex items-center justify-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
              No model cost records in selected filter window
            </div>
          ) : (
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="py-2 pr-2 font-medium">Model</th>
                    <th className="py-2 px-2 font-medium text-right">
                      Actual Cost
                    </th>
                    <th className="py-2 px-2 font-medium text-right">
                      Avg / Attempt
                    </th>
                    <th className="py-2 px-2 font-medium text-right">Share</th>
                    <th className="py-2 pl-2 font-medium text-right">
                      Savings vs Baseline
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {modelCosts.map((row) => {
                    const isNegative =
                      row.estimatedSavingsUsd !== null &&
                      row.estimatedSavingsUsd < 0;
                    return (
                      <tr
                        key={`${row.providerId}::${row.modelId}`}
                        className="hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-2.5 pr-2">
                          <div className="flex items-center gap-1.5">
                            <div>
                              <div className="font-mono text-slate-200 truncate max-w-[180px]">
                                {row.modelId}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {row.providerDisplayName}
                              </div>
                            </div>
                            {!row.isHistoricalOrUnrecorded &&
                              row.modelId !== "unassigned" && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onViewHistory(
                                      row.providerId !== "unassigned"
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
                        <td className="py-2.5 px-2 text-right font-mono text-emerald-300">
                          {row.actualCostUsd !== null
                            ? formatUsdCurrency(row.actualCostUsd)
                            : "Unavailable"}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-slate-300">
                          {row.averageCostPerEligibleAttemptUsd !== null
                            ? formatUsdCurrency(
                                row.averageCostPerEligibleAttemptUsd
                              )
                            : "—"}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono text-slate-400">
                          {row.shareOfTotalCostPercent !== null
                            ? `${row.shareOfTotalCostPercent.toFixed(1)}%`
                            : "—"}
                        </td>
                        <td
                          className={`py-2.5 pl-2 text-right font-mono ${
                            row.estimatedSavingsUsd === null
                              ? "text-slate-500"
                              : isNegative
                                ? "text-amber-300"
                                : "text-teal-300"
                          }`}
                        >
                          {row.estimatedSavingsUsd !== null
                            ? formatUsdCurrency(row.estimatedSavingsUsd)
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Provider & Model Token Burn Breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Provider Token Burn Table */}
        <section
          className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5"
          aria-label="Provider Token Burn Breakdown"
          data-testid="telemetry-provider-token-table"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-slate-200">
                Token Burn by Provider
              </h3>
            </div>
            <span className="text-xs text-slate-400">
              Input / Output / Complete Total
            </span>
          </div>

          {providerTokens.length === 0 ? (
            <div className="h-28 flex items-center justify-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
              No provider token records in selected filter window
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="py-2 pr-2 font-medium">Provider</th>
                    <th className="py-2 px-2 font-medium text-right">
                      Input Tok
                    </th>
                    <th className="py-2 px-2 font-medium text-right">
                      Output Tok
                    </th>
                    <th className="py-2 px-2 font-medium text-right">
                      Total Tok
                    </th>
                    <th className="py-2 px-2 font-medium text-right">Share</th>
                    <th className="py-2 pl-2 font-medium text-right">
                      Attempts
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {providerTokens.map((row) => (
                    <tr
                      key={row.providerId}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 pr-2 font-medium text-slate-200">
                        {row.displayName}
                      </td>
                      <td
                        className="py-2.5 px-2 text-right font-mono text-cyan-300"
                        title={formatExactTokens(row.inputTokens)}
                      >
                        {formatCompactTokens(row.inputTokens)}
                      </td>
                      <td
                        className="py-2.5 px-2 text-right font-mono text-indigo-300"
                        title={formatExactTokens(row.outputTokens)}
                      >
                        {formatCompactTokens(row.outputTokens)}
                      </td>
                      <td
                        className="py-2.5 px-2 text-right font-mono text-slate-200"
                        title={formatExactTokens(row.totalTokens)}
                      >
                        {formatCompactTokens(row.totalTokens)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-400">
                        {row.shareOfTotalTokensPercent !== null
                          ? `${row.shareOfTotalTokensPercent.toFixed(1)}%`
                          : "—"}
                      </td>
                      <td className="py-2.5 pl-2 text-right font-mono text-slate-300">
                        {row.attemptCount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Model Token Burn Table */}
        <section
          className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5"
          aria-label="Model Token Burn Breakdown"
          data-testid="telemetry-model-token-table"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-slate-200">
                Token Burn by Model
              </h3>
            </div>
            <span className="text-xs text-slate-400">
              {modelTokens.length} model{modelTokens.length === 1 ? "" : "s"}
            </span>
          </div>

          {modelTokens.length === 0 ? (
            <div className="h-28 flex items-center justify-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
              No model token records in selected filter window
            </div>
          ) : (
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="py-2 pr-2 font-medium">Model</th>
                    <th className="py-2 px-2 font-medium text-right">
                      Input Tok
                    </th>
                    <th className="py-2 px-2 font-medium text-right">
                      Output Tok
                    </th>
                    <th className="py-2 px-2 font-medium text-right">
                      Total Tok
                    </th>
                    <th className="py-2 pl-2 font-medium text-right">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {modelTokens.map((row) => (
                    <tr
                      key={`${row.providerId}::${row.modelId}`}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 pr-2">
                        <div className="font-mono text-slate-200 truncate max-w-[190px]">
                          {row.modelId}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {row.providerDisplayName}
                        </div>
                      </td>
                      <td
                        className="py-2.5 px-2 text-right font-mono text-cyan-300"
                        title={formatExactTokens(row.inputTokens)}
                      >
                        {formatCompactTokens(row.inputTokens)}
                      </td>
                      <td
                        className="py-2.5 px-2 text-right font-mono text-indigo-300"
                        title={formatExactTokens(row.outputTokens)}
                      >
                        {formatCompactTokens(row.outputTokens)}
                      </td>
                      <td
                        className="py-2.5 px-2 text-right font-mono text-slate-200"
                        title={formatExactTokens(row.totalTokens)}
                      >
                        {formatCompactTokens(row.totalTokens)}
                      </td>
                      <td className="py-2.5 pl-2 text-right font-mono text-slate-400">
                        {row.shareOfTotalTokensPercent !== null
                          ? `${row.shareOfTotalTokensPercent.toFixed(1)}%`
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
    </div>
  );
};
