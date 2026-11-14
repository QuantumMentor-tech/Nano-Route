# Nano Route — Custom Endpoint Security

**Document Version:** 1.0.0  
**Status:** Authoritative  
**Step:** 74 — Custom Base URL Auditing, TLS Enforcement & Query Secret Prevention  
**Subsystems:** Credential Lifecycle Engine, Provider Preferences, IPC Security  

---

## 1. Overview & Threat Model

Nano Route allows users to configure custom base URLs for providers (e.g. enterprise OpenAI gateways, Ollama endpoints, local vLLM instances, or corporate AI proxies).

Connecting to user-specified endpoints introduces significant security risks:
1. **Cleartext Transport Interception (Man-in-the-Middle):** Unencrypted HTTP connections expose API keys to local network eavesdropping.
2. **Credential Leaks in URLs:** Embedding userinfo (`https://user:password@host`) or query parameters (`?api_key=sk-...`) leaks credentials into server access logs, reverse proxies, and browser URL history.
3. **SSRF & Malicious Redirects:** Pointing endpoints to unvetted external services could enable request forgery or redirection.

---

## 2. Endpoint Security Rules & Invariants

Nano Route enforces automated pre-save validation via `auditCustomEndpointSecurity(url)`:

### Rule 1: Mandatory TLS Encryption (HTTPS)
- All remote custom endpoints **MUST** use the `https://` protocol.
- Unencrypted `http://` is strictly rejected for all remote hostnames and public IP addresses.

### Rule 2: Explicit Localhost Exception
- Plain `http://` is permitted **ONLY** for local development endpoints targeting:
  - `localhost`
  - `127.0.0.1`
  - `::1`
  - Subdomains matching `*.localhost` (e.g. `proxy.localhost`)
- This enables local development with tools like LocalAI, vLLM, and Ollama without requiring custom CA root certificates.

### Rule 3: Zero Embedded Userinfo
- URLs containing the `@` symbol before the hostname (e.g., `https://user:secret@proxy.com`) are strictly rejected.
- Authentication secrets must be entered into the dedicated DPAPI credential vault.

### Rule 4: Zero Query String Secrets
- URLs containing query parameters or hash fragments referencing `api_key`, `token`, `secret`, `auth`, or `bearer` are strictly rejected.
- All provider authentication is performed via standard HTTP request headers (`Authorization: Bearer <key>` or `x-api-key: <key>`).

---

## 3. Audit Evaluation Output Contract

The audit function returns a structured report:

```typescript
export interface EndpointSecurityAudit {
  url: string;
  isValid: boolean;
  isTlsEnforced: boolean;
  isLocalhost: boolean;
  hasEmbeddedAuth: boolean;
  hasQuerySecrets: boolean;
  rejectionReason?: string;
  recommendation?: string;
}
```

If `isValid === false`, the Settings UI blocks saving the endpoint, presents the specific rejection reason, and guides the user on remediation.

