# NANO ROUTE — TASK ANALYSIS ENGINE
## Multidimensional Workload Analysis, Provenance & Provider Neutrality (Step 28 of 90)

---

## 1. Executive Summary

Step 28 establishes Nano Route's dedicated native **Complexity, Domain & Capability Analysis Engine** (`TaskAnalyzer`).

The Task Analysis Engine enriches the semantic intent output from Step 27 into an authoritative, provider-neutral **Task Analysis Result**. It determines:
1. **Task Complexity:** The cognitive, algorithmic, and computational depth required (Trivial, Low, Moderate, High, VeryHigh).
2. **Task Domains:** The knowledge areas involved (Software Engineering, Mathematics, Research, Long-Form Writing, Business, Data Analysis, etc.), supporting multi-domain requests.
3. **Task Capability Requirements:** The technical features the execution path must provide (Code Understanding, Deep Reasoning, Structured Output, Web Retrieval, Image Input, Long Context, etc.).

### Critical Architectural Principle:
The Task Analyzer answers:
> **What does this task require?**

It does **NOT** answer:
> **Which provider or model should execute it?**

The analyzer outputs pure workload specifications and never returns provider brand names, model IDs, pricing estimates, or provider rankings.

---

## 2. Architectural Pipeline & Boundary Separation

```text
                             User Prompt
                                  │
                                  ▼
                    Step 27 IntentClassifier
                                  │
                                  ▼
                     IntentClassificationResult
                                  │
                                  ▼
                         Step 28 TaskAnalyzer
            ┌─────────────────────┼─────────────────────┐
            ▼                     ▼                     ▼
    Complexity Analyzer    Domain Analyzer     Capability Analyzer
            │                     │                     │
            └─────────────────────┼─────────────────────┘
                                  ▼
                      Conflict Resolution Engine
                                  │
                                  ▼
                          TaskAnalysisResult
                                  │
                                  ▼
                       Step 29 (Future Scope)
               (Candidate Scoring & Provider Feasibility)
```

---

## 3. Four Distinct Analytical Dimensions

| Dimension | Scope & Authority | Example | Non-Example |
|---|---|---|---|
| **Intent (Step 27)** | What task the user wants performed. | `software_engineering` | "Anthropic", "hard coding" |
| **Complexity (Step 28)** | Reasoning depth, constraints, dependencies. | `high` | "Tier 3 model", "expensive" |
| **Domain (Step 28)** | Subject matter & operational area. | `software_engineering`, `business` | "OpenAI domain" |
| **Capabilities (Step 28)** | Technical execution features required. | `structured_output`, `long_context` | "Gemini Flash capability" |

---

## 4. Signal Provenance & Evidence Hierarchy

To guarantee full auditability without storing raw user prompt text, every analytical decision records machine-readable evidence with explicit provenance:

- `Model`: Derived directly from local SLM inference.
- `ExplicitUserRequirement`: Mandated explicitly in prompt text (e.g., "return valid JSON", "cite sources").
- `StrongStructuralSignal`: Unambiguous syntactical cues (e.g. code fences, stack traces, mathematical formulas).
- `Heuristic`: Deterministic pattern or keyword heuristics.
- `Derived`: Deduced from cross-dimensional synthesis.
- `Unknown`: Unresolved or undecidable provenance.

### Precedence Hierarchy:
$$\text{ExplicitUserRequirement} > \text{Model} > \text{StrongStructuralSignal} > \text{Heuristic} > \text{Unknown}$$

---

## 5. Critical Disambiguations

1. **Discussion vs. Execution Requirement:**
   - *"Explain how image generation works."* $\rightarrow$ TextGeneration only; `ImageInput` is **NOT** required.
   - *"Analyze this image and describe the defects."* $\rightarrow$ `ImageInput = Required`.
2. **Negation Handling:**
   - *"Do not search the web. Explain from general knowledge."* $\rightarrow$ `WebRetrieval = NotRequired`.
3. **Attachment Mention vs. Physical Availability:**
   - *"Analyze the uploaded PDF"* with 0 attached files $\rightarrow$ `DocumentAnalysis = Required`, with machine-readable evidence `attachment_mention_without_file`.
4. **Structured Output:**
   - Detected only when the user explicitly mandates machine-readable formats (`valid JSON`, `CSV format`, `as a table`).

---

## 6. Privacy & Security Invariants

- **100% On-Device:** All analysis executes on the local Windows desktop using the Step 26 SLM runtime and Step 27 intent engine.
- **Zero Prompt Leakage:** User prompt strings, code blocks, and conversation turns are strictly prohibited from logs, error payloads, and telemetry.
- **Untrusted Input Protection:** Prompt text cannot inject execution instructions, alter model parameters, or modify provider credentials.
- **Provider Independence:** Cloud provider health, network state, and credential status have zero impact on semantic task analysis.

