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

</div>

---

## 1. Executive Overview

**Nano Route** is a high-performance, local-first Windows desktop AI orchestration application. Its core purpose is to use a lightweight, locally executed Small Language Model (SLM) router to analyze user prompts and tasks, classify requirements, and intelligently dispatch them to an optimal external AI provider (such as Anthropic Claude, OpenAI, Google Gemini, Groq, Mistral, or Local Ollama/GGUF models) according to task requirements, model capabilities, token cost, latency limits, provider availability, user preferences, and fallback policies.

By delegating task classification to an embedded local SLM running on consumer hardware (DirectML / CPU), Nano Route eliminates the cost and latency of making cloud router calls while ensuring sensitive prompts are evaluated locally before transmission.

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
Application Service Layer
  ├── HealthService
  ├── AppService
  └── TaskManager (Async, Blocking, Concurrency & Cancellation)
       │
       ▼
Domain & Infrastructure Adapters
  ├── SystemInfoProvider
  └── (Planned: SQLite, Windows DPAPI, Local ONNX SLM, HTTP Providers)
```

### Core Architecture Rules:
1. **Frontend is an Untrusted Client:** UI components never directly invoke unrestricted operating system APIs, execute processes, or decrypt keys.
2. **Thin Command Boundary:** Rust Tauri commands contain zero business logic or SQL; they validate IPC DTOs and delegate to application services.
3. **No Unmanaged Background Tasks:** All native asynchronous work is managed by `TaskManager`, with bounded concurrency, hierarchical cancellation (`CancellationToken`), and safe shutdown sweeps.
4. **Zero Transport Leakage:** React components never import `@tauri-apps/api` directly; all communication is mediated through `src/services/ipc`.
5. **Privacy First:** Error messages and diagnostic logs automatically scrub filesystem paths (`C:\Users\...`) and secret authorization tokens (`Bearer ...`, `sk-...`).

---

## 3. Current Implementation Status

Nano Route is being developed through a structured 50-step engineering plan. **Steps 1 through 13 are complete and verified:**

- [x] **Step 1:** Repository Audit, Requirements Lock & Project Baseline
- [x] **Step 2:** Tauri v2 + Rust + React + TypeScript Desktop Foundation
- [x] **Step 3:** Production Folder Architecture & Module Ownership Boundaries
- [x] **Step 4:** Application Configuration, Environment & Build System
- [x] **Step 6:** Design System & Dark Theme Foundation (Tokens + 12 Atomic Primitives)
- [x] **Step 7:** Tauri Window, Layout & Responsive Desktop Shell
- [x] **Step 8:** Sidebar Navigation & Application Routing (HashRouter + 7 Pages)
- [x] **Step 9:** Dashboard Shell & Global Application States
- [x] **Step 10:** Reusable UI Component Library (Overlays, Feedback, Forms, Navigation, Layout)
- [x] **Step 11:** Rust Core Architecture & Application Service Layer (`HealthService`, `AppService`)
- [x] **Step 12:** Secure Tauri IPC Command & Event Architecture (Typed DTOs, Event Subscriptions, Planned Channels)
- [x] **Step 13:** Background Task & Async Execution Infrastructure (`TaskManager`, `CancellationToken`, Concurrency Semaphores)

### Upcoming Roadmap (Steps 14–50):
- **Step 14:** Local Model Download & Storage Engine (HuggingFace / GGUF model files)
- **Step 15:** Cloud AI Provider Integrations & Token Streaming Engine
- **Step 16:** Local SLM Inference Runtime (ONNX Runtime / DirectML / GGUF)
- **Step 17:** Intelligent Routing Matrix & Fallback Cascade
- **Step 18:** Windows DPAPI Credential Vault & Encrypted API Key Storage
- **Step 19:** SQLite Embedded Database & Migration Engine
- **Step 20–25:** Chat Studio Interactive Workspace & Streaming Interface
- **Step 26+:** Token Accounting, Real-Time Latency Tracking & Cost Telemetry

---

## 4. Prerequisites

To run or develop Nano Route on your Windows workstation:

### Required for Web Preview Mode:
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
`run.bat` automatically checks your Node.js and Rust environments, installs missing npm dependencies, and presents an interactive menu to start the application.

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
| `run.bat` | Interactive Windows console launcher. |
| `npm run dev` | Starts the Vite development server with Hot Module Replacement on port `1420`. |
| `npm run typecheck` | Executes strict TypeScript compilation check (`tsc --noEmit`) across all modules and tests. |
| `npm test` | Runs the Node.js native unit test runner (`node --test`) across all 43 contract and logic tests. |
| `npm run build` | Compiles TypeScript and creates an optimized production bundle in `dist/`. |
| `npm run validate` | Runs the full pipeline: **`typecheck` + `test` + `build`**. |
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
│       ├── NANO_ROUTE_IPC.md           # Secure IPC command, event & channel contracts
│       ├── NANO_ROUTE_TASK_SYSTEM.md   # Asynchronous execution & TaskManager design
│       ├── NANO_ROUTE_RUST_CORE.md     # Native service layer architecture
│       ├── NANO_ROUTE_DESIGN_SYSTEM.md # Dark theme design tokens & visual standards
│       ├── NANO_ROUTE_DASHBOARD.md     # Operational Dashboard specification
│       ├── NANO_ROUTE_BUILD_STATUS.md  # Continuous build audit & test baseline
│       └── NANO_ROUTE_PROJECT_BASELINE.md # Certified project baseline
│
├── src/                                # Frontend source code
│   ├── app/                            # Root application component and providers
│   ├── components/                     # Reusable UI component library (Step 10)
│   │   ├── ui/                         # Atomic primitives (Button, Input, Badge, Card, etc.)
│   │   ├── forms/                      # Compound form controls (FormField, SearchField)
│   │   ├── feedback/                   # Alerts, Toasts, EmptyStates
│   │   ├── overlays/                   # Dialogs, ConfirmDialogs, Dropdowns, Popovers
│   │   ├── navigation/                 # Sidebar, Tabs
│   │   └── layout/                     # SectionHeaders, ScrollContainers
│   ├── features/                       # Domain feature modules
│   │   └── dashboard/                  # Dashboard cards, capability grid, diagnostics
│   ├── layouts/                        # Desktop shell, navigation region, titlebar
│   ├── pages/                          # Application route destinations (Dashboard, Chat, Settings, etc.)
│   ├── routes/                         # Route path registry and HashRouter configuration
│   ├── services/
│   │   └── ipc/                        # Secure typed IPC client (Step 12 & 13)
│   │       ├── types.ts                # DTOs, Event payloads, Channel descriptors
│   │       ├── errors.ts               # IpcError normalization & regex path/secret sanitization
│   │       ├── client.ts               # safeInvoke, correlation requestId, mock registry
│   │       ├── commands.ts             # Typed command invocations (health, app info, ping)
│   │       ├── events.ts               # Event subscriptions, useTauriEvent hook, cleanup
│   │       ├── channels.ts             # Channel contracts for ordered token streaming
│   │       └── __tests__/              # Unit and integration test suites
│   ├── state/                          # Global application runtime state
│   └── styles/                         # CSS design tokens, reset, and base styles
│
└── src-tauri/                          # Rust native core source code
    ├── Cargo.toml                      # Rust dependencies (tauri, tokio, tokio-util, serde)
    ├── tauri.conf.json                 # Tauri v2 desktop application window configuration
    ├── capabilities/
    │   └── default.json                # Capability security policy (core:default only)
    └── src/
        ├── commands/                   # Thin IPC boundary handlers (health, app, diagnostics)
        ├── core/                       # Composition root and background execution engine
        │   ├── application.rs          # Application bootstrapping and service graph
        │   └── tasks/                  # TaskManager, TaskConcurrencyLimiter, CancellationToken
        ├── domain/                     # Pure domain entities (HealthReport, AppInfo, TaskStatus)
        ├── errors/                     # Unified AppError enum with serialization
        ├── infrastructure/             # System adapters (OS, architecture, environment)
        ├── services/                   # Application services (HealthService, AppService)
        ├── state/                      # Managed thread-safe AppState container
        ├── lib.rs                      # Native core library setup & command registration
        └── main.rs                     # Windows application binary entry point
```

---

## 8. Security & Privacy Guarantees

Nano Route is designed from the ground up for enterprise and desktop security:
- **Local Credential Storage (Step 18):** Future provider API keys are never stored in plaintext JSON or browser `localStorage`; they are encrypted using the Windows Data Protection API (`CryptProtectData`) tied to the local Windows user account.
- **Strict Capabilities:** The Tauri capability configuration does not grant access to external plugins for raw filesystem manipulation, command execution (`shell`), or arbitrary sockets.
- **Leak-Free Diagnostics:** All IPC error objects and diagnostic disclosure screens automatically scrub absolute directory paths (`C:\Users\...`) and authorization tokens before rendering.
- **Isolated Child Tasks:** Cancellation of one child task (such as a slow fallback provider) is isolated and will not disrupt unrelated application workloads.

---

## 9. License

This project is licensed under the **MIT License** — see the [LICENSE](./LICENSE) file for details.

Copyright © 2026 Nano Route Engineering. All rights reserved.

