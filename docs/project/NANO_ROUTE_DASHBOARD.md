# Nano Route Dashboard & Global Application States
**Document ID:** `NR-DOC-DASH-001`  
**Step:** 9 of 50  
**Status:** Approved & Implemented  
**Date:** November 2026  
**Audience:** Desktop Architects, Product Designers, Frontend Engineers, QA Engineers  

---

## 1. Dashboard Purpose
The Nano Route Dashboard serves as the operational overview and control center of the desktop application. As a local AI orchestration platform, Nano Route provides users with direct visibility into:
- The health and execution mode of the desktop shell and native core.
- The readiness of underlying architectural subsystems (SLM, routing, providers, telemetry).
- Direct access into primary workflows (Chat Studio, Settings, History).
- Truthful empty states indicating what infrastructure is not yet configured, avoiding fabricated analytics or premature claims of intelligence.

---

## 2. Information Hierarchy
The Dashboard layout adheres to a strict top-down operational priority:
1. **Header Area:** Authoritative application title, version tag (`v0.1.0`), environment badge, and primary "Start Chat" action.
2. **Runtime Status Card:** Prominent visual status reporting whether the local application core is operational, degraded, or in an error state.
3. **Quick Action Grid:** Direct navigation into Chat Studio, Settings, and History.
4. **Capability Overview:** Tabular status of all 7 core platform layers, distinguishing what is implemented vs. not configured.
5. **Metrics Area:** Structured placeholder cards for future latency, token volume, cost optimization, and dispatch success.
6. **Recent Activity Area:** Empty state for future prompt routing executions and session logs.
7. **Diagnostics & Baseline Disclosure:** Collapsible panel preserving Step 2–7 foundation verification smoke tests and design system showcases.

---

## 3. Runtime Status
The Dashboard reads runtime status from the centralized `useApplicationState()` hook. Four discrete states are visually communicated:
- **Initializing (`initializing`):** Pulsing status indicator, notifying the user that native core and environment verification is underway.
- **Ready (`ready`):** Solid green status indicator, displaying "Nano Route is Ready" alongside the native IPC message ("Native Core Operational" or "Web Preview Mode").
- **Degraded (`degraded`):** Warning indicator with descriptive message and an active "Retry Health Check" action.
- **Error (`failed`):** High-contrast error badge, display of diagnostic message, and a "Retry Health Check" action.

---

## 4. Quick Actions
The Quick Actions grid provides keyboard-accessible, semantic navigation cards:
- **Start Chat:** Routes to `/chat` via `react-router-dom` Link.
- **Configure Settings:** Routes to `/settings` for DPAPI key management and model path configuration.
- **Session History:** Routes to `/history` for prompt and routing audit inspection.

All quick actions perform purely client-side routing; no premature privileged native calls or fake API invocations are executed.

---

## 5. Capability Overview
The Capability Overview table truthfully reports the current implementation baseline:

| Platform Layer | Operational Status | Status Badge | Step Alignment |
|---|---|---|---|
| **Desktop Shell & Native Core** | IMPLEMENTED | `Ready` (Success) | Step 2 & 7 |
| **Client Navigation & Router** | IMPLEMENTED | `Ready` (Success) | Step 8 |
| **Chat Studio Workspace** | IMPLEMENTED (Boundary) | `Available` (Purple) | Step 8 & 12+ |
| **Local SLM Inference** | NOT CONFIGURED | `Not Configured` (Warning) | Step 11–14 |
| **External AI Providers** | NOT CONFIGURED | `Not Configured` (Default) | Step 17–21 |
| **Intelligent Routing Engine** | NOT CONFIGURED | `Not Configured` (Default) | Step 15–16 |
| **Telemetry & Accounting** | DEFERRED | `Not Available Yet` (Default) | Step 24+ |

---

## 6. Metrics Area
In accordance with the strict no-fake-data policy, the metrics section renders structured metric cards without fabricated numbers:
- **Routing Latency:** Marked `Not Active`; explains that local SLM and dispatch latency will be measured once routing is enabled.
- **Token Volume:** Marked `Not Active`; explains that prompt and completion accounting begins upon provider connection.
- **Cost Optimization:** Marked `Not Active`; explains that savings calculations will activate when frontier models are routed.
- **Dispatch Success:** Marked `Not Active`; explains primary vs. fallback completion metrics.

Zero numeric zeros, dollar signs, percentages, or synthetic graphs are rendered.

---

