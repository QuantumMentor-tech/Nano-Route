# Nano Route — Composer Draft Security Specification
**Step 78 — Authoritative Security Specification**

## 1. Threat Mitigation
Composer drafts are treated as unvalidated local text:

| Threat Vector | Mitigation Strategy | Enforcement |
|---|---|---|
| SQL Injection | Parameterized queries via SQLite prepared statements | Migration 008 / Engine |
| Cross-Site Scripting (XSS) | React text node rendering without HTML injection | React virtual DOM / Composer |
| Malicious Executables | Plain text storage only; zero execution or eval | Composer Engine |
| Credential Exposure | Drafts never access Windows DPAPI or secret stores | Architecture Boundary |
| Outbound Leakage | Autosave is 100% local; zero telemetry or network calls | Local IPC / Storage |

## 2. Invariant Verification
Draft operations never initiate outbound network requests, never invoke ONNX runtime or SLMs, and never parse credentials from system vaults.

