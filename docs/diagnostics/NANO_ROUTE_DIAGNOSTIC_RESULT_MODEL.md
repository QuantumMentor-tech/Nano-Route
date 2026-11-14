# NANO ROUTE — DIAGNOSTIC RESULT & HEALTH MODEL
## Step 62 Authoritative Data Models, Enums & Precedence Definitions

---

## 1. DATA MODEL ARCHITECTURE

The Diagnostics Center operates on strongly-typed TypeScript and Rust models that encapsulate test descriptors, execution results, run summaries, and the deterministic overall health precedence engine.

---

## 2. RESULT STATUS ENUM

Each diagnostic probe produces exactly one of eight distinct status states:

```typescript
export type DiagnosticResultStatus =
  | "PASS"                  // Test executed successfully with all criteria satisfied
  | "PASS_WITH_LIMITATION"  // Test passed, but noted an expected optional limitation (e.g. zero cloud keys)
  | "NOT_RUN"               // Test was not scheduled in this execution mode
  | "NOT_APPLICABLE"        // Test does not apply to the current runtime environment
  | "WARNING"               // Subsystem operational with non-blocking issues or missing optional features
  | "FAIL"                  // Subsystem failed required check or encountered an error
  | "BLOCKED"               // Subsystem blocked by missing dependency or security lock
  | "CANCELLED";            // Test execution was aborted cooperatively by user request
```

---

## 3. OVERALL HEALTH STATE ENUM

The application's synthesized health state is computed from individual test results via strict precedence:

```typescript
export type OverallHealthState =
  | "HEALTHY"                   // All executed required and optional subsystems operational
  | "HEALTHY_WITH_LIMITATIONS"   // Core operational; optional providers or features unconfigured
  | "ACTION_REQUIRED"           // Critical local subsystem (DB, core runtime) offline or failed
  | "DEGRADED"                  // Essential routing prerequisites missing; cannot process prompts
  | "RECOVERY_REQUIRED"         // Update or backup/restore process interrupted or corrupt
  | "UNKNOWN";                  // No diagnostic checks executed yet
```

---

## 4. WATERFALL PRECEDENCE RULES

The `computeOverallHealth` function applies the following non-arbitrary precedence rules:

```
[Diagnostic Results Array]
        │
        ▼
Is DB-001 or RT-001 == FAIL or BLOCKED? ──► YES ──► ACTION_REQUIRED
        │ NO
        ▼
Is UPD-001 or REC-001 == FAIL? ──────────► YES ──► RECOVERY_REQUIRED
        │ NO
        ▼
Is ROUTE-001 == FAIL or WARNING? ────────► YES ──► DEGRADED
        │ NO
        ▼
Any result == WARNING or LIMITATION? ────► YES ──► HEALTHY_WITH_LIMITATIONS
        │ NO
        ▼
All executed tests == PASS? ─────────────► YES ──► HEALTHY
        │ NO
        ▼
Default / Empty ──────────────────────────────────► UNKNOWN
```

---

## 5. DTO SPECIFICATIONS

### `DiagnosticTestResult`
```typescript
export interface DiagnosticTestResult {
  id: DiagnosticTestId;
  name: string;
  category: DiagnosticCategory;
  isNetworkBound: boolean;
  status: DiagnosticResultStatus;
  startedAt: string;                // ISO 8601 UTC
  completedAt?: string;              // ISO 8601 UTC
  durationMs?: number;               // Monotonic elapsed time
  summary: string;                  // User-facing sanitized summary
  safeDetails?: Record<string, unknown>; // Redacted, non-secret diagnostic telemetry
  remediation?: string;             // Actionable next-step guidance
  remediationActionPath?: string;   // In-app navigation route (e.g. "/settings?tab=models")
}
```

### `DiagnosticRunSummary`
```typescript
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
```

