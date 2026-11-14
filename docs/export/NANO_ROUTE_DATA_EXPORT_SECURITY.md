# Nano Route — Data Export Security & Formula Injection Defense

**Document Reference:** `docs/export/NANO_ROUTE_DATA_EXPORT_SECURITY.md`  
**Application:** Nano Route Desktop (Windows 10/11 x64, Tauri v2)  
**Implementation Phase:** Step 70  
**Authoritative Security Specification**  

---

## 1. Threat Model & Mitigations

The export framework implements defense-in-depth protections against data leakage, formula injection, and path traversal:

| Threat Vector | Severity | Vulnerability Mechanism | Step 70 Architectural Defense |
| :--- | :---: | :--- | :--- |
| **Credential Leakage** | Critical | Accidental inclusion of DPAPI secrets or API keys in export. | Strict property allowlist. Secret keys never queried. Post-export automated scanner (`scanForSecretLeaks`) blocks export if forbidden strings are detected. |
| **CSV Formula Injection (CWE-1236)** | High | User prompt content beginning with `=`, `+`, `-`, `@`, `\t` executes as spreadsheet command when opened in Excel/Calc. | All CSV cell values starting with formula trigger characters are automatically prefixed with a single quote (`'`), neutralizing macro execution. |
| **Arbitrary Path Traversal** | High | User-supplied path string overrides system file. | Export APIs do not accept arbitrary filesystem paths from frontend strings. Native browser blob downloads or Tauri file dialogs enforce operating system security boundaries. |
| **Process Blocking / OOM** | Medium | Large chat histories cause memory exhaustion. | Exports use bounded batch queries (`limit: 1000`) and stream rows into string buffers asynchronously. |
| **Source Data Mutation** | High | Export query accidentally deletes or modifies records. | Queries are strictly read-only (`SELECT`). Zero `UPDATE` or `DELETE` statements exist in the export engine. |

---

## 2. CSV Formula Injection Defense (CWE-1236)

Spreadsheet applications (Microsoft Excel, LibreOffice Calc, Google Sheets) interpret cells starting with certain characters as formulas or DDE execution instructions. Because chat messages originate from untrusted or user-entered text, Nano Route applies deterministic formula neutralization:

```typescript
const FORMULA_TRIGGERS = ["=", "+", "-", "@", "\t", "\r"];

if (str.length > 0 && FORMULA_TRIGGERS.some((trigger) => str.startsWith(trigger))) {
  str = `'${str}`; // Single quote prefix tells spreadsheet parser to treat as plain string
}
```

---

## 3. Automated Post-Export Secret Scanner

Before releasing any exported JSON or CSV payload, the engine runs `scanForSecretLeaks()`:
1. Regex pattern scanning for forbidden keys: `"api_key":`, `"password":`, `"secret":`, `"token":`, `"credential":`, `"dpapi":`.
2. Token pattern scanning for known provider API keys (e.g. `sk-[a-zA-Z0-9]{20,}`).
3. If any match is detected, the export fails immediately with a security block notice, preventing file generation.

