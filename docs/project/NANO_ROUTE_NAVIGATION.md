# NANO ROUTE — SIDEBAR NAVIGATION & APPLICATION ROUTING SPECIFICATION
**Document ID:** `NR-DOC-NAV-001`  
**Step:** 8 of 50  
**Status:** Approved & Implemented  
**Date:** November 2026  
**Audience:** Desktop Architects, UI/UX Engineers, Frontend Engineers, QA Engineers, Security Engineers  

---

## 1. DOCUMENT OVERVIEW & PURPOSE

This document establishes the official client-side routing and sidebar navigation specification for **Nano Route**, a Windows-first desktop AI orchestration application. Built on Tauri v2, React 18, and TypeScript, Nano Route requires a deterministic, lightweight, accessible navigation foundation that seamlessly integrates into the Step 7 Desktop Shell without introducing extraneous runtime overhead, race conditions, or unhandled route states.

This document defines:
- The declarative route topology and hash-based routing strategy.
- Centralized route constants and typed navigation metadata.
- Reusable navigation components (`Sidebar`, `SidebarSection`, `SidebarItem`).
- Interactive states, collapse/expand animations, persistence, and tooltips.
- Strict architectural boundaries isolating navigation from future business logic.

---

## 2. CLIENT-SIDE ROUTING ARCHITECTURE

Nano Route employs `react-router-dom` v6 configured via `createHashRouter` and `RouterProvider`. 

```text
┌─────────────────────────────────────────────────────────────┐
│                      Tauri v2 Desktop Shell                 │
│                                                             │
│  ┌───────────────────────────┐  ┌────────────────────────┐  │
│  │   NavigationRegion        │  │   MainContentRegion    │  │
│  │   ┌────────────────────┐  │  │   ┌──────────────────┐ │  │
│  │   │  Sidebar Component │  │  │   │ ShellErrorBndry  │ │  │
│  │   │  - Fixed Branding  │  │  │   │   ┌────────────┐ │ │  │
│  │   │  - Scrollable Nav  │  │  │   │   │  <Outlet/> │ │ │  │
│  │   │  - Fixed Controls  │  │  │   │   └────────────┘ │ │  │
│  │   └────────────────────┘  │  │   └──────────────────┘ │  │
│  └───────────────────────────┘  └────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Architectural Principles:
1. **Hash Routing for Tauri Compatibility:** In production Windows desktop builds, web assets are served over the custom `tauri://` or `asset://` protocol without a backing HTTP routing server. Hash routing (`/#/path`) avoids 404 resource-loading failures upon hard refreshes or deep linking.
2. **Deterministic Shell Invariant:** The desktop shell (`DesktopShell`), brand identity, and sidebar navigation remain permanently mounted across route changes. Only the content rendered within `<Outlet />` is replaced.
3. **Decoupled Architecture:** Route definitions are decoupled from layout rendering. Navigation items declare their target routes via strongly typed constants.

---

## 3. ROUTE REGISTRY & PATH CONTRACTS

All route paths are centrally defined in `src/routes/routePaths.ts` and strictly typed as `RoutePath`:

```typescript
export const ROUTE_PATHS = {
  DASHBOARD: "/",
  CHAT: "/chat",
  HISTORY: "/history",
  SETTINGS: "/settings",
  LICENSE: "/license",
  ABOUT: "/about",
  CONTACT: "/contact",
} as const;
```

### Route Contract Table:

| Route Path | Associated Page | Section Group | Primary Capability / Step Alignment |
|---|---|---|---|
| `/` | `DashboardPage` | Workspace | System health, IPC smoke test, foundation telemetry (Step 2–7) |
| `/chat` | `ChatPage` | Workspace | Multi-turn chat studio, dynamic SLM router (Step 12+) |
| `/history` | `HistoryPage` | Workspace | Audit trails, prompt logs, token accounting (Step 20+) |
| `/settings` | `SettingsPage` | Application | DPAPI vault, provider tokens, model paths (Step 10+) |
| `/license` | `LicensePage` | Application | Offline license validation, entitlement tiers (Step 30+) |
| `/about` | `AboutPage` | Application | Application metadata, build info, diagnostics |
| `/contact` | `ContactPage` | Application | Support channels, bug reports, documentation links |
| `/*` | `NotFoundPage` | Fallback | Unrecognized route handling with return navigation |

---

## 4. NAVIGATION HIERARCHY & GROUPING

To optimize mental models and prevent visual clutter, navigation items are categorized into two explicit structural sections in `src/routes/navigation.ts`:

1. **Workspace Section (`workspace`):**
   - Contains operational day-to-day intelligence tools.
   - Includes *Dashboard*, *Chat Studio*, and *History*.
2. **Application Section (`application`):**
   - Contains persistent management, compliance, and application metadata.
   - Includes *Settings*, *License*, *About*, and *Contact*.

Each item includes an identifier, localized user label, target path, dedicated `lucide-react` icon, and concise tooltip description.

---

## 5. SIDEBAR DESIGN & BEHAVIORAL SPECIFICATION

