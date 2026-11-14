# Nano Route — Branch Import & Export Specification
**Step 81 — Authoritative Portability Specification**

## 1. Data Portability Alignment
- When full sessions are exported via Step 70 Data Portability, branch records and variant groups are exported as relational child entities.
- On import (Step 71), branch mappings are reconciled with target session IDs to ensure non-destructive merge behavior.

