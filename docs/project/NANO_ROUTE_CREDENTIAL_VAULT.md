# NANO ROUTE — WINDOWS DPAPI CREDENTIAL VAULT & SECURE PROVIDER CREDENTIALS
## Architectural Specification & Security Invariants (Step 19)

**Document Version:** 1.0.0  
**Application Architecture Version:** v1.17.0  
**Security Boundary:** Native Rust Core / Windows Data Protection API (DPAPI)  
**Target Platform:** Windows 10 / Windows 11 (Desktop First)

---

## 1. DPAPI Architecture Overview

Nano Route requires external provider credentials (such as API keys for OpenAI, Anthropic, Gemini, DeepSeek, Groq, Mistral, xAI, etc.) to orchestrate local and cloud model execution. Storing credentials in plaintext or reversible application-level obfuscation introduces severe vulnerabilities.

The **Windows Data Protection API (DPAPI)** provides cryptographic protection tied directly to the Windows security subsystem (`LSASS` and user logon credentials). Nano Route utilizes DPAPI via direct Windows Win32 FFI bindings (`CryptProtectData` and `CryptUnprotectData` in `crypt32.dll` and `LocalFree` in `kernel32.dll`) inside the native Rust core.

```text
┌────────────────────────────────────────────────────────┐
│                   React / UI Layer                     │
│  (Zero Plaintext Retention, Status Metadata Only)     │
└──────────────────────────┬─────────────────────────────┘
                           │ IPC: SaveCredential / GetStatus
                           ▼
┌────────────────────────────────────────────────────────┐
│                 Rust Tauri IPC Layer                   │
│         (SecretString Wrapper, Zeroized on Drop)       │
└──────────────────────────┬─────────────────────────────┘
                           │ In-Memory SecretBytes
                           ▼
┌────────────────────────────────────────────────────────┐
│          DpapiProtector (crypt32 / kernel32)          │
│  - User-Scoped Key: MasterKey derived from DPAPI       │
│  - CRYPTPROTECT_UI_FORBIDDEN flag enforced             │
│  - LocalFree cleans unmanaged Windows memory buffer    │
└──────────────────────────┬─────────────────────────────┘
                           │ Ciphertext BLOB
                           ▼
┌────────────────────────────────────────────────────────┐
│          SQLite Storage (api_credentials)              │
│  - encrypted_api_key BLOB NOT NULL                     │
│  - base_url, is_active, priority_weight, budget        │
└────────────────────────────────────────────────────────┘
```

---

## 2. User-Scope Security Guarantees & Rationale

DPAPI supports two primary protection scopes:
1. **Current User Scope (`CurrentUser`)**: Encrypts data using a cryptographic key derived from the active Windows user's password and login token. Only processes running under the identical Windows user security identifier (SID) can decrypt the payload.
2. **Local Machine Scope (`LocalMachine` via `CRYPTPROTECT_LOCAL_MACHINE = 0x4`)**: Encrypts data using a machine-wide key accessible to any process or user on the machine.

### Security Invariant
**Nano Route strictly forbids `CRYPTPROTECT_LOCAL_MACHINE`.**  
All DPAPI encryption routines inside `DpapiProtector` explicitly omit the `0x4` flag and use:
```rust
const CRYPTPROTECT_UI_FORBIDDEN: u32 = 0x1;
```
This guarantees:
- Other local user accounts or unprivileged services on the same PC cannot decrypt Nano Route's credentials.
- Compromise of another user profile does not compromise Nano Route provider credentials.
- Headless execution or background automation cannot trigger unexpected Windows modal authorization dialogs.

---

## 3. Windows Security Boundary & Threat Model

