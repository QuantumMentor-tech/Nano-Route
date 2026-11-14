# Nano Route Data Import Validation Pipeline

## 10-Stage Deterministic Pipeline

1. **Size Boundary Check**: Enforces a strict 20 MB ceiling.
2. **JSON Syntax Parse**: Validates well-formed JSON object trees.
3. **Secret Scan & Strip**: Recursively removes keys containing `api_key`, `secret`, `token`, `dpapi`, or matching `sk-` regex.
4. **Manifest Envelope Check**: Confirms presence of format, application, version, and checksum.
5. **Schema Version Check**: Confirms version $\le 1$.
6. **Allowlist Field Filtering**: Strips undefined or extraneous properties.
7. **Collision & Conflict Analysis**: Cross-references candidate records against existing local SQLite state.
8. **User Preview & Policy Confirmation**: Surfaces total counts, collisions, and policy selector.
9. **Atomic Execution**: Staged commits with rollback capability.
10. **Post-Import Verification**: Audits inserted rows and triggers FTS5 re-indexing.

