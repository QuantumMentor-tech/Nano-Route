# Nano Route — Conversation Branching Architecture Specification
**Step 81 — Authoritative Architecture Specification**

## 1. Subsystem Architecture Overview
Conversation Branching & Response Variants provide a non-destructive exploration layer over Nano Route's conversational workspace:

```text
+-----------------------------------------------------------------------------------+
|                   CONVERSATION BRANCHING SUBSYSTEM (STEP 81)                      |
|                                                                                   |
|  [ User Message Turn ] <----+                                                     |
|          |                  |                                                     |
|          v                  | (Regenerate Action)                                 |
|  [ Multiple Response Variants ]                                                   |
|  - Variant 1 (Original physical attempt)                                          |
|  - Variant 2 (Alternative physical attempt)                                       |
|  - VariantSwitcher UI: `< 1 / 2 >`                                                |
|          |                                                                        |
|          v (Continue from here / Branch Fork)                                     |
|  [ Conversation Branches Lineage ]                                                |
|  - `conversation_branches` linking root checkpoint to new branch sequence         |
|  - Preserves shared ancestry; zero destructive history deletion                   |
|                                                                                   |
+-----------------------------------------------------------------------------------+
                                   | (Branch Draft Seeding)
                                   v
+-----------------------------------------------------------------------------------+
|                     DOWNSTREAM PIPELINE (STEPS 74 - 80)                           |
|                                                                                   |
|  [ Step 78 Draft Autosave ] -> [ Step 76 Context Preflight ]                      |
|                                   |                                               |
|                                   v                                               |
|  [ Step 75 Budget Guardrails ] -> [ Step 29/30 SLM/Model Routing ]                |
|                                   |                                               |
|                                   v                                               |
|  [ Provider Execution & Streaming ]                                               |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

## 2. Inviolable Guarantees
1. **Never a Destructive Rewrite**: Generating an alternate response or branching from a prior turn NEVER overwrites or removes the existing historical messages.
2. **Deterministic Physical Accounting**: Each regeneration attempt creates a discrete physical provider interaction with its own token, cost, and latency metrics.
3. **No Automatic AI Choice**: The user explicitly chooses their preferred variant or continuation path.

