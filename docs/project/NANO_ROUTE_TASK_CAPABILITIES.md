# NANO ROUTE — TASK CAPABILITY REQUIREMENTS
## Execution Feature Demand, Negation Handling & Attachment Semantics (Step 28 of 90)

---

## 1. Executive Summary

This specification defines the 20 task capability requirements supported by Nano Route's on-device Task Analysis Engine.

**Task Capability vs. Provider Capability:**
- **Step 28 Task Capability Requirement:** What functionality the user's task *demands* (e.g. `requires_image_input = true`).
- **Step 25 Provider Capability:** What functionality a specific cloud model or provider *supplies* (e.g. `gpt-4o supports vision`).
- Comparing task demand against provider supply is strictly deferred to Step 29 scoring.

---

## 2. Supported Task Capability Requirements

| Capability Identifier | Display Label | Condition for `Required` | False Positive / Non-Example |
|---|---|---|---|
| `text_generation` | Text Generation | Default requirement for all textual tasks. | Non-textual only tasks. |
| `code_understanding` | Code Understanding | Prompts containing syntax, functions, structs, stack traces. | Conceptual programming questions without code. |
| `code_generation` | Code Generation | Prompts requesting implementation, scripts, refactoring. | Explaining code without generating solutions. |
| `mathematical_reasoning` | Math Reasoning | Prompts requiring calculations, proofs, equations. | Casual conversational arithmetic ($2+2$). |
| `deep_reasoning` | Deep Reasoning | Multi-step deductive logic, formal proofs, causal trade-offs. | Direct factual memory retrieval. |
| `structured_output` | Structured Output | Explicit constraints for JSON, tables, CSV, or strict schemas. | Prompts that mention JSON in conversation. |
| `document_analysis` | Document Analysis | Analyzing or synthesizing reports, whitepapers, or PDFs. | General knowledge inquiries. |
| `large_document_ingestion` | Large Ingestion | Tasks ingesting $>64\text{k}$ token context documents. | Short 200-word summaries. |
| `long_context` | Long Context Window | Tasks requiring $>16\text{k}$ tokens of context. | Standard single-turn chat prompts. |
| `multi_turn_context` | Multi-Turn Context | Tasks relying heavily on previous conversation turns. | Standalone zero-context requests. |
| `web_retrieval` | Live Web Retrieval | Explicit requests for current live web information. | Tasks where web search is explicitly negated. |
| `search_grounding` | Search Grounding | Factual verification and grounded external retrieval. | Creative fiction and speculative ideation. |
| `citation_support` | Citation Support | Explicit requests to cite sources, provide bibliography. | General explanations without source citation. |
| `image_input` | Vision / Image Input | Inspecting, describing, or parsing an attached image. | Discussing how image generation works. |
| `audio_input` | Audio Input | Audio transcription or acoustic analysis. | Discussing music or audio file formats. |
| `video_input` | Video Input | Video clip analysis or frame-by-frame inspection. | Discussing movies or video codecs. |
| `tool_calling` | Tool / Function Call | Tasks explicitly requiring external tool execution. | Standard text-only generation. |
| `file_handling` | File Attachment | Physical file uploaded and attached to the task. | Prompt mentions "PDF" but no file is attached. |
| `translation` | Translation | Natural language translation between human languages. | Code transpilation (C++ to Rust). |
| `summarization` | Summarization | Condensing documents into bullet points, TL;DR, or digests. | Drafting long essays or expanding text. |

---

## 3. Critical Semantic Boundaries

### 3.1 Discussion vs. Execution Requirement
- *"Explain how computer vision models work."* $\rightarrow$ `ImageInput = NotRequired` (TextGeneration only).
- *"Analyze this image and describe the defects."* $\rightarrow$ `ImageInput = Required`.

### 3.2 Negation Handling
- *"Do not search the web. Explain from general knowledge."* $\rightarrow$ `WebRetrieval = NotRequired`.
- The engine explicitly preserves `RequirementStrength::NotRequired` to prevent downstream routers from accidentally triggering web search tools.

### 3.3 Attachment Mentions vs. Physical Presence
- If the user prompt states *"Analyze this uploaded PDF"*, but `attachment_count == 0`:
  - `DocumentAnalysis` is assessed as `Required`.
  - `FileHandling` is **not** assigned.
  - Evidence `attachment_mention_without_file` is recorded so the application can prompt the user to attach the file before routing to expensive cloud models.

