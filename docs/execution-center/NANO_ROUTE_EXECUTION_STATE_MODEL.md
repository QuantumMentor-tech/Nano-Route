# Nano Route — Execution State Model

## 1. Lifecycle State Machine
Every task tracked by the Active Request Center transitions through an explicit lifecycle finite-state machine (FSM):

```text
[STARTING]
    │
    ▼
[PREPARING] ───(Context/Budget Blocked)───► [BLOCKED] (Terminal)
    │
    ▼
[ROUTING]
    │
    ▼
[CONNECTING]
    │
    ▼
[STREAMING]
    │
    ├───(Token Stream Complete)───► [FINALIZING] ───► [COMPLETED] (Terminal)
    ├───(User Cancellation)───────► [CANCELLED] (Terminal)
    ├───(Timeout Threshold)───────► [TIMED_OUT] (Terminal)
    ├───(Network/API Crash)───────► [FAILED] (Terminal)
    └───(App Restart/Shutdown)────► [INTERRUPTED] (Terminal)
```

## 2. State Classifications

### Active (Non-Terminal) States
- `QUEUED`: Scheduled or queued for execution.
- `STARTING`: Initialization and parameter preparation.
- `PREPARING`: Preflight validation (Step 76 Context & Step 75 Budget).
- `ROUTING`: Local SLM / heuristic decision evaluation.
- `CONNECTING`: Establishing TLS socket / HTTP stream connection to model provider.
- `STREAMING`: Incremental token reception and transient assistant assembly.
- `FINALIZING`: Post-processing, telemetry recording, and database commit.

### Terminal States (Immutable)
- `COMPLETED`: Finished successfully with persisted response.
- `CANCELLED`: Ceased cooperatively upon user command.
- `FAILED`: Unrecoverable provider error or transport fault.
- `BLOCKED`: Prevented by context guardrails or budget limits prior to network call.
- `TIMED_OUT`: Deadline exceeded without provider acknowledgment.
- `INTERRUPTED`: Abruptly severed by application restart or process shutdown.

