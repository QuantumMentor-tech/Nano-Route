# Nano Route Rust Core & Service Architecture
**Document ID:** `NR-DOC-CORE-001`  
**Step:** 11 of 50  
**Status:** Approved & Implemented  
**Date:** November 2026  
**Audience:** Rust Engineers, Backend Architects, Tauri v2 Engineers, Systems Architects, QA Engineers  

---

## 1. Native Core Purpose
The Nano Route native core is the trusted, local execution engine of the desktop application. Its role is to execute system-level operations, secure credential protection via Windows DPAPI, embedded SQLite storage, asynchronous external AI provider communication, and on-device Small Language Model (SLM) quantized inference.

The native core enforces strict separation of concerns, ensuring that Tauri commands remain thin IPC handlers, while application services coordinate use cases, domain entities encapsulate business concepts, and infrastructure adapters isolate external interfaces.

---

## 2. Tauri Boundary
The Tauri IPC boundary forms the contract between the untrusted web frontend (React + TypeScript) and the trusted Rust core:
```text
React / TypeScript Frontend
            │
            ▼
   Frontend IPC Service (safeInvoke)
            │  JSON-RPC Message Passing
            ▼
    Tauri Command Handlers (src-tauri/src/commands/)
            │
            ▼
 Application Services (src-tauri/src/services/)
```

### Boundary Constraints:
- Commands are the sole entry points for IPC invocations.
- Commands accept validated arguments and a managed state reference (`tauri::State<'_, AppState>`).
- Commands delegate immediately to an application service and convert domain models into IPC-safe DTOs.
- Commands never perform raw database queries, network requests, or cryptographic operations.

---

## 3. Commands
Commands reside in `src-tauri/src/commands/` and are grouped by domain:

| Command Identifier | Module | Input | Return Type | Responsibility | Status |
|---|---|---|---|---|---|
| `cmd_health_check` | `commands::health` | None | `String` | Legacy smoke-test verifying IPC bridge connectivity | IMPLEMENTED |
| `cmd_get_health` | `commands::health` | None | `Result<HealthReport, String>` | Full structured health report of all native subsystems | IMPLEMENTED |
| `cmd_get_app_info` | `commands::app` | None | `Result<AppInfo, String>` | Authoritative application build metadata and environment | IMPLEMENTED |
| `cmd_chat_send` | `commands::chat` | `ChatRequestDto` | `Result<ChatResponseDto, AppError>` | Conversational execution | DEFERRED (Step 24) |
| `cmd_save_key` | `commands::security` | `KeyStorageDto` | `Result<(), AppError>` | DPAPI credential storage | DEFERRED (Step 12) |
| `cmd_route_task` | `commands::routing` | `TaskPromptDto` | `Result<RouteDecisionDto, AppError>` | Model evaluation | DEFERRED (Step 17) |

---

## 4. Application Services
The service layer (`src-tauri/src/services/`) coordinates application operations without exposing Tauri internals:

1. **`HealthService` (`src/services/health.rs`):**
   - Coordinates native core subsystem inspections.
   - Generates the authoritative `HealthReport` containing status for the IPC bridge, state manager, and infrastructure adapters.
   - Provides legacy `check_health_string()` helper for backward compatibility.
2. **`AppService` (`src/services/app.rs`):**
   - Coordinates application identity, versioning, environment (`development` vs `production`), target OS, and architecture.
3. **Future Services:**
   - `RoutingService` (PLANNED: Step 17)
   - `ProviderService` (PLANNED: Step 19)
   - `StorageService` (PLANNED: Step 12)
   - `SecurityService` (PLANNED: Step 12)
   - `InferenceService` (PLANNED: Step 13)

---

## 5. Domain Layer
The domain layer (`src-tauri/src/domain/`) contains pure Rust entities, values, and business rules completely independent of Tauri, WebViews, SQLite, and network clients:
- **`CoreStatus`:** Enumerates lifecycle readiness (`Ready`, `Degraded`, `Initializing`, `Error`).
- **`SubsystemHealth`:** Represents the health and diagnostic note of a discrete subsystem.
- **`HealthReport`:** Aggregated operational status report of the entire application.
- **`AppInfo`:** Application name, version, environment, OS, and architecture.

---

## 6. Infrastructure Layer
The infrastructure layer (`src-tauri/src/infrastructure/`) encapsulates concrete operating system and external platform details:
- **`SystemInfoProvider` (`src/infrastructure/system.rs`):** Inspects `std::env::consts::OS`, `std::env::consts::ARCH`, and `cfg!(debug_assertions)` to safely deliver host environment details without external dependencies.
- **Future Infrastructure:**
  - `WindowsDpapiVault` (PLANNED: Step 12)
  - `SqliteConnectionPool` (PLANNED: Step 12)
  - `OnnxDirectMlEngine` (PLANNED: Step 13)
  - `HttpProviderClient` (PLANNED: Step 19)

