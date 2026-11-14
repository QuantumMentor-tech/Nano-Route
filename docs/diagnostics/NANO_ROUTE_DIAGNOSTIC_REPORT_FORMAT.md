# NANO ROUTE — DIAGNOSTIC REPORT FORMAT & SCHEMA
## Step 62 Standardized Support Diagnostic Export Specification

---

## 1. PURPOSE & BOUNDARIES

The Diagnostic Report generation subsystem creates a deterministic, sanitized export bundle designed for sharing with support engineers or troubleshooting workflows.

The generation layer strictly enforces that no secret tokens, plaintext API keys, decrypted DPAPI blobs, or user conversational prompts are serialized into the report payload.

---

## 2. STRUCTURAL JSON PAYLOAD SCHEMA

```typescript
export interface DiagnosticReportPayload {
  reportId: string;                 // nr-diag-{timestamp}-{random}
  generatedAt: string;              // ISO 8601 UTC
  appVersion: string;               // e.g. "0.1.0"
  overallHealth: OverallHealthState; // "HEALTHY" | "DEGRADED" | etc.
  environmentSummary: {
    os: string;                     // "Windows"
    arch: string;                   // "x64"
    webview2Status: string;         // "Evergreen"
  };
  subsystemSummaries: Record<string, string>; // Subsystem ID -> Sanitized string
  testResults: DiagnosticTestResult[];        // Redacted test results array
  invariants: {
    zeroPlaintextKeys: boolean;     // Must be true
    zeroChatHistory: boolean;       // Must be true
    userPathsSanitized: boolean;    // Must be true
  };
}
```

---

## 3. CANONICAL HUMAN-READABLE TEXT FORMAT (.TXT)

When exported via the in-app Diagnostics Center download action, the report formats deterministically as:

```text
====================================================
  NANO ROUTE DIAGNOSTIC REPORT
====================================================
Report ID    : nr-diag-1731600000000-abc123
Generated At : 2026-11-14T09:50:00.000Z
App Version  : 0.1.0
Overall Health: HEALTHY

ENVIRONMENT
-----------
OS           : Windows
Architecture : x64
WebView2     : Evergreen

SUBSYSTEM STATUS
----------------
  RT-001               [PASS] Frontend and native core responsive. Lifecycle operational.
  ENV-001              [PASS] Windows 64-bit environment with Microsoft Edge WebView2 Evergreen runtime.
  DB-001               [PASS] SQLite database healthy (Schema v6, WAL active, Integrity OK).
  SLM-001              [PASS] Local SLM runtime ready (nano-route-router, backend: onnx).
  CRED-001             [PASS] Windows DPAPI vault operational (3 provider keys stored securely).
  PROV-CONFIG-001      [PASS] 6 providers registered with valid protocol endpoints.
  MODEL-001            [PASS] 12 models verified in authoritative registry with context bounds.
  ROUTE-001            [PASS] Routing policy active (balanced profile). Candidates available.
  UPD-001              [PASS] Update subsystem idle. No interrupted or corrupt updates detected.
  REC-001              [PASS] Disaster recovery subsystem ready (2 local backups available).

DIAGNOSTIC TEST RESULTS
-----------------------
  [PASS                ] RT-001 — Application Runtime Health
    Summary  : Frontend and native core responsive. Lifecycle operational.
    Duration : 1ms
  [PASS                ] DB-001 — SQLite Database & WAL Integrity
    Summary  : SQLite database healthy (Schema v6, WAL active, Integrity OK).
    Duration : 2ms
  ...

INVARIANTS
----------
  Zero plaintext keys    : true
  Zero chat history      : true
  User paths sanitized   : true

====================================================
  END OF NANO ROUTE DIAGNOSTIC REPORT
====================================================
```

