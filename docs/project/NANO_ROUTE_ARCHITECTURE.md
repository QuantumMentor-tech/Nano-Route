# Nano Route Architecture
**Document Version:** 1.9.0  
**Step:** 11 of 50 — Rust Core Architecture & Application Service Layer  
**Date:** November 2026  
**Status:** APPROVED ARCHITECTURAL SPECIFICATION  

---

## 1. Architecture Overview
Nano Route is a Windows-first local-first desktop AI orchestration system. The fundamental architectural objective is to decouple user interface concerns from business logic, local SLM inference, secure credential storage, and external AI provider communication.

The architecture enforces a strict three-tier hierarchy:
1. **Frontend Presentation Tier (React + TypeScript):** Owns UI state, view rendering, user input validation, and user interactions. Operates in an untrusted context with zero access to plaintext credentials, raw SQL, or OS filesystem handles.
2. **Tauri IPC Boundary:** Controlled, typed message bridge. Replaces ad-hoc IPC calls with a centralized frontend IPC service communicating with domain-scoped Rust commands and push-based token streaming events.
3. **Rust Native Core Tier:** Owns native OS resources, Tokio multi-threaded async runtime, Windows DPAPI encryption at rest, embedded SQLite (WAL mode), local SLM inference engine (ONNX Runtime / DirectML or llama.cpp GGUF), unified provider abstraction, and multi-factor routing policies.

```text
+-------------------------------------------------------------------------------+
|                       NANO ROUTE SYSTEM ARCHITECTURE                          |
+-------------------------------------------------------------------------------+

[FRONTEND TIER - React 18 + TypeScript + Vite 5]
  app/ (App.tsx, shell orchestration) [EXISTING]
  services/ipc/ (safeInvoke, centralized typed IPC client) [EXISTING]
  types/ (Shared domain & IPC contracts) [EXISTING]
  styles/ (Foundational dark CSS) [EXISTING]
  components/ (Reusable visual primitives) [PLANNED - Step 6+]
  features/ (Domain features: chat, routing, history, telemetry) [PLANNED - Steps 18-25]

                                   │  Tauri IPC (Typed commands & SSE events)
                                   ▼
[NATIVE CORE TIER - Rust + Tauri v2]
  commands/ (health, chat, keys, telemetry) [EXISTING: health; PLANNED: others]
  core/ (High-level application orchestration) [PLANNED]
  domain/ (Pure domain entities: Task, Model, Provider, Decision) [PLANNED]
  errors/ (Unified domain error hierarchy) [PLANNED]
  inference/ (Local SLM execution: ONNX / GGUF) [PLANNED - Steps 11-14]
  infrastructure/ (HTTP clients, Windows OS helpers) [PLANNED]
  providers/ (Standardized Provider trait & adapters) [PLANNED - Steps 6-10]
  routing/ (Multi-factor candidate scoring & fallback engine) [PLANNED - Steps 15-16]
  security/ (Windows DPAPI Crypt32 encryption) [PLANNED - Step 5]
  services/ (Application use-case orchestrators) [PLANNED]
  state/ (Tauri-managed thread-safe application state) [PLANNED]
  storage/ (SQLite WAL connection pool & repositories) [PLANNED - Step 4]
  telemetry/ (Local-first latency, token & cost metrics) [PLANNED - Step 24]

                                   │  Outbound HTTPS / Localhost HTTP
                                   ▼
[EXTERNAL / LOCAL PROVIDER APIS]
  Anthropic Claude | OpenAI | Google Gemini | Groq | Localhost Ollama
```

---

## 1.1 Application Runtime State & Dashboard Flow
Established in Step 9, the runtime state hierarchy enforces unidirectional data flow and strict separation of concerns:

```text
Native Core Status (Tauri IPC Bridge: cmd_health_check)
                   │
                   ▼
       Application Runtime State (src/state/)
                   │
                   ▼
              DesktopShell
                   │
                   ▼
                 Router
                   │
                   ▼
               Dashboard
```

