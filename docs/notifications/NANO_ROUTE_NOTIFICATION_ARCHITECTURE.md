# NANO ROUTE — NOTIFICATION ARCHITECTURE
## In-App Unified Notification Center, Toasts, Alerts & User Messaging (Step 64)

---

## 1. ARCHITECTURAL OVERVIEW

The **Unified Notification Center & Messaging System** establishes a single, strongly-typed pipeline for transient user feedback, persistent alerts, background task monitoring, and actionable remediation across Nano Route.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        React 18 / TypeScript UI                        │
│   ├── UnifiedToastContainer (non-blocking transient feedback, 5-stack) │
│   ├── NotificationCenterDrawer (slide-over persistent center)          │
│   ├── SystemStatusBanner (top-level critical / warning alert bar)      │
│   └── NotificationCenterTrigger (header bell button with badge)        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Pure State Dispatch
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             Notification Context & Deduplication Engine                │
│   src/features/notifications/NotificationContext.tsx                   │
│   src/features/notifications/sanitizer.ts                              │
│   ├── In-Memory & Local Storage Persistence (Max 50 records)          │
│   ├── Deterministic Deduplication (Coalescing repeated notices)        │
│   └── Secret Sanitization Layer (Zero API keys, paths, or tokens)      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Subsystem Observability Bridges
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Authoritative Nano Route Systems                     │
│   ├── Step 52 Updater (Update lifecycle events)                        │
│   ├── Step 53 Disaster Recovery (Backup/restore events)                │
│   ├── Step 56 Provider Registry (Rate limit & timeout notices)         │
│   ├── Step 62 Diagnostics (Health check completions & reports)         │
│   └── Step 63 Help Center (Contextual troubleshooting action links)    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. CORE INVARIANTS & POLICIES

1. **Observational Communication Layer**: Notifications communicate what authoritative subsystems determine. Notification code never executes business logic, modifies database records, stores credentials, or alters routing decisions.
2. **Zero Plaintext Secrets**: All message text, technical categories, and metadata pass through `sanitizeNotificationText`, ensuring no API keys (`sk-`, `AIzaSy`, `gsk_`), Bearer tokens, or local Windows usernames are exposed.
3. **Deterministic Deduplication**: Notifications with matching deduplication keys coalesce into a single notification record with an incremented `occurrenceCount`, preventing notification storms from repeated polling or render cycles.
4. **Resolution vs Dismissal**:
   - **Dismissal**: User removes the notice from immediate view (`status: "dismissed"`).
   - **Resolution**: Underlying subsystem signals the condition has cleared (`status: "resolved"`).
5. **Accessibility**: All toasts and banners use semantic ARIA roles (`role="alert"` for critical/error, `role="status"` for info/success) and avoid color-only status differentiation.

