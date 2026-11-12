/**
 * TelemetryFinancialMethodologySection — Step 43
 *
 * Displays financial data coverage metrics, explicit denominators, deduplication
 * counts, and the Methodology & Certainty Disclosure panel explaining:
 * - Token Usage Accounting (Logical requests vs physical execution attempts)
 * - Recorded Actual Cost vs Catalog-Estimated Cost
 * - Baseline & Routing Savings Methodology (Token-Equivalent Method B)
 * - Why some records may be excluded (missing tokens, missing cost, or unpriced baseline)
 */

import React from "react";
import type { TelemetryFinancialAnalytics } from "../types";
import { ShieldCheck, Info } from "lucide-react";

interface TelemetryFinancialMethodologySectionProps {
  analytics: TelemetryFinancialAnalytics;
}

export const TelemetryFinancialMethodologySection: React.FC<
  TelemetryFinancialMethodologySectionProps
> = ({ analytics }) => {
  const {
    coverage,
    baselineSummary: baseline,
    tokenSummary,
    actualCostSummary,
    savingsSummary,
  } = analytics;

  return (
    <section
      className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 space-y-5"
      aria-label="Financial Coverage & Savings Methodology"
      data-testid="telemetry-financial-methodology-section"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-slate-200">
            Financial Data Coverage &amp; Savings Methodology Disclosure
          </h3>
        </div>
        <span className="text-xs text-slate-400 font-mono">
          {coverage.totalLogicalRequests.toLocaleString()} logical requests ·{" "}
          {coverage.totalPhysicalAttempts.toLocaleString()} physical attempts
        </span>
      </div>

      {/* Coverage Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div
          className="bg-slate-950/60 border border-slate-800/70 rounded-lg p-3"
          data-testid="coverage-card-tokens"
        >
          <div className="text-xs text-slate-400 mb-1">
            Complete Token Coverage
          </div>
          <div className="text-lg font-bold text-cyan-300 font-mono">
            {coverage.tokenCoveragePercent !== null
              ? `${coverage.tokenCoveragePercent.toFixed(1)}%`
              : "Unavailable"}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {coverage.tokenCoverageCount.toLocaleString()} of{" "}
            {coverage.totalPhysicalAttempts.toLocaleString()} attempts (
            {tokenSummary.missingTokenRecordsCount.toLocaleString()} missing)
          </div>
        </div>

        <div
          className="bg-slate-950/60 border border-slate-800/70 rounded-lg p-3"
          data-testid="coverage-card-cost"
        >
          <div className="text-xs text-slate-400 mb-1">
            Known Cost Coverage
          </div>
          <div className="text-lg font-bold text-emerald-300 font-mono">
            {coverage.costCoveragePercent !== null
              ? `${coverage.costCoveragePercent.toFixed(1)}%`
              : "Unavailable"}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {coverage.costCoverageCount.toLocaleString()} known (
            {actualCostSummary.zeroCostAttemptCount.toLocaleString()} $0.00) ·{" "}
            {actualCostSummary.missingCostAttemptCount.toLocaleString()}{" "}
            unavailable
          </div>
        </div>

        <div
          className="bg-slate-950/60 border border-slate-800/70 rounded-lg p-3"
          data-testid="coverage-card-savings"
        >
          <div className="text-xs text-slate-400 mb-1">
            Savings Comparison Coverage
          </div>
          <div className="text-lg font-bold text-teal-300 font-mono">
            {coverage.savingsCoveragePercent !== null
              ? `${coverage.savingsCoveragePercent.toFixed(1)}%`
              : "Unavailable"}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {savingsSummary.eligibleRecordCount.toLocaleString()} eligible ·{" "}
            {savingsSummary.ineligibleRecordCount.toLocaleString()} excluded
          </div>
        </div>

        <div
          className="bg-slate-950/60 border border-slate-800/70 rounded-lg p-3"
          data-testid="coverage-card-deduplication"
        >
          <div className="text-xs text-slate-400 mb-1">
            Execution Event Deduplication
          </div>
          <div className="text-lg font-bold text-slate-200 font-mono">
            {tokenSummary.duplicateOrIntermediateEventsExcluded.toLocaleString()}{" "}
            filtered
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Intermediate stream &amp; non-execution events excluded from billing
          </div>
        </div>
      </div>

      {/* Methodology & Certainty Disclosure */}
      <div
        className="bg-slate-950/50 border border-slate-800/60 rounded-lg p-4 text-xs text-slate-300 space-y-2"
        data-testid="telemetry-methodology-disclosure"
      >
        <div className="flex items-center gap-1.5 font-semibold text-slate-200">
          <Info className="w-3.5 h-3.5 text-cyan-400" />
          <span>Methodology &amp; Certainty Disclosure</span>
        </div>
        <ul className="list-disc list-inside space-y-1 text-slate-400 leading-relaxed">
          <li>
            <strong className="text-slate-300">
              Recorded Actual Cost vs. Unavailable Cost:
            </strong>{" "}
            Confirmed zero cost (<code className="text-emerald-300">$0.00</code>
            , such as local SLM inference) is strictly distinguished from
            missing or unrecorded cost (
            <code className="text-slate-300">Cost unavailable</code>). Missing
            values are never coerced to zero.
          </li>
          <li>
            <strong className="text-slate-300">
              Token-Equivalent Baseline Estimate ({baseline.methodologyLabel}):
            </strong>{" "}
            Baseline cost estimates what each eligible request would have cost
            on{" "}
            <span className="text-slate-200 font-medium">
              {baseline.baselineProviderDisplayName} /{" "}
              {baseline.baselineModelDisplayName}
            </span>{" "}
            using the request&apos;s recorded input and output tokens and the
            versioned model pricing table active at the historical execution
            timestamp.
          </li>
          <li>
            <strong className="text-slate-300">
              Retry, Failover &amp; Stream Deduplication:
            </strong>{" "}
            Physical execution attempts (including retries and failovers)
            contribute to actual token burn and actual spend, while intermediate{" "}
            <code>routing_decision</code> and non-final{" "}
            <code>stream_lifecycle</code> events are excluded so tokens and
            costs are never double-counted.
          </li>
          <li>
            <strong className="text-slate-300">
              Negative Savings Preserved:
            </strong>{" "}
            When routing selects a higher-cost specialist or reasoning model
            that costs more than the baseline, negative savings are preserved and
            reported transparently as{" "}
            <span className="text-amber-300 font-medium">Above baseline</span>.
          </li>
        </ul>
      </div>
    </section>
  );
};