### Architectural Rules for Dashboard & State:
1. **Consumer Only:** The Dashboard is strictly a consumer of application runtime state; it does not own infrastructure, native bridges, or background tasks.
2. **No Provider Ownership:** The Dashboard does not communicate with external AI providers directly. Future provider registries will report through the native application service layer.
3. **No Telemetry Ownership:** The Dashboard does not calculate or store metrics. Future telemetry services will feed the Dashboard via typed ViewModels.
4. **Truthful Representation:** Unconfigured systems (providers, SLM, routing) are rendered as explicit empty states rather than simulated numbers.

---

## 1.2 Native Service Architecture & AppState Flow
Established in Step 11, the native Rust core decouples IPC command handling from business logic, application state, and infrastructure:

```text
                         React / TypeScript
                                │
                                ▼
                        Frontend IPC Layer
                                │
                                ▼
                         Tauri Commands
                                │
                                ▼
                     Application Service Layer
                                │
                    ┌───────────┼────────────┐
                    ▼           ▼            ▼
                 Domain      App State   Infrastructure
                                              │
                               ┌──────────────┼──────────────┐
                               ▼              ▼              ▼
                           Future DB      Future APIs    Future AI
```

### Native Core Rules:
1. **Commands are Thin:** Commands validate IPC arguments, extract `State<'_, AppState>`, delegate to services, and return serialized DTOs.
2. **Services Coordinate:** Services (`HealthService`, `AppService`) contain application use-case logic and operate on pure domain entities.
3. **Domain is Portable:** Domain types (`HealthReport`, `AppInfo`) are independent of Tauri, SQLite, and network clients.
4. **State is Thread-Safe:** `AppState` holds `Arc`-wrapped services and `RwLock`-protected runtime timestamps (`Send + Sync`).
5. **Composition Root:** `Application::bootstrap()` in `src/core/application.rs` constructs the dependency graph explicitly.

---

### 1.3 Secure Tauri IPC Command & Event Architecture (Step 12)
Nano Route enforces a strict, typed, observable, and secured IPC boundary between the untrusted React frontend and the Rust native core:

```text
React Feature / Presentation
       │
       ▼
Typed IPC Service (src/services/ipc)
       │
┌───────────────┴───────────────┐
│ Command       │ Event/Channel │
└───────┬───────┴───────┬───────┘
        │               │
        ▼               ▼
   Rust Command    Rust Push Data
        │
        ▼
Application Services (HealthService, AppService)
        │
        ▼
Domain & Infrastructure
```

#### Communication Primitives:
- **Commands:** Request/response operations with typed DTOs, argument validation, and sanitized `AppError` returns.
- **Events:** Low-volume pub/sub notifications (`app_lifecycle_changed`, `diagnostic_notification`) with automatic listener cleanup and duplicate-listener prevention.
- **Channels:** Dedicated to high-throughput, ordered streaming (reserved for Step 15 AI token streaming and Step 16 local SLM inference).

---

| Layer | Technology | Version / Specification | Status |
|---|---|---|---|
| **OS Platform** | Windows 10/11 x64 | Windows 10.0.26100+ | EXISTING |
| **Desktop Shell** | Tauri v2 | `@tauri-apps/api` 2.12.4, `@tauri-apps/cli` 2.12.4 | EXISTING |
| **WebView Engine** | Microsoft Edge WebView2 | Runtime 157.0.4341.42 | EXISTING |
| **Frontend Framework** | React + React DOM | 18.3.1 | EXISTING |
| **Language (Web)** | TypeScript (Strict) | 5.6.3 | EXISTING |
| **Bundler & HMR** | Vite | 5.4.11 / 5.4.21 | EXISTING |
| **Native Language** | Rust (MSVC target) | Edition 2021 (Target: `x86_64-pc-windows-msvc`) | PLANNED (Host toolchain prereq) |
| **Database** | SQLite 3 | Embedded WAL mode (`rusqlite` / `r2d2`) | PLANNED (Step 4) |
| **Key Security** | Windows DPAPI | Win32 `CryptProtectData` / `CryptUnprotectData` | PLANNED (Step 5) |
| **Local SLM** | ONNX Runtime / GGUF | DirectML GPU / CPU quantized inference | PLANNED (Steps 11-14) |

