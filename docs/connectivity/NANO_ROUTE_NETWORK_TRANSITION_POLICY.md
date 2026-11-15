# Nano Route — Network Transition Policy

## 1. Network Flapping Protection
Windows network adapters (e.g. Wi-Fi roaming, VPN tunnel initialization, DHCP lease renewal) frequently cycle network events in rapid succession. Nano Route applies a 400ms debounce stabilization window to all incoming OS network events.

```text
[OS Event: Offline] ───► Start Timer (400ms)
    ▲
    │ (If Online Event arrives within 400ms, timer resets)
    ▼
[Debounce Window Elapses] ───► Commit Transition Event ───► Notify UI
```

## 2. Transition History
- Maintains a bounded circular buffer of the most recent 20 transition events.
- Each event records the transition identifier, previous state, new state, exact timestamp, and triggering reason.
- History is kept strictly in ephemeral process memory to prevent privacy leakage.

## 3. Recovery & Zero Automatic Resubmission Invariant
When the transition `OFFLINE → ONLINE` occurs:
- The global network state transitions back to `ONLINE`.
- Remote provider preflight blocks are immediately lifted.
- The UI indicator updates smoothly.
- **Strict Invariant**: Nano Route **never** automatically resubmits failed or interrupted requests upon reconnect. Users must explicitly click "Retry" or send their prompt manually.

