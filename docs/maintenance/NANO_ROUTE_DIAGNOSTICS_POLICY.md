# NANO ROUTE — OBSERVABILITY & DIAGNOSTICS PRIVACY POLICY

**Phase 11: Post-Release Stability & Maintenance — Step 51**  
**Document ID:** MAINT-DIAG-051  
**Date:** November 13, 2026  

---

## 1. Local Observability Principles

Nano Route is designed from first principles as an on-device, privacy-preserving desktop application. Its diagnostic and observability systems strictly adhere to three core rules:

1. **Local-Only Logging:** Diagnostic events and telemetry are persisted exclusively into local SQLite tables and local rotating log files (`%LOCALAPPDATA%\Nano Route\`). Zero telemetry beacons are transmitted to remote servers.
2. **Automated Secret Scrubbing:** All diagnostic strings pass through native Rust and frontend TypeScript sanitization filters that redact API keys (`sk-`, `AIza`, `gsk_`, `ghp_`), Bearer tokens, and local Windows profile paths.
3. **Prompt Exclusion:** Operational telemetry records exclusively metadata (timestamps, token counts, model IDs, costs, latency). User prompt texts and assistant response bodies are never committed to telemetry logs.

---

## 2. Safe Diagnostics Support Bundle Standard

When users generate a diagnostic support bundle for troubleshooting, the output payload contains strictly:
- Application version and build channel (e.g. `0.1.0` Alpha Development)
- Operating system platform and architecture (e.g. `Windows Desktop x86_64`)
- SQLite database schema version and table status
- Local SLM manifest ID and inference engine status
- Provider configuration states (`isConfigured: true`, `isActive: true`, masked key `sk-...9a1b`)
- Aggregated operational event counts and failure categories

### Prohibited Artifacts (Strictly Excluded)
- Plaintext API keys and passwords
- Windows DPAPI encrypted ciphertext blobs
- Full conversational message histories
- Authorization HTTP request headers
- Local user profile paths (`C:\Users\<username>\...`)