---

## 3. Repository Structure

```text
d:\App Winrar Files\Nano Router SLM (Working)\
├── .gitignore                          # Git ignore rules for node_modules, dist, target
├── Nano Route Neon Tech Logo.png       # Official brand asset (670,255 bytes, preserved)
├── index.html                          # Single-page application entry point
├── package.json                        # Frontend & Tauri CLI dependencies
├── package-lock.json                   # Deterministic dependency lockfile
├── tsconfig.json                       # Strict TypeScript configuration
├── tsconfig.node.json                  # Node/Vite TypeScript configuration
├── vite.config.ts                      # Tauri-optimized Vite configuration
│
├── docs/                               # Baseline and architecture documentation
│   └── project/
│       ├── NANO_ROUTE_PROJECT_BASELINE.md
│       ├── NANO_ROUTE_REQUIREMENTS.md
│       ├── NANO_ROUTE_ARCHITECTURE_BASELINE.md
│       ├── NANO_ROUTE_ARCHITECTURE.md
│       ├── NANO_ROUTE_BUILD_AND_ENVIRONMENT.md
│       ├── NANO_ROUTE_DESIGN_SYSTEM.md
│       ├── NANO_ROUTE_DESKTOP_SHELL.md
│       ├── NANO_ROUTE_NAVIGATION.md
│       ├── NANO_ROUTE_DASHBOARD.md
│       ├── NANO_ROUTE_COMPONENT_LIBRARY.md
│       ├── NANO_ROUTE_RUST_CORE.md
│       ├── NANO_ROUTE_IPC.md
│       └── NANO_ROUTE_BUILD_STATUS.md
│
├── src/                                # Frontend application source
│   ├── app/
│   │   └── App.tsx                     # Root presentation component (ApplicationStateProvider + ToastProvider + Router)
│   ├── components/                     # Reusable interaction and UI component library (Step 10)
│   │   ├── ui/                         # 12 Core atomic UI primitives (Step 6 & 10)
│   │   │   ├── Button.tsx
│   │   │   ├── IconButton.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Textarea.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Divider.tsx
│   │   │   ├── Spinner.tsx
│   │   │   ├── Skeleton.tsx
│   │   │   ├── Tooltip.tsx
│   │   │   ├── StatusIndicator.tsx
│   │   │   └── index.ts
│   │   ├── forms/                      # Form field and search primitives (Step 10)
│   │   │   ├── FormField.tsx
│   │   │   ├── SearchField.tsx
│   │   │   └── index.ts
│   │   ├── feedback/                   # User feedback, toasts, and alerts (Step 10)
│   │   │   ├── Alert.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── Toast.tsx
│   │   │   ├── ToastContext.tsx
│   │   │   ├── ToastContainer.tsx
│   │   │   └── index.ts
│   │   ├── overlays/                   # Modal dialogs, menus, and popovers (Step 10)
│   │   │   ├── Dialog.tsx
│   │   │   ├── ConfirmDialog.tsx
│   │   │   ├── DropdownMenu.tsx
│   │   │   ├── Popover.tsx
│   │   │   └── index.ts
│   │   ├── navigation/                 # Navigation & tabs (Step 8 & 10)
│   │   │   ├── Sidebar.tsx
│   │   │   ├── SidebarSection.tsx
│   │   │   ├── SidebarItem.tsx
│   │   │   ├── Tabs.tsx
│   │   │   └── index.ts
│   │   ├── layout/                     # Section headers & scroll containers (Step 10)
│   │   │   ├── SectionHeader.tsx
│   │   │   ├── ScrollContainer.tsx
│   │   │   └── index.ts
│   │   ├── __tests__/                  # Component interaction unit tests (Step 10)
│   │   │   └── components.test.ts
│   │   └── index.ts                    # Centralized component export barrel
│   ├── features/                       # Domain feature modules (Step 9)
│   │   └── dashboard/
│   │       ├── components/
│   │       │   ├── DashboardHeader.tsx
│   │       │   ├── RuntimeStatusCard.tsx
│   │       │   ├── QuickActions.tsx
│   │       │   ├── CapabilityOverview.tsx
│   │       │   ├── MetricsOverview.tsx
│   │       │   ├── RecentActivity.tsx
│   │       │   └── DiagnosticDisclosure.tsx
│   │       ├── types.ts
│   │       └── index.ts
│   ├── layouts/                        # Desktop window & shell layout (Step 7 & 8)
│   │   ├── DesktopShell.tsx
│   │   ├── NavigationRegion.tsx
│   │   ├── MainContentRegion.tsx
│   │   ├── ShellErrorBoundary.tsx
│   │   ├── RootLayout.tsx
│   │   └── index.ts
│   ├── pages/                          # Destination route pages (Step 8 & 9)
│   │   ├── DashboardPage.tsx
│   │   ├── ChatPage.tsx
│   │   ├── HistoryPage.tsx
│   │   ├── SettingsPage.tsx
│   │   ├── LicensePage.tsx
│   │   ├── AboutPage.tsx
│   │   ├── ContactPage.tsx
│   │   ├── NotFoundPage.tsx
│   │   └── index.ts
│   ├── routes/                         # Centralized routing registry & router (Step 8)
│   │   ├── routePaths.ts
│   │   ├── navigation.ts
│   │   ├── router.tsx
│   │   └── index.ts
│   ├── state/                          # Global application runtime state (Step 9)
│   │   ├── application/
│   │   │   ├── applicationTypes.ts
│   │   │   ├── applicationReducer.ts
│   │   │   ├── ApplicationStateContext.tsx
│   │   │   └── __tests__/
│   │   │       └── applicationReducer.test.ts
│   │   └── index.ts
│   ├── services/
│   │   └── ipc/                        # Secure typed IPC client layer (Step 12)
│   │       ├── types.ts                # Request/response, event, and channel DTO contracts
│   │       ├── errors.ts               # IpcError class, error normalization, path/secret sanitization
│   │       ├── client.ts               # Low-level safeInvoke, request ID, mock registry
│   │       ├── commands.ts             # Typed command functions (health, app info, ping)
│   │       ├── events.ts               # Event subscriptions, useTauriEvent hook, cleanup
│   │       ├── channels.ts             # Channel contracts for ordered token streaming
│   │       ├── __tests__/              # IPC unit and integration test suite
│   │       │   └── ipc.test.ts
│   │       └── index.ts                # Public typed IPC barrel export
│   ├── styles/
│   │   ├── tokens.css                  # Design system tokens
│   │   ├── reset.css                   # Box-sizing & normalization
│   │   ├── index.css                   # Global base styles & Tailwind
│   │   └── App.css                     # Foundation layout styles
│   ├── types/
│   │   └── index.ts                    # Shared domain and IPC types
│   ├── main.tsx                        # React DOM mounting entry point
│   └── vite-env.d.ts                   # Vite client type definitions
│
└── src-tauri/                          # Rust native core source
    ├── Cargo.toml                      # Rust package and dependency manifest
    ├── build.rs                        # Tauri build script
    ├── tauri.conf.json                 # Tauri v2 application configuration
    ├── capabilities/
    │   └── default.json                # Minimal capability configuration
    └── src/
        ├── commands/                   # Thin IPC command handlers (Step 11 & 12)
        │   ├── mod.rs                  # Command router and re-exports
        │   ├── health.rs               # cmd_health_check, cmd_get_health
        │   ├── app.rs                  # cmd_get_app_info
        │   └── diagnostics.rs          # cmd_ping with input validation & request ID
        ├── core/                       # Composition root & lifecycle (Step 11)
        │   ├── mod.rs
        │   └── application.rs          # Application bootstrap & dependency graph
        ├── domain/                     # Pure domain models (Step 11)
        │   ├── mod.rs
        │   ├── health.rs               # SubsystemHealth, HealthReport, CoreStatus
        │   └── app_info.rs             # AppInfo domain entity
        ├── errors/                     # Unified error hierarchy (Step 11)
        │   └── mod.rs                  # AppError enum (Serialize, Display, Error)
        ├── inference/                  # Local SLM inference engine (Planned Step 13-14)
        │   └── mod.rs
        ├── infrastructure/             # OS & host adapters (Step 11)
        │   ├── mod.rs
        │   └── system.rs               # SystemInfoProvider
        ├── providers/                  # Provider traits and adapters (Planned Step 18-20)
        │   └── mod.rs
        ├── routing/                    # Router policy and fallback cascade (Planned Step 25-28)
        │   └── mod.rs
        ├── security/                   # Windows DPAPI and key vault (Planned Step 16-17)
        │   └── mod.rs
        ├── services/                   # Application service layer (Step 11)
        │   ├── mod.rs
        │   ├── health.rs               # HealthService
        │   └── app.rs                  # AppService
        ├── state/                      # Thread-safe managed application state (Step 11)
        │   ├── mod.rs
        │   └── app_state.rs            # AppState with Arc services & RwLock timestamps
        ├── storage/                    # SQLite connection & repositories (Planned Step 15)
        │   └── mod.rs
        ├── telemetry/                  # Local telemetry and metrics (Planned Step 32)
        │   └── mod.rs
        ├── lib.rs                      # Native core library setup & composition root
        └── main.rs                     # Windows application binary entry point
```

