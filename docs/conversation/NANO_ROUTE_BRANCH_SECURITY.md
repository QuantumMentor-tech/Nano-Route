# Nano Route — Branch Security Specification
**Step 81 — Authoritative Security Specification**

## 1. Security Boundaries & Threat Modeling
- **Typed IPC Operations**: Branch creation, navigation, and deletion use strongly typed parameters. Raw SQL query injection from frontend is structurally impossible.
- **Cross-Session Isolation**: A branch cannot reference a `root_message_id` belonging to a different session; foreign key and validation constraints block cross-session leakage.
- **Zero Credential Contamination**: Branch metadata consists of IDs, timestamps, and names; credentials and API keys are never referenced.

