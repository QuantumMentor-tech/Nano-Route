# Nano Route — Routing Scoring Engine Architecture
**Roadmap Step:** Step 29 of 90  
**Phase:** Phase 6 — Local SLM / Routing Intelligence  
**Component:** `src-tauri/src/routing/scoring/`  
**Status:** Implemented & Verified

---

## 1. Overview & Architectural Role

The **Routing Scoring Engine** is Nano Route's native, provider-neutral candidate evaluation service. It bridges local task understanding (Step 28 `TaskAnalysisResult`) and operational routing execution (Step 30 Final Routing Policy & Fallback Cascade).

```text
┌──────────────────────────────────────────────┐
│       Step 28: Task Analysis Result          │
│ (Complexity, Domains, Capability Demands)    │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│     Step 29: Routing Scoring Engine          │
│                                              │
│  1. Hard Constraint Eligibility Filtering   │
│     (Preflight, Credentials, Capabilities)   │
│                                              │
│  2. Soft Multi-Dimensional Suitability       │
│     (11 Normalized Dimensions [0.0, 1.0])    │
│                                              │
│  3. Deterministic Candidate Sorting          │
│     (Eligible first, Score desc, Provider)   │
│                                              │
│  4. Transparent Audit & Explainability       │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│  Candidate Scores & Explainable Breakdowns   │
│  (Step 30 consumes for final dispatch policy)│
└──────────────────────────────────────────────┘
```

---

## 2. Hard Eligibility Separation Invariant

Nano Route enforces strict mathematical decoupling between **eligibility** (hard boolean constraints) and **soft scoring** (heuristic suitability):

1. **Ineligible Candidate Invariant:**
   - Any candidate failing preflight validation, deactivated by user preference, lacking an API credential, or missing a non-negotiable required capability is marked `is_eligible: false`.
   - Ineligible candidates strictly have `total_score: None` and `breakdown: None`.
   - Ineligible candidates provide explicit, typed `ineligibility_reasons: Vec<IneligibilityReason>`.
2. **Non-Revival Invariant:**
   - High user preference weights (e.g., 10/10) or favorable soft suitability metrics **CAN NEVER** revive an ineligible candidate or generate a numerical total score.

---

## 3. Normalized Scoring Dimensions

For eligible candidates, the engine computes normalized scores $s_i \in [0.0, 1.0]$ across 11 distinct dimensions:

| Dimension | Description | Default Weight | Behavior when Unknown |
|:---|:---|:---:|:---:|
| `intent_fit` | Alignment between user intent and model qualitative strengths | 0.15 | Neutral 0.50 |
| `complexity_fit` | Alignment between workload complexity and model operational tier | 0.15 | Neutral 0.50 |
| `domain_fit` | Primary and secondary domain affinity matching | 0.10 | Neutral 0.50 |
| `capability_fit` | Satisfaction of optional/preferred capabilities & capability breadth | 0.15 | Baseline 0.80 |
| `context_fit` | Headroom evaluation (sweet spot vs. dangerously tight vs. waste) | 0.05 | Neutral 0.85 |
| `modality_fit` | Text, image, audio, or multimodal requirement matching | 0.05 | Neutral 0.90 |
| `preference_fit` | User configured priority weight (1..10 $\to$ 0.1..1.0) + requested provider | 0.10 | Default 0.50 |
| `cost_fit` | Relative cost efficiency from token pricing | 0.08 | **Neutral 0.50 (Never assumed $0)** |
| `latency_fit` | Latency tier suitability (e.g. Groq ultra-low vs. reasoning CoT) | 0.07 | **Neutral 0.50 (Never assumed 0ms)** |
| `reliability_fit` | Runtime health state (Healthy = 1.0, Degraded = 0.6, Unhealthy = 0.1) | 0.05 | Neutral 0.50 |
| `profile_fit` | Base suitability score from configured `ModelRoutingProfile` | 0.05 | Baseline 0.75 |

**Total Score Formula:**
$$\text{Total Score} = \sum_{i=1}^{11} (w_i \times s_i)$$
where $\sum w_i = 1.0$, guarded against non-finite values (NaN/Inf clamped to 0.0).

---

## 4. Deterministic Candidate Ordering

Candidate sorting follows a strict, deterministic hierarchy to guarantee reproducible execution:

1. **Eligibility Status:** Eligible (`is_eligible == true`) precedes ineligible (`is_eligible == false`).
2. **Total Score:** Descending numerical order (`Some(score)` higher before lower).
3. **Provider Identifier:** Ascending lexicographical comparison (e.g., `"anthropic"` before `"openai"`).
4. **Model Identifier:** Ascending lexicographical comparison (e.g., `"claude-3-5-sonnet"` before `"gpt-4o"`).

---

## 5. Security & Privacy Invariants

- **Zero Credential Exposure:** Plaintext API keys and DPAPI ciphertext are never accessed, deserialized, or serialized in candidate scoring results.
- **Provider Neutrality:** The scoring engine does not embed hardcoded provider names; all evaluations operate over abstract capabilities, model descriptors, and structured routing profiles.
- **Strict Scope Boundary:** Step 29 calculates candidate suitability only. It **does NOT** choose the final winner, trigger network calls, execute fallbacks, or dispatch prompt execution (owned by Step 30).

