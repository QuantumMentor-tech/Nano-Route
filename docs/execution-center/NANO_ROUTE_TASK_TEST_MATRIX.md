# Nano Route — Task Test Matrix

## 1. Test Coverage Overview
The Active Request Center test suite (`src/features/execution-center/__tests__/executionCenter.test.ts`) verifies lifecycle mechanics, invariants, failure edge cases, and concurrency guarantees.

| Test Case | Scope | Expected Outcome | Status |
| :--- | :--- | :--- | :--- |
| **Identity Decoupling** | `taskId`, `logicalRequestId`, `physicalAttemptId` | All IDs unique and correctly structured; category defaults to `REQUEST` | PASS |
| **Snippet Truncation** | Prompt snippets exceeding 100 characters | Truncated to exactly 100 characters | PASS |
| **Lifecycle Progression** | `STARTING` → `STREAMING` → `COMPLETED` | State advances monotonically; metadata updates correctly | PASS |
| **Terminal Immutability** | Transition attempts after `COMPLETED` | Subsequent mutations rejected; state remains terminal | PASS |
| **Attempt Accounting** | Retries and failovers | `attemptCount` increments, `physicalAttemptId` updates, `taskId` remains stable | PASS |
| **Cooperative Cancel** | In-flight execution cancellation | Sets `isCancelling: true`, calls IPC, transitions to `CANCELLED` | PASS |
| **Non-Cancellable Check** | Task with `cancellable: false` | Rejects cancellation request cleanly | PASS |
| **Stale Task Sweeper** | Application crash simulation | In-flight tasks marked `INTERRUPTED` with `recoverable: true` and no auto-resubmission | PASS |
| **Bounded Retention** | Registering > 50 completed tasks | Memory capped to max 50 recent tasks | PASS |
| **Clear History** | User calls `clearTerminalTasks()` | Recent tasks cleared immediately | PASS |
| **Stats Aggregation** | Multi-category execution mix | Statistics accurately summarize active, failed, cancelled, and total counts | PASS |

