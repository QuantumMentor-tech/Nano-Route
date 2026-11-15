# Nano Route — Connectivity Diagnostics Integration

## 1. Diagnostics Center Integration
The Connectivity subsystem integrates directly with Step 62 In-App Diagnostics via `testRunner.ts`:

- **Test `PROV-CONN-001` (Provider Endpoint Reachability)**:
  - When the local network is `OFFLINE`, the test reports `WARNING` with explicit status `network_offline` and clear remediation: *"Check your local network connection, Wi-Fi, or Ethernet cable."*
  - When online, it executes Step 25 IPC probe (`checkProviderHealth`) and reports accurate latency and reachability without sending prompts.
- **Support Report Sanitization**:
  - Exported support bundles include structured reachability metrics (`state`, `latencyMs`, `httpStatus`) while redacting all credentials and request contents.

