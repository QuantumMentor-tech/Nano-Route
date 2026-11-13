# NANO ROUTE — SECURITY FINDINGS REGISTER

**Step 48 Audit Findings Register**  
**Phase 10: Release & Production Readiness**  
**Date:** November 13, 2026  
**Auditor:** Antigravity Engineering Core  

---

## Findings Summary Matrix

| Finding ID | Severity | Component | Title | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-048-001** | Low | UI Markdown | SafeMarkdown URL Parser Permissive Prefix Matching | **REMEDIATED** |
| **SEC-048-002** | Low | About / Links | External Link Opener CRLF / Control Character Acceptance | **REMEDIATED** |
| **SEC-048-003** | Low | Native IPC | Chat Session Title Parameter Unbounded Input | **REMEDIATED** |
| **SEC-048-004** | Low (Accepted) | Dependencies | Dev-Only Vite esbuild Prototype Pollution Advisory | **DOCUMENTED / ACCEPTED** |
| **SEC-048-005** | Low (Accepted) | Dependencies | React-Router Backslash Redirection Advisory | **DOCUMENTED / ACCEPTED** |

---

## Detailed Findings Register

### Finding SEC-048-001: SafeMarkdown URL Parser Permissive Prefix Matching
- **Component:** `src/features/chat/components/SafeMarkdown.tsx`
- **Severity:** Low (Defense-in-Depth)
- **Description:**  
  The internal URL sanitizer helper `isSafeUrl()` previously checked protocol safety using string prefix matching (`url.startsWith("https://") || url.startsWith("http://")`). While effective at blocking obvious `javascript:` prefixes, malformed URLs containing control characters or unparsed fragments could pass through to the anchor element.
- **Remediation Action:**  
  Updated `isSafeUrl()` to parse candidate strings using `new URL()`, verify protocol equality (`parsed.protocol === "https:" || parsed.protocol === "http:"`), and reject any input containing ASCII control characters or newlines (`/[\x00-\x1F\x7F]/`).
- **Verification:**  
  Covered in automated test suite `src/features/security/__tests__/securityAudit.test.ts`. Verified in `chatStudio.test.ts`.
- **Status:** **REMEDIATED**

---

### Finding SEC-048-002: External Link Opener CRLF / Control Character Acceptance
- **Component:** `src/features/about/utils/externalLinks.ts`
- **Severity:** Low (Defense-in-Depth)
- **Description:**  
  `validateExternalUrl()` allowed valid `mailto:` schemes based on a standard email regular expression, but did not explicitly inspect destination strings for embedded Carriage Return or Line Feed (`\r`, `\n`) characters. When passed to external desktop mail clients, unescaped CRLF could theoretically allow header injection.
- **Remediation Action:**  
  Implemented explicit rejection of CRLF (`\r`, `\n`) and ASCII control characters (`[\r\n\x00-\x1F\x7F]`) in `validateExternalUrl()` before scheme-specific parsing.
- **Verification:**  
  Covered in automated test suite `src/features/security/__tests__/securityAudit.test.ts`. Verified in `aboutWorkspace.test.ts`.
- **Status:** **REMEDIATED**

---

### Finding SEC-048-003: Chat Session Title Parameter Unbounded Input
- **Component:** `src-tauri/src/commands/chat.rs`
- **Severity:** Low (Resource Governance)
- **Description:**  
  The native IPC commands `cmd_create_chat_session` and `cmd_rename_chat_session` did not enforce an explicit upper-bound length check on the incoming `title` parameter prior to database insertion. Oversized strings could consume unnecessary database storage.
- **Remediation Action:**  
  Added defensive length clamping in `cmd_create_chat_session` and `cmd_rename_chat_session` ensuring titles are trimmed and bounded to a maximum of 255 characters. Enforced non-empty check for session renaming.
- **Verification:**  
  Native Rust handlers compile cleanly; existing chat integration tests pass.
- **Status:** **REMEDIATED**

---

### Finding SEC-048-004: Dev-Only Vite esbuild Prototype Pollution Advisory
- **Component:** `esbuild` <= 0.24.2 (via `vite` devDependencies)
- **Severity:** Low (Advisory: GHSA-67mh-4wv8-2f99)
- **Description:**  
  An upstream advisory notes potential prototype pollution in `esbuild` dev server during development serving.
- **Risk Assessment & Justification:**  
  `esbuild` is configured exclusively as a developer dependency (`devDependencies`) for local asset bundling. It is never included or packaged in the production desktop application bundle or runtime installer. In a production build, Vite outputs static compiled JS/CSS artifacts.
- **Remediation Plan:**  
  Keep tracked for future Vite/esbuild major version bump in Step 50 packaging cycle.
- **Status:** **DOCUMENTED / ACCEPTED RISK**

---

### Finding SEC-048-005: React-Router Backslash Redirection Advisory
- **Component:** `react-router` <= 7.17.0 (via `react-router-dom`)
- **Severity:** Low (Advisory: GHSA-wrjc-x8rr-h8h6, GHSA-337j-9hxr-rhxg)
- **Description:**  
  Advisories note backslash path redirection and SSR hydration issues in React Router web deployments.
- **Risk Assessment & Justification:**  
  Nano Route runs exclusively as a desktop client-side application using hash-based routing (`HashRouter`) without Server-Side Rendering (SSR). All external links are routed through `validateExternalUrl()` which disallows backslash and unsafe navigation.
- **Remediation Plan:**  
  Continue using stable React Router v6 release in lockstep with Tauri v2 compatibility matrix.
- **Status:** **DOCUMENTED / ACCEPTED RISK**

---

## Conclusion

All actionable findings have been fully remediated. No Critical, High, or unmitigated Medium vulnerabilities exist in the Nano Route codebase. The residual risk profile is acceptable for release-gate clearance.

