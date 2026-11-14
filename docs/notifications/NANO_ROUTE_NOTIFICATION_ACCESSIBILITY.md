# NANO ROUTE — NOTIFICATION ACCESSIBILITY AUDIT
## Step 64 WCAG 2.1 AA Compliance, Keyboard Behaviors & Screen Reader Policies

---

## 1. SCREEN READER ANNOUNCEMENTS

- **Polite Regions (`aria-live="polite"`)**: Used for informational notices, success toasts, and background sync events. These do not interrupt current screen reader speech.
- **Assertive Regions (`aria-live="assertive"`)**: Reserved strictly for `critical` alerts and high-severity `error` toasts requiring immediate user attention.
- **Non-Color Cues**: Every notification severity pairs colored left-borders with distinctive SVG icons (`CheckCircle2`, `AlertTriangle`, `AlertCircle`, `ShieldAlert`) and explicit source text labels.

---

## 2. KEYBOARD WORKFLOWS & FOCUS TRAPPING

- **Toast Interaction**: Toasts do not steal focus upon appearance, preventing disruption of active typing in Chat Studio.
- **Notification Center Drawer**:
  - Opened via the header Bell trigger (`Tab` -> `Enter`).
  - Automatically traps focus on the Close button when opened.
  - Pressing `Escape` cleanly closes the drawer and restores logical focus.
  - All action buttons (`Configure Providers`, `Run Diagnostics`) are keyboard focusable via `Tab`.

---

## 3. HIGH-DPI & REDUCED MOTION

- Respects `prefers-reduced-motion`: Slide-over and toast animations use zero aggressive transforms.
- Built with relative units (`rem`, flexible percentages) accommodating Windows display scaling from 100% to 200%.