---

## 4. Frontend Architecture
The frontend is strictly responsible for presentation and interaction.

- **Desktop Shell Layout Hierarchy (Step 7):**
  ```text
  DesktopShell (src/layouts/DesktopShell.tsx)
  ├── NavigationRegion (src/layouts/NavigationRegion.tsx)
  └── MainContentRegion (src/layouts/MainContentRegion.tsx)
  ```
  - **Ownership Boundary:** The shell owns the desktop viewport frame, navigation reservation, and scroll boundaries. The shell does **NOT** own feature logic, provider logic, routing logic, or persistence.
  - **Sidebar Contract:** Full navigation, collapse, and route styling will be implemented by **Step 8 (Sidebar)** inside `NavigationRegion`.

- **Component Layering:**
  - `src/layouts/`: Desktop application frame (`DesktopShell`, `NavigationRegion`, `MainContentRegion`, `ShellErrorBoundary`).
  - `src/app/`: Application root orchestration (`App.tsx`).
  - `src/components/ui/`: Reusable, generic UI primitives (buttons, cards, badges, inputs). Must never contain Nano Route routing or domain logic.
  - `src/features/`: High-cohesion domain features (Chat, Router Matrix, Provider Settings, Telemetry Dashboard).
  - `src/services/ipc/`: Centralized native communication adapter. UI components never call `invoke()` directly.
  - `src/types/`: Authoritative contracts for data passing across the IPC boundary.
  - `src/styles/`: Theme definitions, utility styles, and typography.

