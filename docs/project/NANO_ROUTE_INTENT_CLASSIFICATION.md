# NANO ROUTE — LOCAL SLM INTENT CLASSIFICATION ENGINE
## Semantic Task Classification, Ambiguity Modeling & Privacy Foundations (Step 27 of 90)

---

## 1. Executive Summary

Step 27 establishes Nano Route’s dedicated native **Intent Classification Engine**.

The Intent Classification Engine answers the foundational question:
> **What kind of task is the user asking to perform?**

It does **not** answer:
> **Which provider or model should receive this request?**

The classification layer is strictly provider-neutral. It consumes the on-device Step 26 SLM runtime, validates input against context boundaries, maps raw model output tensors into a versioned intent taxonomy, evaluates calibrated confidence and ambiguity states, handles multi-intent workloads, and exposes a clean, typed contract for subsequent Step 28 analysis without invoking any cloud API or leaking sensitive user prompts.

---

## 2. Architectural Pipeline & Boundary Separation

```text
                             User Prompt
                                  │
                                  ▼
                    IntentClassificationRequest
                                  │
                                  ▼
                           IntentClassifier
                     ┌────────────┴────────────┐
                     ▼                         ▼
               Preprocessor           ClassificationPolicy
                     │                         │
                     ▼                         │
            Step 26 SLM Runtime                │
           (Worker Queue / ONNX)               │
                     │                         │
                     ▼                         │
             InferenceOutput (Logits)          │
                     │                         │
                     ▼                         │
               Output Mapper  ◄────────────────┘
                     │
                     ▼
        IntentClassificationResult
                     │
                     ▼
          Step 28 (Future Scope)
  (Complexity / Domain / Routing Policy)
```

### Critical Separation Rules:
- **Intent ≠ Provider:** An intent describes the task (e.g., `software_engineering`). It never returns a provider name (e.g., Anthropic, OpenAI).
- **Intent ≠ Complexity:** Difficulty estimation (simple vs. expert) belongs to Step 28.
- **Intent ≠ Domain:** Domain categorization (e.g., Healthcare, Legal, Mathematics) belongs to Step 28.
- **Intent ≠ Routing Priority:** Quality weights, latency weights, and cost thresholds are routing policies belonging to Step 29/30.

---

## 3. Canonical Intent Taxonomy

Nano Route supports 12 canonical workload-centric intents:

| Canonical ID | Display Name | Core Purpose | Typical Signals |
|---|---|---|---|
| `software_engineering` | Software Engineering | Code design, architecture, refactoring | `fn`, `struct`, `class`, `impl`, `refactor`, `API` |
| `code_debugging` | Code Debugging | Error diagnosis, crashes, bugs | `stack trace`, `panic`, `NullPointerException`, `fix error` |
| `reasoning_math` | Reasoning & Math | Mathematical proofs, logic, multi-step math | `proof`, `theorem`, `calculate`, `matrix`, `eigenvalue` |
| `general_conversation` | General Conversation | Greetings, chit-chat, everyday inquiries | `hello`, `how are you`, `thank you`, casual Q&A |
| `research_retrieval` | Research & Retrieval | Comparative analysis, knowledge synthesis | `compare`, `survey`, `tradeoffs`, `literature review` |
| `writing` | Long-Form Writing | Professional or creative prose drafting | `draft`, `essay`, `proposal`, `cover letter`, `formal article` |
| `data_analysis` | Data Analysis | Interpreting tabular data, metrics, trends | `CSV`, `table`, `aggregate`, `correlation`, `percentages` |
| `translation` | Translation | Natural language text translation | `translate`, `to Spanish`, `Urdu translation`, `tarjuma` |
| `summarization` | Summarization | Condensing long blocks of text into points | `summarize`, `TL;DR`, `key takeaways`, `bullet points` |
| `creative_generation` | Creative Generation | Fiction, worldbuilding, poetry, brainstorming | `write a story`, `poem`, `cyberpunk tale`, `roleplay` |
| `other` | Other Workload | Understood tasks outside primary 10 categories | Cooking recipes, diet plans, specific legal clauses |
| `unknown` | Unknown / Uncertain | Below confidence threshold, undecidable | `help`, `what should I do?`, empty/unparseable input |

---

## 4. Model Output Contract & Numerical Safety

### 4.1 Label Mapping (`ClassifierLabelMap`)
- Schema: `nano-route-intent-schema-v1`
- Mapping: Explicit association between model output tensor index `0..15` and `UserIntent`.
- Hard Dimension Check: If model outputs 10 logits while schema expects 16, inference rejects immediately with `LabelSchemaMismatch`.

### 4.2 Stable Softmax Normalization
Raw model logits are converted into normalized probabilities:
$$\text{Softmax}(z_i) = \frac{e^{z_i - \max(z)}}{\sum_{j} e^{z_j - \max(z)}}$$
- **NaN / Infinity Rejection:** Any non-finite float immediately yields `ClassificationErrorKind::InvalidModelOutput`.
- **Numerical Overflow Prevention:** Subtracting $\max(z)$ prevents floating-point overflow during exponentiation.

---

## 5. Confidence, Ambiguity & Multi-Intent Policy

| Policy Parameter | Value | Semantics & Behavior |
|---|---|---|
| `confidence_threshold` | `0.35` | If $\text{score} < 0.35$, primary intent falls back to `UserIntent::Unknown` with `AmbiguityState::Unknown`. Evaluated as $\ge$. |
| `ambiguity_margin` | `0.08` | If $|\text{top} - \text{second}| < 0.08$, state is evaluated as `AmbiguityState::Ambiguous`. |
| `multi_intent_threshold` | `0.25` | If a distinct non-unknown secondary candidate has $\text{score} \ge 0.25$, state is `AmbiguityState::MultiIntent`. |
| `max_alternatives` | `3` | Maximum distinct alternative candidates preserved in the classification result. |

### Deterministic Tie-Breaking
When candidates share identical normalized scores:
1. Sort by normalized score descending.
2. Sort by raw model logit descending.
3. Tie-breaker: sort by canonical intent identifier string alphabetically ascending (`"code_debugging"` before `"writing"`).

---

## 6. Preprocessing & Input Safety

1. **Empty Input Check:** Whitespace-only prompts are rejected locally with `EmptyInput`.
2. **Syntax Preservation:** Code blocks, markdown fences, indentation, and punctuation are strictly preserved to maintain crucial software-engineering signals.
3. **Multilingual Safety:** Non-English characters (e.g., Urdu, French, Arabic) are preserved in their native encoding.
4. **Context Boundary:** Conversation context is bounded to at most the last 2 turns (`MAX_CONTEXT_TURNS`).
5. **No Silent Truncation:** Prompts exceeding sequence limits return `InputTooLong` without silent data loss.

---

## 7. Security, Privacy & Zero Cloud Dependency

1. **100% Offline Execution:** Classification executes on-device via ONNX Runtime without internet or DPAPI credentials.
2. **Zero Telemetry Leakage:** Prompt texts, conversation turns, and raw feature tensors are strictly prohibited from logs and SQLite telemetry tables.
3. **No Personal Profiling:** The classifier classifies requested tasks, never user traits (no age, gender, politics, or religion inference).
4. **Untrusted Input Invariant:** Prompts cannot execute code or inject instructions into runtime configuration.