---

## 7. Application State
Long-lived application state is managed by Tauri through `src-tauri/src/state/app_state.rs`:
```rust
pub struct AppState {
    pub app_service: Arc<AppService>,
    pub health_service: Arc<HealthService>,
    pub initialized_at: RwLock<Option<String>>,
}
```
### State Rules:
- Registered once via `tauri::Builder::default().manage(app_state)`.
- Services are stored inside `Arc` wrappers, allowing zero-copy sharing across Tokio async worker threads.
- Mutable runtime timestamps are protected by `std::sync::RwLock`.
- Transient request data and credentials are never stored in global state.

---

## 8. Composition Root
`src-tauri/src/core/application.rs` acts as the explicit dependency composition root:
```rust
impl Application {
    pub fn bootstrap() -> Result<AppState, AppError> {
        let app_service = Arc::new(AppService::new());
        let health_service = Arc::new(HealthService::new());
        let state = AppState::new(app_service, health_service);
        state.mark_initialized("2026-11-07T00:00:00Z");
        Ok(state)
    }
}
```
`src-tauri/src/lib.rs` executes `Application::bootstrap()`, attaches state to the builder, registers commands, and launches the application context.

---

## 9. Dependency Construction
- Dependencies are constructed explicitly in Rust; no heavyweight dependency injection containers, reflection frameworks, or macro-based service locators are used.
- Constructors accept their concrete dependencies or trait interfaces.

---

## 10. Async Model
- Asynchronous commands utilize the Tokio multi-threaded runtime provided natively by Tauri v2.
- Genuinely fast, local operations (such as reading cached health reports or app metadata) execute synchronously without unneeded async overhead.
- Heavy operations (future SLM inference and HTTP calls) will execute asynchronously on Tokio worker threads without blocking the main OS event loop.

---

## 11. Error Flow
1. **Infrastructure/Domain Failure:** Low-level failure occurs.
2. **Normalized AppError:** Service maps the failure into `AppError` (`ServiceUnavailable`, `InitializationFailed`, `InvalidInput`, `Internal`).
3. **Safe Serialization:** Command boundary converts `AppError` into a structured, sanitized error payload.
4. **Frontend Consumer:** Frontend IPC client catches the rejected promise and populates error state in the UI.

---

## 12. Logging Flow
- High-level lifecycle transitions and subsystem initialization events are logged through safe diagnostic sinks.
- Boundary commands record operation entries and sanitized error codes.
- Raw API keys, plaintext credentials, and user prompt contents are strictly forbidden from log outputs.

---

## 13. IPC DTOs
All data crossing the Tauri IPC boundary derives `serde::Serialize` and `serde::Deserialize`:
- Internal memory pointers, mutexes, raw sockets, and file descriptors never cross the IPC boundary.
- DTOs match the corresponding TypeScript interfaces defined in `src/types/index.ts`.

---

## 14. Thread Safety
- `AppState` satisfies `Send + Sync`.
- No `unsafe` code or `unsafe impl Send / Sync` is permitted.
- `RwLock` read and write locks are held for the minimal duration required and never across `.await` points.

---

## 15. Lifecycle
The application core progresses through explicit lifecycle states:
```text
Uninitialized ──> Bootstrap ──> Initializing ──> Ready ──> Shutdown
```
State readiness is recorded in `AppState::initialized_at`.

---

## 16. Future Provider Boundary
*Status: PLANNED (Step 19)*  
The service layer will interact with external AI providers exclusively through a standardized `ProviderClient` trait defining streaming and completion methods. Individual provider SDKs will never be called directly from commands.

---

## 17. Future SLM Boundary
*Status: PLANNED (Step 13)*  
The local Small Language Model router will be encapsulated behind an `InferenceRuntime` trait. Concrete implementations (ONNX Runtime / DirectML or llama.cpp / GGUF) will be swappable without altering application services.

---

## 18. Future Storage Boundary
*Status: PLANNED (Step 12)*  
SQLite persistence will be abstracted behind repository traits (`ConversationRepository`, `SettingsRepository`). SQL query strings and database handles will remain strictly inside infrastructure adapters.

---

## 19. Future Routing Boundary
*Status: PLANNED (Step 17)*  
The intelligent model routing matrix will receive task classifications from the SLM service and dispatch requests through candidate scoring policies.

---

## 20. Forbidden Patterns
- ❌ Do NOT place business logic, SQL queries, or HTTP requests inside `commands/` or `lib.rs`.
- ❌ Do NOT use global mutable singletons (`static mut`).
- ❌ Do NOT hold locks across asynchronous await points or long-running computations.
- ❌ Do NOT serialize raw internal state, file descriptors, or secrets over Tauri IPC.
- ❌ Do NOT use `unsafe` blocks for convenience.

