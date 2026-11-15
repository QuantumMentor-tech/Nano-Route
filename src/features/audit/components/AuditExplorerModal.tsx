/**
 * Nano Route — Local Audit Trail & Activity Review Modal
 * File: src/features/audit/components/AuditExplorerModal.tsx
 *
 * Implements Step 89:
 * - Searchable, filterable audit event explorer
 * - Metric cards: Total events, Security events, Warning/Errors, Success Rate
 * - Detailed event inspection view with correlation IDs and safe metadata
 * - Sanitized JSON export and retention cleanup controls
 * - Fully accessible dark obsidian interface
 */

import React, { useState, useEffect } from "react";
import {
  X,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  Download,
  Trash2,
  Clock,
  FileText,
  Activity,
  ArrowRight,
  Info,
  Server,
} from "lucide-react";
import {
  queryAuditEvents,
  getAuditSummaryMetrics,
  exportAuditEvents,
  clearAuditEvents,
  subscribeToAuditEvents,
} from "../engine.ts";
import type {
  AuditEvent,
  AuditEventCategory,
  AuditEventSeverity,
  AuditEventOutcome,
  AuditFilterCriteria,
  AuditSummaryMetrics,
} from "../types.ts";

export interface AuditExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToPrivacyCenter?: () => void;
  onNavigateToSettings?: () => void;
  onNavigateToRequestInspector?: () => void;
}

