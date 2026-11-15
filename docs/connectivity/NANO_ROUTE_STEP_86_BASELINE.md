# Nano Route — Step 86 Baseline

## 1. Executive Summary & Existing State Audit
Nano Route currently possesses robust systems for provider abstraction (`ProviderClient`), provider health snapshots (`Step 25`), runtime model registries, SLM routing (`Step 29/30`), streaming execution (`Step 33`), failover (`Step 37`), retry policies (`Step 38`), diagnostic tests (`Step 62`), context preflight (`Step 76`), request inspection (`Step 84`), and active task tracking (`Step 85`).

However, prior to Step 86, the application lacked a dedicated, centralized **Connectivity & Network Health subsystem** to answer the fundamental question:
> *"Is Nano Route online, offline, partially connected, or unable to reach a specific provider, and what does that mean for my current operation?"*

### Existing Systems Audited
- **Tauri / OS Networking**: Browser APIs (`navigator.onLine`, `window.addEventListener('online' | 'offline')`) provide primary OS-level network connection events. In Tauri desktop mode, network interfaces are observed through standard Windows socket abstraction.
- **Provider Health (Step 25 / `src/services/ipc/provider_health.ts`)**: Supports `checkProviderHealth`, `getAllProviderHealth`, and `preflightProviderRequest`. Returns health states (`ready`, `rate_limited`, `authentication_failed`, `provider_unavailable`, `credential_missing`), with built-in mock snapshots and Tauri IPC bridges.
- **Retry / Failover (Step 37 / Step 38)**: Evaluates error categories (`Timeout`, `RateLimit`, `NetworkError`) and determines retry eligibility. Without connectivity awareness, requests to unreachable remote endpoints would trigger repeated futile retries and failovers even during complete local network disconnection.
- **Active Request Center (Step 85)**: Ephemeral task registry tracking active and recent execution tasks. Tasks fail with generic transport errors during network drops.
- **Request Inspector (Step 84)**: Evaluates preflight context limits and monthly budget constraints, but did not incorporate live network availability or provider reachability into its warning and blocking evaluations.
- **Local SLM Runtime**: Operates completely on-device without requiring internet connectivity. A network outage does not render Nano Route or its local SLM inoperable.

---

## 2. Core Architectural Principles for Step 86
1. **Observation & Health Classification Only**: Connectivity awareness provides facts. It does **not** make final routing decisions or override Step 29/30 routing authority.
2. **Local vs. Provider State Decoupling**: Local network offline status is strictly segregated from provider-specific reachability and health states. A local network may be healthy while Anthropic is experiencing an outage; conversely, every remote provider may be unreachable while the local adapter is active.
3. **Local SLM Distinction**: Local offline state does **not** equal application failure. Local SLM inference, chat history, drafts, attachments, templates, presets, context collections, bookmarks, notes, diagnostics, settings, export/import, and integrity functions remain fully functional.
4. **No Pointless Network Attempts**: When the system has authoritative evidence that the network is offline, remote provider requests are blocked gracefully at preflight, preserving user drafts and attachments without generating phantom assistant error records.
5. **No Network Flapping Spams**: Windows network transitions (e.g. Wi-Fi roaming, adapter cycling) are debounced with a bounded stabilization window before triggering state changes.
6. **No Automatic Resubmission on Reconnect**: When connectivity is restored, the application **never** automatically replays interrupted or failed prompts. Users retain complete control to retry manually.
7. **Zero Aggressive Polling**: Background health checks avoid periodic polling loops. Health checks are manual, bounded, rate-limited, cancellable, and send zero prompts or secrets.
8. **Truthful Error Classification**: HTTP 401/403 (authentication/authorization) and HTTP 429 (rate limits) prove that network communication succeeded and must never be classified as network offline.

---

## 3. Explicit Non-Goals
- No new routing engine, model ranker, or provider selection algorithms.
- No new retry engine or failover engine.
- No third-party network monitoring, speed test, port scanning, or packet capture tools.
- No VPN, proxy, DNS, or firewall OS configuration management.
- No continuous high-frequency provider polling.
- No credential transmission in health check probes.

