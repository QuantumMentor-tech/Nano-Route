# Nano Route — Regeneration Policy & Operational Contracts
**Step 81 — Authoritative Regeneration Specification**

## 1. Request Execution Lifecycle
Regenerating an assistant response:
1. Reconstructs exact conversational history up to the target user message turn.
2. Formulates an execution attempt through the canonical request pipeline.
3. Evaluates target limits via Step 76 Context Window Preflight.
4. Enforces spend limits via Step 75 Budget Guardrails.
5. Invokes Step 29/30 Intelligent Routing or manual override.
6. Upon completion, persists the new response turn and registers it as a new response variant in `message_response_variants`.

## 2. Invariants
- Direct API calls from UI components are strictly forbidden.
- Failed attempts do not erase previously successful variants.