---

## 5. Rust/Tauri Architecture
The Rust native core owns critical native operations:
- **`commands/`:** Validates incoming payloads from Tauri IPC and delegates immediately to application services.
- **`services/`:** Implements use-case business workflows (e.g. `ChatService::send_prompt`, `KeyService::store_key`).
- **`domain/`:** Represents pure business models without external dependencies on SQLite or HTTP clients.
- **`routing/`:** Evaluates user prompt complexity, matches model capabilities, evaluates costs, and selects provider candidates.
- **`inference/`:** Executes local SLM inference asynchronously on a dedicated thread pool to avoid blocking the Tokio async reactor.
- **`providers/`:** Implements a standardized asynchronous `Provider` trait for external APIs.
- **`security/`:** Interfaces with Windows DPAPI to encrypt keys at rest.
- **`storage/`:** Manages the SQLite database connection pool and repositories.
- **`telemetry/`:** Computes token spend, latency, and routing accuracy.

---

## 6. IPC Boundary
All communication between React and Rust crosses a strictly managed IPC boundary:

```text
React Component
      │ (calls typed method)
      ▼
src/services/ipc/index.ts
      │ (safeInvoke with error handling)
      ▼
Tauri Invoke Bridge (JSON Serialized)
      │
      ▼
src-tauri/src/commands/
      │ (dispatches to service)
      ▼
src-tauri/src/services/
```

