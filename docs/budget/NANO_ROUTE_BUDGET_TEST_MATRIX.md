# Nano Route — Budget & Spend Guardrail Test Matrix

**Document Version:** 1.0.0  
**Status:** Authoritative  
**Step:** 75 — Provider Budget Controls, Quota Awareness, Spend Guardrails, Usage Limits & Cost-Safe Request Enforcement  
**Subsystems:** Node Test Runner, QA Automation  

---

## 1. Test Suite Coverage Summary

Test Suite: `src/features/budget/__tests__/budgetGuardrails.test.ts` (15 passing tests across 10 suites).

| Suite | Test Case | Expected Result |
| :--- | :--- | :--- |
| **1. Deterministic UTC Month Period Boundaries** | Mid-month timestamp boundary evaluation | Exact UTC 1st 00:00:00.000Z to Next Month 1st 00:00:00.000Z |
| | Year boundary transition (Dec -> Jan) | Correct rollover across calendar year |
| **2. Authoritative Spend Derivation & Confidence** | Zero spend with empty records | $0.00 spend with `EXACT` confidence |
| | Precise nano-USD summation | Exact penny & sub-penny sum without floating-point drift |
| | Missing `costUsd` with known token counts | Accurate estimation using model pricing and `ESTIMATED` confidence |
| **3. Retry & Failover Accounting** | Multiple attempts for single logical prompt | Individual attempt costs isolated per provider; zero double-counting |
| **4. Spend Cache Reconciliation** | Cached counter drifts from telemetry | Status detects `MISMATCH_DETECTED`; reconciliation restores `IN_SYNC` |
| **5. In-Flight Cost Reservations** | Create, inspect, and release reservation | Spend increases temporarily and returns to zero upon release |
| **6. Request Preflight & Enforcement** | Enforcement mode `OFF` | Allowed even when spend exceeds limit |
| | Enforcement mode `HARD_LIMIT` with spend > limit | Blocked locally (`LOCAL_BUDGET_BLOCK`) |
| | Enforcement mode `HARD_LIMIT` with estimate exceeding | Blocked locally before dispatch |
| | Enforcement mode `WARN_ONLY` | Allowed with explicit warning flag |
| **7. Provider-Reported Quotas** | Fresh vs Stale evaluation | Flagged stale when `now >= resetAt` or `elapsed > 1 hour` |
| **8. Month Transition Simulation** | System clock crosses into next month | Spend computation automatically evaluates to $0.00 for new period |
| **9. Security & DTO Sanitization** | `getProviderBudgetStatus` output audit | Zero secrets, zero API keys, zero authorization headers present |

