# NANO ROUTE — DIAGNOSTICS ARCHITECTURE
## In-App Diagnostics Center, Self-Test Framework, Troubleshooting Guidance & Safe Recovery Assistance (Step 62)

---

## 1. ARCHITECTURAL OVERVIEW

The **In-App Diagnostics Center** provides a deterministic, read-mostly, and privacy-preserving observability workspace within the Nano Route Windows desktop application. It integrates authoritative health subsystems across the Tauri v2 / Rust native core and the React 18 / TypeScript frontend without duplicating registries, mutating states, or exposing credentials.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        React 18 / TypeScript UI                        │
│   DiagnosticsPage (/diagnostics)                                       │
│   ├── Quick Check (local-only, zero network)                           │
│   ├── Full Check (includes opt-in frontier provider reachability)       │
│   ├── Synthetic SLM Self-Test (local-only, bounded)                    │
│   └── Sanitized Report Export (.txt & preview)                         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Strongly-Typed Functional Bridge
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                Diagnostic Test Runner & Redaction Layer                │
│   src/features/diagnostics/testRunner.ts                               │
│   src/features/diagnostics/reportGenerator.ts                          │
│   ├── Bounded AbortSignal Cancellation                                 │
│   ├── Deterministic Overall Health Precedence State Machine            │
│   └── Structural Omission & Regex Redaction Boundaries                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ safeInvoke IPC Boundary
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Authoritative System IPC Wrappers                    │
│   ├── Database Health & Integrity (cmd_get_database_health)            │
│   ├── Local SLM Runtime & Inference (cmd_get_local_runtime_status)      │
│   ├── Provider Registry & Credentials (DPAPI metadata inspection)      │
│   ├── Authoritative Model Catalog                                      │
│   ├── Update Subsystem State Machine (Step 52 updater)                 │
│   └── Disaster Recovery Backups (Step 53 recovery)                     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. CORE INVARIANTS & POLICIES

1. **Observational & Read-Mostly**: Diagnostics inspect and report existing state. Diagnostics never silently alter routing decisions, provider priorities, credentials, model configurations, or database records.
2. **Explicit Network Activity**: Local-only diagnostics (database, SLM presence, DPAPI status, model catalog, routing consistency) make zero external requests. Outbound HTTPS pings (e.g. `PROV-CONN-001`) are strictly user-initiated or explicit via Full Check.
3. **Zero Plaintext Secrets**: At no point are unmasked API keys, authorization headers, bearer tokens, or DPAPI plaintext payloads loaded into diagnostic UI state or included in exported reports.
4. **Zero Conversational Persistence**: Synthetic SLM self-tests run bounded inference with synthetic text; outputs and tokens are never saved to SQLite chat history or telemetry sessions.
5. **Deterministic Precedence**: The overall health summary state is computed deterministically from test results via strict hierarchical precedence rules.

---

## 3. SUBSYSTEM INTEGRATION

| Domain | Authoritative Service | Check Mechanism | Safety Guardrail |
| :--- | :--- | :--- | :--- |
| **Runtime & Core** | `commands.ts` / `AppService` | IPC roundtrip & metadata probe | Non-blocking timeout (3000ms) |
| **Windows Env** | `commands.ts` / `AppService` | Architecture, OS version, WebView2 | Zero invasive telemetry collected |
| **SQLite DB** | `DatabaseHealthReport` | Schema version, WAL state, integrity check | Safe read-only inspection; no destructive tests |
| **Local SLM** | `local_slm.ts` | Loaded model state, ONNX/DirectML status | On-demand synthetic check; no automatic heavy inference |
| **DPAPI Vault** | `credentials.ts` | Key presence metadata flags | Categorical boolean state; zero plaintext keys returned |
| **Providers** | `registry.ts` / `provider_health.ts` | Endpoint protocol and registry validity | Opt-in HTTPS ping; cost/network disclosures |
| **Routing** | `settings.ts` / `routing_policy.ts` | Active profile and candidate availability | Observational; no policy alteration |
| **Updater** | `updater.ts` (Step 52) | Staging lock, state machine status | Read-only state inspection; no automatic download |
| **Recovery** | `recovery.ts` (Step 53) | Backup manifest presence and count | Manifest integrity verification; no auto-restore |

---

## 4. DETERMINISTIC HEALTH PRECEDENCE RULES

The application health state follows a strict waterfall precedence model:

1. **`ACTION_REQUIRED`**: Core local persistence (`DB-001`) or native runtime (`RT-001`) failed or blocked.
2. **`RECOVERY_REQUIRED`**: An update (`UPD-001`) or recovery (`REC-001`) operation was interrupted or corrupted.
3. **`DEGRADED`**: Routing prerequisites missing (`ROUTE-001`); neither local SLM nor cloud credentials configured.
4. **`HEALTHY_WITH_LIMITATIONS`**: System operational, but optional providers or capabilities produced warnings/limitations (e.g. zero cloud keys in local-only mode).
5. **`HEALTHY`**: All executed core tests passed cleanly.
6. **`UNKNOWN`**: Diagnostics unexecuted.

---

## 5. CANCELLATION & CONCURRENCY

- **AbortSignal Integration**: All diagnostic sweeps accept an `AbortSignal`. Pre-aborted or cancelled sweeps immediately halt remaining iterations, leaving running tasks unorphaned and tagging uncompleted items as `CANCELLED`.
- **Single-Flight Run Guard**: The UI locks the action bar during active test sweeps, preventing duplicate concurrent runs, task flooding, or resource contention.
- **Resource Cleanup**: Timers and IPC promises are bounded by per-test timeouts (2,000ms – 10,000ms).

