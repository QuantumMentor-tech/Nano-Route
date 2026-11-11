# Nano Route — Desktop AI Orchestration & SLM Router

<div align="center">

![Nano Route Neon Tech Logo](./Nano%20Route%20Neon%20Tech%20Logo.png)

**Intelligent Local SLM Routing • Multi-Provider Dispatch • Windows-First Desktop AI Architecture**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Platform: Windows 10 / 11](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011%20x64-0078D4.svg)](#prerequisites)
[![Tauri: v2](https://img.shields.io/badge/Tauri-v2.1-FFC131.svg)](https://v2.tauri.app/)
[![React: 18](https://img.shields.io/badge/React-18.3-61DAFB.svg)](https://react.dev/)
[![TypeScript: 5.6](https://img.shields.io/badge/TypeScript-5.6%20Strict-3178C6.svg)](https://www.typescriptlang.org/)
[![Vite: 5.4](https://img.shields.io/badge/Vite-5.4-646CFF.svg)](https://vitejs.dev/)
[![Tests: 427 Passed](https://img.shields.io/badge/Tests-427%20Passed-success.svg)](#6-available-scripts--verification-commands)

</div>

---

## 1. Executive Overview

**Nano Route** is a high-performance, local-first Windows desktop AI orchestration application. Its core purpose is to use a lightweight, locally executed Small Language Model (SLM) router to analyze user prompts and tasks, classify requirements, and intelligently dispatch them to an optimal AI provider (OpenAI, Anthropic Claude, Google Gemini, DeepSeek, Groq, Mistral, and local endpoints) according to task requirements, model capabilities, token cost, latency limits, provider availability, user preferences, and fallback policies.

By delegating task classification, complexity scoring, domain taxonomy analysis, and candidate evaluation to an embedded local SLM running on consumer hardware (DirectML / CPU), Nano Route eliminates the cost and latency of cloud router calls while ensuring sensitive prompts are evaluated locally before transmission.

---

## 2. Architecture & Design Principles

Nano Route is engineered around a strict separation of concerns between an **untrusted presentation client** and a **hardened native core**:

```text
React 18 / TypeScript Presentation Layer
       │
       ▼
Frontend IPC Client Layer (src/services/ipc)
  ├── safeInvoke Transport Wrapper
  ├── Correlation Request ID Flow
  ├── Argument Pre-flight Validation
  ├── Error Sanitization (Redacting Paths & Secrets)
  └── Typed Commands & Event Listeners
       │
┌──────┴────────────────────────┐
│ Commands                      │ Events / Channels
▼                               ▼
Native Rust Command Boundary   Native Push Notifications / Ordered Streaming
       │
       ▼
Local SLM & Routing Intelligence Pipeline (Phase 6)
  ├── Step 26: Local SLM Runtime & Inference Engine (ONNX Runtime)
  ├── Step 27: Intent Classification Engine (Versioned Taxonomy & Calibrated Softmax)
  ├── Step 28: Task Complexity, Domain & Capability Analysis
  ├── Step 29: Multi-Dimensional Candidate Scoring Engine (11 Normalized Dimensions)
  └── Step 30: Routing Policy, Final Selection & Manual Override Engine
       │
       ▼
Provider Infrastructure & Adapters (Phase 5)
  ├── Step 14: Provider Abstraction & Neutral Types
  ├── Step 15: Resilient Streaming Transport & Chunk Parsers
  ├── Step 21: Canonical Provider & Model Registry
  ├── Steps 22–24: OpenAI, Anthropic, Gemini, DeepSeek, Groq, Mistral Adapters
  └── Step 25: Provider Health, Runtime Availability & Preflight Engine
       │
       ▼
Native Data, Security & Persistence (Phases 3–4)
  ├── Step 16: SQLite Embedded Persistence & Migration Engine
  ├── Step 17: Chat Session & Message History Persistence
  ├── Step 18: Telemetry Persistence & Metrics Aggregation
  ├── Step 19: Windows DPAPI Credential Vault (Encrypted API Keys)
  └── Step 20: Application Settings & Provider Preferences
```

### Core Architecture Rules:
1. **Frontend is an Untrusted Client:** UI components never directly invoke unrestricted operating system APIs, execute processes, or decrypt keys.
2. **Thin Command Boundary:** Rust Tauri commands contain zero business logic or SQL; they validate IPC DTOs and delegate to application services.
3. **No Unmanaged Background Tasks:** All native asynchronous work is managed by `TaskManager`, with bounded concurrency, hierarchical cancellation (`CancellationToken`), and safe shutdown sweeps.
4. **Hard Eligibility Decoupled from Soft Scoring:** Ineligible candidates (`is_eligible == false`) strictly receive `total_score: None`. High user preference weights can NEVER revive an ineligible candidate.
5. **Zero Credential Exposure:** API keys and DPAPI ciphertext are never accessed, deserialized, or serialized in candidate scoring results or routing decisions.
6. **Privacy First:** Error messages and diagnostic logs automatically scrub filesystem paths (`C:\Users\...`) and secret authorization tokens (`Bearer ...`, `sk-...`, `gsk_...`, `AIza...`).

---

## 3. Current Implementation Status

Nano Route is being developed through a structured master engineering roadmap. **Steps 1 through 40 are complete and verified:**

### Phase 1–2: Desktop Shell, Design System & UI Foundations
- [x] **Step 1:** Repository Audit, Requirements Lock & Project Baseline
- [x] **Step 2:** Tauri v2 + Rust + React + TypeScript Desktop Foundation
- [x] **Step 3:** Production Folder Architecture & Module Ownership Boundaries
- [x] **Step 4:** Application Configuration, Environment & Build System
- [x] **Step 6:** Design System & Dark Theme Foundation (Tokens + 12 Atomic Primitives)
- [x] **Step 7:** Tauri Window, Layout & Responsive Desktop Shell
- [x] **Step 8:** Sidebar Navigation & Application Routing (HashRouter + 7 Pages)
- [x] **Step 9:** Dashboard Shell & Global Application States
- [x] **Step 10:** Reusable UI Component Library (Overlays, Feedback, Forms, Navigation, Layout)

### Phase 3–4: Native Core, Persistence & DPAPI Security
- [x] **Step 11:** Rust Core Architecture & Application Service Layer (`HealthService`, `AppService`)
- [x] **Step 12:** Secure Tauri IPC Command & Event Architecture
- [x] **Step 13:** Background Task & Async Execution Infrastructure (`TaskManager`, `CancellationToken`)
- [x] **Step 16:** SQLite Database Foundation, Schema Migrations & Connection Pooling
- [x] **Step 17:** Chat Session & Message Persistence
- [x] **Step 18:** Telemetry Persistence & Metrics Aggregation
- [x] **Step 19:** Windows DPAPI Credential Vault (`CryptProtectData` Encrypted Key Storage)
- [x] **Step 20:** Application Settings & Provider Preferences Service

### Phase 5: Multi-Provider Layer & Health Intelligence
- [x] **Step 14:** Provider Abstraction & Neutral Request/Response Types
- [x] **Step 15:** Streaming Transport & SSE Chunk Parsing Infrastructure
- [x] **Step 21:** Canonical Provider & Model Registry Foundation
- [x] **Step 22:** OpenAI Provider Integration
- [x] **Step 23:** Anthropic Claude Messages API Integration
- [x] **Step 24:** Google Gemini, DeepSeek, Groq & Mistral Provider Integrations
- [x] **Step 25:** Provider Health, Runtime Availability & Preflight Evaluation Engine

### Phase 6: Local SLM & Routing Intelligence Pipeline
- [x] **Step 26:** Local SLM Runtime & On-Device Inference Engine (ONNX Runtime, Thread-Safe Worker)
- [x] **Step 27:** Local SLM Intent Classification Engine (Gold Evaluation Benchmarks & Ambiguity Handling)
- [x] **Step 28:** Task Complexity, Domain & Capability Analysis Engine
- [x] **Step 29:** Routing Scoring Engine (11 Normalized Scoring Dimensions, NaN/Inf Guards)
- [x] **Step 30:** Routing Policy, Final Selection & Manual Override Engine (Precedence Order & Fallback Planning)

### Phase 7: Chat Experience & Orchestration
- [x] **Step 31:** Chat Studio UI & Conversation Workspace (Session Sidebar, Timeline, Pure React Safe Markdown, Monospace CodeBlock, Dynamic Composer, Stale-Request Protection, Decoupled `SubmitPromptIntent`)
- [x] **Step 32:** Prompt Submission, Routing Pipeline & Provider Execution (End-to-End Non-Streaming Execution, Context Builder, Provider Resolver, Metadata Persistence, Double-Submission Protection)
- [x] **Step 33:** Streaming Response Engine & Live Chat Transport (Tauri v2 Channel Transport, Lossless Token Streamer, Monotonic Sequence Guarantees, Single SQLite Assistant Commit)
- [x] **Step 34:** Routing Explanation, Score Breakdown & Confidence Experience (On-Device Read-Only Explainability, Confidence Triad Semantics, 11-Dimension Candidate Scores, Expandable "Why this route?" Accordion)
- [x] **Step 35:** Recovery, Cancellation & Execution Lifecycle Control (Formal Execution Lifecycle State Machine, Cooperative CancellationToken Propagation, Idempotent Single-Finalization Winner Invariant, Live Stream Cancellation without Assistant SQLite Persistence, Stop Generation Composer Button with Escape Key Support, Session-Switching Isolation & Component Unmount Cleanup)
- [x] **Step 36:** Error Classification & Normalized Failure Handling (Provider-Neutral Error Taxonomy, 44 Canonical Categories, ErrorEnvelope DTO with Informational Hints, Sanitization of Keys and Filesystem Paths, Cancellation Precedence Over Aborts, Persistence Failure Isolation, Chat Studio Error Presentation)
- [x] **Step 37:** Automatic Failover & Fallback Execution Engine (Pre-ranked Step 30 Fallback Candidate Traversal, Candidate Pre-validation against DPAPI Vault & Model Catalog, Stream Isolation with Discard of Primary Partial Content, Strict Manual Override Non-substitution Guarantee, Exactly-Once SQLite Assistant Persistence with Failover Provenance, Amber Failover Badge in Chat Studio)
- [x] **Step 38:** Retry, Timeout & Rate-Limit Control Engine (Centralized Retry Policy, Explicit Retry Safety Classifications, No Blind Replay on Ambiguous Post-Send Timeout, Stream Token Emission Safety, Clamped Retry-After & Jittered Backoff, Two-Tier Logical Request Deadlines, Non-Blocking Cooperative Cancellation During Backoff Waits, Clean Handoff to Step 37 Failover)
- [x] **Step 39:** Context, Quota & Availability Control (Context Window Headroom Evaluation, Heuristic Token Estimator with Framing Overhead, 10% Safety Buffer, Windows DPAPI Monthly Budget Limits, Observed Provider Quota Tracking with Advisory Resets, Zero-Network-Call Candidate Disqualification, Clean Handoff to Step 37 Failover & Step 38 Retries, Tolerance for Unknown Pricing)
- [x] **Step 40:** Reliability Testing & Resilience Validation (Integrated End-to-End Validation across Steps 35–39, 18 Core Failure/Recovery Scenarios, 10 Property-Style Safety Invariants, Native `ExecutionManager` Lock-Ordering & TOCTOU Deadlock Remediation, Security Path/Token Redaction Alignment, Deterministic Fault-Injection Test Harness & Matrix)
- [x] **Step 41:** History Explorer, Search & Conversation Management (SQLite Migration `006` Composite Indexes & `history_search_fts` FTS5 Table with Atomic Triggers, Indexed SQL `LIKE` Fallback, Single-Query Aggregate Listing, Exact-Title > Partial-Title > Content Ranking, Safe Plain-Text React `<mark>` Highlighting, Provider/Model/Pinned/Local-Date Filters, Bounded Pagination, Controlled Pin/Rename/Message-Delete/Session-Delete/Bulk-Delete Lifecycle, Passive Historical Inspection Without SLM Invocation, and Chat Studio Continuation Integration)

### Upcoming Roadmap (Steps 42–90):
- **Step 42:** Telemetry Dashboard & Operational Overview

---

## 4. Prerequisites

To run or develop Nano Route on your Windows workstation:

### Required for Web Preview & Verification:
- **Operating System:** Windows 10 (Build 19041+) or Windows 11 (x64)
- **Node.js:** v18.0.0 or later (Tested on `v26.8.2`)
- **npm:** 9.0.0 or later (Tested on `11.19.1`)
- **WebView2:** Microsoft Edge WebView2 Runtime (Pre-installed on modern Windows)

### Required for Native Desktop Compilation (`tauri dev` / `tauri build`):
- **Rust Toolchain:** Stable Rust (`rustc` & `cargo` 1.77+) installed via [rustup.rs](https://rustup.rs/) (Target: `x86_64-pc-windows-msvc`)
- **C++ Build Tools:** Visual Studio 2022 Build Tools (Select "Desktop development with C++" and Windows 10/11 SDK)

---

## 5. How to Run the Application

### Option A: One-Click Quick Start (Recommended on Windows)
Simply double-click the included batch launcher in the project root:
```cmd
run.bat
```
`run.bat` automatically checks your Node.js and Rust environments, installs missing npm dependencies, and presents an interactive menu to start the application, run the validation harness, or execute test suites.

---

### Option B: Web Browser Development Mode
If Rust is not yet installed on your system, you can immediately run and test the complete frontend UI, dashboard, and IPC mock subsystem in your browser:
```cmd
npm run dev
```
Open [http://localhost:1420](http://localhost:1420) in your browser. The frontend detects browser mode and seamlessly activates the diagnostic mock IPC provider.

---

### Option C: Native Tauri Desktop Application
Once the Rust toolchain is installed:
```cmd
npm run tauri:dev
```
This compiles the native Rust backend core, launches the native Windows window frame (1440x900 dark theme), and connects the React presentation layer via native IPC.

---

## 6. Available Scripts & Verification Commands

All development, verification, and testing scripts are deterministic and cross-checked:

| Command | Action |
|---|---|
| `run.bat` | Interactive Windows console launcher with environment diagnostics. |
| `npm run dev` | Starts the Vite development server with Hot Module Replacement on port `1420`. |
| `npm run typecheck` | Executes strict TypeScript compilation check (`tsc --noEmit`) across all modules and tests. |
| `npm test` | Runs the Node.js native unit test runner (`node --test`) across **all 427 contract and logic tests** across 219 suites. |
| `npm run build` | Compiles TypeScript and creates an optimized production bundle in `dist/`. |
| `npm run validate` | Runs the full pipeline: **`typecheck` + `test` (427 tests) + `build`**. |
| `npm run tauri:dev` | Compiles Rust native core and launches native Tauri desktop application. |
| `npm run tauri:build` | Generates a production Windows desktop installer (`.msi` / `.exe`). |

---

## 7. Project Structure

```text
Nano Router SLM (Working)/
├── run.bat                             # One-click Windows project launcher
├── README.md                           # Project documentation and guide
├── LICENSE                             # MIT License
├── Nano Route Neon Tech Logo.png       # Official brand asset (670,255 bytes, preserved)
├── index.html                          # Single-page HTML entry point
├── package.json                        # Dependencies, scripts, and build metadata
├── tsconfig.json                       # Strict TypeScript compiler options
├── vite.config.ts                      # Tauri v2-optimized Vite configuration
│
├── docs/                               # Architectural blueprints and engineering specs
│   └── project/
│       ├── NANO_ROUTE_ARCHITECTURE.md  # Master architecture specification
│       ├── NANO_ROUTE_ERROR_CLASSIFICATION.md # Step 36: Error taxonomy, sanitization & failure handling
│       ├── NANO_ROUTE_STREAMING_IMPLEMENTATION.md # Step 33: Streaming response engine & live transport
│       ├── NANO_ROUTE_ROUTING_POLICY.md # Step 30: Routing policy, overrides & precedence
│       ├── NANO_ROUTE_ROUTING_SCORING.md # Step 29: 11-factor scoring engine
│       ├── NANO_ROUTE_TASK_ANALYSIS.md # Step 28: Multidimensional task analysis
│       ├── NANO_ROUTE_INTENT_CLASSIFICATION.md # Step 27: Intent classification
│       ├── NANO_ROUTE_LOCAL_SLM_RUNTIME.md # Step 26: ONNX Runtime native inference
│       ├── NANO_ROUTE_PROVIDER_HEALTH_CAPABILITY.md # Step 25: Health & preflight
│       ├── NANO_ROUTE_CREDENTIAL_VAULT.md # Step 19: DPAPI key encryption
│       ├── NANO_ROUTE_DATABASE_ARCHITECTURE.md # Step 16: SQLite persistence
│       └── ...
│
├── src/                                # Frontend source code
│   ├── app/                            # Root application component and providers
│   ├── components/                     # Reusable UI component library (Step 10)
│   ├── features/                       # Domain feature modules (dashboard, chat, settings)
│   ├── layouts/                        # Desktop shell, navigation region, titlebar
│   ├── pages/                          # Application route destinations (Dashboard, Chat, Settings, etc.)
│   ├── routes/                         # Route path registry and HashRouter configuration
│   ├── services/
│   │   └── ipc/                        # Secure typed IPC client (Steps 12–30)
│   │       ├── types.ts                # DTOs, Event payloads, Routing contracts
│   │       ├── routing_policy.ts       # Step 30: Policy & manual override IPC bridge
│   │       ├── routing_scoring.ts      # Step 29: Candidate scoring IPC bridge
│   │       ├── task_analysis.ts        # Step 28: Task analysis IPC bridge
│   │       ├── intent_classifier.ts    # Step 27: Intent classification IPC bridge
│   │       ├── local_slm.ts            # Step 26: Local SLM inference IPC bridge
│   │       ├── provider_health.ts      # Step 25: Provider health & preflight IPC bridge
│   │       ├── credentials.ts          # Step 19: DPAPI credential vault IPC bridge
│   │       ├── settings.ts             # Step 20: Preferences IPC bridge
│   │       ├── registry.ts             # Step 21: Provider/model registry IPC bridge
│   │       └── __tests__/              # 277 Unit and contract test suites
│   ├── state/                          # Global application runtime state
│   └── styles/                         # CSS design tokens, reset, and base styles
│
└── src-tauri/                          # Rust native core source code
    ├── Cargo.toml                      # Rust dependencies (tauri, tokio, ort, rusqlite, serde)
    ├── tauri.conf.json                 # Tauri v2 desktop application window configuration
    └── src/
        ├── commands/                   # Tauri IPC command handlers
        ├── core/                       # Background task manager & application lifecycle
        ├── domain/                     # Pure domain entities (Health, Settings, Credentials)
        ├── inference/                  # Step 26: Local ONNX Runtime SLM inference engine
        ├── classification/             # Step 27: Intent classifier & label taxonomy
        ├── analysis/                   # Step 28: Task complexity, domain & capability analysis
        ├── routing/                    # Routing engine
        │   ├── scoring/                # Step 29: 11-factor candidate scoring engine
        │   └── policy/                 # Step 30: Policy selection, overrides & fallbacks
        ├── providers/                  # Cloud provider adapters (OpenAI, Claude, Gemini, etc.)
        ├── storage/                    # SQLite database manager & repositories
        ├── services/                   # Application services (Vault, Preferences, Settings)
        ├── state/                      # Managed thread-safe AppState container
        ├── lib.rs                      # Native core library setup & command registration
        └── main.rs                     # Windows application binary entry point
```

---

## 8. Security & Privacy Guarantees

Nano Route is designed from the ground up for privacy-preserving AI orchestration:
- **Local DPAPI Credential Vault (Step 19):** Provider API keys are never stored in plaintext JSON or browser `localStorage`; they are encrypted using the Windows Data Protection API (`CryptProtectData`) tied to the local Windows user account.
- **Strict Capabilities:** The Tauri capability configuration does not grant access to external plugins for raw filesystem manipulation, command execution (`shell`), or arbitrary sockets.
- **Leak-Free Diagnostics:** All IPC error objects and diagnostic disclosure screens automatically scrub absolute directory paths (`C:\Users\...`) and authorization tokens before rendering.
- **Hard Execution Safety:** Manual route overrides cannot bypass model context limits or required task capabilities (e.g. attempting to override to a text-only model for an image task is strictly rejected).

---

## 9. License

This project is licensed under the **MIT License** — see the [LICENSE](./LICENSE) file for details.

Copyright © 2026 Nano Route Engineering. All rights reserved.
