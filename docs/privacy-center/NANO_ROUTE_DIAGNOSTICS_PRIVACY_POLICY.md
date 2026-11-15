# Nano Route — Diagnostics & Redaction Privacy Policy
**Document Version:** 1.0.0  
**Phase:** Post-Roadmap Product Capability Expansion  
**Status:** Authoritative Policy  
**Date:** 2026-11-15  

---

## 1. Local-Only Execution

System diagnostics (Step 62) run entirely on-demand on the local host. Diagnostics do not transmit telemetry or reports over the network.

Reports are generated exclusively into memory or saved to user-selected local destination files when explicitly requested by the user.

---

## 2. Automated Sanitization & Redaction

When a diagnostic report or test run is compiled, the following sanitization rules are enforced:

1. **API Keys & Credentials**: Provider keys are never read or output during diagnostic routines. The `CRED-001` test only queries DPAPI integrity flags without retrieving secret bytes.
2. **Filesystem Paths**: Local user paths (e.g. `C:\Users\<username>\AppData\...`) are sanitized to relative or generic representations where possible.
3. **Database Contents**: Diagnostic probes verify database schema version, WAL mode, page sizes, and integrity check results (`PRAGMA integrity_check`). Individual message contents, user prompts, and private notes are strictly omitted from diagnostic outputs.
4. **Environment Variables**: Process environment dumps exclude known sensitive variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `NANO_SECRET`, etc.).

