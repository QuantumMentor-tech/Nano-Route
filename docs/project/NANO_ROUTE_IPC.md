# Nano Route IPC Architecture
**Document Version:** 1.0.0  
**Step:** 12 of 50 — Secure Tauri IPC Command & Event Architecture  
**Date:** November 2026  
**Status:** APPROVED BASELINE (TYPED COMMAND, EVENT & CHANNEL FOUNDATION ESTABLISHED)  

---

## 1. IPC Purpose
The Nano Route Inter-Process Communication (IPC) architecture establishes a secure, typed, observable, and strictly controlled boundary between the React/TypeScript presentation layer and the native Rust application core. 

The primary objective is to enable safe command execution, application state notifications, and future ordered high-throughput streaming (for local SLM and cloud AI providers) without permitting arbitrary or uncontrolled frontend access to the native operating system, filesystem, network, or credential vaults.

---

## 2. Trust Boundary
The frontend is treated as an **untrusted client boundary**. Even though the frontend is packaged and distributed within the Tauri desktop application bundle, native security principles dictate that the web runtime (WebView2) cannot be granted direct access to native system resources.

```text
React / TypeScript (Untrusted Presentation Layer)
       │
       ▼
Frontend IPC Client Layer (Validation, Request ID, Safe Invoke)
       │
       ▼
Tauri IPC Boundary (Commands / Events / Channels)
       │
       ▼
Rust Command Layer (Thin Boundary, Input Verification)
       │
       ▼
Application Service Layer (HealthService, AppService)
       │
       ▼
Domain / Infrastructure (Pure Logic, OS Adapters)
```

### Architectural Principles:
1. **Frontend asks, Rust verifies:** UI components never directly invoke native system commands, access files, execute processes, or decrypt stored credentials.
2. **Commands contain zero business logic:** Rust commands serve purely as thin IPC transport adapters.
3. **No transport leakage:** UI components do not import `@tauri-apps/api/core` or `@tauri-apps/api/event`. All interactions are mediated through typed methods in `src/services/ipc`.

---

## 3. Commands
Commands represent unary request/response operations between the frontend and native Rust core:
- **Asynchronous Execution:** All commands execute asynchronously, preventing UI thread blocking.
- **Strictly Typed Inputs & Outputs:** Every command accepts a typed request DTO and returns a typed `Result<T, AppError>`.
- **Stateless Handlers:** Handlers access dependency-injected application services via `tauri::State<'_, AppState>`.

---

## 4. Command Naming
A single authoritative naming convention is enforced across Rust and TypeScript:
- **Convention:** `cmd_<domain>_<action>` or `cmd_<action>` for global operations.
- **Unique Registration:** Command names are globally unique in the generated handler registry to eliminate registration collisions.

Authoritative command identifiers (`IPC_COMMANDS`):
- `cmd_health_check`: Smoke-test backward compatibility command.
- `cmd_get_health`: Structured domain health inspection.
- `cmd_get_app_info`: Application metadata and platform architecture inspection.
- `cmd_ping`: Diagnostic round-trip with argument validation and correlation ID echoing.

---

## 5. Command DTOs
All command payloads utilize explicit Data Transfer Objects (DTOs) rather than loose string maps or raw domain entities:
- **`PingRequest`:** `{ message: String, request_id: Option<String> }`
- **`PingResponse`:** `{ message: String, request_id: String, timestamp: String, duration_ms: u64 }`
- **`HealthReport`:** `{ status: CoreStatus, message: String, subsystems: Vec<SubsystemHealth>, timestamp: String }`
- **`AppInfo`:** `{ name: String, version: String, environment: String, target_os: String, arch: String }`

---

## 6. Request Validation
Every native command treats frontend arguments as untrusted input. Validation occurs in two defense layers:
1. **Frontend Client Validation:** Pre-flight checks in `src/services/ipc/commands.ts` reject malformed or empty payloads before transport overhead.
2. **Native Rust Validation:** In `src-tauri/src/commands/diagnostics.rs`, commands enforce:
   - Non-empty constraints (e.g., whitespace-only messages rejected).
   - Maximum size bounds (`MAX_PING_MESSAGE_LEN = 256` bytes).
   - Format validation.
   - Any validation failure immediately returns `Err(AppError::InvalidInput(...))`.