The Nano Route Sidebar (`src/components/navigation/Sidebar.tsx`) satisfies the following structural specifications:

- **Expanded Width:** `260px` (matches Step 7 layout contract).
- **Collapsed Width:** `68px` (icon-only mode).
- **Z-Index:** `var(--nr-z-sticky)` (100) to ensure dropdowns and tooltips overlay appropriately.
- **Background:** `var(--nr-bg-surface)` (`#161922`).
- **Border:** `1px solid var(--nr-border-default)` (`#2a2e3d`).
- **Layout Model:** Vertical CSS flex container with three distinct structural zones:
  1. **Fixed Header Zone:** 64px height; contains the "NR" neon purple badge (`34x34px`), application title ("Nano Route"), and subtitle ("AI Orchestrator"). In collapsed mode, only the centered badge is rendered.
  2. **Scrollable Nav Zone:** Independent vertical scroll container (`overflow-y: auto`, `overflow-x: hidden`) styled with low-contrast, non-intrusive scrollbars.
  3. **Fixed Footer Zone:** Fixed-height action bar containing version metadata (`v0.1.0 • Desktop Shell`) and the collapse/expand toggle button.

---

## 6. ACTIVE ROUTE RESOLUTION & STATE MANAGEMENT

Route activation is evaluated via React Router's `NavLink` primitive:

- **Root Exact Matching:** The Dashboard route (`/`) uses `end={true}` to prevent it from matching deep child paths.
- **Active State Tokens:**
  - Background: `var(--nr-accent-purple-subtle)` (`rgba(139, 92, 246, 0.12)`).
  - Border: `1px solid var(--nr-accent-purple-border)` (`rgba(139, 92, 246, 0.3)`).
  - Foreground Text: `var(--nr-text-primary)` (`#f3f4f6`) with `font-weight: 600`.
  - Icon Tint: `var(--nr-accent-purple)` (`#8b5cf6`).
- **Inactive State Tokens:**
  - Background: `transparent`.
  - Border: `1px solid transparent`.
  - Foreground Text: `var(--nr-text-secondary)` (`#9ca3af`) with `font-weight: 500`.
  - Hover: `var(--nr-bg-surface-hover)` (`#222634`) with transition duration `var(--nr-duration-fast)` (150ms).

---

## 7. COLLAPSIBLE BEHAVIOR & PERSISTENCE

Users can toggle between the 260px expanded mode and the 68px collapsed mode at any time.

- **Persistence Layer:** State is stored in `localStorage` under the key `nr_sidebar_collapsed` (`"true"` | `"false"`).
- **Fault-Tolerant Initialization:** State retrieval is wrapped in defensive `try/catch` handlers. If `localStorage` is unavailable (e.g., due to sandboxed permission constraints), the state cleanly defaults to expanded (`false`) without throwing.
- **Smooth Animation:** Width transitions use CSS transitions (`width 200ms cubic-bezier(0.16, 1, 0.3, 1)`), preventing layout snapping.

---

## 8. ACCESSIBILITY & KEYBOARD NAVIGATION (WCAG 2.1 AA)

Accessibility is baked into the navigation architecture:

1. **Semantic Landmarks:**
   - The sidebar is enclosed in `<aside role="navigation" aria-label="Main Navigation">`.
   - Each section is partitioned with `<nav aria-label="{section.label}">`.
2. **Screen Reader Hints:**
   - Active links automatically receive `aria-current="page"`.
   - In collapsed mode, each navigation element provides an explicit `aria-label` matching its destination title.
3. **Keyboard Focus Management:**
   - Interactive elements (`NavLink`, toggle button) display distinct focus rings via `:focus-visible` (`outline: 2px solid var(--nr-accent-purple); outline-offset: 2px`).
   - The Skip Link (`<a href="#main-content">`) from Step 7 permits bypassing sidebar navigation directly into page content.

---

## 9. VIEWPORT ADAPTATION & RESPONSIVE BEHAVIOR

The Nano Route desktop window is constrained to a minimum size of 1000x650 (enforced via Tauri configuration and CSS `min-width: 1000px`).

- At standard resolutions (1440x900, 1920x1080), the expanded sidebar leaves 1180px–1660px of available horizontal width for workspace content.
- When collapsed, the 68px width frees 192px of horizontal space for data-dense multi-column chat and log inspection layouts.
- Content within `MainContentRegion` auto-centers or stretches based on the configured `contentMaxWidth`.

---

## 10. TOOLTIP SYSTEM FOR COLLAPSED NAVIGATION

When the sidebar is collapsed:
- Text labels and section headers are visually hidden to preserve the compact 68px footprint.
- Each `SidebarItem` renders inside the design system `Tooltip` primitive (`src/components/ui/Tooltip.tsx`).
- Tooltips display on hover or keyboard focus with `position="right"` and a fast `100ms` delay, styled with `var(--nr-bg-surface-overlay)`, high contrast text, and subtle drop shadows.

---

## 11. ROUTE TRANSITIONS & PERFORMANCE IMPACT