export const AuditExplorerModal: React.FC<AuditExplorerModalProps> = ({
  isOpen,
  onClose,
  onNavigateToPrivacyCenter,
  onNavigateToSettings,
  onNavigateToRequestInspector,
}) => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [metrics, setMetrics] = useState<AuditSummaryMetrics | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<AuditEventCategory | "ALL">("ALL");
  const [selectedSeverity, setSelectedSeverity] = useState<AuditEventSeverity | "ALL">("ALL");
  const [selectedOutcome, setSelectedOutcome] = useState<AuditEventOutcome | "ALL">("ALL");
  const [dateRange, setDateRange] = useState<"ALL" | "TODAY" | "7D" | "30D">("ALL");

  const [confirmClear, setConfirmClear] = useState(false);

  const loadData = () => {
    let startDateMs: number | undefined;
    const now = Date.now();
    if (dateRange === "TODAY") {
      startDateMs = now - 24 * 60 * 60 * 1000;
    } else if (dateRange === "7D") {
      startDateMs = now - 7 * 24 * 60 * 60 * 1000;
    } else if (dateRange === "30D") {
      startDateMs = now - 30 * 24 * 60 * 60 * 1000;
    }

    const criteria: AuditFilterCriteria = {
      searchQuery: searchQuery.trim() || undefined,
      category: selectedCategory !== "ALL" ? selectedCategory : undefined,
      severity: selectedSeverity !== "ALL" ? selectedSeverity : undefined,
      outcome: selectedOutcome !== "ALL" ? selectedOutcome : undefined,
      startDateMs,
      limit: 100,
    };

    const res = queryAuditEvents(criteria);
    setEvents(res.events);
    setTotalCount(res.totalCount);
    setMetrics(getAuditSummaryMetrics());
  };

  useEffect(() => {
    if (!isOpen) return;
    loadData();

    const unsubscribe = subscribeToAuditEvents(() => {
      loadData();
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen, searchQuery, selectedCategory, selectedSeverity, selectedOutcome, dateRange]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        if (selectedEvent) {
          setSelectedEvent(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedEvent, onClose]);

  if (!isOpen) return null;

  const handleExport = () => {
    const bundle = exportAuditEvents({
      category: selectedCategory !== "ALL" ? selectedCategory : undefined,
      severity: selectedSeverity !== "ALL" ? selectedSeverity : undefined,
      outcome: selectedOutcome !== "ALL" ? selectedOutcome : undefined,
    });
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nanoroute-audit-trail-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearHistory = () => {
    clearAuditEvents({ olderThanMs: Date.now() - 30 * 24 * 60 * 60 * 1000 });
    setConfirmClear(false);
    loadData();
  };

  const getSeverityBadge = (severity: AuditEventSeverity) => {
    switch (severity) {
      case "SECURITY":
        return { label: "SECURITY", bg: "#7f1d1d", color: "#fca5a5" };
      case "ERROR":
        return { label: "ERROR", bg: "#991b1b", color: "#f87171" };
      case "WARNING":
        return { label: "WARNING", bg: "#78350f", color: "#fcd34d" };
      case "NOTICE":
        return { label: "NOTICE", bg: "#1e3a8a", color: "#93c5fd" };
      default:
        return { label: "INFO", bg: "#1f2937", color: "#9ca3af" };
    }
  };

  const getOutcomeBadge = (outcome: AuditEventOutcome) => {
    switch (outcome) {
      case "SUCCESS":
        return { label: "SUCCESS", color: "#34d399", icon: <CheckCircle2 size={13} /> };
      case "FAILED":
        return { label: "FAILED", color: "#f87171", icon: <XCircle size={13} /> };
      case "BLOCKED":
        return { label: "BLOCKED", color: "#fbbf24", icon: <AlertTriangle size={13} /> };
      case "CANCELLED":
        return { label: "CANCELLED", color: "#9ca3af", icon: <Clock size={13} /> };
      default:
        return { label: outcome, color: "#9ca3af", icon: <Info size={13} /> };
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-explorer-title"
    >
      <div className="relative w-full max-w-5xl h-[88vh] bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-100 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Activity size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="audit-explorer-title" className="text-lg font-semibold tracking-tight text-white">
                  Local Audit Trail & Activity Review
                </h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-purple-950/60 border border-purple-800/40 text-purple-300">
                  Step 89
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Verifiable operational history, security events & configuration tracking (Zero content capture)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
              title="Export sanitized audit bundle as JSON"
            >
              <Download size={14} className="text-emerald-400" />
              Export
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Close Audit Trail"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-3 border-b border-slate-800 bg-slate-900/40">
          <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/50">
            <span className="text-[11px] text-slate-400 font-medium">Total Events</span>
            <div className="text-base font-bold text-white mt-0.5">
              {metrics?.totalEvents.toLocaleString() ?? 0}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/50">
            <span className="text-[11px] text-slate-400 font-medium">Security Events</span>
            <div className="text-base font-bold text-emerald-400 mt-0.5">
              {metrics?.securityEventsCount.toLocaleString() ?? 0}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/50">
            <span className="text-[11px] text-slate-400 font-medium">Warnings & Errors</span>
            <div className="text-base font-bold text-amber-400 mt-0.5">
              {((metrics?.warningEventsCount ?? 0) + (metrics?.errorEventsCount ?? 0)).toLocaleString()}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/50">
            <span className="text-[11px] text-slate-400 font-medium">Success Rate</span>
            <div className="text-base font-bold text-purple-400 mt-0.5">
              {metrics?.successRatePercent ?? 100}%
            </div>
          </div>
        </div>

        {/* Toolbar: Search and Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-slate-800 bg-slate-900/60 text-xs">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search size={14} className="text-slate-400" />
            <input
              type="text"
              placeholder="Search event type, summary, correlation ID, provider..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-2.5 py-1 text-xs bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as any)}
              className="px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="ALL">All Categories</option>
              <option value="SECURITY">Security</option>
              <option value="CREDENTIAL">Credential</option>
              <option value="PROVIDER">Provider</option>
              <option value="ROUTING">Routing</option>
              <option value="BUDGET">Budget</option>
              <option value="DATA">Data</option>
              <option value="PRIVACY">Privacy</option>
              <option value="EXECUTION">Execution</option>
              <option value="CONNECTIVITY">Connectivity</option>
              <option value="RECOVERY">Recovery</option>
              <option value="UPDATE">Update</option>
              <option value="DIAGNOSTICS">Diagnostics</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="CONFIGURATION">Configuration</option>
              <option value="SYSTEM">System</option>
            </select>

            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value as any)}
              className="px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="ALL">All Severities</option>
              <option value="INFO">Info</option>
              <option value="NOTICE">Notice</option>
              <option value="WARNING">Warning</option>
              <option value="ERROR">Error</option>
              <option value="SECURITY">Security</option>
            </select>

            <select
              value={selectedOutcome}
              onChange={(e) => setSelectedOutcome(e.target.value as any)}
              className="px-2 py-1 text-xs bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="ALL">All Outcomes</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILED">Failed</option>
              <option value="BLOCKED">Blocked</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            <div className="flex items-center rounded-lg bg-slate-800 p-0.5 border border-slate-700">
              {(["ALL", "TODAY", "7D", "30D"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setDateRange(r)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    dateRange === r ? "bg-purple-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {r === "ALL" ? "All" : r}
                </button>
              ))}
            </div>

            <span className="text-[11px] text-slate-400 ml-1">
              ({events.length} of {totalCount})
            </span>
          </div>
        </div>

        {/* Content Body: Event List or Detail View */}
        <div className="flex-1 overflow-y-auto p-6">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 space-y-2">
              <FileText size={28} className="text-slate-500" />
              <p className="text-xs">No audit events matching current search or filters.</p>
            </div>
          ) : (
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/60 text-slate-300 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Severity</th>
                    <th className="p-3">Outcome</th>
                    <th className="p-3">Event Type</th>
                    <th className="p-3">Summary</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {events.map((event) => {
                    const sevBadge = getSeverityBadge(event.severity);
                    const outBadge = getOutcomeBadge(event.outcome);

                    return (
                      <tr
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                      >
                        <td className="p-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                          {new Date(event.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </td>
                        <td className="p-3 font-medium text-slate-200">
                          {event.category}
                        </td>
                        <td className="p-3">
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-semibold"
                            style={{ backgroundColor: sevBadge.bg, color: sevBadge.color }}
                          >
                            {sevBadge.label}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-medium"
                            style={{ color: outBadge.color }}
                          >
                            {outBadge.icon}
                            {outBadge.label}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-[11px] text-purple-300">
                          {event.eventType}
                        </td>
                        <td className="p-3 text-slate-200 font-medium max-w-md truncate">
                          {event.summary}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEvent(event);
                            }}
                            className="text-purple-400 hover:text-purple-300 text-[11px] font-medium"
                          >
                            Inspect →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Event Detail Modal Overlay */}
        {selectedEvent && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md p-6 flex flex-col z-20 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-purple-950 border border-purple-800 text-purple-300">
                  {selectedEvent.eventType}
                </span>
                <h3 className="text-base font-semibold text-white">Event Inspection</h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="text-slate-400 font-medium text-[11px] uppercase tracking-wider">
                  Summary
                </div>
                <div className="text-sm font-semibold text-white">{selectedEvent.summary}</div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-[11px] text-slate-400">Timestamp</span>
                  <div className="font-mono text-slate-200 mt-0.5">
                    {new Date(selectedEvent.timestamp).toLocaleString()}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-[11px] text-slate-400">Actor</span>
                  <div className="font-mono text-slate-200 mt-0.5">{selectedEvent.actor}</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-[11px] text-slate-400">Category</span>
                  <div className="font-mono text-slate-200 mt-0.5">{selectedEvent.category}</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-[11px] text-slate-400">Outcome</span>
                  <div className="font-mono text-slate-200 mt-0.5">{selectedEvent.outcome}</div>
                </div>
              </div>

              {(selectedEvent.providerId || selectedEvent.modelId || selectedEvent.correlationId) && (
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="text-slate-400 font-medium text-[11px] uppercase tracking-wider">
                    Context & Identifiers
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-[11px]">
                    {selectedEvent.providerId && (
                      <div>
                        <span className="text-slate-400">Provider:</span>{" "}
                        <span className="text-white">{selectedEvent.providerId}</span>
                      </div>
                    )}
                    {selectedEvent.modelId && (
                      <div>
                        <span className="text-slate-400">Model:</span>{" "}
                        <span className="text-white">{selectedEvent.modelId}</span>
                      </div>
                    )}
                    {selectedEvent.correlationId && (
                      <div>
                        <span className="text-slate-400">Correlation ID:</span>{" "}
                        <span className="text-purple-300">{selectedEvent.correlationId}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedEvent.details && Object.keys(selectedEvent.details).length > 0 && (
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="text-slate-400 font-medium text-[11px] uppercase tracking-wider">
                    Safe Metadata Details
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg font-mono text-[11px] text-slate-300 overflow-x-auto">
                    {JSON.stringify(selectedEvent.details, null, 2)}
                  </div>
                </div>
              )}

              {/* Contextual Action Links */}
              <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-900/30 flex items-center justify-between">
                <span className="text-purple-200 text-xs">
                  Inspect related subsystem:
                </span>
                <div className="flex items-center gap-2">
                  {onNavigateToSettings && (
                    <button
                      onClick={() => {
                        setSelectedEvent(null);
                        onClose();
                        onNavigateToSettings();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 flex items-center gap-1"
                    >
                      <Server size={13} />
                      Provider Settings
                    </button>
                  )}
                  {onNavigateToRequestInspector && (
                    <button
                      onClick={() => {
                        setSelectedEvent(null);
                        onClose();
                        onNavigateToRequestInspector();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-blue-300 border border-slate-700 flex items-center gap-1"
                    >
                      <FileText size={13} />
                      Request Inspector
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-3 flex justify-end">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs"
              >
                Back to List
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <ShieldCheck size={14} />
              <span>Zero-Content Audit Policy Enforced</span>
            </div>
            {onNavigateToPrivacyCenter && (
              <button
                onClick={() => {
                  onClose();
                  onNavigateToPrivacyCenter();
                }}
                className="text-purple-400 hover:underline flex items-center gap-1"
              >
                <span>Privacy Center</span>
                <ArrowRight size={11} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {confirmClear ? (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-amber-400">Purge records older than 30 days?</span>
                <button
                  onClick={handleClearHistory}
                  className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="px-2 py-1 rounded bg-slate-800 text-slate-300 text-xs"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1.5"
                title="Purge audit logs older than 30 days"
              >
                <Trash2 size={13} />
                Prune History
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
