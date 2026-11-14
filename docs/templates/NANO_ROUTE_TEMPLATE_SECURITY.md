# Nano Route — Prompt Template Security & Sanitization Specification
**Step 77 — Authoritative Security Reference**

## 1. Threat Modeling & Prohibited Vectors
Prompt templates are untrusted user input that may be authored locally or imported from external packages.

| Threat Vector | Mitigation Strategy | Enforcement Layer |
|---|---|---|
| Script Injection (`<script>`) | Regex pattern matching rejecting `<script>` tags in content | Parser (`validateTemplate`) |
| Unbounded Payload | Maximum content limit of 32,768 characters (~8.6k tokens) | Parser & SQLite schema |
| Secret Exfiltration | Zero credential storage; export packages explicitly omit secrets | Engine (`exportTemplatesPackage`) |
| Macro / Code Execution | Plain string replacement only; zero `eval`, `Function`, or child_process | Parser (`resolveTemplateContent`) |
| Prompt Hijacking | Explicit human review in Composer before any request is transmitted | UI Workflow (`ChatStudio` -> `Composer`) |

## 2. Invariant Verification
- Unit test suite `src/features/templates/__tests__/templates.test.ts` asserts that executable script tags are rejected.
- Test suite verifies that template packages contain zero DPAPI keys, bearer tokens, or sensitive user environment data.

