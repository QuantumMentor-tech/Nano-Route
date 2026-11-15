# Nano Route — Local Audit Trail Architecture
**Document Version:** 1.0.0  
**Phase:** Post-Roadmap Product Capability Expansion  
**Status:** Authoritative Architectural Design  
**Date:** 2026-11-15  

---

## 1. Subsystem Architecture Overview

The Nano Route Local Audit Trail operates as an asynchronous, non-blocking operational and security event observation plane:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Nano Route Core Subsystems                      │
│                                                                        │
│  [DPAPI Vault]      [Provider Router]   [Data Lifecycle / Wipe]        │
│  [Execution Engine] [Connectivity]      [Integrity / Maintenance]      │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ Emits non-content operational events
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Audit Event Normalizer & Redactor                     │
│                                                                        │
│  • Scrubs API keys (sk-, AIzaSy, gsk_, ghp_, Bearer)                  │
│  • Sanitizes Windows & POSIX filesystem paths                         │
│  • Drops forbidden content keys (prompt, response, secret, password)   │
│  • Assigns category, severity, outcome, actor & ISO timestamps        │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      Bounded Local Audit Store                         │
│                                                                        │
│  • Deterministic ordering (timestamp DESC, id DESC)                   │
│  • Bounded retention ceiling (max 5,000 events)                        │
│  • Fast multi-criteria indexing (category, severity, outcome, date)   │
│  • Subscription bus for live UI reactivity                            │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Audit Explorer UI & Export Engine                    │
│                                                                        │
│  • Metric cards (Total, Security, Warnings/Errors, Success Rate)       │
│  • Search bar & multi-category filters                                │
│  • Deep inspection drawer with correlation IDs & safe metadata        │
│  • Sanitized JSON export bundle generator                             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Architectural Invariants

### 2.1 Separation from Logging, Telemetry, and History
- **Logs**: Low-level engineering diagnostics and stack traces (Step 5).
- **Telemetry**: Performance latencies, token counts, and cost metrics (Step 18).
- **History**: Conversation prompts, responses, and variants (Step 41 / Step 81).
- **Audit**: Significant operational milestones, security state transitions, and configuration changes (Step 89).

### 2.2 Asynchronous, Non-Blocking Write Path
Audit event recording is lightweight and synchronous to the in-memory bus, never blocking chat streaming, IPC calls, or UI rendering.

### 2.3 Strict Non-Content Capture
Audit records strictly record **what happened** (metadata, event type, category, outcome, timestamp), never **user conversation content** (prompts, completions, attachments, or private notes).

