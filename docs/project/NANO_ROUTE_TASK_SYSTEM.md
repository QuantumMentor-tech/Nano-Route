# Nano Route Task System
**Document Version:** 1.0.0  
**Step:** 13 of 50 — Background Task & Async Execution Infrastructure  
**Date:** November 2026  
**Status:** APPROVED BASELINE (BACKGROUND TASK & ASYNC EXECUTION INFRASTRUCTURE ESTABLISHED)  

---

## 1. Purpose
The Nano Route Task System provides native asynchronous execution, cooperative cancellation, bounded concurrency, lifecycle state management, and ordered application shutdown. 

Its core objective is to ensure that future high-demand workloads (local SLM inference, cloud AI provider calls, model downloads, and background telemetry) execute without freezing the desktop UI thread, overflowing CPU resources, or accumulating unmanaged background futures.

---

## 2. Task Ownership
Every managed background task has a designated owner:
- **Application Core:** Startup bootstrapping, health monitoring, and shutdown sweeps.
- **Feature Services:** Future provider dispatchers, SLM runtime managers, and database workers.
- **Maintenance:** Cache pruning, temporary file deletion, and connection pool recycles.

Anonymous or untracked tasks (`tokio::spawn` without registration and lifecycle ownership) are strictly prohibited.

---

## 3. Task IDs
Every task receives a strongly-typed `TaskId` (`task_<prefix>_<timestamp>_<counter>`):
- **Unique:** Monotonically incrementing atomic counters combined with millisecond timestamps guarantee session uniqueness.
- **Non-Secret:** Safe to write to diagnostic logs and UI state disclosures.
- **Structured:** Embeds the task kind prefix (e.g., `task_io_...`, `task_cpu_...`, `task_bg_...`).
- **Separate from Request IDs:** An IPC `requestId` represents an incoming user/UI operation, whereas `TaskId` represents an internal execution unit.

---

## 4. Task Metadata
Managed tasks track sanitized diagnostic metadata represented by `TaskMetadata`:
- `task_id`: Unique task identifier.
- `kind`: Task classification (`Application`, `Maintenance`, `Background`, `Blocking`, `CpuBound`, `Io`).
- `status`: Current lifecycle state (`Created`, `Queued`, `Running`, `Cancelling`, `Completed`, `Failed`, `Cancelled`).
- `owner`: Subsystem or service name owning the task.
- `created_at`: UTC ISO 8601 creation timestamp.
- `started_at`: Optional execution start timestamp.
- `finished_at`: Optional completion timestamp.
- `parent_task_id`: Optional parent task identifier.
- `cancellable`: Boolean indicating cooperative cancellation support.
- `error_message`: Sanitized failure description if terminated with an error.

*Privacy Guarantee:* Task metadata strictly omits user prompts, provider credentials, API keys, and model response bodies.

---

## 5. Task States
The Task System defines seven mutually exclusive lifecycle states:
- **`Created`:** Task allocated and registered.
- **`Queued`:** Awaiting a concurrency permit or runtime thread scheduling.
- **`Running`:** Work is actively executing.
- **`Cancelling`:** Cooperative cancellation requested; awaiting task exit.
- **`Completed`:** Terminal state; task finished successfully.
- **`Failed`:** Terminal state; task finished with an error or unhandled panic.
- **`Cancelled`:** Terminal state; task exited cooperatively in response to cancellation.

---

## 6. State Transitions
The `TaskStatus` state machine strictly regulates transitions:

```text
Created
  ├──→ Queued
  ├──→ Running
  └──→ Cancelled
        │
Queued ─┼──→ Running
        └──→ Cancelled
              │
Running ──────┼──→ Completed (terminal)
              ├──→ Failed (terminal)
              ├──→ Cancelling
              └──→ Cancelled (terminal)
                    │
Cancelling ───┼──→ Cancelled (terminal)
              ├──→ Completed (race condition: task finished while cancel arrived)
              └──→ Failed (terminal)
```

Terminal states (`Completed`, `Failed`, `Cancelled`) can never transition to any other state. Retrying an operation always allocates a new `TaskId`.

---

## 7. TaskManager
The `TaskManager` engine (`src-tauri/src/core/tasks/manager.rs`) is the centralized composition root for background work:
- Registered as an application-lifetime dependency in Tauri's managed `AppState` (`Arc<TaskManager>`).
- Coordinates task registration, active tracking, cancellation signaling, concurrency limits, and shutdown sweeps.
- Owns task lifecycle, while business services own the actual task domain results.

---

## 8. Async Task Policy
Naturally asynchronous tasks (I/O, timers, channels) execute on the native Tokio/Tauri async runtime via `manager.spawn(...)`:
- No secondary Tokio runtimes (`Runtime::new()` inside application services is prohibited).
- Non-blocking execution ensures the Tauri UI main thread remains 100% fluid.

---

## 9. Blocking Task Policy
Synchronous or blocking workloads (blocking disk reads, legacy synchronous libraries) execute on Tokio's blocking threadpool via `manager.spawn_blocking(...)`:
- **Prohibition:** Synchronous blocking calls must never execute directly inside ordinary async tasks.
- **Limitation:** As documented by Tokio, blocking threads cannot be aborted once started. Cancellation of blocking tasks is strictly cooperative (closures must periodically evaluate `context.is_cancelled()`).

