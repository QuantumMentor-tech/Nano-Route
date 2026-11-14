# Nano Route — Branch Recovery & Continuity Specification
**Step 81 — Authoritative Recovery Specification**

## 1. Restart Lifecycle
- Branch configurations and variant links reside in persistent SQLite tables.
- After an application or renderer restart, conversation branches and variants are restored without data loss.
- An interrupted streaming regeneration turn is marked with failure/cancelled status; prior completed variants remain intact.

