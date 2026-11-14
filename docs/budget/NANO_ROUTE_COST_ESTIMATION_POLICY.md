# Nano Route — Cost Estimation Policy

**Document Version:** 1.0.0  
**Status:** Authoritative  
**Step:** 75 — Provider Budget Controls, Quota Awareness, Spend Guardrails, Usage Limits & Cost-Safe Request Enforcement  
**Subsystems:** Pricing Engine, Routing Preflight, Heuristics  

---

## 1. Purpose of Cost Estimation

Before an outbound cloud request is dispatched, Nano Route must assess whether the anticipated transaction will violate configured budget guardrails. Because completion token counts cannot be known prior to generation, Nano Route applies a **conservative preflight cost estimation policy**.

---

## 2. Estimation Methodology

$$\text{Estimated Cost} = \text{Input Cost} + \text{Conservative Output Cost}$$

1. **Prompt Tokens ($\text{Tokens}_{\text{in}}$)**: Exact count derived from local tokenization heuristics.
2. **Output Tokens ($\text{Tokens}_{\text{out}}$)**:
   - If user/task specifies `max_tokens`: $\min(\text{max\_tokens}, 1024)$.
   - Default heuristic if unspecified: $512$ tokens for standard conversational queries, $1024$ for code/analytical tasks.
3. **Pricing Table Resolution**: Fetches current `inputCostPerMillionUsd` and `outputCostPerMillionUsd` from the active versioned pricing table (`src/services/ipc/pricing.ts`).

---

## 3. Cost Confidence Classification

Historical and aggregated spend summaries report confidence states:

| Confidence State | Definition |
| :--- | :--- |
| **`EXACT`** | 100% of recorded attempts in the period contain provider-verified `costUsd`. |
| **`ESTIMATED`** | Attempts contain token counts, and cost was derived using the versioned pricing catalog. |
| **`MIXED`** | Period contains a combination of exact and estimated records. |
| **`INCOMPLETE`** | Token counts or pricing rates were missing for one or more attempts. |
| **`UNKNOWN`** | No telemetry records exist for the requested period ($0.00 spend). |

