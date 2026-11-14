# Nano Route — Retry & Failover Cost Accounting Policy

**Document Version:** 1.0.0  
**Status:** Authoritative  
**Step:** 75 — Provider Budget Controls, Quota Awareness, Spend Guardrails, Usage Limits & Cost-Safe Request Enforcement  
**Subsystems:** Intelligent Routing, Telemetry Persistence, Spend Aggregation  

---

## 1. The Challenge of Complex Routing Lifecycles

In intelligent routing, a single high-level user prompt (logical request) can result in:
- A failed initial attempt on Provider A (which may still consume input tokens if partially processed).
- An automatic fallback attempt on Provider B (which succeeds).

Naive accounting risks two critical errors:
1. **Double-counting**: Attribution of the entire prompt cost twice to the primary provider.
2. **Missing spend**: Ignoring billable tokens consumed by failed attempts before upstream termination.

---

## 2. Multi-Attempt Attribution Rules

1. **Attempt-Level Precision**: Every physical HTTP execution emits an independent `telemetry_record` referencing its specific `providerId`, `modelId`, `promptTokens`, `completionTokens`, and `costUsd`.
2. **Provider Isolation**:
   - Provider A's budget ledger reflects strictly Provider A's attempt costs.
   - Provider B's budget ledger reflects strictly Provider B's attempt costs.
3. **Failover Transparency**:
   - When Provider A fails, its cost is recorded based on billable tokens consumed.
   - Provider B records the full cost of the successful completion.
4. **Logical Request Cost**:
   - For total user session analytics, the cumulative cost is the sum across all physical attempts.
   - For provider budget enforcement, each provider is charged only for its own physical attempts.

