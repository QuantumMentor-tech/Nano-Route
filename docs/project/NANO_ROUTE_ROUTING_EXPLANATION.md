# Nano Route — Step 34: Routing Explanation, Score Breakdown & Confidence Experience

## Architecture & Implementation Overview

Step 34 introduces an on-device, read-only explainability subsystem for Nano Route. It bridges the native intelligent routing pipeline (Intent Classification, Task Analysis, 11-Factor Scoring, and Policy Selection) to the Chat Studio user interface without modifying routing decisions, invoking third-party LLMs for post-hoc justification, or re-running inference.

---

## 1. Core Principles & Boundaries

1. **Strictly Read-Only Explainability:**
   - Explanation generation explains what Nano Route did; it never triggers rescoring, reranking, or re-execution.
   - Live explanations are generated directly during prompt submission/streaming and held in an in-memory bounded LRU cache (200 entries).
   - Historical explanations are reconstructed deterministically from persisted SQLite metadata (`routed_provider`, `routed_model`, `routing_reason`, `slm_confidence_score`), omitting absent live candidate score breakdowns without fabricating data.

2. **No Second-Pass AI / No Hallucinated Reasons:**
   - Nano Route does NOT call an external cloud LLM (or a local SLM) to draft natural language routing justifications.
   - All summaries and explanations are deterministically derived from structured `TaskAnalysisResult`, `RoutingScoreResult`, `RoutingDecision`, and provider catalog metadata.

3. **Distinction of the Confidence Triad:**
   - **SLM Intent Certainty (`slm_confidence`):** Self-reported confidence of the local ONNX intent classification engine in categorizing the user prompt (e.g., Coding 94%). Disclaims answer correctness or LLM output accuracy.
   - **Routing Fit Score (`routing_fit`):** Multi-factor candidate suitability score (0.00–1.00 / 0–100%) computed across 11 analytical dimensions (intent match, quality tier, latency, cost, context window, provider health, user preference, etc.).
   - **Selection Margin (`selection_margin`):** Score difference between the chosen route and the next highest eligible runner-up candidate, clearly demonstrating selection decisiveness.

---

## 2. Native Subsystem Architecture (Rust / Tauri v2)

### Modules
- `src-tauri/src/routing/explanation/types.rs`: Authoritative DTOs for structured route breakdowns, confidence triad, and alternative candidate rankings.
- `src-tauri/src/routing/explanation/service.rs`: `RoutingExplanationService` managing:
  - `build_live_explanation(...)`: Constructs complete 11-dimension breakdown, task analysis summary, and runner-up margins.
  - `build_historical_explanation(...)`: Safe fallback reading persisted message metadata from SQLite without re-computation.
  - `store_live_explanation(...)` / `get_explanation(...)`: Thread-safe bounded cache with session context validation.
- `src-tauri/src/commands/routing_explanation.rs`: IPC command `cmd_get_routing_explanation(message_id, session_id)`.

---

## 3. Presentation Layer & UX (React / TypeScript)

### Components
- `RoutingExplanationPanel.tsx`:
  - Accessible accordion region (`role="region"`, `aria-label`).
  - Triad display cards with visual indicators for SLM certainty, Routing fit score, and Selection margin.
  - Detected task requirements, domain tags, and matched model capabilities.
  - Multi-factor score breakdown with accessible progress bars (`role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`) and explicit text percentages.
  - Alternative candidates list with ranking and ineligibility reasons for disqualified models.
  - Historical disclaimer banner when viewing past messages.
- `AssistantMessage.tsx`:
  - "Why this route?" toggle button positioned cleanly in message header.
  - Collapsed by default. Disabled during active streaming.
  - Seamless in-memory caching preventing redundant IPC round-trips.

---

## 4. Verification & Validation Invariants

- Fully automated test suite (`src/features/chat/__tests__/routingExplanation.test.ts`) covering all 6 core test groups:
  1. Triad Confidence Semantics
  2. Multi-factor Score Breakdown across dimensions
  3. Manual Route Override Contracts
  4. Ineligible Candidate Exclusion vs Runner-up Ranking
  5. Historical Route Explanation (SQLite Read-only Fallback)
  6. Session Context Isolation & Guard Contracts
- Total passing test suites: 166 suites, 319 passing tests.
- Zero external network calls for explanation generation.
- Logo length invariant preserved at exactly 670,255 bytes.

