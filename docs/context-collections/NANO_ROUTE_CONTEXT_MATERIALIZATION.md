# Nano Route — Context Materialization & Formatting

## 1. Materialization Process
When a collection is materialized for preview or composer insertion:
1. All child reference items are sorted by `position ASC`.
2. Each item is resolved against local stores.
3. Item-level character counts and estimated tokens are computed using Step 76's `estimateTextTokens` (~3.8 chars/token).
4. Aggregate statistics are computed: `totalCharCount`, `totalEstimatedTokens`, `validCount`, `staleCount`, `unavailableCount`, and `hasSensitiveNotes`.
5. The structured reference pack text is generated.

## 2. Canonical Delimitation Format
```text
[CONTEXT REFERENCE PACK: "Architecture Overview"]
Context Description: Core backend design references

--- Reference 1: Conversation Message - "Engine Design" ---
<Resolved message content>

--- Reference 2: Private Note (User-Authorized Context) - "Security Flags" ---
<Resolved note content>

[/CONTEXT REFERENCE PACK]
```

## 3. Composer & Preflight Boundary
- The formatted text is injected into the user's active draft in `Composer.tsx`.
- The user can review, edit, or delete any portion of the injected text prior to submission.
- Once submitted, the complete prompt (including the reference pack) passes through Step 76 Context Preflight for model limit and headroom validation.

