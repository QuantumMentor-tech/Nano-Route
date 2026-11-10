# NANO ROUTE — COMPLEXITY TAXONOMY SPECIFICATION
## Workload Depth, Scoring Boundaries & Structural Evidence (Step 28 of 90)

---

## 1. Executive Summary

This specification defines the 6 qualitative complexity levels used by Nano Route's on-device Task Analysis Engine.

**Complexity is not provider quality:**
- High complexity indicates higher reasoning depth, multi-step dependency, or strict algorithmic constraints.
- It does **not** mandate selecting an expensive or cloud-hosted provider. Provider feasibility and selection are deferred to Step 29+.

---

## 2. Complexity Taxonomy Levels

### 2.1 `Trivial`
- **Definition:** Direct single-step lookups, basic greetings, single-word definitions, or simple single-sentence translations.
- **Examples:**
  - *"Hello! How are you doing today?"*
  - *"Translate 'good morning' into French."*
  - *"What is the capital of Japan?"*
- **Non-Examples:** Explaining the architectural trade-offs of modern microservices.
- **Score Range:** $[0.0, 0.18)$

### 2.2 `Low`
- **Definition:** Single-function generation without constraints, brief summaries of short text, straightforward single-concept explanations.
- **Examples:**
  - *"Write a Python helper function to check if a string is a palindrome."*
  - *"Summarize this three-sentence paragraph."*
  - *"Explain the difference between a stack and a queue."*
- **Score Range:** $[0.18, 0.38)$

### 2.3 `Moderate`
- **Definition:** Multi-condition comparisons, structured data parsing, multi-paragraph document drafting, moderate algorithmic problems.
- **Examples:**
  - *"Write an essay comparing renewable energy incentives in Europe and North America."*
  - *"Parse this CSV sales data and calculate quarterly averages per region."*
  - *"Implement binary search tree insertion and deletion in C++."*
- **Score Range:** $[0.38, 0.65)$

### 2.4 `High`
- **Definition:** Multi-file refactoring, formal mathematical proofs, complex systems architecture, deep race condition or memory leak debugging.
- **Examples:**
  - *"Refactor these five Rust modules so the async worker can cancel cleanly without leaking memory."*
  - *"Prove by contradiction that the square root of 2 is irrational and show every intermediate step."*
  - *"Design a distributed consensus mechanism resilient to network partitions."*
- **Score Range:** $[0.65, 0.88)$

### 2.5 `VeryHigh`
- **Definition:** Multi-stage multi-domain technical workflows, formal verification, massive context ingestion under strict constraints, cross-document discrepancy detection.
- **Examples:**
  - *"Audit this 50-page financial contract across three amendments, extract all liability clauses into strict JSON schema, verify compliance with local banking regulations, and draft an executive risk matrix."*
- **Score Range:** $[0.88, 1.0]$

### 2.6 `Unknown`
- **Definition:** Under-specified prompts, unparseable input, or severe signal conflict where complexity cannot be determined reliably.
- **Examples:**
  - *"Can you help with this?"*
  - *"Do it now."*

---

## 3. Structural Evidence Signals

| Evidence Code | Weight | Description |
|---|---|---|
| `multi_step_instruction` | 0.85 | Sequential dependencies ("first...", "then...", "finally..."). |
| `cross_file_reasoning` | 0.90 | Operations spanning multiple modules, files, or packages. |
| `code_block_detected` | 0.80 | Source code syntax or markdown code blocks present in prompt. |
| `explicit_constraints` | 0.85 | Algorithmic constraints ($O(1)$, thread-safety, memory limits). |
| `mathematical_proof_requested` | 0.90 | Formal deductive mathematical derivations or proofs. |
| `large_context_payload` | 0.70 | Extended prompt length (>400 words) or deep multi-turn context. |

