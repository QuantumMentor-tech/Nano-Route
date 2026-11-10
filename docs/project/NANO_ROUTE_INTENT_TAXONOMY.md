# NANO ROUTE — INTENT TAXONOMY SPECIFICATION
## Authoritative Task Categories, Positive/Negative Signals & Mapping (Step 27 of 90)

---

## 1. Overview

This document defines the 12 canonical task intent categories supported by Nano Route’s on-device SLM classification engine.

Each category defines:
- **Canonical Identifier:** Language-neutral string for serialization and telemetry.
- **Display Label:** Presentation name for diagnostics.
- **Definition:** Clear specification of the requested work.
- **Positive Signals:** Keywords and syntactical patterns identifying the workload.
- **Negative Boundary:** What this category is *not*.

---

## 2. Intent Specifications

### 2.1 `software_engineering`
- **Display Name:** Software Engineering
- **Definition:** The user wants to write, architect, refactor, implement, or review software systems.
- **Positive Signals:** `fn`, `struct`, `class`, `impl`, `refactor`, `algorithm`, `architecture`, `API`, `compile`, `git`, code fences.
- **Negative Boundary:** Debugging a specific error with a stack trace (use `code_debugging`); general programming trivia without an implementation task.

### 2.2 `code_debugging`
- **Display Name:** Code Debugging
- **Definition:** The user wants to troubleshoot a crash, panic, exception, memory leak, or compiler error.
- **Positive Signals:** `stack trace`, `panic`, `NullPointerException`, `segmentation fault`, `memory leak`, `fix this error`, `why does this fail`.
- **Negative Boundary:** General feature implementation without an active bug.

### 2.3 `reasoning_math`
- **Display Name:** Reasoning & Math
- **Definition:** Formal logic, mathematical proofs, linear algebra, arithmetic derivation, or multi-step deductive problem solving.
- **Positive Signals:** `proof`, `theorem`, `calculate`, `eigenvalue`, `matrix`, `integral`, `derivative`, `equation`, `contradiction`.
- **Negative Boundary:** Casual conversation or open-ended subjective opinions.

### 2.4 `general_conversation`
- **Display Name:** General Conversation
- **Definition:** Everyday conversational dialog, greetings, chit-chat, and quick common inquiries.
- **Positive Signals:** `hello`, `hi`, `how are you`, `good morning`, `what's up`, `thank you`, `tell me a fun fact`.
- **Negative Boundary:** Concrete technical requests or long-form document generation.

### 2.5 `research_retrieval`
- **Display Name:** Research & Retrieval
- **Definition:** Comparative technical surveys, historical exploration, or multi-source knowledge synthesis.
- **Positive Signals:** `compare`, `survey`, `history of`, `tradeoffs between`, `literature review`, `overview of recent developments`.
- **Negative Boundary:** Short factual trivia or single-step calculations.

### 2.6 `writing`
- **Display Name:** Long-Form Writing
- **Definition:** Drafting, refining, or composing essays, proposals, business correspondence, formal reports, or articles.
- **Positive Signals:** `draft an essay`, `business proposal`, `executive summary`, `formal letter`, `cover letter`, `rephrase for professional tone`.
- **Negative Boundary:** Creative fiction/poetry (use `creative_generation`); condensing documents (use `summarization`).

### 2.7 `data_analysis`
- **Display Name:** Data Analysis
- **Definition:** Extracting metrics, identifying anomalies, aggregating data, or calculating statistical trends from structured tabular data.
- **Positive Signals:** `CSV`, `JSON dataset`, `calculate growth percentage`, `identify outliers`, `correlation`, `sales table`.
- **Negative Boundary:** Theoretical math without a dataset.

### 2.8 `translation`
- **Display Name:** Translation
- **Definition:** Translating text between human natural languages.
- **Positive Signals:** `translate into French`, `in Spanish`, `Urdu translation`, `how do you say in German`, `tarjuma`.
- **Negative Boundary:** Code transpilation (e.g. C++ to Rust is `software_engineering`).

### 2.9 `summarization`
- **Display Name:** Summarization
- **Definition:** Condensing long articles, meeting transcripts, reports, or privacy policies into concise points or digests.
- **Positive Signals:** `summarize`, `TL;DR`, `key takeaways`, `bullet point summary`, `condense this meeting transcript`.
- **Negative Boundary:** Expanding or drafting new long-form material from scratch.

### 2.10 `creative_generation`
- **Display Name:** Creative Generation
- **Definition:** Imaginative fiction, poetry, storytelling, character design, roleplay, and creative ideation.
- **Positive Signals:** `write a short story`, `compose a poem`, `cyberpunk fiction`, `character dialogue`, `worldbuilding`.
- **Negative Boundary:** Formal business writing or factual reporting.

### 2.11 `other`
- **Display Name:** Other Workload
- **Definition:** An understood task or domain that falls outside the primary 10 categories.
- **Positive Signals:** Cooking recipes, fitness workouts, specific legal clauses, diet planning.
- **Negative Boundary:** Ambiguous gibberish (use `unknown`).

### 2.12 `unknown`
- **Display Name:** Unknown / Uncertain
- **Definition:** The classifier cannot determine a reliable category, the score is below acceptance threshold, or the input is undecidable.
- **Positive Signals:** `help`, `what should I do?`, `tell me something useful`, empty/unparseable input.
- **Negative Boundary:** Clearly articulated tasks matching any primary intent.

---

## 3. Label Map Association (`nano-route-intent-schema-v1`)

```text
Index 0  -> software_engineering
Index 1  -> code_debugging
Index 2  -> reasoning_math
Index 3  -> general_conversation
Index 4  -> research_retrieval
Index 5  -> writing
Index 6  -> data_analysis
Index 7  -> translation
Index 8  -> summarization
Index 9  -> creative_generation
Index 10 -> software_engineering (coding sub-label)
Index 11 -> reasoning_math (math sub-label)
Index 12 -> reasoning_math (reasoning sub-label)
Index 13 -> creative_generation (creative sub-label)
Index 14 -> other
Index 15 -> unknown
```

