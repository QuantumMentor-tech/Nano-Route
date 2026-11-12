/**
 * TelemetryExecutionLifecycleTimingSection — Step 44
 *
 * Renders:
 * 1. Logical Request vs. Physical Attempt & Retry/Failover Latency Analysis
 *    (Initial attempt vs Retry/Failover attempts vs Logical Cumulative Duration)
 * 2. Local Routing Overhead & Streaming Performance Summary
 *    (Routing decision overhead, SLM sub-stage provenance, Stream completion latency, TTFT provenance)
 * 3. Performance Data Quality & Request Mix Disclosure Panel
 */

import React from "react";
import { GitCommit, Info, Radio, ShieldCheck, Zap } from "lucide-react";
import { formatLatencyMs } from "../../../services/ipc/telemetry.ts";
import type { TelemetryPerformanceAnalytics } from "../types.ts";

export interface TelemetryExecutionLifecycleTimingSectionProps {
  analytics: TelemetryPerformanceAnalytics;
}

export const TelemetryExecutionLifecycleTimingSection: React.FC<
  TelemetryExecutionLifecycleTimingSectionProps
> = ({ analytics }) => {
  const {
    logicalVsPhysical: lvp,
    routingOverhead,
    streamingPerformance,
    dataQuality,
  } = analytics;

  return (
    <div
      className="space-y-6"
      data-testid="telemetry-execution-lifecycle-timing-section"
    >
      {/* Logical vs Physical Latency + Routing Overhead & Streaming Performance */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* 1. Logical Request vs Physical Attempt & Retry/Failover Latency */}
        <section
          className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 space-y-4"
          aria-label="Logical vs Physical & Retry/Failover Latency"
          data-testid="telemetry-logical-vs-physical-latency"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitCommit className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-slate-200">
                Logical Request vs. Physical Attempt &amp; Retry/Failover
                Latency
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {lvp.measuredLogicalRequests.toLocaleString()} /{" "}
              {lvp.totalLogicalRequests.toLocaleString()} logical requests
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-950/60 border border-slate-800/70 rounded-lg p-3">
              <div className="text-slate-400 mb-1">
                Logical Cumulative Latency
              </div>
              <div className="text-base font-bold text-purple-300 font-mono">
                {formatLatencyMs(lvp.logicalCumulativeMedianLatencyMs)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 font-mono">
                Mean: {formatLatencyMs(lvp.logicalCumulativeAverageLatencyMs)} ·
                P95: {formatLatencyMs(lvp.logicalCumulativeP95LatencyMs)}
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/70 rounded-lg p-3">
              <div className="text-slate-400 mb-1">
                Initial Attempt (n ={" "}
                {lvp.initialAttemptMeasuredCount.toLocaleString()})
              </div>
              <div className="text-base font-bold text-cyan-300 font-mono">
                {formatLatencyMs(lvp.initialAttemptMedianLatencyMs)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 font-mono">
                Mean: {formatLatencyMs(lvp.initialAttemptAverageLatencyMs)} ·
                Single-attempt:{" "}
                {lvp.singleAttemptLogicalRequests.toLocaleString()}
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/70 rounded-lg p-3">
              <div className="text-slate-400 mb-1">
                Retry / Failover Attempts (n ={" "}
                {lvp.retryOrFailoverAttemptMeasuredCount.toLocaleString()})
              </div>
              <div className="text-base font-bold text-teal-300 font-mono">
                {formatLatencyMs(lvp.retryOrFailoverAttemptMedianLatencyMs)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 font-mono">
                Multi-attempt reqs:{" "}
                {lvp.multiAttemptLogicalRequests.toLocaleString()} (Med:{" "}
                {formatLatencyMs(lvp.multiAttemptMedianLatencyMs)})
              </div>
            </div>
          </div>
        </section>

        {/* 2. Local Routing Overhead & Streaming Performance */}
        <section
          className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 space-y-4"
          aria-label="Routing Overhead & Streaming Performance"
          data-testid="telemetry-routing-streaming-performance"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-slate-200">
                Routing Overhead &amp; Streaming Startup / Completion
              </h3>
            </div>
            <Radio className="w-4 h-4 text-teal-400" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Routing Overhead Card */}
            <div className="bg-slate-950/60 border border-slate-800/70 rounded-lg p-3">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span>Local Routing Decision Overhead</span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                  {routingOverhead.provenance}
                </span>
              </div>
              <div className="text-base font-bold text-cyan-300 font-mono">
                {routingOverhead.measuredRoutingEvents > 0
                  ? formatLatencyMs(routingOverhead.medianRoutingLatencyMs)
                  : "Unavailable for historical records"}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {routingOverhead.measuredRoutingEvents.toLocaleString()} of{" "}
                {routingOverhead.totalRoutingEvents.toLocaleString()} routing
                events measured · Mean:{" "}
                {formatLatencyMs(routingOverhead.averageRoutingLatencyMs)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                {routingOverhead.slmClassificationNote}
              </div>
            </div>

            {/* Streaming Performance Card */}
            <div className="bg-slate-950/60 border border-slate-800/70 rounded-lg p-3">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span>Stream Completion Latency</span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                  {streamingPerformance.completionProvenance}
                </span>
              </div>
              <div className="text-base font-bold text-teal-300 font-mono">
                {streamingPerformance.measuredStreamingCompletionCount > 0
                  ? formatLatencyMs(
                      streamingPerformance.medianStreamCompletionLatencyMs
                    )
                  : "Unavailable"}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                n ={" "}
                {streamingPerformance.measuredStreamingCompletionCount.toLocaleString()}{" "}
                streams · P95:{" "}
                {formatLatencyMs(
                  streamingPerformance.p95StreamCompletionLatencyMs
                )}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                TTFT:{" "}
                <span className="text-slate-400 font-mono">
                  Unavailable ({streamingPerformance.ttftProvenance})
                </span>{" "}
                — {streamingPerformance.ttftMethodologyNote}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 3. Performance Data Quality & Request Mix Disclosure Panel */}
      <section
        className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 space-y-4"
        aria-label="Performance Data Quality & Methodology Disclosure"
        data-testid="telemetry-latency-data-quality-section"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-200">
              Performance Data Quality &amp; Request Mix Disclosure
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {dataQuality.validLatencyRecords.toLocaleString()} valid ·{" "}
            {dataQuality.missingLatencyRecords.toLocaleString()} missing ·{" "}
            {dataQuality.invalidLatencyRecords.toLocaleString()} invalid ·{" "}
            {dataQuality.distinctProvidersCount} providers ·{" "}
            {dataQuality.distinctModelsCount} models
          </span>
        </div>

        <div className="bg-slate-950/50 border border-slate-800/60 rounded-lg p-4 text-xs text-slate-300 space-y-2">
          <div className="flex items-center gap-1.5 font-semibold text-slate-200">
            <Info className="w-3.5 h-3.5 text-purple-400" />
            <span>
              Measurement Semantics, Percentile Methodology &amp; Interpretation
              Boundaries
            </span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-slate-400 leading-relaxed">
            <li>
              <strong className="text-slate-300">
                Monotonic Attempt Duration (<code>latency_ms</code>):
              </strong>{" "}
              Measures observed provider attempt duration using{" "}
              <code>std::time::Instant</code> from outbound provider dispatch to
              response/stream completion, including network transit, provider
              queueing, and generation time.
            </li>
            <li>
              <strong className="text-slate-300">
                Percentile &amp; Sample-Size Rules:
              </strong>{" "}
              Percentiles use deterministic inclusive linear interpolation
              (R-7). To prevent statistical fabrication on small samples,{" "}
              <code>P25/P75</code> require <code>n &ge; 3</code>,{" "}
              <code>P90/P95</code> require <code>n &ge; 5</code>, and{" "}
              <code>P99</code> requires <code>n &ge; 10</code>. Outliers are
              preserved in full.
            </li>
            <li>
              <strong className="text-slate-300">
                Request Mix &amp; Descriptive Neutrality:
              </strong>{" "}
              Observed latency depends on prompt length, completion token count,
              task complexity, streaming mode, and network conditions. Lower
              measured latency is descriptive of the selected historical sample
              and does not automatically imply higher model quality or a global
              recommendation.
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
};