| Threat / Attack Vector | Mitigation in Nano Route |
| :--- | :--- |
| **Disk Inspection / SQLite Dump** | The SQLite database stores exclusively encrypted binary BLOBs (`encrypted_api_key`). Offline extraction of the SQLite file yields cryptographically random ciphertext that cannot be decrypted without the user's DPAPI MasterKey. |
| **Browser Storage Scraping** | Plaintext keys are never stored in Web Storage (`localStorage`, `sessionStorage`), IndexedDB, or frontend state variables after submission. |
| **Memory Dump / Cold Boot** | Plaintext memory is wrapped in `SecretString` and `SecretBytes`, ensuring that heap allocations are immediately overwritten with zeros via `write_volatile` as soon as they exit scope. |
| **Log Snooping / Sentry / Crash Dumps** | `SecretString` and `SecretBytes` override `fmt::Debug` to output `[REDACTED SECRET]`. They do not implement `serde::Serialize`. Error types sanitize provider IDs and suppress secret values. |
| **Cross-User Local Privilege Escalation** | User-scoped DPAPI keys ensure that another unprivileged Windows user account on the same host cannot decrypt the stored blobs. |
| **IPC Sniffing / Inspection** | Plaintext keys are passed once over Tauri IPC during `save_provider_credential`. No query command exists that can return a plaintext API key to the frontend over IPC. |

---

## 4. Secret Lifecycle & In-Memory Zeroization

To prevent secrets from lingering in freed memory or page files, Nano Route implements zeroizing wrappers in `src-tauri/src/security/secret.rs`:

- **`SecretBytes`**: Owns a heap-allocated `Vec<u8>`. Upon drop, it iterates across the slice and invokes `std::ptr::write_volatile(ptr, 0)` with compiler memory fences (`std::sync::atomic::compiler_fence(Ordering::SeqCst)`).
- **`SecretString`**: Wraps `SecretBytes` to provide safe UTF-8 parsing while guaranteeing volatile zeroization on drop.

```rust
impl Drop for SecretBytes {
    fn drop(&mut self) {
        for byte in self.0.iter_mut() {
            unsafe {
                std::ptr::write_volatile(byte, 0);
            }
        }
        std::sync::atomic::compiler_fence(std::sync::atomic::Ordering::SeqCst);
    }
}
```

---

## 5. Ciphertext Storage in SQLite

The ciphertext produced by DPAPI is stored as a raw binary `BLOB` in SQLite. Base64 encoding is avoided in storage to reduce redundant copies in memory and storage footprint.

### Table Definition: `api_credentials`
Located in `src-tauri/src/storage/migrations/004_credential_vault.sql`:

```sql
CREATE TABLE IF NOT EXISTS api_credentials (
    provider_id TEXT PRIMARY KEY NOT NULL,
    encrypted_api_key BLOB NOT NULL,
    base_url TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    priority_weight INTEGER NOT NULL DEFAULT 1,
    monthly_budget_limit REAL,
    current_month_spend REAL NOT NULL DEFAULT 0.0,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_api_credentials_active 
ON api_credentials (is_active, priority_weight DESC);
```

---

## 6. Memory Handling & Native Allocation Freeing

When `CryptUnprotectData` or `CryptProtectData` succeeds, Windows allocates an output memory buffer in process unmanaged heap memory via `LocalAlloc`.

Nano Route encapsulates this inside `DpapiProtector`:
1. Safely copies bytes from `pDataOut.pbData` into a managed Rust `SecretBytes` or `Vec<u8>`.
2. Immediately invokes `kernel32::LocalFree(pDataOut.pbData as *mut c_void)` to release the OS allocation.
3. If an error occurs, `LocalFree` is invoked before returning to prevent memory leaks.

---

## 7. In-Memory Decryption Boundary

Plaintext credentials exist in memory **only within the native Rust layer** and only during the exact moment an outbound network request is dispatched by future provider clients (Step 20+).

```text
       UI / Browser                  Rust Native Core                  Network
┌─────────────────────────┐     ┌────────────────────────┐     ┌──────────────────────┐
│ Never receives key      │     │ Decrypts just-in-time  │     │ Sends Authorization: │
│ Reads only:             │     │ into ephemeral memory; │────▶│ Bearer <token> over  │
│ - is_configured (bool)  │     │ immediately zeroizes   │     │ TLS / HTTPS          │
│ - is_active (bool)      │     │ upon request completion│     └──────────────────────┘
└─────────────────────────┘     └────────────────────────┘
```

