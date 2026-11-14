# Nano Route — Context Preflight Policy

**Document Version:** 1.0.0  
**Status:** Authoritative  
**Step:** 76 — Context Window Management, Prompt Size Guardrails, Token Budgeting, Request Preflight & Safe Context Optimization  
**Subsystems:** Preflight Engine, Routing Subsystem, UI Notifications  

---

## 1. Preflight Evaluation States

Before physical dispatch to an AI provider, Nano Route computes the preflight evaluation:

| Classification | Condition | Action |
| :--- | :--- | :--- |
| **`SAFE`** | Total required tokens fit comfortably ($< 80\%$ usage and $\ge$ safety margin). | Proceed normally without notice. |
| **`NEAR_LIMIT`** | Context usage $\ge 80\%$ of context window OR available headroom $<$ safety margin buffer. | Allow request to proceed; display non-blocking warning badge and toast. |
| **`EXCEEDS_LIMIT`** | Input exceeds `maxInputTokens`, requested output exceeds `maxOutputTokens`, or total exceeds `contextWindow`. | **BLOCK request locally**. Prevent network transmission. Offer context reduction. |
| **`UNKNOWN`** | Model context limit is unverified/uncatalogued. | Allow request to proceed; surface non-blocking unverified notice. |

---

## 2. Safety Buffer & Headroom Formulation

$$\text{Safety Margin} = \max\left(\left\lceil \text{Total Required} \times 0.10 \right\rceil, 500\right)\text{ tokens}$$

$$\text{Available Headroom} = \text{Context Window} - \text{Total Required}$$

$$\text{Percent Used} = \left(\frac{\text{Total Required}}{\text{Context Window}}\right) \times 100$$

---

## 3. Output Capacity Guarantee

When calculating available output generation room, Nano Route never assumes the entire remaining context is available if the candidate model enforces a separate maximum output generation constraint:

$$\text{Available Output} = \min\left(\text{Model Max Output}, \max(0, \text{Context Window} - \text{Estimated Input})\right)$$

