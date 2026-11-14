# NANO ROUTE — NOTIFICATION SECURITY & PRIVACY
## Step 64 Zero-Secret Policies, Error Sanitization & Protocol Boundaries

---

## 1. ZERO-SECRET ENFORCEMENT

All user-visible notification text, technical diagnostic strings, and action payloads are passed through `sanitizeNotificationText` before being enqueued into memory or persisted to storage:

1. **API Key Scrubbing**: Automatically detects and replaces OpenAI (`sk-`), Gemini (`AIzaSy`), Groq (`gsk_`), and GitHub (`ghp_`) keys with `[REDACTED_SECRET]`.
2. **Authorization Headers**: Strips `Bearer <token>` and raw JWT credentials.
3. **Filesystem Path Scrubbing**: Redacts local Windows drive paths (`C:\Users\<user>\...`) to `[REDACTED_PATH]`, preventing local username disclosure.

---

## 2. STORAGE ISOLATION

- Notifications are persisted under `nr_persistent_notifications_v1` in `localStorage`.
- Storage contents are restricted to structural metadata (id, dedupeKey, severity, source, title, sanitized message, timestamp).
- **Prohibited Data**: Plaintext API keys, DPAPI blobs, prompt strings, and provider response completions are strictly barred from notification storage.

---

## 3. SAFE ACTION ROUTING

Notification actions execute purely internal navigation transitions (`navigate("/settings")`, `navigate("/diagnostics")`). Zero arbitrary shell commands, SQL statements, or remote URLs can be executed via notification action buttons.