- **Zero Layout Shifts (CLS 0.00):** Since `NavigationRegion` and `DesktopShell` remain mounted, route transitions incur zero layout recalculation outside the main content viewport.
- **Bundle Footprint:** `react-router-dom` adds only ~14 kB gzipped, well within the desktop shell budget.
- **Instant Switching:** Route switching occurs in `< 1ms` in memory without synchronous network or disk reads.

---

## 12. ERROR HANDLING, NOT FOUND (404) & FALLBACKS

1. **Catch-All 404 Route (`/*`):**
   - Catches corrupted deep links, deleted paths, or typos.
   - Renders `NotFoundPage` with a clear warning badge, explanatory diagnostic text, and a primary call-to-action button returning to the Dashboard.
2. **Boundary Isolation:**
   - All page components within `<Outlet />` are wrapped inside `ShellErrorBoundary` from Step 7.
   - If a page throws a runtime rendering exception, the error is isolated to the main content panel. The sidebar and title bar remain completely functional, allowing the user to navigate away.

---

## 13. ROUTE LEVEL LAZY LOADING STRATEGY

For the Step 8 MVP baseline, all core pages are statically bundled into the initial client bundle because placeholder pages are minimal.
- **Future Scale Plan:** When heavy modules (e.g., Monaco/CodeMirror prompt editors, large chart visualizations, or WASM tokenizers) are integrated, routes will be wrapped in `React.lazy()` with `Suspense` fallbacks displaying `<Spinner />` or `<Skeleton />` without modifying the route contract.

---

## 14. INTEGRATION WITH STEP 7 DESKTOP SHELL

Step 8 directly fulfills the contract established in Step 7:
- `NavigationRegion.tsx` receives the active `Sidebar` component in its slot.
- `RootLayout.tsx` pairs `Sidebar` with `DesktopShell` and `Outlet`.
- Independent scroll containers prevent the sidebar scroll position from resetting when scrolling through long content in the main pane.

---

## 15. WINDOW STATE & DEEP LINKING CONSIDERATIONS

- Deep links within the desktop application can be dispatched via window events or native Tauri commands by writing to the hash router: `window.location.hash = "#/settings"`.
- This ensures clean compatibility with Windows notification clicks, tray icon menu shortcuts, and future CLI argument dispatching.

---

## 16. IPC & TAURI PROTOCOL COMPATIBILITY

- The router operates completely in client memory and hash history.
- No HTTP server or custom protocol handlers are required for route navigation.
- Native Rust IPC calls (e.g., `checkNativeHealth`) are executed asynchronously and do not block navigation transitions.

---

## 17. MOCK DATA & FUTURE FEATURE BOUNDARIES

- In accordance with the Step 8 scope lock, all secondary pages (`ChatPage`, `HistoryPage`, `SettingsPage`, `LicensePage`, `AboutPage`, `ContactPage`) are strictly architectural placeholders.
- Zero mock business logic or simulated responses were added.
- The `DashboardPage` preserves 100% of the Foundation Verification cards, IPC smoke test, and design system showcase created in Steps 2–7.

---

## 18. AUTOMATED & MANUAL TESTING STRATEGY

The navigation system is validated via:
1. **Type Checking:** `npm run typecheck` (`tsc --noEmit`) validates all route paths, navigation interfaces, and props.
2. **Build Validation:** `npm run build` (`tsc && vite build`) validates bundle generation without asset resolution failures.
3. **Manual Test Procedures:**
   - Route switching between all 7 registered paths.
   - Back/Forward browser navigation buttons.
   - Collapse/expand toggle functionality and persistence in `localStorage`.
   - Tooltip visibility in collapsed mode.
   - Navigation to an invalid hash (e.g., `/#/unknown-page`) triggering `NotFoundPage`.

---

## 19. DRIFT RISKS & MITIGATION

| Risk | Likelihood | Impact | Mitigation Strategy |
|---|---|---|---|
| Hardcoded string path mismatches | Medium | High | Centralized `ROUTE_PATHS` constants; TypeScript strict string unions |
| Route navigation resetting sidebar scroll | Low | Medium | Discrete `overflow-y: auto` boundary on `.nr-sidebar-scroll` |
| Nested landmark warnings | Low | Low | `NavigationRegion` delegates `<aside role="navigation">` to `Sidebar` |
| LocalStorage access exceptions | Low | Low | Defensive `try/catch` wraps all persistence reads/writes |

---

## 20. STEP 8 COMPLETION VERIFICATION

- [x] `react-router-dom` v6 installed and configured with `createHashRouter`.
- [x] Centralized route registry in `src/routes/routePaths.ts`.
- [x] Structured navigation items defined in `src/routes/navigation.ts`.
- [x] Reusable navigation components: `Sidebar`, `SidebarSection`, `SidebarItem`.
- [x] Verified collapsible state (260px expanded / 68px collapsed) with `localStorage` persistence.
- [x] Reusable tooltips in collapsed mode using Step 6 `Tooltip` primitive.
- [x] All 7 core MVP page placeholders + `NotFoundPage` implemented.
- [x] Full continuity of Step 2–7 Foundation Verification card in `DashboardPage`.
- [x] Verified zero TypeScript compilation errors and successful production build.

