# Nano Route — Organization Privacy Specification
**Step 82 — Authoritative Privacy Specification**

## 1. Local-Only Storage Guarantee
- Notes and bookmark labels are stored solely in local SQLite databases.
- Private notes are excluded from LLM prompt construction, SLM classification, and remote telemetry logging.
- Diagnostic support packages structurally redact user note content.