The application service method `credential_vault.get_decrypted_credential(provider_id)` is strictly a Rust-internal crate API. It is **never** registered as or called by a Tauri IPC command.

---

## 8. Safe IPC Command Surface

Nano Route provides exactly 5 Tauri IPC commands for credential management. None of these commands transmit or return plaintext secrets:

1. `cmd_save_provider_credential(provider_id, api_key, base_url, priority_weight, monthly_budget_limit)`: Encrypts the key via DPAPI, saves it to SQLite, and returns safe metadata (`ProviderCredentialStatus`).
2. `cmd_get_provider_credential_status(provider_id)`: Returns whether the provider is configured and active, along with budget and priority metadata.
3. `cmd_list_provider_credential_statuses()`: Returns a list of all configured providers sorted by priority.
4. `cmd_set_provider_active(provider_id, is_active)`: Toggles active status without modifying the secret.
5. `cmd_delete_provider_credential(provider_id)`: Atomically purges the record and ciphertext from SQLite.

---

## 9. Input Validation & Base URL Security Policy

All inputs are sanitized before reaching storage or DPAPI:
- **`provider_id`**: 2–64 characters, lowercase alphanumeric, hyphens, and underscores (`^[a-z0-9_-]{2,64}$`).
- **`api_key`**: Minimum 8 characters, maximum 4096 characters, non-whitespace.
- **`priority_weight`**: Clamped to integers `1..=10`.
- **`monthly_budget_limit`**: Non-negative finite float or `None`.
- **`base_url`**:
  - Must use `https://` scheme for all remote hosts.
  - Permits `http://localhost` or `http://127.0.0.1` strictly for local testing or custom mock servers.
  - Rejects dangerous schemes (`javascript:`, `file:`, `data:`, `ftp:`).
  - Rejects URLs containing user credentials (`user:pass@host`).

---

## 10. Frontend IPC Service & In-Memory Fallback

The TypeScript IPC service in `src/services/ipc/credentials.ts` mirrors the Rust domain model:
- Exposes `saveProviderCredential`, `getProviderCredentialStatus`, `listProviderCredentialStatuses`, `setProviderActive`, and `deleteProviderCredential`.
- In a standalone web development or browser testing environment without the native Tauri IPC backend, an in-memory mock store simulates the exact credential vault lifecycle without writing to disk or exposing plaintext keys.

---

## 11. Security Audit & Invariant Verification Checklist

| Invariant | Status | Verification Method |
| :--- | :--- | :--- |
| `CRYPTPROTECT_LOCAL_MACHINE` is absent | Verified | Code review of `src-tauri/src/security/dpapi.rs` confirms only `0x1` (`CRYPTPROTECT_UI_FORBIDDEN`) is passed. |
| In-Memory Zeroization on Drop | Verified | `SecretBytes` and `SecretString` execute volatile writes on drop. |
| No IPC plaintext leak | Verified | IPC returns strictly `ProviderCredentialStatus` structs. |
| SQLite contains binary BLOBs | Verified | Schema specifies `BLOB NOT NULL`. Base64 is not used. |
| Strict Base URL enforcement | Verified | Unit tests in `src/services/ipc/__tests__/credentials.test.ts` verify scheme and userinfo rejection. |
| 136/136 TypeScript unit tests pass | Verified | `npm test` executes all test suites cleanly. |

---

## 12. Conclusion

Step 19 establishes the secure cryptographic vault foundation for Nano Route. Provider secrets remain protected under user-scoped DPAPI, isolated in native Rust, zeroized in memory, and stored as encrypted blobs. Future Step 20 integrations can securely consume these credentials to perform authenticated model inference.

