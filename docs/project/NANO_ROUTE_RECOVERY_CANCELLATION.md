# Nano Route — Recovery, Cancellation & Execution Lifecycle Control (Step 35)

## Overview & Architecture

Step 35 introduces deterministic execution lifecycle control, cooperative cancellation, and reliability invariants across Nano Route's native core and frontend Chat Studio.

Prior to Step 35, chat request execution and streaming relied on unstructured promises without formal lifecycle states or cooperative cancellation mechanisms. Step 35 establishes a formal execution state machine, stable correlation via `execution_id`, cooperative cancellation using `tokio_util::sync::CancellationToken`, session-switching isolation, component unmount cleanup, and telemetry integration.

---

## 1. Execution Lifecycle State Machine

Execution progression is governed by strict state transition rules:

```text
[Created] -> [Validating] -> [Routing] -> [RouteResolved]
                                              |
                   +--------------------------+--------------------------+
                   |                                                     |
                   v                                                     v
             [Executing]                                            [Streaming]
                   |                                                     |
                   +--------------------------+--------------------------+
                                              |
                                              v
                                         [Completed]
```

### Cancellation & Interruption Paths
Cooperative cancellation or upstream interruptions can be initiated from any active state:

```text
[Active State] ---> [Cancelling] ---> [Cancelled]
                          |
                          +---------> [Recovering] ---> [Cancelled] / [Failed]
```

### Invariant Rules
1. **Single-Finalization Winner Invariant**: A boolean flag (`terminal_finalized`) ensures that whichever event completes the execution first (completion, cancellation, failure, or timeout) wins finalization exactly once.
2. **Terminal State Immutability**: States `Completed`, `Cancelled`, and `Failed` are terminal. No transitions out of terminal states are permitted.
3. **Cooperative Cancellation**: Cancellation tokens are checked before prompt analysis, between routing scoring evaluations, and between stream deltas.

---

## 2. Standardized Termination Reasons

Termination reasons are strictly typed and categorized:

| Reason | Description | Serde Identifier |
| :--- | :--- | :--- |
| `UserCancelled` | User clicked "Stop Generation" or pressed `Escape` in Composer | `user_cancelled` |
| `SessionChanged` | Active chat session switched while generation was running | `session_changed` |
| `ViewDisposed` | Chat Studio or view unmounted during generation | `view_disposed` |
| `ApplicationInterrupted` | Application shutdown requested | `application_interrupted` |
| `TransportInterrupted` | Upstream network connection dropped or timed out | `transport_interrupted` |
| `StreamClosed` | IPC Channel or stream receiver dropped | `stream_closed` |
| `ExecutionAborted` | Cooperative cancellation token triggered | `execution_aborted` |
| `ProviderFailed` | Cloud LLM provider returned an unrecoverable HTTP/API error | `provider_failed` |
| `UnknownInterruption` | Fallback unspecified interruption | `unknown_interruption` |

---

## 3. Database Persistence Invariant

- **User Message**: Written to SQLite *before* provider execution dispatches.
- **Cancelled Execution**: Partial stream text and unfinished assistant messages are **NEVER** persisted to SQLite as completed assistant messages.
- **Completed Execution**: The assistant message is written to SQLite **EXACTLY ONCE** upon reaching the `Completed` state.

---

## 4. UI & Chat Studio Integration

- **Stop Button**: When a generation request is active (`isSubmitting = true`), the Composer's Send button transitions dynamically into a "Stop Generation" button (`data-testid="stop-generation-button"`).
- **Keyboard Shortcut**: Pressing `Escape` while generating immediately triggers cooperative cancellation.
- **Message Badge**: Cancelled assistant messages display an amber badge (`data-testid="cancelled-badge"`) reading `Generation stopped`, distinct from provider failures (`Generation incomplete`).
- **Session Switching Isolation**: Selecting a different conversation tab or creating a new conversation automatically cancels any running generation in the previous session and isolates the timeline.
- **Component Unmount Safety**: When `useChatStudio` unmounts, any active execution is cancelled with `view_disposed` to prevent memory leaks.

---

## 5. IPC Commands & Boundary

| Command | Purpose | Input | Output |
| :--- | :--- | :--- | :--- |
| `cmd_cancel_chat_execution` | Cancel active execution by execution ID | `{ executionId, reason? }` | `CancellationResultDto` |
| `cmd_cancel_session_chat` | Cancel running execution for a session | `{ sessionId, reason? }` | `CancellationResultDto \| null` |
| `cmd_get_execution_state` | Query lifecycle state of an execution | `{ executionId }` | `ExecutionStateDto \| null` |

---

## 6. Zero-Leak Verification

Automated stress testing verifies that repeated send-and-cancel cycles return active execution counts to zero (`getActiveMockExecutionCount() === 0`), guaranteeing zero abandoned handlers or memory leaks.

