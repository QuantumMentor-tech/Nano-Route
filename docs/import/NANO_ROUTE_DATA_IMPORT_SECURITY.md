# Nano Route Data Import Security & Untrusted Input Boundary

## Security Guarantees & Boundaries

1. **Zero Secret Leakage / Ingestion**:
   - Untrusted JSON trees are recursively traversed by `sanitizeUntrustedObject`.
   - Keys matching `api_key`, `secret`, `token`, `dpapi`, `credential`, or `private_key` are permanently stripped prior to persistence.
   - Values matching OpenAI-style or bearer API key regex patterns (`sk-...`) are neutralized and replaced with `[REDACTED_API_KEY]`.
2. **Denial-of-Service Defense**:
   - Fixed payload byte boundary limit: 20MB.
   - Streaming memory parsing prevents heap exhaustion.
3. **No Arbitrary Code / SQL Execution**:
   - Zero dynamic SQL evaluation.
   - All insertions invoke parameterized IPC functions.
4. **Source Immutability**:
   - The original file selected by the user is never written to, truncated, or removed.

