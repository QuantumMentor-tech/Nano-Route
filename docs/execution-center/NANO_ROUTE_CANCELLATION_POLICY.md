# Nano Route — Cancellation Policy

## 1. Cooperative Cancellation Architecture
Cancellation in Nano Route is strictly cooperative and non-destructive. Cancelling a request halts token streaming, aborts HTTP requests at socket level, and prevents database corruption while saving all partial work generated up to the cancellation point.

## 2. Cancellation Lifecycle & Signal Propagation
1. **User Action**: The user clicks "Stop" in the composer or "Cancel Task" in the Active Request Center.
2. **Intermediate State (`isCancelling: true`)**: The task UI immediately updates to show "Cancelling...", disabling duplicate click actions.
3. **IPC Dispatch (`cancelChatExecution`)**: An abort signal is transmitted through the Step 35 cancellation IPC channel.
4. **Socket Abort**: The native HTTP client drops the connection, terminating upstream billing where supported.
5. **Partial Preservation**: Any tokens accumulated prior to the cancellation event remain visible in the chat session with an `isCancelled` flag.
6. **Terminal State (`CANCELLED`)**: The task transitions to `CANCELLED` and moves to the recent tasks history.

## 3. Guarantees
- Cancellation is idempotent; multiple cancellation requests on the same task produce no adverse side-effects.
- Non-cancellable tasks (such as atomic database commit or DPAPI secret rotation) explicitly reject cancellation requests with a descriptive notification.

