# Nano Route Integrity Privacy Guarantees

## Evidence & Diagnostic Privacy Policy

1. **Zero Secret Exposure**: Plaintext API keys, bearer tokens, or DPAPI ciphertexts are never present in check findings, evidence envelopes, or UI screens.
2. **No Prompt or Completion Body Leakage**: Integrity checks inspect metadata, row counts, and structural constraints. Message body texts are never dumped into diagnostic logs.
3. **Redacted File Paths**: Any local path references in diagnostics are scrubbed of usernames and sensitive parent directories.

