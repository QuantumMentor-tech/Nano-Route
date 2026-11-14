# Nano Route — Budget & Spend Security Architecture

**Document Version:** 1.0.0  
**Status:** Authoritative  
**Step:** 75 — Provider Budget Controls, Quota Awareness, Spend Guardrails, Usage Limits & Cost-Safe Request Enforcement  
**Subsystems:** Security Core, DPAPI Vault, IPC Boundary, DTO Sanitization  

---

## 1. Zero Secret Exposure Invariant

Budget and spend operations frequently interact with provider configurations. Under NO circumstances do budget DTOs, spend summaries, quota records, or reconciliation events carry plaintext API keys or DPAPI cipher blobs.

```typescript
// Budget status DTO guarantees ZERO secret material:
export interface ProviderBudgetStatusDto {
  providerId: string;
  policy: ProviderBudgetPolicy;
  spendSummary: PeriodSpendSummary;
  quotaInfo: ProviderQuotaInfo | null;
  status: BudgetStatusState;
  percentUsed: number | null;
  activeReservationsUsd: number;
}
```

---

## 2. Injection & Overflow Defenses

1. **Nano-USD Integer Arithmetic**: By using BigInt integers up to $10^{18}$, calculations are completely immune to IEEE 754 precision attacks, NaN propagation, or -0.0 artifacts.
2. **Bounds Enforcement**:
   - `budgetLimitUsd`: Strictly non-negative or null. Negative values are normalized to `null`.
   - `warnThresholdPercent`: Clamped to $[0.0, 100.0]$.
   - `hardStopThresholdPercent`: Clamped to $[0.0, 200.0]$.
3. **Local-Only Scope**: Budget settings are stored locally on the user's workstation. No external network queries or telemetry reports are dispatched to sync budget limits.

