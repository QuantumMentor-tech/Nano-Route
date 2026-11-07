# Nano Route Desktop Shell
**Document Version:** 1.0.0  
**Step:** 7 of 50 — Tauri Window, Layout & Responsive Desktop Shell  
**Date:** November 2026  
**Status:** APPROVED ARCHITECTURAL SPECIFICATION  

---

## 1. Main Window
Nano Route operates as a single-window Windows desktop application hosted inside Tauri v2 and Microsoft Edge WebView2.
- **Window Role:** Primary workstation container for local AI orchestration, intelligent routing, and multi-turn chat interaction.
- **Theme:** Dark mode by default (`"theme": "Dark"` in `src-tauri/tauri.conf.json`), eliminating bright white flashes upon initial window launch.
- **Window Background:** Aligns with the Deep Obsidian design token (`#09090b`).

---

## 2. Window Dimensions
Configured in `src-tauri/tauri.conf.json`:
- **Initial Width:** `1440px` (Optimized for side-by-side chat streaming and routing telemetry matrices).
- **Initial Height:** `900px` (Provides comfortable vertical clearance without crowding taskbars).
- **Minimum Width:** `1000px` (`minWidth: 1000`, enforces layout stability and prevents unusable UI compression).
- **Minimum Height:** `650px` (`minHeight: 650`, guarantees visibility of chat input and navigation controls).
- **Resizable:** `true` (Free user window resizing with smooth layout reflow).
- **Maximizable:** `true` (Standard Windows maximization supported).
- **Minimizable:** `true` (Standard Windows minimize to taskbar supported).
- **Fullscreen:** `false` (Non-fullscreen by default).

---

## 3. Window Label and Identity
- **Label:** `main` (Explicitly configured as the single primary window instance in `tauri.conf.json`).
- **Title:** `Nano Route` (Exact capitalization and spacing preserved).
- **Application Identifier:** `com.nanoroute.desktop`.

---

## 4. Native Window Decorations
- **Decorations:** Enabled (`decorations: true`).
- **Rationale:** Native Windows title bar controls (Minimize, Maximize, Close, Snap Assist, and Windows 11 Snap Layouts) are preserved natively by the OS.
- **Chrome Safety:** No custom frameless window dragging or hit-testing issues. Native title bars guarantee full OS accessibility, screen reader compatibility, and DPI-aware scaling.

---

## 5. Window State Persistence
- **Status:** Evaluated and architectured for Tauri v2 (`@tauri-apps/plugin-window-state`).
- **Scope:** Window position, dimensions, and maximized status are preserved across user restarts.
- **Security Boundary:** Window state persistence strictly stores viewport geometry only. It NEVER stores chat text, API tokens, provider credentials, or routing history.

---

## 6. Shell Structure
The desktop shell is implemented as a modular hierarchy in `src/layouts/`:

```text
DesktopShell (src/layouts/DesktopShell.tsx)
  ├── Accessibility Skip Link (#main-content)
  ├── [Optional] Top Header / Status Bar
  └── Shell Body Container (flex row, 100% height, overflow hidden)
        ├── NavigationRegion (src/layouts/NavigationRegion.tsx)
        │     └── Reserved Slot for Step 8 Sidebar (w: 260px, fixed)
        └── MainContentRegion (src/layouts/MainContentRegion.tsx)
              └── ShellErrorBoundary (src/layouts/ShellErrorBoundary.tsx)
                    └── Active Page / View Content (#main-content)
```

---

## 7. Navigation Region Contract
- **Component:** `src/layouts/NavigationRegion.tsx`
- **Semantic Element:** `<aside role="navigation" aria-label="Main Navigation">`
- **Width:** Fixed `260px` (`flex-shrink: 0`), preventing navigation collapse during main content resizing.
- **Border:** `1px solid var(--nr-border-default)` on the right border.
- **Background:** `var(--nr-bg-surface)` (`#111318`).
- **Contract Boundary:** Reserved exclusively as the mounting slot for the **Step 8 Sidebar**. In Step 7, it displays a non-interactive contract indicator confirming slot reservation.

