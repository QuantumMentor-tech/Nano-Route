# NANO ROUTE — PROJECT BASELINE
**Document Version:** 1.10.0  
**Step:** 12 of 50 — Secure Tauri IPC Command & Event Architecture  
**Date:** November 2026  
**Status:** APPROVED BASELINE (TYPED COMMAND, EVENT & CHANNEL FOUNDATION ESTABLISHED)  

---

## 1. PROJECT IDENTITY

| Field | Baseline Definition |
|---|---|
| **Product Name** | **Nano Route** |
| **Product Category** | AI Orchestration & Intelligent SLM Routing |
| **Product Type** | Windows Desktop Application |
| **Target Platform** | Windows 10 / Windows 11 (x64) |
| **Target Distribution** | Microsoft Store + Standalone Windows Packaging (MSIX / NSIS) |
| **Repository Classification** | **A. Established Foundation (Steps 1–12 Complete)** |
| **Application Identifier** | `com.nanoroute.desktop` |
| **Current Version** | `0.1.0` |
| **Primary Visual Direction** | Premium dark interface with neon/tech accents derived from official brand assets |

### Core Concept
Nano Route is a Windows-first local-first desktop AI orchestration application. Its core purpose is to use a lightweight, locally executed Small Language Model (SLM) router to analyze user prompts and tasks, classify requirements, and intelligently dispatch them to an optimal external AI provider (e.g., Anthropic Claude, OpenAI, Google Gemini, Groq, Mistral, Local Ollama/GGUF) according to task requirements, model capabilities, token cost, latency limits, provider availability, user preferences, and fallback policies.

---

## 2. REPOSITORY & FOUNDATION AUDIT

### 2.1 Repository Classification & Established Structure
In Steps 1–10, the foundational desktop application scaffold, client routing, operational dashboard, and reusable component interaction layer were established in strict compliance with Tauri v2, React 18, and TypeScript:

- **Root Frontend Project:**
  - `package.json`: Configured with React 18.3.1, TypeScript 5.6.3, Vite 5.4.11, `@tauri-apps/api` 2.12.4, `@tauri-apps/cli` 2.12.4, `react-router-dom` 6.28.0, `lucide-react` 1.70.0. Scripts include `dev`, `build`, `typecheck`, `test`, `validate`.
  - `tsconfig.json` & `tsconfig.node.json`: Strict TypeScript compiler configuration, React JSX transform, bundler module resolution.
  - `vite.config.ts`: Tauri v2-optimized HMR server, fixed port 1420, `src-tauri` watcher exclusion.
  - `index.html`: Clean entry point referencing `/src/main.tsx`.
  - `src/main.tsx`: React DOM client root mounting `<App />` in `React.StrictMode`.
  - `src/app/App.tsx`: Application root wrapping `<RouterProvider />` with `<ApplicationStateProvider>` and `<ToastProvider>`.
  - `src/components/`:
    - `ui/`: 12 core atomic primitives (`Button`, `IconButton`, `Input`, `Textarea`, `Select`, `Badge`, `Card`, `Divider`, `Spinner`, `Skeleton`, `Tooltip`, `StatusIndicator`).
    - `forms/`: Form composition (`FormField`, `SearchField`).
    - `feedback/`: Feedback and notifications (`Alert`, `Toast`, `ToastContainer`, `EmptyState`).
    - `overlays/`: Modals, dialogs, menus, and popovers (`Dialog`, `ConfirmDialog`, `DropdownMenu`, `Popover`).
    - `navigation/`: Sidebar navigation and tabs (`Sidebar`, `SidebarSection`, `SidebarItem`, `Tabs`).
    - `layout/`: Section headers and scroll containers (`SectionHeader`, `ScrollContainer`).
    - `index.ts`: Authoritative export barrel.
  - `src/state/`: Centralized global application runtime state (`ApplicationStateProvider`, `useApplicationState`, `applicationReducer`).
  - `src/features/dashboard/`: Operational Dashboard components with interactive component showcase.
  - `src/services/ipc/`:
    - `types.ts`: Authoritative request/response, event, and channel DTO contracts.
    - `errors.ts`: Unified `IpcError` class, error normalization, and filesystem/key sanitization.
    - `client.ts`: Low-level `safeInvoke`, correlation `requestId` generation, and test mock registry.
    - `commands.ts`: Typed command functions (`checkNativeHealth`, `getNativeHealthReport`, `getNativeAppInfo`, `pingNative`).
    - `events.ts`: Authoritative event registry (`IPC_EVENTS`), typed payloads, unlisten cleanup, and `useTauriEvent` hook.
    - `channels.ts`: Channel contracts for ordered token and progress streaming.
    - `index.ts`: Authoritative export barrel.
  - `src/routes/`: Centralized route paths (`routePaths.ts`), typed navigation hierarchy (`navigation.ts`), and router configuration (`router.tsx`).
  - `src/layouts/`: Desktop shell foundation (`DesktopShell.tsx`, `NavigationRegion.tsx`, `MainContentRegion.tsx`, `ShellErrorBoundary.tsx`, `RootLayout.tsx`).
  - `src/pages/`: 7 MVP pages (`DashboardPage`, `ChatPage`, `HistoryPage`, `SettingsPage`, `LicensePage`, `AboutPage`, `ContactPage`) + `NotFoundPage`.
  - `src/styles/`: Design tokens (`tokens.css`), reset styles (`reset.css`), and global styling (`index.css`, `App.css`).
  - `.gitignore`: Ignoring `node_modules`, `dist`, `src-tauri/target`, environment files, and IDE artifacts.
