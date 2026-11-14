# NANO ROUTE — DIAGNOSTIC PRIVACY & REDACTION MODEL
## Step 62 Structural Redaction Boundaries & Data Classification Model

---

## 1. DATA CLASSIFICATION TIERS

Every data field encountered during diagnostics and report export is strictly classified into one of four privacy tiers:

| Tier | Classification | Description | Handling in Diagnostics | Handling in Report Export |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1** | `PUBLIC_SAFE` | Application version, build architecture, public model IDs, operational timestamps, general OS family. | Rendered in UI directly. | Serialized into report. |
| **Tier 2** | `INTERNAL_SAFE` | Aggregated record counts, schema version, latency milliseconds, boolean capability flags. | Rendered in UI detail drawers. | Serialized into report with scalar sanitization. |
| **Tier 3** | `SENSITIVE_OMIT` | Local Windows usernames, absolute user folder paths, detailed internal database filenames. | Scrubbed with `[REDACTED_PATH]`. | Structurally stripped or regex sanitized. |
| **Tier 4** | `SECRET_NEVER_EXPORT` | Plaintext API keys, DPAPI encrypted blobs, HTTP Authorization headers, conversational chat prompts, model completion text. | **NEVER** fetched across IPC boundary into diagnostic memory. | Structurally omitted; secondarily stripped with `[REDACTED_SECRET]`. |

---

## 2. STRUCTURAL OMISSION ENFORCEMENT

The Diagnostics Center enforces privacy primarily through **Structural Omission at the Source**, rather than relying solely on string-based regular expressions:

1. **Credentials Subsystem**: The diagnostics test runner calls `listProviderCredentialStatuses()`, which queries metadata boolean flags (`isConfigured: true/false`). It does not invoke any API capable of decrypting or returning raw credential bytes.
2. **Chat & History Subsystem**: The test runner never calls `getChatHistory()` or conversational query functions. Diagnostic summaries do not have access to prompt or completion memory.
3. **Database Subsystem**: SQLite integrity is validated via `getDatabaseHealth()` which returns schema version, WAL mode, and integrity check status; table row contents are never scanned.

---

## 3. SECONDARY DEFENSE-IN-DEPTH REDACTION

As a secondary safety net against unexpected error messages or third-party library stack traces, all exported strings pass through `redactString`:

- **API Key Regex**:
  `/(?:Bearer\s+[A-Za-z0-9._\-/+=]+|sk-(?:proj-)?[A-Za-z0-9_\-]{8,}|AIza[0-9A-Za-z\-_]{30,}|gsk_[A-Za-z0-9_\-]{16,}|ghp_[A-Za-z0-9]{30,}|(?:eyJ[A-Za-z0-9_\-]{10,}\.eyJ[A-Za-z0-9_\-]{10,})|(?:key|secret|password|token|api_key)=[^\s&"']+)/gi`
- **Filesystem Path Regex**:
  `/(?:[A-Za-z]:\\(?:Users\\[^\\/:*?"<>|\r\n\t]+\\[^\\/:*?"<>|\r\n\t]+)|\/(?:Users|home|root)\/[^\s"']+)/g`

---

## 4. INVARIANT VERIFICATION

Every generated diagnostic report payload computes and verifies three hard boolean invariants:

- `zeroPlaintextKeys === true`
- `zeroChatHistory === true`
- `userPathsSanitized === true`