---

## 8. Main Content Region
- **Component:** `src/layouts/MainContentRegion.tsx`
- **Semantic Element:** `<main id="main-content" tabIndex={-1} role="main">`
- **Dimensions:** `flex: 1`, `min-width: 0`, `min-height: 0`, occupying all remaining window area.
- **Background:** `var(--nr-bg-app)` (`#09090b`).
- **Centering Container:** Inner container `max-width: 1100px` (configurable) with `margin: 0 auto` and padding `var(--nr-space-6)` (24px).

---

## 9. Scroll Ownership
- **Window Root:** `overflow: hidden`, strictly preventing global viewport horizontal/vertical window scrollbars.
- **Navigation Scroll Area:** Owns vertical scrolling for lengthy navigation lists if required (`overflow-y: auto`).
- **Content Scroll Area:** `MainContentRegion` owns vertical scrolling for all page content (`overflow-y: auto`, `overflow-x: hidden`).
- **Nested Scrolling:** Code blocks and telemetry tables maintain local horizontal overflow within their respective containers.

---

## 10. Responsive Rules
1. **Large Desktop (Width > 1440px):** Content centers comfortably within `1100px` content container.
2. **Standard Desktop (1200px – 1440px):** Default workstation layout with 260px navigation and full-width main view.
3. **Compact Desktop (1000px – 1200px):** Main content compresses smoothly; grids reflow from multi-column to single-column; minimum window constraints (`minWidth: 1000px`) ensure zero UI truncation.
4. **Desktop-First Guarantee:** Mobile navigation patterns (e.g. hamburger drawers) are prohibited. Layout behavior is optimized for Windows mouse, keyboard, and trackpad interaction.

---

## 11. Accessibility
- **Skip to Content:** Keyboard users can press `Tab` immediately upon launch to reveal the `.nr-skip-link` button and jump straight to `#main-content`.
- **Landmarks:** Proper HTML5 landmark tags (`<aside>`, `<main>`, `<header>`).
- **Focus Visibility:** Main content receives focus cleanly via `tabIndex={-1}` without awkward browser outline rings, while all interactive children display `--nr-focus-ring`.

---

## 12. High-DPI / Scaling
- **Resolution Independence:** All dimensions use CSS logical pixels, rems, and relative flexbox/grid units.
- **Windows Display Scaling (100%–175%):** WebView2 automatically scales the logical interface. The 1000px minimum width prevents clipping at higher scaling factors.

---

## 13. Startup Behavior
- **Dark-Theme Cohesion:** Both `tauri.conf.json` (`theme: "Dark"`) and `src/styles/reset.css` specify `#09090b`, preventing white flash during application initialization.
- **Zero Heavy Workload:** No AI models, provider clients, or database connections are initialized during shell startup.

---

## 14. Error Handling
- **`ShellErrorBoundary`:** Wraps the entire main content region. If any page component throws an unhandled render exception, the shell displays a recovery card with "Try again" and "Reload Application" buttons rather than crashing the native window.

---

## 15. Security Permissions
- **Capability Scope:** Window operations require zero privileged capabilities (no shell execution, no arbitrary file dialogs, no network proxies).
- **Capability File:** `src-tauri/capabilities/default.json` remains strictly confined to `core:default`.

---

## 16. Testing
- **TypeScript:** Validated with `tsc --noEmit` (0 errors).
- **Production Build:** Validated with `vite build` (Built in 1.77s).
- **Window Configuration:** Validated against Tauri v2 JSON schema.

---

## 17. Known Limitations
- Host environment currently lacks the Rust toolchain (`cargo`), which blocks local native binary compilation (`tauri build`). All web-side assets and Tauri configuration are fully verified.

---

## 18. Future Extensions
- **Step 8:** Full Sidebar implementation inside `NavigationRegion`.
- **Step 9+:** Feature views mounted inside `MainContentRegion`.

---
*End of Desktop Shell Specification. Source of Truth for Step 7.*

