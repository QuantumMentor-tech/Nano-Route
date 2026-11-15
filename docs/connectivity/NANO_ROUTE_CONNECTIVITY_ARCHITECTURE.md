# Nano Route — Connectivity Architecture

## 1. Architectural Philosophy
The Connectivity subsystem acts as an observational and resilience layer underneath Nano Route's request and execution pipeline. It provides accurate, unvarnished facts regarding local network availability and provider reachability without making provider routing decisions or intercepting provider clients directly.

## 2. Component Pipeline
```text
Windows / OS Network Events (online / offline)
       ↓
Flap Protection Debounce Window (400ms stabilization)
       ↓
Authoritative Connectivity Engine (`src/features/connectivity/engine.ts`)
       ↓
       ├── Local Network State (`ONLINE`, `OFFLINE`, `DEGRADED`, `UNKNOWN`)
       ├── Local SLM Runtime Status (On-Device, unaffected by internet outages)
       └── Provider Reachability Records (Mapped via Step 25 IPC)
               ↓
Consumers & Safety Integrations:
  ├── Chat Studio Preflight (`useChatStudio.ts`) → Blocks remote requests if offline
  ├── Request Inspector (`src/features/request-inspector`) → Surfaces blocking warnings
  ├── Active Request Center (`src/features/execution-center`) → Reflects task blocking & recovery
  ├── Diagnostics Center (`src/features/diagnostics`) → Distinguishes local vs provider faults
  ├── Command Palette (`src/features/commands`) → Exposes connectivity actions
  └── Header UI Indicator (`ConnectivityIndicator.tsx` & `ConnectivityCenterModal.tsx`)
```

## 3. Core Modules
1. **Engine (`src/features/connectivity/engine.ts`)**: Authoritative in-memory state store, browser event listener bindings, debounced transition commit, safe manual health checks, and reactive listener subscriptions.
2. **Types (`src/features/connectivity/types.ts`)**: Normalized state enums, reachability records, transition history schemas, and check options.
3. **UI Components (`src/features/connectivity/components/`)**:
   - `ConnectivityIndicator.tsx`: Non-color-only, screen-reader accessible header status pill.
   - `ConnectivityCenterModal.tsx`: Obsidian dark-themed management center displaying detailed provider reachability, local SLM guarantees, manual probe triggers, and transition audit logs.

