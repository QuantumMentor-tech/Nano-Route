# NANO ROUTE — HELP CONTENT REVIEW & AUDIT LOG
## Step 63 Content Factuality, Terminology & Factual Verification

---

## 1. FACTUALITY & CODEBASE ALIGNMENT AUDIT

Every article in the knowledge base was audited against the live codebase implementation to guarantee that no unsupported or speculative claims were introduced:

| Article ID | Claimed Feature | Codebase Verification Source | Audit Outcome |
| :--- | :--- | :--- | :--- |
| `what-is-nano-route` | Tauri v2 + Rust + React + SQLite | `src-tauri/Cargo.toml`, `package.json` | **VERIFIED** |
| `first-run-setup` | Guided onboarding modal | `src/features/onboarding/components/OnboardingModal.tsx` | **VERIFIED** |
| `how-routing-works` | Preflight capability evaluation | `src/services/ipc/provider_health.ts` | **VERIFIED** |
| `routing-preference-profiles` | Quality, Balanced, Cost Saving | `src/services/ipc/types.ts` (`RoutingPreferenceMode`) | **VERIFIED** |
| `manual-routing-override` | Provider/model pinning & failover lockout | `src/features/chat/__tests__/failoverExecution.test.ts` | **VERIFIED** |
| `local-slm-runtime` | ONNX Runtime + DirectML | `src/services/ipc/local_slm.ts` | **VERIFIED** |
| `slm-self-test` | Deterministic synthetic inference | `src/features/diagnostics/testRunner.ts` (`SLM-002`) | **VERIFIED** |
| `provider-credentials` | Windows DPAPI CryptProtectData | `src/services/ipc/credentials.ts` | **VERIFIED** |
| `provider-health` | 429 rate limit backoff tracking | `src/services/ipc/types.ts` (`ProviderHealthSnapshotDto`) | **VERIFIED** |
| `chat-studio-basics` | SSE token streaming & cancellation | `src/services/ipc/streaming.ts` | **VERIFIED** |
| `history-and-search` | SQLite WAL history search & pinning | `src/services/ipc/history.ts` | **VERIFIED** |
| `telemetry-and-savings` | GPT-4o frontier baseline comparison | `src/features/telemetry/pricingEngine.ts` | **VERIFIED** |
| `settings-overview` | 5 settings tabs (General, Providers, etc.) | `src/pages/SettingsPage.tsx` | **VERIFIED** |
| `diagnostics-overview` | Quick Check, Full Check, sanitized reports | `src/pages/DiagnosticsPage.tsx` | **VERIFIED** |
| `update-lifecycle` | SHA-256 integrity verification & safety snapshots | `src/services/ipc/updater.ts` | **VERIFIED** |
| `backup-and-recovery` | Manifest SHA-256 & RESTORE token confirmation | `src/services/ipc/recovery.ts` | **VERIFIED** |
| `privacy-guarantees` | Zero external analytics, local-first storage | `src/features/security/audit.ts` | **VERIFIED** |
| `accessibility-and-shortcuts` | WCAG 2.1 AA keyboard navigation | `src/features/qa/accessibility.ts` | **VERIFIED** |

---

## 2. PROHIBITED CLAIMS CHECKLIST

- [x] No claims of live cloud knowledge base sync or remote CMS.
- [x] No claims of proprietary cloud AI support chatbots or ticketing agents.
- [x] No fabricated pricing guarantees or future subscription plans.
- [x] No promises of unreleased model providers or hardware drivers.
- [x] No unsupported claims of 100% cloud privacy when routing to external providers.

