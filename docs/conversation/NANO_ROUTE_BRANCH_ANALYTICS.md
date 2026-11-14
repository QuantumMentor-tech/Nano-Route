# Nano Route — Branch Analytics & Telemetry Specification
**Step 81 — Authoritative Telemetry Specification**

## 1. Logical vs Physical Accounting
- **Logical Request**: The user's conversational intent to receive an answer to a specific prompt.
- **Physical Attempt**: A discrete network invocation to a provider.
- Regeneration increments the physical attempt count and attributes tokens, latency, and cost to that specific attempt. It does NOT multiply logical request counters.

## 2. Invariants
- Multiple variants do not cause double-counting in cost summaries.
- Each variant records its own provider, model, latency, and cost.

