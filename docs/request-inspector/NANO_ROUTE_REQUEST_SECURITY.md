# Nano Route — Request Inspector Security Model

## 1. Zero Credential Exposure Invariant
The Request Inspector operates on normalized prompt and context text. It strictly excludes:
- API Keys (`apiKey`, `sk-...`).
- HTTP Authorization headers (`Bearer ...`).
- Windows DPAPI master keys or encrypted blobs.
- Internal provider endpoint secrets or tokens.

## 2. Parameterized Read-Only Operations
All queries into local history, notes, and session metadata utilize parameterized SQLite statements. Inspection never executes raw SQL strings or invokes external scripts.

## 3. Render Sanitization
Prompt and reference content displayed in the inspector modal is rendered with strict HTML escaping and sanitization, neutralizing XSS risks from untrusted file content or pasted text.