---

## 10. CPU-Bound Task Policy
Compute-heavy workloads (future model quantization, local tokenizer encoding, SLM prompt processing) are classified as `TaskKind::CpuBound`:
- Enforces strict concurrency bounds via `TaskConcurrencyLimiter`.
- Prevents unlimited compute threads from starving host OS CPU cores or causing fan-out lockups.

---

## 11. Cancellation
Cooperative cancellation is implemented using `tokio_util::sync::CancellationToken`:
- Three distinct concepts are maintained:
  1. *Cancel Requested:* Signal dispatched via `manager.cancel(task_id)` or `handle.cancel()`.
  2. *Cancellation Observed:* Task code reaches an evaluation point (`tokio::select!` or `ctx.is_cancelled()`).
  3. *Cancelled:* Task terminates and marks terminal status `TaskStatus::Cancelled`.

---

## 12. Parent/Child Tasks
Supports hierarchical cancellation using `CancellationToken::child_token()`:
- **Parent to Child:** Cancelling a parent task automatically cancels all derived child tasks.
- **Child Isolation:** Cancelling a single child task does not cancel the parent or sibling tasks.

---

## 13. Concurrency Limits
Managed by `TaskConcurrencyLimiter` using `tokio::sync::Semaphore`:
- **CPU Bound Limit:** Default `2` concurrent tasks (bounded compute).
- **Blocking Limit:** Default `8` concurrent tasks (bounded blocking I/O).
- **Async I/O:** Pass-through without semaphore exhaustion.

---

## 14. Task Registry
Active in-flight tasks are tracked in `TaskRegistry`:
- Synchronized with `std::sync::RwLock` for high read concurrency.
- Locks are released immediately after lookup; locks are never held across `.await` points or during long operations.
- **Automatic Cleanup:** Tasks are removed from the registry upon reaching terminal status (`Completed`, `Failed`, `Cancelled`), preventing unbounded memory leaks.

---

## 15. Shutdown
Application termination follows a strict sequence via `manager.shutdown(timeout)`:
1. `is_shutting_down` flag set to `true`: All subsequent task spawns are immediately rejected with `AppError::ServiceUnavailable`.
2. Root shutdown cancellation token triggered: Signals cooperative cancellation to all active tasks and child trees.
3. Awaits completion of in-flight tasks up to the configured bounded `timeout`.
4. If tasks fail to terminate within the timeout, logs safe diagnostic records of abandoned tasks and clears the registry before process exit.

---

## 16. Error Handling
- Task closures return `Result<T, AppError>`.
- Failures are recorded as `TaskStatus::Failed` with sanitized error descriptions.
- `TaskHandle::await_result()` catches task panics (`JoinError::is_panic()`) and converts them into normalized `AppError::Internal` without crashing the application.

---

## 17. Logging
Diagnostic task logging records operational parameters:
- `task_id`, `kind`, `owner`, `status`, `duration_ms`, and sanitized error codes.
- Payload bodies, user prompt text, and external provider tokens are strictly omitted.

---

## 18. Request vs Task IDs
- **`RequestId` (`req_...`):** Represents an IPC user command or frontend transaction.
- **`TaskId` (`task_...`):** Represents a native background execution unit.
- One `RequestId` may initiate zero, one, or multiple coordinated `TaskId` execution units.

---

## 19. Testing
A comprehensive verification suite in `src/services/ipc/__tests__/tasks.test.ts` validates:
- State machine legal and forbidden transitions.
- Parent-child cancellation hierarchy and child isolation.
- Bounded concurrency permit limits.
- Memory leak prevention and registry cleanup.
- Shutdown rejection and report schemas.
- Diagnostic metadata schema cleanliness.

---

## 20. Future SLM Integration
*(PLANNED — Step 16)*  
The local SLM inference engine will execute as bounded `CpuBound` tasks with periodic cancellation checkpoints between generated tokens.

---

## 21. Future Provider Integration
*(PLANNED — Step 15)*  
Cloud AI provider requests will execute as cancellable `Io` tasks with individual operational timeouts.

---

## 22. Future Streaming Integration
*(PLANNED — Step 15)*  
Task lifecycle states (`Queued`, `Running`, `Completed`, `Cancelled`) will drive stream start, progress, and terminal signals over Tauri channels.

---

## 23. Forbidden Patterns
1. **No Unmanaged Spawning:** Raw `tokio::spawn` without `TaskManager` registration is forbidden.
2. **No Synchronous Sleep in Async:** `std::thread::sleep` inside async tasks is forbidden.
3. **No Unbounded CPU Execution:** CPU workloads must acquire a bounded permit.
4. **No Locks Across Await:** Mutex/RwLock guards must never be held across `.await` points.
5. **No Infinite In-Memory Task Retention:** Completed tasks must be purged from the active registry.
6. **No Secondary Tokio Runtimes:** All native tasks execute on Tauri's established runtime.

---
*End of Task System Architecture. Step 13 Completed.*