---

## 7. Error Contract
Errors returned across the IPC boundary conform to a standardized contract matching Step 11's `AppError` and Step 6's diagnostic categorization:

```typescript
export interface IpcErrorPayload {
  code: IpcErrorCode | string;
  category: "ServiceUnavailable" | "InitializationFailed" | "InvalidInput" | "Internal";
  message: string;
  retryable: boolean;
  userActionRequired?: boolean;
  requestId?: string;
}
```

### Error Sanitization:
- Local drive letters and filesystem paths (`C:\Users\...`, `/home/...`) are scrubbed and replaced with `[REDACTED_PATH]`.
- API keys, authorization tokens, bearer tokens (`Bearer ...`, `sk-...`, `api_key=...`) are scrubbed and replaced with `[REDACTED_SECRET]`.
- Raw internal panics or stack traces are never exposed to the frontend.

---

## 8. Events
Events provide lightweight, low-volume publish/subscribe notifications:
- **Direction:** Native Rust core push to frontend (or internal frontend test emitter).
- **Prohibition:** Events are **never** used for high-frequency token streams or bulk data.
- **Typed Payloads:** Every event is mapped to an explicit TypeScript interface in `IpcEventPayloadMap`.

Authoritative Event Identifiers:
- `app_lifecycle_changed`: Emitted when the desktop application transitions lifecycle states.
- `diagnostic_notification`: Emitted for operational diagnostic notices.

---

## 9. Channels
Channels provide high-throughput, ordered binary and text streaming:
- **Tauri v2 Channels:** Reserved for Step 14 (Model Downloads), Step 15 (AI Provider Token Streaming), and Step 16 (Local SLM Token Streaming).
- **Ordered Sequencing:** `ChannelStreamChunk<T>` enforces `chunkIndex`, `isFinal`, and `requestId` tracking.
- **Rule of Thumb:**
  - *Commands:* Unary request/response.
  - *Events:* Low-volume notification.
  - *Channels:* High-throughput streaming data.

---

## 10. Frontend IPC Client
The frontend IPC client (`src/services/ipc/client.ts`) wraps all native calls:
- Attaches or generates correlation `requestId` for every request (`req_<timestamp>_<random>_<counter>`).
- Provides deterministic test mock registry (`registerMockCommandHandler`, `setMockTauriContext`) allowing 100% of frontend components to be tested headlessly without spinning up a live Tauri process.
- Detects browser development mode and provides safe fallback responses without throwing unhandled exceptions.

---

## 11. Listener Lifecycle
Every frontend event listener adheres to strict lifecycle management to prevent memory leaks and duplicate handler accumulation:
- `subscribeToEvent` returns an explicit `UnlistenFn` callback.
- `useTauriEvent` hook:
  - Subscribes on mount.
  - Stores callback in a React `useRef` to prevent stale closures without re-triggering subscriptions on re-renders.
  - Cleans up listener on component unmount or when the target event changes.
  - Cancels listener registration if the component unmounts before an asynchronous `listen()` promise resolves.

---

## 12. Capabilities
Tauri v2 security capabilities are defined in `src-tauri/capabilities/default.json`:
- Mapped exclusively to the `main` application window.
- Grants minimal baseline capability (`core:default`).
- **No Dangerous Plugins:** No filesystem plugins (`tauri-plugin-fs`), no shell plugins (`tauri-plugin-shell`), and no process execution plugins (`tauri-plugin-process`) are registered or permitted.

---

## 13. Permissions
- Commands registered via `tauri::generate_handler!` are scoped to the application binary.
- Custom capabilities will be added incrementally in lockstep with feature steps (e.g. SQLite storage permissions in Step 15, DPAPI permissions in Step 16).
- Principle of Least Privilege: Frontend only has access to currently implemented commands.

---

## 14. Command Inventory

