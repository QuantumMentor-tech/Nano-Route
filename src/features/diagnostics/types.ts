/**
 * Nano Route — In-App Diagnostics Center Types
 * File: src/features/diagnostics/types.ts
 *
 * Implements Step 62 diagnostic test taxonomy, result models,
 * overall health precedence states, and report export schemas.
 */

export type DiagnosticTestId =
  | "RT-001"
  | "ENV-001"
  | "DB-001"
  | "SLM-001"
  | "SLM-002"
  | "CRED-001"
  | "PROV-CONFIG-001"
  | "PROV-CONN-001"
  | "MODEL-001"
  | "ROUTE-001"
  | "UPD-001"
  | "REC-001";

export type DiagnosticCategory =
  | "runtime"
  | "environment"
  | "database"
  | "slm"
  | "credentials"
  | "providers"
  | "models"
  | "routing"
  | "updater"
  | "recovery";

export type DiagnosticResultStatus =
  | "PASS"
  | "PASS_WITH_LIMITATION"
  | "NOT_RUN"
  | "NOT_APPLICABLE"
  | "WARNING"
  | "FAIL"
  | "BLOCKED"
  | "CANCELLED";

export type OverallHealthState =
  | "HEALTHY"
  | "HEALTHY_WITH_LIMITATIONS"
  | "ACTION_REQUIRED"
  | "DEGRADED"
  | "RECOVERY_REQUIRED"
  | "UNKNOWN";

export interface DiagnosticTestDescriptor {
  id: DiagnosticTestId;
  name: string;
  category: DiagnosticCategory;
  isNetworkBound: boolean;
  timeoutMs: number;
  description: string;
  remediationPath?: string;
  remediationLabel?: string;
}

export interface DiagnosticTestResult {
  id: DiagnosticTestId;
  name: string;
  category: DiagnosticCategory;
  isNetworkBound: boolean;
  status: DiagnosticResultStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  summary: string;
  safeDetails?: Record<string, unknown>;
  remediation?: string;
  remediationActionPath?: string;
}

export interface DiagnosticRunSummary {
  overallHealth: OverallHealthState;
  healthHeadline: string;
  healthDescription: string;
  runMode: "quick" | "full" | "single";
  startedAt: string;
  completedAt?: string;
  totalTests: number;
  passedCount: number;
  warningCount: number;
  failedCount: number;
  blockedCount: number;
  notRunCount: number;
  results: DiagnosticTestResult[];
}

export interface DiagnosticReportPayload {
  reportId: string;
  generatedAt: string;
  appVersion: string;
  overallHealth: OverallHealthState;
  environmentSummary: {
    os: string;
    arch: string;
    webview2Status: string;
  };
  subsystemSummaries: Record<string, string>;
  testResults: DiagnosticTestResult[];
  invariants: {
    zeroPlaintextKeys: boolean;
    zeroChatHistory: boolean;
    userPathsSanitized: boolean;
  };
}

