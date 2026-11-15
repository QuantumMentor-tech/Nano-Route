# Nano Route — Compatibility Privacy Guarantees

## 1. Local-First Processing
All compatibility evaluations, context comparisons, and request eligibility checks are calculated 100% locally on the user's workstation.

## 2. Privacy Guarantees
- **No Remote Telemetry on Browsing**: The models, providers, and capabilities viewed by the user are never reported to remote analytics servers.
- **No Request Leakage**: When the user opens the Compatibility Center with an active prompt or attachment context, prompt text and filenames are never sent across the network.
- **Local Cache Expiration**: Cached compatibility snapshots expire automatically after 5 seconds and are purged upon app exit.

