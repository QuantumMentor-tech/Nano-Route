# Nano Route — Secret Handling, In-Memory Lifetime & Leak Prevention

**Document Version:** 1.0.0  
**Status:** Authoritative  
**Step:** 74 — Zero-Leak Architecture, Heap Minimization & Cross-Subsystem Redaction  
**Subsystems:** Native Rust Core, React Frontend, Diagnostics, Export, Profiles, Notifications  

---

## 1. Zero Plaintext Invariant

The fundamental security invariant of Nano Route:
> **Plaintext API keys, authorization tokens, and DPAPI private keys are NEVER persisted to disk in unencrypted form and NEVER emitted to frontend logs, application telemetry, support exports, or error messages.**

---

## 2. In-Memory Lifetime Minimization

To minimize exposure to local process memory dumps, page file extraction, or malicious heap inspection:

1. **Frontend Ephemeral Input:**
   - Password fields use `type="password"`, `autoComplete="off"`, and `spellCheck="false"`.
   - React state variables holding user input (`apiKeyInput`) are set to empty string `""` immediately upon form submission or dialog dismissal.
   - Plaintext keys are never stored in React Context, Redux/Zustand stores, or browser `localStorage` / `sessionStorage`.

2. **Native Rust Execution:**
   - Plaintext credentials exist in native memory only during DPAPI encryption or outbound HTTP request execution.
   - Decrypted buffers are zeroed out immediately after constructing request headers.

---

## 3. Cross-Subsystem Redaction Engine

All textual outputs, logs, diagnostics, and error envelopes pass through the unified redaction filter (`sanitizeErrorMessage` and `SECRET_REGEX`):

### Redaction Pattern Coverage
- `Bearer [A-Za-z0-9._-]+`
- `sk-(?:proj-)?[A-Za-z0-9_-]{8,}` (OpenAI keys)
- `AIza[0-9A-Za-z-_]{30,}` (Google Gemini keys)
- `gsk_[A-Za-z0-9_-]{16,}` (Groq keys)
- `ghp_[A-Za-z0-9]{30,}` (GitHub personal access tokens)
- Key-value query parameters matching `key=`, `secret=`, `password=`, `token=`, `api_key=`

Matched sequences are replaced with `[REDACTED_SECRET]` before emission.

---

## 4. Subsystem Audits & Synthetic Leak Tests

Nano Route enforces continuous synthetic secret leak testing across all subsystems:

1. **Diagnostic Reports (`generateDiagnosticReport`):**
   - Asserts that diagnostic summaries, technical details, and error logs contain zero synthetic tokens.
2. **User Data Export (`executeDataExport`):**
   - Validates that JSON and CSV export archives contain zero credential records or DPAPI ciphertext blobs.
   - Post-export scanner (`scanForSecretLeaks`) verifies that forbidden keys (`api_key`, `secret`, `dpapi`) are not present in serialized output.
3. **Workspace Profiles (`exportProfileToJson`):**
   - Confirms that profile JSON exports contain exclusively non-sensitive visual and routing configuration parameters.
4. **Desktop Notifications (`sanitizeNotificationText`):**
   - Verifies that error notifications and completion toasts scrub synthetic secrets before display.

