# Nano Route — Compatibility Security

## 1. Zero Trust Principles
The Compatibility Center is an observational glass cockpit that operates under strict zero-trust boundaries:
1. **Zero Credential Exposure**: API keys, master secrets, and DPAPI ciphertext are never deserialized into the frontend compatibility state.
2. **Untrusted Input Sanitization**: Model search inputs are sanitized against SQL injection, script tags, and path traversal vectors.
3. **No Dynamic Execution**: Modality flags and capabilities are static strings; no arbitrary code execution or template evaluation is permitted.
4. **No Unsolicited Network Probes**: Browsing models does not trigger external HTTP requests, ping probes, or background socket connections.
5. **Memory Isolation**: Compatibility data structures exist only in volatile frontend memory.

