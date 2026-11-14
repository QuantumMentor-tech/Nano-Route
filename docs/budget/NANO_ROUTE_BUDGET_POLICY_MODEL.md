# Nano Route — Budget Policy Model

**Document Version:** 1.0.0  
**Status:** Authoritative  
**Step:** 75 — Provider Budget Controls, Quota Awareness, Spend Guardrails, Usage Limits & Cost-Safe Request Enforcement  
**Subsystems:** Policy Engine, DPAPI Credential Vault, React Frontend  

---

## 1. Budget Policy Data Model

Each cloud frontier provider maintains a configurable `ProviderBudgetPolicy`:

```typescript
export interface ProviderBudgetPolicy {
  providerId: string;
  enforcementMode: BudgetEnforcementMode; // "OFF" | "WARN_ONLY" | "SOFT_LIMIT" | "HARD_LIMIT"
  periodType: BudgetPeriodType;           // "MONTHLY_UTC"
  budgetLimitUsd: number | null;          // null = unlimited spend allowed
  warnThresholdPercent: number;          // default: 80% (0.0 to 100.0)
  hardStopThresholdPercent: number;      // default: 100% (0.0 to 200.0)
  lastConfiguredAt: number;              // Unix epoch timestamp in milliseconds
}
```

---

## 2. Enforcement Modes Specification

| Mode | Behavior When Spend < Warn Threshold | Behavior When Spend >= Warn Threshold | Behavior When Spend >= Hard Stop | Error / Event Raised |
| :--- | :--- | :--- | :--- | :--- |
| **OFF** | Request Allowed | Request Allowed | Request Allowed | None |
| **WARN_ONLY** | Request Allowed | Request Allowed with Warning Event | Request Allowed with Warning Event | `BUDGET_WARN_LIMIT_REACHED` |
| **SOFT_LIMIT** | Request Allowed | Request Allowed with Warning Event | User Prompted for Explicit Confirmation | `BUDGET_SOFT_LIMIT_PROMPT` |
| **HARD_LIMIT** | Request Allowed | Request Allowed with Warning Event | **Request Blocked Locally** | `LOCAL_BUDGET_BLOCK` |

---

## 3. Deterministic UTC Calendar Monthly Period Boundaries

All budget tracking periods align to exact UTC calendar months:

$$\text{Period Start} = \text{Date.UTC}(\text{Year}, \text{Month}, 1, 0, 0, 0, 000)$$
$$\text{Period End} = \text{Date.UTC}(\text{Next Year}, \text{Next Month}, 1, 0, 0, 0, 000)$$

- Example: `2026-11` starts at `2026-11-01T00:00:00.000Z` and ends at `2026-12-01T00:00:00.000Z`.
- When the system clock crosses midnight UTC on the 1st of any month, period spend resets to `$0.00` naturally because telemetry queries filter by `occurredAt >= periodStartMs && occurredAt < periodEndMs`.
- No destructive deletion of historical telemetry occurs upon month transitions.

