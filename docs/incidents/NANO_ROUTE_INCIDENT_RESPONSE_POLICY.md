# Nano Route Incident Response Policy & Lifecycle Manual

## 1. Executive Summary & Core Mandate
This policy governs incident detection, triage, containment, root-cause investigation, and corrective-action engineering for the **Nano Route** desktop hybrid routing application. As a local-first Windows desktop application utilizing local Small Language Models (SLMs), cloud frontier providers, DPAPI encryption, and SQLite storage, Nano Route strictly forbids permanent background telemetry tracking or covert cloud diagnostic collection.

All incident response protocols must preserve:
- **Local-First Privacy:** Zero remote telemetry beacons or unconsented diagnostic uploads.
- **Data Protection:** Zero plain-text credentials, DPAPI BLOBs, or user conversational contents leaked to logs or support bundles.
- **Fail-Safe Operation:** Automatic degraded operation (e.g. falling back to local SLM) over catastrophic crashes.

---

## 2. Incident Classification Taxonomy (Categories A through M)

| Category Code | Classification Name | Primary Failure Domain | Initial Containment Action |
|:---|:---|:---|:---|
| **CAT_A** | Crash / Fatal Termination | Uncaught panic, SEGFAULT, stack overflow | Write startup crash marker, safe fallback restart |
| **CAT_B** | Startup Failure | Window spawn failure, WebView2 corruption | Safe mode boot, reset volatile UI state |
| **CAT_C** | Runtime Exception | Uncaught JS/TS render error, React error boundary | Display localized error boundary, retain session state |
| **CAT_D** | Provider Drift / Outage | Frontier API 4xx/5xx, model deprecation | Route to alternative frontier provider or local SLM |
| **CAT_E** | Router Cascade Failure | Decision tree timeout, invalid route scoring | Execute deterministic local SLM fallback |
| **CAT_F** | SLM Memory / Runtime | Out-of-memory (OOM), CUDA/DirectML failure | Release SLM buffers, throttle batch size |
| **CAT_G** | Database Corruption | SQLite `SQLITE_CORRUPT`, lock timeout | Invoke staged online backup recovery (Step 53) |
| **CAT_H** | Update Signature Failure | Checksum mismatch, invalid Ed25519 signature | Abort update transaction, retain current binary (Step 52) |
| **CAT_I** | Disaster Recovery Failure | Backup restoration failure, unmountable disk | Maintain quarantine directory, notify user with manual export |
| **CAT_J** | Packaging / Installer | Missing DLL, NSIS installer permission error | Provide standalone portable package verification |
| **CAT_K** | Windows DPAPI / OS Error | `CryptProtectData` failure, key store loss | Prompt for credential re-entry without crashing |
| **CAT_L** | Performance Degradation | UI thread freeze > 500ms, memory leak | Free cached token streams, garbage collection cycle |
| **CAT_M** | Security / Supply Chain | Compromised dependency, rogue token access | Revoke credentials, publish emergency hotfix release |

---

## 3. Incident Lifecycle Stages

```
   [ 1. DETECTION ]
          │ (User report, sanitized log, crash marker)
          ▼
   [ 2. TRIAGE & SEVERITY ASSESSMENT ]
          │ (Evaluate SEV-1 through SEV-4 criteria)
          ▼
   [ 3. CONTAINMENT & MITIGATION ]
          │ (Activate fallback route, safe mode, or rollback)
          ▼
   [ 4. ROOT-CAUSE ANALYSIS (RCA) ]
          │ (5-Whys, Fault Tree, Reproduction)
          ▼
   [ 5. CORRECTIVE-ACTION ENGINEERING ]
          │ (Hotfix branch, automated regression test, CI gate)
          ▼
   [ 6. POST-MORTEM & CLOSURE ]
          │ (Template sign-off, knowledge base update)
```

### Stage 1: Detection & Ingestion
- Sources: User issue reports, support diagnostics export, local application logs, Windows Event Viewer (`Application Error`).
- Verification: Validate application version, build hash, and reproduction prerequisites.

### Stage 2: Triage & Classification
- Categorize according to Taxonomy (CAT_A to CAT_M).
- Calculate Severity (SEV-1 Critical to SEV-4 Low) based on impact and data-loss risk.

### Stage 3: Immediate Containment
- Minimize user disruption. If cloud routing fails, prioritize local SLM. If database fails, activate read-only rollback mode.
- Prevent destructive actions (e.g. do not drop corrupt tables without staged backup).

### Stage 4: Root-Cause Analysis
- Perform rigorous 5-Whys analysis and Fault Tree Analysis (FTA).
- Pinpoint technical root cause, process gap, and test coverage gap.

### Stage 5: Corrective-Action Implementation
- Implement code hotfix adhering to semantic versioning (`v0.1.x`).
- Author a dedicated regression test in `src/features/maintenance/__tests__/`.
- Validate against all 4 CI quality gates (lint, audit, build, qualification).

### Stage 6: Post-Mortem & Closure
- Archive completed Incident Template in `docs/incidents/archive/`.
- Update provider schema contracts or security policies if drift occurred.