| Command | Rust Owner | Frontend Consumer | Permission | Input | Output | Sensitive? | Status |
|---|---|---|---|---|---|---|---|
| `cmd_health_check` | `commands::health` | `ApplicationStateContext` | `core:default` | None | `String` | No | **IMPLEMENTED** |
| `cmd_get_health` | `commands::health` | IPC service / Dashboard | `core:default` | None | `HealthReport` | No | **IMPLEMENTED** |
| `cmd_get_app_info` | `commands::app` | IPC service / About | `core:default` | None | `AppInfo` | No | **IMPLEMENTED** |
| `cmd_ping` | `commands::diagnostics` | IPC service / Diagnostics | `core:default` | `PingRequest` | `PingResponse` | No | **IMPLEMENTED** |

---

## 15. Event Inventory

| Event | Owner | Consumers | Payload | Frequency | Sensitive? | Status |
|---|---|---|---|---|---|---|
| `app_lifecycle_changed` | Native Core | Application State | `AppLifecycleEventPayload` | Low (< 1 / min) | No | **IMPLEMENTED (Contract)** |
| `diagnostic_notification` | Diagnostic Subsystem | Toast / Dashboard | `DiagnosticEventPayload` | Low (On error/notice) | No | **IMPLEMENTED (Contract)** |

---

## 16. Planned Channels

| Channel | Future Purpose | Direction | Data Type | Planned Step | Status |
|---|---|---|---|---|---|
| `chat_token_stream` | AI provider token streaming | Rust to Frontend | `TokenChunk` | Step 15 | **PLANNED** |
| `slm_inference_stream` | Local SLM inference token streaming | Rust to Frontend | `TokenChunk` | Step 16 | **PLANNED** |
| `model_download_stream` | Quantized model weight download progress | Rust to Frontend | `DownloadProgressChunk` | Step 14 | **PLANNED** |

---

## 17. Security Rules
1. **Zero Raw Tauri Access in UI:** Feature components must never import from `@tauri-apps/api`.
2. **Payload Redaction:** Error messages must never leak credentials, session tokens, passwords, or absolute filesystem paths.
3. **No Wildcard Capabilities:** Capabilities must never specify wildcard `*` command permissions.
4. **Mandatory Argument Validation:** Every command must validate strings, lengths, and ranges prior to execution.

---

## 18. Logging Rules
1. **Lifecycle Only:** Only command initiation, duration, outcome, and error codes are logged.
2. **Zero Payload Logging:** Command argument bodies and response payloads are omitted from standard logs.
3. **Sanitized Diagnostics:** Diagnostic disclosures only display sanitized, non-secret metadata.

---

## 19. Testing Strategy
1. **Deterministic Mocking:** `setMockTauriContext` and `registerMockCommandHandler` allow complete test coverage without running a live WebView or Rust compiler.
2. **Input Validation Testing:** Tests verify that empty strings and oversized payloads are rejected with `INVALID_INPUT`.
3. **Sanitization Testing:** Tests verify regex redaction of Windows paths, POSIX paths, and secret tokens.
4. **Listener Lifecycle Testing:** Tests verify that listeners detach on unmount and do not accumulate duplicates.

---

## 20. Performance Rules
1. **Small DTOs:** Commands exchange compact, focused JSON DTOs.
2. **Async Delegation:** Long operations delegate to background worker threads; the Tauri command thread is never blocked.
3. **Channels Over Polling:** High-frequency data uses push channels, never rapid timer polling.

---

## 21. Current Limitations
- Host OS lacks a local Rust/Cargo compiler; native Rust compilation is blocked pending host developer toolchain installation (`rustup-init.exe` and MSVC Build Tools).
- Streaming channels are implemented at the architectural and contract level; real token streaming will be activated during Step 15.

---

## 22. Future Extensions
- **Step 14:** Model download streaming channels and storage commands.
- **Step 15:** Cloud AI provider streaming channels and secure request orchestration.
- **Step 16:** Local SLM inference streaming channels and DirectML acceleration telemetry.
- **Step 17:** DPAPI credential storage IPC commands with zero frontend secret exposure.

---
*End of IPC Architecture Specification. Step 12 Completed.*

