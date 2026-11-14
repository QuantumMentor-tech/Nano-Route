# Nano Route — Step 81 Pre-Implementation Audit & Baseline
**Conversation Branching, Response Variants, Regeneration & Non-Destructive Chat Exploration**

## 1. Current State Assessment
- **Session & Message Data Model**:
  - `chat_sessions`: `id`, `title`, `created_at`, `updated_at`, `pinned`.
  - `chat_messages`: `id`, `session_id`, `sender` (`user`, `assistant`, `system`), `content`, `routed_provider`, `routed_model`, `routing_reason`, `slm_confidence_score`, `prompt_tokens`, `completion_tokens`, `latency_ms`, `cost_usd`, `created_at`.
  - Linear message sequence strictly ordered by `session_id, created_at, id`.
- **Regeneration / Retries in Baseline**:
  - Retries previously resent prompt text, producing an appended turn rather than maintaining explicit lineage or multi-variant state.
  - Previous assistant outputs had no grouping metadata connecting alternate responses for the same user prompt.
- **Architectural Scope (Step 81)**:
  - Add non-destructive branching via migration `009_conversation_branches.sql`.
  - `conversation_branches`: `id`, `session_id`, `name`, `parent_branch_id`, `root_message_id`, `created_at`, `updated_at`.
  - `message_response_variants`: `id`, `user_message_id`, `assistant_message_id`, `variant_index`, `is_preferred`, `created_at`.
  - UI Navigation: Variant switcher on Assistant Message bubbles (`< 1 / 3 >`) with preferred selection.
  - "Branch from here" message action seeding Composer draft with lineage context.

## 2. Inviolable Guarantees
1. **Zero Destructive Overwriting**: Regenerating or branching NEVER overwrites or deletes the canonical historical message. All physical attempts and variants remain persisted.
2. **Authoritative Downstream Pipeline**: Regenerations flow strictly through Step 76 Context Preflight, Step 75 Budget Enforcement, Step 74 Secret Isolation, and Step 29/30 Intelligent Routing.
3. **Separate Logical vs Physical Accounting**: Distinct provider requests are tracked individually for tokens, cost, and latency; logical request counts are not inflated.

