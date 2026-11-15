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
[![Tests: 1,071 Passed](https://img.shields.io/badge/Tests-1%2C071%20Passed-success.svg)](#6-available-scripts--verification-commands)

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
6. **Privacy First:** Error messages, diagnostic logs, and audit records automatically scrub filesystem paths (`C:\Users\...`) and secret authorization tokens (`Bearer ...`, `sk-...`, `gsk_...`, `AIza...`).
7. **Strict Separation of Data Domains:**
   - **Logs** = engineering diagnostics and crash dumps.
   - **Telemetry** = non-content operational measurements (latencies, token counts, cost).
   - **History** = user conversation workflows, prompts, and completions.
   - **Audit Trail** = operational governance, security events, and configuration tracking.

---

## 3. Current Implementation Status

Nano Route has progressed through an exhaustive engineering roadmap. **Steps 1 through 89 are complete and verified (1,071 unit & contract tests passing across 510 suites):**

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
- [x] **Step 18:** Telemetry Persistence & Metrics Aggregation (Zero content capture)
- [x] **Step 19:** Windows DPAPI Credential Vault (`CryptProtectData` User-Scoped Key Storage)
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

### Phase 7: Chat Experience, Streaming & Execution Reliability
- [x] **Step 31:** Chat Studio UI & Conversation Workspace
- [x] **Step 32:** Prompt Submission, Routing Pipeline & Provider Execution
- [x] **Step 33:** Streaming Response Engine & Live Chat Transport
- [x] **Step 34:** Routing Explanation, Score Breakdown & Confidence Experience
- [x] **Step 35:** Recovery, Cancellation & Execution Lifecycle Control
- [x] **Step 36:** Error Classification & Normalized Failure Handling (44 Categories)
- [x] **Step 37:** Automatic Failover & Fallback Execution Engine
- [x] **Step 38:** Retry, Timeout & Rate-Limit Control Engine
- [x] **Step 39:** Context Window Headroom & Advisory Spend Guardrails
- [x] **Step 40:** Reliability Testing & Resilience Validation (18 Core Scenarios)

### Phase 8: History, Telemetry, Costs, Latency & Data Lifecycle
- [x] **Step 41:** History Explorer, FTS5 Search & Conversation Management
- [x] **Step 42:** Telemetry Dashboard, Operational Routing Insights & Local Analytics
- [x] **Step 43:** Token Usage, Cost Analytics & Routing Savings Engine (Integer Nano-Dollar Arithmetic)
- [x] **Step 44:** Latency, Execution Performance & Benchmark Analytics (`P25`–`P99` Percentiles)
- [x] **Step 45:** Telemetry Audit, Data Cleanup, Retention & Full Wipe System
- [x] **Step 46:** Settings, Provider Management & Configuration Control Center
- [x] **Step 47:** License Management, Application About & Contact / Support Workspace

### Phase 9: Release Qualification, Quality Assurance & Platform Hardening
- [x] **Step 48:** Comprehensive Security, Privacy & Release-Gate Audit (DPAPI Verification)
- [x] **Step 49:** Full QA, Regression, Edge-Case Matrix & Release Candidate Validation
- [x] **Step 50:** Golden Path Verification, Smoke Testing & User Journey Automation
- [x] **Step 51:** Windows Binary Packaging, Authenticode Code Signing & MSIX/NSIS
- [x] **Step 52:** In-App Update Engine, Staging Pipeline & Rollback Safety
- [x] **Step 53:** Disaster Recovery, SQLite Backup Engine & Data Restoration
- [x] **Step 54:** Performance Benchmarking, Memory Profiling & Resource Governor
- [x] **Step 55:** Dependency Audit, SBOM & Supply Chain Vulnerability Scanner
- [x] **Step 56:** Provider API Compatibility Engine & Model Registry Drift Tracking
- [x] **Step 57:** Automated CI/CD Pipeline & Pull Request Release Qualification
- [x] **Step 58:** Incident Response Playbooks, Crash Diagnostics & Support Reporting
- [x] **Step 59:** Windows OS Compatibility, Display Scaling (High-DPI) & Multi-Monitor Support
- [x] **Step 60:** Accessibility (a11y) Certification, Keyboard Navigation & Screen Readers

### Phase 10: User Experience, Navigation & Personalization
- [x] **Step 61:** Guided First-Run Experience & Interactive Onboarding Wizard
- [x] **Step 62:** Comprehensive System Diagnostics, Hardware Probes & Sanity Runner
- [x] **Step 63:** Offline Help Center, Knowledge Base & Contextual Troubleshooting
- [x] **Step 64:** Desktop Notification Center, Priority Triage & Toast Stack
- [x] **Step 65:** Global Command Palette (`Ctrl+K`), Unified Search & Quick Navigation
- [x] **Step 66:** User Preferences & Workspace Personalization (Themes, Density, Scaling)
- [x] **Step 67:** Workspace Profiles, Routing Personas & Isolation
- [x] **Step 68:** Session Continuity, State Restoration & Crash Resumption
- [x] **Step 69:** Typed Application Reset Taxonomy & Factory Defaults Engine
- [x] **Step 70:** User Data Export & Privacy Portability (Sanitized JSON/CSV)
- [x] **Step 71:** User Data Import, Schema Validation & Conflict Resolution
- [x] **Step 72:** Data Health, Structural Integrity Auditing & SQLite Repair
- [x] **Step 73:** Automated Maintenance Engine, VACUUM & Cache Housekeeping

### Phase 11: Production Capabilities Expansion (Steps 74–89)
- [x] **Step 74:** Provider Credential Lifecycle, Validation, Health & Revocation
- [x] **Step 75:** Provider Budget Controls, Spend Ceilings & Monthly Guardrails
- [x] **Step 76:** Context Window Management, Token Estimation & Request Preflight
- [x] **Step 77:** Prompt Templates, Variables & Request Presets
- [x] **Step 78:** Composer Draft Persistence & Automatic Loss Prevention
- [x] **Step 79:** Local Attachments, Document Intake & Preflight Processing
- [x] **Step 80:** Rich Response Presentation, Code Blocks & Safe Markdown
- [x] **Step 81:** Conversation Branching, Response Variants & Non-Destructive Forks
- [x] **Step 82:** Conversation Bookmarks, Text Highlights, Notes & Anchors
- [x] **Step 83:** Context Collections & Reference Packs for Controlled Prompt Reuse
- [x] **Step 84:** Request Inspector, Final Payload Transparency & Preflight Safety Review
- [x] **Step 85:** Active Request Center, Lifecycle Monitoring, Concurrency & Task Recovery
- [x] **Step 86:** Connectivity Center, Offline Mode & Windows Network Resilience
- [x] **Step 87:** Provider & Model Compatibility Center & Readiness Matrix
- [x] **Step 88:** Privacy & Data Governance Center, Retention & Trust Dashboard
- [x] **Step 89:** Local Audit Trail, Security Events, Config History & Activity Review

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
Double-click `run.bat` in the project root or run from command line:
```cmd
run.bat
```
`run.bat` automatically verifies Node.js and Rust environments, installs missing npm dependencies, and presents an interactive menu.

You can also run specific tasks directly without entering the interactive menu:
```cmd
run.bat dev        :: Start Vite development server at http://localhost:1420
run.bat tauri      :: Start native desktop application (Tauri v2 + Rust)
run.bat test       :: Run unit & contract test suite (1,071 tests across 510 suites)
run.bat typecheck  :: Execute strict TypeScript compilation check (tsc --noEmit)
run.bat build      :: Compile and bundle optimized production assets
run.bat validate   :: Run complete verification pipeline (typecheck + test + build)
run.bat help       :: View all launcher options
```

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
| `run.bat` | Windows launcher with interactive menu and direct CLI subcommands (`dev`, `test`, `build`, etc.). |
| `npm run dev` | Starts the Vite development server with Hot Module Replacement on port `1420`. |
| `npm run typecheck` | Executes strict TypeScript compilation check (`tsc --noEmit`) across all modules and tests. |
| `npm test` | Runs the Node.js native unit test runner (`node --test`) across **1,071 tests across 510 suites**. |
| `npm run build` | Compiles TypeScript and creates an optimized production bundle in `dist/`. |
| `npm run validate` | Runs the full pipeline: **`typecheck` + `test` (1,071 tests) + `build`**. |
| `npm run tauri:dev` | Compiles Rust native core and launches native Tauri desktop application. |
| `npm run tauri:build` | Generates a production Windows desktop installer (`.msi` / `.exe`). |

---

## 7. Project Structure

```text
Nano Router SLM (Working)/
├── run.bat                             # Scriptable Windows launcher & test runner (CLI & Menu)
├── README.md                           # Master project documentation and architecture guide
├── LICENSE                             # MIT License
├── Nano Route Neon Tech Logo.png       # Official brand asset
├── index.html                          # Single-page HTML entry point
├── package.json                        # Dependencies, scripts, and build metadata
├── tsconfig.json                       # Strict TypeScript compiler options
├── vite.config.ts                      # Tauri v2-optimized Vite configuration
│
├── docs/                               # 39 Subsystem architecture documentation folders
│   ├── audit/                          # Step 89: Local audit trail & security events
│   ├── privacy-center/                 # Step 88: Privacy & data governance center
│   ├── provider-compatibility/         # Step 87: Compatibility center & readiness matrix
│   ├── connectivity/                   # Step 86: Connectivity center & offline resilience
│   ├── execution-center/               # Step 85: Active request center & lifecycle monitoring
│   ├── request-inspector/              # Step 84: Request inspector & preflight review
│   ├── context-collections/            # Step 83: Context collections & reference packs
│   ├── organization/                   # Step 82: Bookmarks, highlights, notes & anchors
│   ├── conversation/                   # Step 81: Conversation branching & variants
│   ├── chat-rendering/                 # Step 80: Rich Markdown & code block presentation
│   ├── attachments/                    # Step 79: Local attachments & file context
│   ├── composer/                       # Step 78: Composer drafts & loss prevention
│   ├── templates/                      # Step 77: Prompt templates & request presets
│   ├── context/                        # Step 76: Context window management & preflight
│   ├── budget/                         # Step 75: Budget guardrails & spend ceilings
│   ├── providers/                      # Step 74: Provider credential lifecycle
│   ├── maintenance/                    # Step 73: Maintenance, vacuum & cache purge
│   ├── integrity/                      # Step 72: Structural integrity & repair
│   ├── import/                         # Step 71: Data import & archive ingestion
│   ├── export/                         # Step 70: Data export & privacy portability
│   ├── reset/                          # Step 69: Application reset taxonomy
│   ├── session/                        # Step 68: Session continuity & crash recovery
│   ├── profiles/                       # Step 67: Workspace profiles & routing personas
│   ├── preferences/                    # Step 66: User preferences & themes
│   ├── commands/                       # Step 65: Command palette (Ctrl+K)
│   ├── notifications/                  # Step 64: Desktop notification center
│   ├── help/                           # Step 63: Offline help center & knowledge base
│   ├── diagnostics/                    # Step 62: System diagnostics & health checks
│   ├── onboarding/                     # Step 61: Guided first-run onboarding
│   ├── accessibility/                  # Step 60: a11y & screen reader certification
│   ├── incidents/                      # Step 58: Incident response & crash playbooks
│   ├── ci/                             # Step 57: Automated CI/CD qualification
│   ├── compatibility/                  # Step 56: Provider compatibility & drift
│   ├── performance/                    # Step 54: Performance benchmarks & resource governor
│   ├── recovery/                       # Step 53: Backup & disaster recovery
│   ├── release/                        # Step 52: Updates, staging & signing
│   ├── security/                       # Step 48: Security & privacy audit
│   └── project/                        # Master blueprints & SLM routing specifications
│
├── src/                                # Frontend application source code
│   ├── app/                            # Root application component and providers
│   ├── components/                     # Reusable UI component library (Step 10)
│   ├── features/                       # Domain feature modules:
│   │   ├── audit/                      # Step 89: Audit Explorer & Activity Review
│   │   ├── privacy-center/             # Step 88: Privacy & Data Governance Center
│   │   ├── provider-compatibility/     # Step 87: Compatibility Center & Explorer
│   │   ├── connectivity/               # Step 86: Connectivity & Network Health
│   │   ├── execution-center/           # Step 85: Active Request Center
│   │   ├── request-inspector/          # Step 84: Preflight Payload Inspector
│   │   ├── context-collections/        # Step 83: Context Collections & Packs
│   │   ├── attachments/                # Step 79: File Intake & Tokenization
│   │   ├── commands/                   # Step 65: Command Palette Registry
│   │   ├── notifications/              # Step 64: Notification Center
│   │   ├── diagnostics/                # Step 62: System Diagnostics Runner
│   │   ├── settings/                   # Step 46: Settings & Provider Management
│   │   ├── chat/                       # Step 31: Chat Studio & Timeline
│   │   └── dashboard/                  # Step 9: Control Center & Dashboard Shell
│   ├── layouts/                        # Desktop shell, navigation region, titlebar
│   ├── routes/                         # Route path registry and HashRouter configuration
│   ├── services/
│   │   └── ipc/                        # Secure typed IPC client (Steps 12–30, 45, 74)
│   │       ├── client.ts               # safeInvoke wrapper & correlation IDs
│   │       ├── errors.ts               # Sanitized error envelopes & redaction
│   │       ├── credentials.ts          # Step 19/74: DPAPI vault IPC bridge
│   │       ├── telemetry.ts            # Step 18: Telemetry persistence IPC bridge
│   │       ├── privacy.ts              # Step 45: Data inventory & wipe IPC bridge
│   │       └── types.ts                # Authoritative DTOs and contracts
│   └── state/                          # Global application runtime state
│
└── src-tauri/                          # Rust native core source code
    ├── Cargo.toml                      # Rust dependencies (tauri, tokio, rusqlite, serde)
    ├── tauri.conf.json                 # Tauri v2 desktop application window configuration
    └── src/
        ├── commands/                   # Tauri IPC command handlers
        ├── core/                       # Background task manager & application lifecycle
        ├── domain/                     # Pure domain entities (Health, Settings, Credentials)
        ├── routing/                    # On-device routing & scoring engine
        ├── providers/                  # Cloud provider adapters (OpenAI, Claude, Gemini, etc.)
        ├── storage/                    # SQLite database manager & migrations
        ├── services/                   # Application services (Vault, Preferences, Settings)
        ├── state/                      # Managed thread-safe AppState container
        ├── lib.rs                      # Native core library setup & command registration
        └── main.rs                     # Windows application binary entry point
```

---

## 8. Security & Privacy Guarantees

Nano Route is designed from the ground up for privacy-preserving AI orchestration:
- **Local DPAPI Credential Vault (Step 19/74):** Provider API keys are never stored in plaintext JSON, SQLite, or browser `localStorage`; they are encrypted using the Windows Data Protection API (`CryptProtectData`) tied to the local Windows user account.
- **Zero Cloud Telemetry (Step 18/88):** Nano Route operates zero analytics servers. All performance and cost logs reside solely on the user's personal machine.
- **Preflight Payload Transparency (Step 84):** The Request Inspector allows users to inspect the exact resolved prompt text, active templates, and attachment tokens before anything crosses the network.
- **Strict Data Segregation (Step 89):** Audit logs record only structural and operational events (milestones, rotations, failures) with strict regex scrubbing of API keys and filesystem paths. Conversation text, prompts, and completions are never written to audit tables.
- **Scoped Reset & Safe Deletion (Step 45/69):** Users can purge specific date ranges or execute scoped resets up to a complete two-factor local data wipe (`"DELETE"` token).

---

## 9. License

This project is licensed under the **MIT License** — see the [LICENSE](./LICENSE) file for details.

Copyright © 2026 Nano Route Engineering. All rights reserved.
