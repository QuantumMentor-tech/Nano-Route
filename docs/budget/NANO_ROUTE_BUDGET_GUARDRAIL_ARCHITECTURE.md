# Nano Route — Provider Budget, Spend & Quota Guardrail Architecture

**Document Version:** 1.0.0  
**Status:** Authoritative  
**Step:** 75 — Provider Budget Controls, Quota Awareness, Spend Guardrails, Usage Limits & Cost-Safe Request Enforcement  
**Subsystems:** FinOps Core, Telemetry Ledger, Routing Pipeline, DPAPI Credential Vault, React Frontend  

---

## 1. Architectural Mission & Domain Boundaries

Nano Route provides a local-first Windows desktop AI orchestration application connecting local SLMs with frontier cloud providers. While local SLMs run at zero marginal financial cost, cloud provider requests incur API fees.

Nano Route implements a **strict local spending guardrail system** designed to protect users from unexpected billing without overstepping its domain authority.

### 1.1 Five Distinct Architectural Pillars

Nano Route explicitly segregates five related yet fundamentally distinct operational concerns:

```
+---------------------------------------------------------------------------------------------------+
|                                  Nano Route Financial Subsystem                                   |
+---------------------------------------------------------------------------------------------------+
| 1. Cost Analytics (Step 43)    | Historical ledger recording calculated costs of past requests    |
| 2. Budget Control (Step 75)     | Local user-defined spending limits evaluated before dispatch     |
| 3. Provider Quota (Step 75)     | Upstream information explicitly reported by provider APIs        |
| 4. Usage Estimation (Step 75)   | Preflight heuristic cost approximation before execution begins   |
| 5. Guardrail Enforcement (Step 75) | Local decisions: OFF, WARN_ONLY, SOFT_LIMIT, HARD_LIMIT     |
+---------------------------------------------------------------------------------------------------+
```

### 1.2 Non-Authority Invariant

- **Nano Route is NOT a cloud billing portal, payment platform, or bank.**
- Nano Route does NOT manage cloud credit cards, bank accounts, or provider subscription tiers.
- Local budget calculations reflect local telemetry and configured rates. Upstream cloud providers remain the sole billing authority.
- When budget limits are breached locally, Nano Route raises a `LOCAL_BUDGET_BLOCK`, distinct from HTTP 429 (rate limits) or 500 (provider outages).

---

## 2. Guardrail Pipeline Architecture

```
                                  [ User Request / Prompt ]
                                             │
                                             ▼
                                  [ Routing Decision Made ]
                                             │
                                             ▼
                        ┌─────────────────────────────────────────┐
                        │ Step 75: Budget Preflight Evaluation    │
                        │ - Read Provider Budget Policy           │
                        │ - Compute Authoritative Period Spend    │
                        │ - Add Active In-Flight Reservations     │
                        │ - Estimate Request Cost (Input+Output)  │
                        └────────────────────┬────────────────────┘
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       │                                           │
             [ Spend <= Limit ]                            [ Spend > Limit ]
                       │                                           │
                       ▼                                           ▼
             [ Create In-Flight ]                        ┌──────────────────┐
             [ Cost Reservation ]                        │ Enforcement Mode │
                       │                                 └─────────┬────────┘
                       ▼                                           │
             [ Dispatch Stream ]                ┌──────────────────┼──────────────────┐
                       │                        │                  │                  │
                       ▼                     [ OFF ]          [ WARN_ONLY ]      [ HARD_LIMIT ]
             [ Request Complete ]               │                  │                  │
                       │                        ▼                  ▼                  ▼
             [ Release Reservation ]     [ Proceed ]        [ Warning Toast ]    [ BLOCK REQUEST ]
                       │                                    [ & Proceed ]        [ Raise Local   ]
                       ▼                                                         [ Budget Error  ]
             [ Telemetry Recorded ]
             [ with Exact Cost ]
```

---

## 3. High-Precision Nano-USD Mathematical Foundation

Floating-point representations (`f64`, `number`) accumulate catastrophic rounding drift when summing millions of fractional micro-cent token transactions. Nano Route mandates exact integer arithmetic for spend aggregation:

$$\text{Total Spend (Nano-USD)} = \sum_{i=1}^{N} \text{Record Cost (Nano-USD)}$$

- $1.00\text{ USD} = 1,000,000,000\text{ nano-USD}$ ($10^9$)
- Pricing rates (e.g., $\$0.15$ per 1M tokens) convert into exact integer nano-USD calculations:
  $$\text{Nano-USD} = \frac{\text{Tokens} \times (\text{Cost per Million} \times 1,000,000,000)}{1,000,000} = \text{Tokens} \times (\text{Cost per Million} \times 1,000)$$
- Conversions to human-readable strings occur strictly at display boundaries with `.toFixed(4)` or `.toFixed(2)`.

---

## 4. In-Flight Cost Reservation Lifecycle

To prevent concurrent requests from simultaneously exhausting a remaining budget buffer, Nano Route employs ephemeral in-flight cost reservations:

1. **Reservation Creation**: Preflight evaluates prompt tokens and maximum completion tokens to estimate worst-case cost, registering a reservation ID with a 5-minute safety TTL.
2. **Execution**: Outbound HTTP stream proceeds.
3. **Reservation Release**: When the stream completes, fails, or cancels, the ephemeral reservation is released, and the exact telemetry record becomes authoritative.
4. **Leak Prevention**: Reservations older than TTL automatically expire.

