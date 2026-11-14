# Nano Route — Context Collections & Reference Packs Architecture

## 1. Architectural Philosophy
Context Collections serve as a deliberate, user-controlled bridge between historical chat knowledge and future model prompts. Rather than relying on speculative AI retrieval, the system gives the user deterministic control over what reference material is included in a prompt.

## 2. Component Pipeline
```
[Saved Chat Messages / Notes / Attachments]
                     ↓ User Action ("Add to Collection")
            [Context Collection Store]
                     ↓ User Reviews & Reorders in Modal
           [Source Resolution & Staleness Check]
                     ↓ Token Estimation (Step 76 Heuristics)
             [Explicit "Insert into Composer"]
                     ↓ Draft State (Step 78)
        [Context Preflight & Headroom Validation (Step 76)]
                     ↓ Budget Verification (Step 75)
            [Intelligent Routing & Dispatch]
```

## 3. Core Subsystems
1. **Collections Engine (`src/features/context-collections/engine.ts`):** Handles CRUD, item re-indexing, cascade cleanup, and provenance mapping.
2. **Materialization & Token Estimator:** Formats raw references into bounded context blocks (`[CONTEXT REFERENCE PACK: ...]`) and calculates approximate token usage via `estimateTextTokens`.
3. **Staleness Classifier:** Detects when underlying messages, notes, or attachments have been removed or modified, tagging references as `VALID`, `STALE`, or `UNAVAILABLE`.
4. **Composer UI Integration:** Adds accessible buttons in `Composer.tsx` and `AssistantMessage.tsx` to browse collections and add new references without interrupting user flow.