- **Streaming:** Token generation uses Tauri's event bus (`window.listen("stream-chunk", handler)`). Rust buffers high-speed tokens into ~16ms batches to prevent WebView render stutter.
- **Error Normalization:** Errors returned across IPC are serialized into structured error objects `{ code: string, message: string }`.

---

## 7. State Ownership

| State Domain | Owner | Technology | Persistence |
|---|---|---|---|
| **UI Interactive State** | React Component | React `useState` / `useReducer` | Transient (Memory) |
| **Feature View State** | Frontend Store | Zustand (Planned) | Session / LocalStorage (Non-secret) |
| **Managed Native Services** | Rust Native Core | Tauri `State<AppServices>` | Process Lifetime (Arc/RwLock) |
| **API Credentials** | Rust Security Core | Windows DPAPI + In-Memory Zeroize | Encrypted SQLite at rest |
| **Chat & Message History** | Rust Storage Core | SQLite (WAL mode) | Local Disk (ACID Compliant) |
| **Routing Telemetry** | Rust Telemetry Core| SQLite (WAL mode) | Local Disk |

---

## 8. Domain Boundaries

1. **Routing Domain:** Knows about task types, model capabilities, pricing, latency, and scoring weights. Does NOT know about React components or raw HTTP request formatting.
2. **Provider Domain:** Knows how to format HTTP payloads for OpenAI, Anthropic, Gemini, Groq, and Ollama. Does NOT know which provider is "best" (that is the Routing Domain's responsibility).
3. **Security Domain:** Knows how to call Windows DPAPI `CryptProtectData` and zeroize buffers. Does NOT know how API keys are used in chat prompts.
4. **Storage Domain:** Knows SQL tables, migrations, and queries. Does NOT know business logic or prompt routing rules.

---

## 9. Dependency Direction

```text
Frontend Presentation
      │
      ▼
Frontend Services (IPC Adapter)
      │
      ▼
IPC Boundary (Tauri Commands / Events)
      │
      ▼
Native Commands Layer
      │
      ▼
Application Services Layer
      │
      ▼
Domain Layer ◄─── Infrastructure Layer (Inversion of Control via Traits)
```

**Rule:** Dependencies must always flow inward toward the domain. Outer layers may depend on inner layers; inner layers must NEVER depend on outer layers.

---

## 10. Module Ownership Matrix

| Module | Owner | Responsibility | Must Not Own | Status |
|---|---|---|---|---|
| `src/app/` | Frontend | Root shell & app composition | Business routing algorithms | **EXISTING** |
| `src/services/ipc/` | Frontend | Centralized native IPC bridge | Database SQL / Direct Crypto | **EXISTING** |
| `src/types/` | Frontend | Shared frontend data contracts | Implementation logic | **EXISTING** |
| `src/styles/` | Frontend | Foundational styling & themes | Component logic | **EXISTING** |
| `src/components/ui/` | Frontend | Reusable UI primitives | Routing / Domain logic | **PLANNED** |
| `src/features/` | Frontend | Feature views (chat, dashboard) | Direct OS / Provider calls | **PLANNED** |
| `src-tauri/src/commands/` | Rust | IPC command entry points | Heavy business algorithms | **EXISTING** (health) |
| `src-tauri/src/core/` | Rust | Application workflow orchestration | Low-level HTTP / UI | **PLANNED** |
| `src-tauri/src/domain/` | Rust | Pure domain entities & models | rusqlite / reqwest / UI | **PLANNED** |
| `src-tauri/src/errors/` | Rust | Unified error taxonomy | Unsanitized secret leaks | **PLANNED** |
| `src-tauri/src/inference/` | Rust | Local SLM inference engine | UI presentation / Remote HTTP | **PLANNED** |
| `src-tauri/src/infrastructure/`| Rust | OS helpers & HTTP transport | Product routing policies | **PLANNED** |
| `src-tauri/src/providers/` | Rust | AI provider adapters | Global candidate selection | **PLANNED** |
| `src-tauri/src/routing/` | Rust | Candidate scoring & fallback | React UI / Plaintext keys | **PLANNED** |
| `src-tauri/src/security/` | Rust | Windows DPAPI encryption | Plaintext key exposure to Web | **PLANNED** |
| `src-tauri/src/services/` | Rust | Use-case orchestration | Tauri WebView state | **PLANNED** |
| `src-tauri/src/state/` | Rust | Managed thread-safe state | Unsynchronized globals | **PLANNED** |
| `src-tauri/src/storage/` | Rust | SQLite persistence & migrations | Raw SQL exposure to Web | **PLANNED** |
| `src-tauri/src/telemetry/` | Rust | Local cost & latency metrics | Remote third-party trackers | **PLANNED** |

---

## 11. Security Boundaries

- **Zero Plaintext Credentials in Frontend:** The React frontend never receives, stores, or handles unencrypted API keys. The frontend only displays masked keys (e.g. `sk-ant-...a8f1`) and validation status badges.
- **Hardware/OS-Backed Encryption:** Keys stored on disk in SQLite are encrypted with Windows DPAPI (`CryptProtectData`), binding decryption to the active Windows user account.
- **Tauri Capability Confinement:** Capabilities in `src-tauri/capabilities/default.json` explicitly allow only required commands. Dangerous shell execution or arbitrary file dialogs are denied.
- **Safe Memory Handling:** In Rust, sensitive key strings are wrapped in zeroizing memory structures (`zeroize::Zeroizing<String>`) that overwrite memory buffers upon deallocation.

---

## 12. Future Extension Points

1. **New AI Providers:** Add a new module in `src-tauri/src/providers/<provider_name>.rs` implementing the `ProviderClient` trait. No changes required to routing or UI code.
2. **New SLM Engine:** Replace or add runtimes in `src-tauri/src/inference/` (e.g. switching between DirectML ONNX and llama.cpp GGUF) via the `InferenceEngine` trait.
3. **Custom Routing Policies:** Add routing heuristics or ML classifiers in `src-tauri/src/routing/` without modifying provider adapters.
4. **New Storage Engines:** Implement repository traits in `src-tauri/src/storage/` without altering application services.

---

## 13. Forbidden Dependency Patterns

The following patterns are strictly prohibited in Nano Route:
- ❌ **UI → Provider SDK:** Frontend calling Anthropic/OpenAI/Gemini directly.
- ❌ **UI → SQLite:** Frontend issuing raw SQL queries or managing database handles.
- ❌ **UI → DPAPI:** Frontend performing cryptographic operations.
- ❌ **Routing → UI:** Rust routing engine depending on frontend state or formatting HTML/JSX.
- ❌ **Provider → Routing:** Provider clients deciding model ranking or failover policies.
- ❌ **Circular Dependencies:** `Feature A → Feature B → Feature A` or `Domain → Infrastructure → Domain`.

---

## 14. Naming Conventions

### TypeScript & React
- **Components:** `PascalCase.tsx` (e.g., `App.tsx`, `ChatStudio.tsx`)
- **Modules / Utilities / Services:** `camelCase.ts` (e.g., `client.ts`, `checkNativeHealth.ts`)
- **Types / Interfaces:** `PascalCase` (e.g., `NativeHealthResponse`, `IpcResult<T>`)
- **Hooks:** `useCamelCase.ts` (e.g., `useRoutingMetrics.ts`)

### Rust
- **Files & Modules:** `snake_case.rs` (e.g., `health.rs`, `chat_service.rs`)
- **Structs / Enums / Traits:** `PascalCase` (e.g., `ProviderClient`, `RoutingDecision`)
- **Functions & Commands:** `snake_case` (e.g., `cmd_health_check`, `execute_route`)
- **Constants:** `SCREAMING_SNAKE_CASE` (e.g., `MAX_RETRY_ATTEMPTS`)

---

## 15. Testing Boundaries

- **Frontend Unit Tests:** `src/**/__tests__/*.test.tsx` using Vitest + React Testing Library (mocking `src/services/ipc`).
- **Rust Domain Unit Tests:** In-module `#[cfg(test)]` testing pure logic (scoring, token estimation, prompt parsing) without database or network dependencies.
- **Rust Integration Tests:** `src-tauri/tests/` testing SQLite migrations, DPAPI round-trip encryption, and fallback cascades.
- **E2E Smoke Tests:** Automated headless tests verifying the Tauri IPC bridge.

---

## 16. Configuration & Build System Ownership

Configuration ownership is strictly partitioned across specialized tooling:
- **Frontend build:** Vite (`vite.config.ts`)
- **Frontend types:** TypeScript (`tsconfig.json`, `tsconfig.node.json`)
- **Rust build:** Cargo (`src-tauri/Cargo.toml`)
- **Desktop shell:** Tauri v2 (`src-tauri/tauri.conf.json`)
- **Windows packaging:** Tauri Bundler (`src-tauri/tauri.conf.json`, `src-tauri/icons/`)
- **Package dependencies:** npm (`package.json`, `package-lock.json`)
- **Environment variables:** Approved client-safe `.env` strategy (`.env.example`)
- **API Credentials & Secrets:** Future native secure vault (Windows DPAPI + Rust native core)

---

## 17. Current Deviations From Target Architecture
- **Host Rust Toolchain Missing:** Native compilation is currently blocked on the host system because `rustup`/`cargo` are not yet installed in the OS PATH.
- **Placeholder Rust Modules:** Modules in `src-tauri/src/` (`core`, `domain`, `errors`, `inference`, `infrastructure`, `providers`, `routing`, `security`, `services`, `state`, `storage`, `telemetry`) currently exist as documented architectural boundaries. Implementation will be built incrementally across Steps 4–50.

---

## 18. Architectural Risks

1. **Host Toolchain Prerequisite:** `rustc` and `cargo` must be installed before Step 5 native code can be compiled.
2. **IPC Throughput with High-Speed Streaming:** Providers like Groq stream 200+ tokens/sec. High-frequency individual IPC events can choke WebView2. Mitigation: Batching token deltas into ~16ms frames in Rust.
3. **Local SLM Memory Footprint:** Running a 1B–3B parameter model on a workstation with 8GB RAM could induce swap thrashing. Mitigation: Support ultra-lightweight classifiers (e.g. 0.5B / quantized INT4) and rule-based heuristic fallbacks.

---

## 19. Change History

| Version | Date | Description | Author |
|---|---|---|---|
| **1.0.0** | November 2026 | Initial Production Folder Architecture & Module Boundaries Specification | Senior Principal Software Architect |
| **1.1.0** | November 2026 | Added Configuration & Build System Ownership Specification (Step 4) | Senior Principal Software Architect |
| **1.2.0** | November 2026 | Added Desktop Shell & Layout Hierarchy Specification (Step 7) | Senior Principal Desktop Application Architect |

---
*End of Architecture Document. Source of Truth for Step 7.*