## 7. Recent Activity
The Recent Activity panel provides a structured empty state:
- Clean icon presentation (`History` icon).
- Clear heading: "No Recent Activity".
- Truthful description: "Your prompt routing executions, provider dispatches, and session logs will be recorded here once you begin conversational tasks."
- Direct action button to initiate a new chat session.

---

## 8. Empty States
Empty states are treated as first-class UI surfaces rather than unhandled blanks:
- Centered typography with muted iconography.
- High-contrast text adhering to WCAG 2.1 AA readability.
- Informational guidance clarifying the exact prerequisite required to populate the area.

---

## 9. Global Application State
Application state is decoupled from Dashboard JSX and managed via a dedicated React Context + Reducer pattern (`src/state/application/`):
- **Lifecycle Type (`AppLifecycle`):** `"initializing" | "ready" | "degraded" | "failed"`
- **Native Core Type (`NativeCoreStatus`):** `"unknown" | "checking" | "ready" | "unavailable" | "error"`
- **Environment Type (`Environment`):** `"development" | "production" | "test"`
- **State Model:**
  ```typescript
  export interface ApplicationState {
    lifecycle: AppLifecycle;
    nativeCoreStatus: NativeCoreStatus;
    environment: Environment;
    appName: string;
    appVersion: string;
    isNative: boolean;
    nativeMessage: string;
    initializedAt: string | null;
    lastError: string | null;
  }
  ```

---

## 10. State Ownership
A strict top-down ownership model is enforced:
```text
Native Core (Tauri IPC)
          │
          ▼
ApplicationStateProvider (src/state/)
          │
          ├────────────────────────┐
          ▼                        ▼
     DesktopShell              Dashboard
                                   │
                           ┌───────┴───────┐
                           ▼               ▼
                   RuntimeStatusCard  DiagnosticDisclosure
```
- The Dashboard is strictly a consumer of application state.
- Dashboard-specific UI preferences (e.g. diagnostic disclosure collapse) are scoped locally to Dashboard components.

---

## 11. Error Handling
- Initialization exceptions caught during `checkNativeHealth()` dispatch `INITIALIZATION_DEGRADED` or `INITIALIZATION_FAILED`.
- The application shell does not crash; instead, it renders the controlled degraded status card with a "Retry Health Check" button.
- The `ShellErrorBoundary` from Step 7 wraps all content, ensuring rendering exceptions in Dashboard subcomponents do not bring down the desktop application.

---

## 12. Accessibility (WCAG 2.1 AA)
- **Landmarks:** Dashboard is mounted inside the main desktop shell `<main id="main-content">`.
- **Heading Structure:** Valid single `<h1>` ("Dashboard"), secondary `<h2>` per section, and tertiary `<h3>` for cards.
- **Color Independence:** Status indicators include textual labels and badges; status is never communicated by color alone.
- **Focus Indicators:** `:focus-visible` rings on all interactive links, retry buttons, and disclosures.

---

## 13. Responsive Behavior
The Dashboard layout reflows across standard desktop viewports:
- **Large Desktop (1440×900+):** Multi-column metrics grid (4 columns), 3-column quick action grid.
- **Medium Desktop (1280×800):** 2–3 column reflow with flexible card wraps.
- **Compact Desktop (1000×650 min width):** 2-column or 1-column stack; zero horizontal scrolling.
- **High DPI (125%, 150%):** Flexible vector icons (`lucide-react`) and rem-based typography prevent pixelation and clipping.

---

## 14. Performance
- **Zero Polling:** The native core check runs once on initial provider mount.
- **Zero Network Calls:** No remote API requests or telemetry pings are initiated.
- **Context Memoization:** `ApplicationContextValue` is memoized via `useMemo` to prevent spurious re-renders.
- **Production Bundle:** Production build completes in under 6 seconds, producing ~287 kB JavaScript.

---

## 15. Future Data Integration
When future steps implement real backend engines:
- **Step 10 (Settings & DPAPI):** Will feed provider key presence into `CapabilityOverview`.
- **Step 11–14 (SLM Engine):** Will feed ONNX/DirectML runtime status into `RuntimeStatusCard`.
- **Step 15–16 (Router Engine):** Will activate the `MetricsOverview` dispatch metrics.
- **Step 20+ (History & SQLite):** Will populate `RecentActivity` from real local database rows.

---

## 16. Current Limitations
- **No SQLite persistence:** Recent activity is currently empty.
- **No SLM model weights:** Local SLM inference is marked "Not Configured".
- **No external provider tokens:** Provider status is marked "Not Configured".
- **Host Rust Toolchain Required:** Native binary compilation requires Visual Studio C++ Build Tools and Rustup on the host machine.