- **Tauri Native Core (`src-tauri/`):**
  - `src-tauri/Cargo.toml`: Tauri v2 dependency specification, serde, serde_json, `nano_route_lib`.
  - `src-tauri/tauri.conf.json`: Product name (`Nano Route`), identifier (`com.nanoroute.desktop`), dev URL (`http://localhost:1420`), frontend dist (`../dist`), window dimensions 1440x900 (min 1000x650), theme Dark.
  - `src-tauri/capabilities/default.json`: Minimal capability definition granting `core:default` to main window.
  - `src-tauri/build.rs`: Standard `tauri_build::build()`.
  - `src-tauri/src/main.rs`: Entry point with Windows release subsystem configuration.
  - `src-tauri/src/lib.rs`: Composition root initializing `AppState`, registering commands, and starting Tauri runtime.
  - `src-tauri/src/commands/`: Thin IPC boundary handlers (`cmd_health_check`, `cmd_get_health`, `cmd_get_app_info`, `cmd_ping`).
  - `src-tauri/src/core/`: Composition root and application bootstrap (`Application::bootstrap()`).
  - `src-tauri/src/domain/`: Pure domain entities (`HealthReport`, `SubsystemHealth`, `CoreStatus`, `AppInfo`).
  - `src-tauri/src/infrastructure/`: Low-level system and host adapters (`SystemInfoProvider`).
  - `src-tauri/src/services/`: Decoupled application services (`HealthService`, `AppService`).
  - `src-tauri/src/state/`: Thread-safe application state (`AppState` with `Arc` services and `RwLock`).
  - `src-tauri/src/errors/`: Unified `AppError` enum implementing `Serialize`, `Display`, `Error`, and `From<AppError> for String`.
- **Preserved Brand Asset:**
  - `Nano Route Neon Tech Logo.png` (Root, 670,255 bytes, preserved completely untouched).

---

## 3. STATUS DISTINCTION: FOUNDATION VS FUTURE FEATURES

### 3.1 FOUNDATION IMPLEMENTED (Steps 1–12)
```text
[x] Step 1: Repository Audit, Requirements Lock & Project Baseline
[x] Step 2: Tauri v2 + Rust + React + TypeScript Desktop Foundation
[x] Step 3: Production Folder Architecture & Module Boundaries
[x] Step 4: Application Configuration, Environment & Build System
[x] Step 6: Design System & Dark Theme Foundation (Tokens + 12 Primitives)
[x] Step 7: Tauri Window, Layout & Responsive Desktop Shell
[x] Step 8: Sidebar Navigation & Application Routing (Hash Router + Sidebar)
[x] Step 9: Dashboard Shell & Global Application States (Operational Dashboard)
[x] Step 10: Reusable UI Components, Icons & Interaction Patterns
[x] Step 11: Rust Core Architecture & Application Service Layer
[x] Step 12: Secure Tauri IPC Command & Event Architecture
```

### 3.2 FEATURES NOT YET IMPLEMENTED (Preserved for Future Steps)
```text
[ ] SQLite database engine & migrations (Step 13/Storage)
[ ] Local model download & storage engine (Step 14/Storage)
[ ] Cloud AI provider clients & token streaming (Step 15/Providers)
[ ] Local SLM inference engine (ONNX Runtime / DirectML / GGUF) (Steps 16-17)
[ ] Windows DPAPI credential vault & API key management (Step 18/Security)
[ ] Intelligent routing matrix & fallback engine (Steps 19-20)
[ ] Chat Studio full interactive execution & UI (Steps 21-25)
[ ] Telemetry, token accounting & cost tracking (Steps 26+)
```

---

## 4. ENVIRONMENT & TOOLCHAIN READINESS

- **Operating System:** Windows 10.0.26100 x86_64 (X64).
- **Node.js:** `v26.8.2` (Verified operational).
- **npm:** `11.19.1` (Verified operational via `npm.cmd`).
- **WebView2:** `157.0.4341.42` (Verified installed).
- **Rust Toolchain:** `rustc` / `cargo` not yet installed on host OS. Identified prerequisite for native compilation (`cargo build` / `tauri build`).

---
*End of Baseline Document. Step 12 Secure Tauri IPC Command & Event Architecture Locked.*
