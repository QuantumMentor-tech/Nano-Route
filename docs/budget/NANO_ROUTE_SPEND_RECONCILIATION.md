# Nano Route — Spend Reconciliation & Drift Detection

**Document Version:** 1.0.0  
**Status:** Authoritative  
**Step:** 75 — Provider Budget Controls, Quota Awareness, Spend Guardrails, Usage Limits & Cost-Safe Request Enforcement  
**Subsystems:** SQLite Vault, Telemetry Ledger, Reconciliation Engine  

---

## 1. The Dual-Ledger Problem

Nano Route maintains two views of provider spend:

1. **Cached Ledger (`current_month_spend` in `provider_credentials`)**: Fast $O(1)$ read stored alongside encrypted DPAPI credentials for instant UI checks.
2. **Authoritative Ledger (`telemetry_records`)**: Immutable, append-only operational stream of physical requests, tokens, and computed nano-USD costs.

Over time, discrepancies can arise due to:
- Legacy float rounding accumulation.
- Application termination during an in-flight stream before updating cached counters.
- Telemetry pruning, migration, or export/import cycles.

---

## 2. Drift Detection Specification

The budget engine computes drift as:

$$\Delta = |\text{Authoritative Spend (USD)} - \text{Cached Spend (USD)}|$$

- If $\Delta \le \$0.01$ (1 cent tolerance), status is **`IN_SYNC`**.
- If $\Delta > \$0.01$, status is flagged as **`MISMATCH_DETECTED`**.

---

## 3. Reconciliation Mechanism

When `reconcileProviderSpend(providerId)` is triggered (manually from Provider Settings or automatically on startup):

1. The authoritative period spend is queried from `telemetry_records` for the current UTC calendar month.
2. Summation uses integer nano-USD precision.
3. The resulting authoritative USD spend is written back into `current_month_spend` in the credential database.
4. The status immediately updates to `IN_SYNC`.
5. Zero user prompts or chat histories are modified during reconciliation.

