# Nano Route — Step 84 Baseline & Request Pipeline Audit

## 1. System Context & Intent
Step 84 introduces a secure, read-only Request Inspector and Final Submission Review subsystem. It provides a transparent, consolidated view of everything Nano Route prepares to transmit to an AI provider before network dispatch.

## 2. Pre-Implementation Audit of Prior Steps
- **Step 76 Context Window Management:** Authoritative context limits, token estimation heuristics (`estimateTextTokens`), and preflight headroom calculations.
- **Step 75 Budget Guardrails:** Local monthly spend tracking, period bounds, and hard/soft guardrail blocks (`evaluateBudgetPreflight`).
- **Step 77 Prompt Templates:** Template contributions, variable expansion, and preset parameter preferences.
- **Step 78 Composer Drafts:** Active prompt state persistence, recovery, and input editing.
- **Step 79 Attachments:** Prepared file contexts, size/token constraints, and category validations.
- **Step 80 Rich Message Rendering:** Markdown rendering and sanitized display.
- **Step 81 Conversation Branching:** Lineage tracking and branch-specific variant context.
- **Step 82 Organization:** Bookmarks, highlights, and private notes.
- **Step 83 Context Collections:** Curated reference packs, source provenance, and stale reference tags.

## 3. Strict Non-Goals & Invariants
- **No Secondary Submission Pipeline:** The inspector does NOT transmit requests independently; activating Send delegates to the authoritative `onSubmit` pipeline.
- **No Raw Credential Exposure:** API keys, DPAPI data, and authorization headers are never shown or stored in inspection snapshots.
- **Fresh Revalidation Required:** The system always performs fresh authoritative validation immediately before submission to prevent stale sends.
- **Zero Network Activity on Inspection:** Opening, viewing, and refreshing the inspector triggers no external provider network calls.

