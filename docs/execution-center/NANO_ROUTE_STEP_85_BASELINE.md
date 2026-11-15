# Nano Route — Step 85 Baseline

## Overview & Scope
Step 85 establishes the **Active Request Center, Task Lifecycle Monitoring, Concurrency Control, Cancellation & Execution Recovery** subsystem within Nano Route.

It provides users with real-time operational visibility into active chat queries, provider streaming requests, and background operations, offering granular lifecycle tracking, cooperative cancellation, safe restart recovery, and memory-bounded retention.

## Key Invariants & Non-Negotiable Boundaries
1. **No Second Task Runner**: Does not duplicate the Tokio runtime, IPC handler dispatch, or streaming engine. Operates strictly as an execution registry and lifecycle coordinator.
2. **Zero Direct Provider Calls**: All network traffic continues through the authoritative `ProviderClient` and `streamChatPrompt` pipeline.
3. **Decoupled Identity Hierarchy**:
   - `taskId`: Ephemeral unique operational execution task unit.
   - `logicalRequestId`: Stable end-to-end user request ID spanning failovers and retries.
   - `physicalAttemptId`: Per-attempt network transaction identifier.
4. **Strict Terminal State Immutability**: Tasks in `COMPLETED`, `CANCELLED`, `FAILED`, `TIMED_OUT`, or `INTERRUPTED` states can never transition out of terminal status.
5. **No Automatic Resubmission After Interruption**: If the application crashes, restarts, or loses connection, in-flight tasks are marked `INTERRUPTED` with `recoverable: true`. The system **never** automatically resubmits requests to avoid unauthorized cost and duplicated remote operations.
6. **Bounded In-Memory Retention**: Maintains a hard cap of 50 recent terminal tasks in memory to guarantee zero memory leakage over long-running desktop sessions.
7. **Zero Raw Secret Exposure**: Execution task progress, error messages, and metadata are scrubbed of API keys, bearer tokens, or DPAPI credentials.

