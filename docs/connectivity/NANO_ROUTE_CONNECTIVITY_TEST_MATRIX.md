# Nano Route — Connectivity Test Matrix

## 1. Test Coverage Overview
The Connectivity test suite (`src/features/connectivity/__tests__/connectivity.test.ts`) qualifies all functional and invariant requirements:

| Test Case | Scope | Expected Outcome | Status |
| :--- | :--- | :--- | :--- |
| **Initial State & Registry** | Initial snapshot evaluation | `networkState: ONLINE`, `isLocalSlmAvailable: true`, canonical providers present | PASS |
| **Transition Commits** | State changes via `setNetworkState` | Transitions recorded with previous state, new state, reason, and timestamp | PASS |
| **Flap Debounce** | Rapid online/offline toggling | Stabilizes for 400ms before committing final state | PASS |
| **Local SLM Isolation** | Network `OFFLINE` status | `local` provider remains reachable; remote providers blocked | PASS |
| **SLM Availability Toggle** | On-device SLM runtime toggle | Correctly reflects `isLocalSlmAvailable` without network side-effects | PASS |
| **Truthful 401/403 Mapping** | Authentication failure probe | Mapped to `AUTH_REQUIRED`, never `OFFLINE` | PASS |
| **Truthful 429 Mapping** | Rate limit probe | Mapped to `RATE_LIMITED`, never `OFFLINE` | PASS |
| **Truthful 5xx Mapping** | Server error response | Mapped to `SERVICE_ERROR` | PASS |
| **Probe Execution** | Safe manual health check | Returns latency and status without credentials or prompt leaks | PASS |
| **Offline Short-Circuit** | Probing while `OFFLINE` | Aborts immediately with `NETWORK_OFFLINE` errorCategory | PASS |
| **Probe Cancellation** | `AbortSignal` cancellation | Probe rejects with cancellation error cleanly | PASS |
| **Inspector Remote Block** | Preflight snapshot while `OFFLINE` | Remote request marked non-submissible with `BLOCKING` warning | PASS |
| **Inspector Local Pass** | Local SLM request while `OFFLINE` | Local request remains submissible with zero blocking warnings | PASS |
| **Recovery Invariant** | Network restores `OFFLINE` → `ONLINE` | State restored, remote requests unblocked, **zero auto-resubmission** | PASS |

