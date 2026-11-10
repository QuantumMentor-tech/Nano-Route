# Nano Route — Routing Policy, Final Selection & Manual Override Architecture
**Roadmap Step:** Step 30 of 90  
**Phase:** Phase 6 — Local SLM / Routing Intelligence  
**Component:** `src-tauri/src/routing/policy/`  
**Status:** Implemented & Verified

---

## 1. Overview & Purpose

The **Routing Policy Engine** is Nano Route's authoritative decision-making layer that consumes the candidate scores produced by Step 29 (`RoutingScoreResult`), validates optional manual model overrides, enforces policy thresholds and routing preference modes, and outputs a canonical `RoutingDecision`.

```text
User Prompt
    ↓
Local SLM Runtime (Step 26)
    ↓
Intent Classification (Step 27)
    ↓
Task Complexity & Capability Analysis (Step 28)
    ↓
Candidate Suitability Scoring (Step 29)
    ↓
Routing Policy & Manual Override Engine (Step 30)
    ├─ Automatic Selection (Score + Preference + Thresholds + Ties)
    └─ Validated Manual Override (Safety & Capability Gates)
    ↓
Final Route Decision + Ordered Fallback Plan
    ↓
[STOP BOUNDARY - Step 32+ Prompt Submission / Provider Execution]
```

---

## 2. Score vs. Policy Distinction

Nano Route maintains a strict distinction between scoring mathematics and policy selection:

- **Step 29 (Scoring Engine):** *"How suitable is candidate X for this task across 11 normalized dimensions?"*
- **Step 30 (Policy Engine):** *"Under the current user preferences, execution safety constraints, thresholds, and optional manual overrides, which route should Nano Route execute?"*

A lower-scoring candidate may legitimately be selected when:
1. The user has set an explicit, valid manual model override.
2. The user has configured `CostSaving` preference and the score difference is within the close-margin tolerance.
3. The higher-scoring candidate is disqualified by a hard runtime constraint or falls below the minimum policy threshold.

---

## 3. Explicit Policy Precedence Order

When signals conflict, the policy engine resolves them according to this strict, immutable hierarchy:

| Priority | Precedence Rule | Authoritative Resolution |
|:---:|:---|:---|
| **1** | **Safety & Hard Execution Constraints** | Disqualifies any candidate failing adapter support, context window limits, or provider health. Hard ineligibility can NEVER be bypassed. |
| **2** | **Explicit Manual Override Validation** | Validated manual overrides take precedence over automatic score rankings. |
| **3** | **Required Capability Validity** | If a manual override or top model lacks a non-negotiable task capability (e.g., `image_input`), it is **strictly rejected**. Capability always defeats manual override. |
| **4** | **Provider & Model Availability** | Deprecated, preview-only, or unavailable models are excluded from automatic selection. |
| **5** | **Policy Thresholds (`minimum_accepted_score`)** | Candidates scoring below the threshold are filtered out. If all candidates are below threshold, returns `NoRouteAvailable`. |
| **6** | **User Routing Preference Mode** | `Quality` prefers highest overall score. `CostSaving` prefers lower cost tier when score delta $\le 4 \times \text{tie\_tolerance}$. `Balanced` balances suitability, cost, and latency. |
| **7** | **User Provider Priority Weight (1..10)** | When candidate scores are tied within `tie_tolerance`, higher priority weight wins. |
| **8** | **Deterministic Lexicographical Order** | Ties unresolved by priority are broken by `provider_id` ascending, then `model_id` ascending. |

---

## 4. Conflict Resolution Matrix

| Scenario | Authoritative Policy Resolution |
|:---|:---|
| **Manual override conflicts with score** | **Manual override wins**, provided the selected model is valid, active, and satisfies all hard task requirements. |
| **Manual override conflicts with capability** | **Capability wins**. The override is rejected (`OverrideRejected`) with an explicit reason (e.g. `MissingRequiredCapability`). The system does not silently route to another model. |
| **Provider preference conflicts with score** | If score difference $> \text{tie\_tolerance}$, **score wins**. If scores are within `tie_tolerance`, **provider preference breaks the tie**. |
| **Cost preference conflicts with Quality preference** | Governed strictly by the active `preference_profile`: in `Quality`, the highest score wins; in `CostSaving`, a cheaper model wins if within the score margin. |
| **Highest-score candidate becomes unavailable** | The unavailable model is excluded; the next highest policy-valid eligible candidate is selected automatically. |
| **All candidates fall below threshold** | Returns `SelectionMode::NoRouteAvailable`. No model is selected; no silent fallback to disabled models occurs. |
| **Candidates tie** | Resolved deterministically: provider priority weight $\to$ `provider_id` ascending $\to$ `model_id` ascending. |
| **Health state is stale** | Re-evaluates preflight check against authoritative health state. If degraded, penalties apply; if blocked, candidate is excluded. |

---

## 5. Manual Route Override Contract

Manual model override is a first-class feature supporting user autonomy while enforcing safety:

```typescript
interface ManualRouteOverrideDto {
  provider_id: string;
  model_id: string;
  enabled: boolean;
  reason?: string;
}
```

### Safety Invariants:
1. **Never Blindly Trusted:** The Rust backend validates the override against the authoritative registry, provider activation state, context window limits, and task capabilities.
2. **Never Silently Substituted:** If an override is invalid, the engine returns `SelectionMode::OverrideRejected` with structured rejection reasons. It does not silently pretend the override was honored.
3. **No Secret Transmission:** Override DTOs contain only non-secret provider/model strings.

---

## 6. Fallback Candidate Plan

Step 30 produces an ordered list of post-policy eligible candidates (`fallback_candidates`) to prepare downstream failover:
- Ordered by policy suitability score descending.
- Strictly excludes the primary selected candidate.
- Bounded by `max_fallback_candidates` (default 5).
- **CRITICAL STOP BOUNDARY:** Step 30 **does NOT** execute fallback, retry HTTP requests, or perform failover switching. It produces the plan only.

---

## 7. Telemetry & Explainability Integration

Every routing decision produces a structured, deterministic explanation:
- `summary`: Concise human-readable decision summary.
- `primary_reason`: The definitive reason the model was selected.
- `selection_margin`: Delta between primary candidate score and runner-up score.
- `candidate_ranking`: Ordered audit trail of all evaluated candidates with their selection status (`SelectedPrimary`, `EligibleFallback`, `DisqualifiedHardConstraint`, `FilteredPolicyThreshold`).
- Zero secret exposure: Contains zero API keys, auth headers, or raw prompt text.

---

## 8. Explicit Non-Goals & Scope Boundaries

Step 30 strictly does **NOT** own:
- Provider HTTP networking or SSE stream execution (Step 32+).
- Automatic retries or HTTP error parsing (Step 33+).
- Actual failover execution or provider switching during streaming (Step 33+).
- DPAPI key decryption or credential handling (Step 19).
- Evolutionary / reinforcement learning or weight mutation (Future phase).
- Semantic vector routing or embedding databases (Future phase).
- Local GGUF response generation (Future phase).

