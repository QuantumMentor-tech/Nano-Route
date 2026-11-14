# Nano Route — Reset Security & Destructive Action Safety

**Document Reference:** `docs/reset/NANO_ROUTE_RESET_SECURITY.md`  
**Application:** Nano Route Desktop (Windows 10/11 x64, Tauri v2)  
**Implementation Phase:** Step 69  
**Authoritative Security Specification**  

---

## 1. Primary Safety Rule & Threat Mitigations

The reset framework is designed around a single immutable safety directive:

> **No destructive operation may be triggered by a single accidental click, a generic button, an ambiguous notification, a Command Palette shortcut, an imported configuration file, an external deep link, or arbitrary IPC/SQL injection.**

### Threat Vectors & Architectural Mitigations

| Threat Vector | Potential Vulnerability | Step 69 Architectural Mitigation |
| :--- | :--- | :--- |
| **Accidental Click** | User misclicks "Reset" while exploring settings. | All destructive operations require multi-step modal previews with explicit consequences listed. |
| **Silent Data Destruction** | Ambiguous dialog text like "Delete data?". | Modal lists exact bullet points: *Will change*, *Will be deleted*, *Will remain*, and *Recovery options*. |
| **Rapid Keystroke / Enter spam** | User presses Enter rapidly on a confirmation prompt. | High-impact actions (`RESET_APPLICATION_CONFIGURATION`, `FULL_LOCAL_DATA_RESET`, `FACTORY_RESET`) require typing exact confirmation phrases (`"RESET CONFIG"`, `"DELETE"`, `"FACTORY RESET"`). |
| **Command Palette Abuse** | Direct one-click palette command triggers wipe. | Command Palette strictly exposes *navigation* commands (e.g. `Open Reset & Recovery Settings`), NEVER direct execution commands. |
| **Arbitrary Path Traversal** | Malicious input attempts to delete system files. | Reset APIs accept no filesystem paths. Deletion targets are derived strictly from internal trusted configuration paths. |
| **Arbitrary SQL Execution** | Frontend sends raw `DROP TABLE` or `DELETE` SQL. | Zero arbitrary SQL is accepted across the IPC boundary. All resets use predefined, compiled Rust/SQLite functions. |
| **Credential Exfiltration** | Reset process logs or exports plaintext API keys. | DPAPI secrets are deleted natively without ever decrypting or passing credentials back to the frontend. |
| **Race Conditions During Stream** | Wipe executed while LLM token stream is writing. | Precondition checks detect active streaming and database locks, blocking execution until safe. |

---

## 2. IPC Boundary & Capability Enforcement

Tauri IPC commands for data cleanup, safe repair, and full wipe (`cmd_run_data_cleanup`, `cmd_run_full_data_wipe`, `cmd_delete_provider_credential`) operate under strict capability boundaries:
1. **Strongly Typed Payloads:** Deserialization verifies exact enum variants and rejects unexpected JSON keys.
2. **Explicit Confirmation Tokens:** The Rust core independently verifies `request.confirmation_token == "DELETE"` prior to executing transactional table truncation.
3. **Least Privilege Filesystem Access:** File operations are restricted to the application's dedicated AppData directory. No root or system directories are accessible.

---

## 3. Cryptographic Credential Deletion

When credentials are removed via `REMOVE_PROVIDER_CREDENTIAL` or `FACTORY_RESET`:
1. The encrypted ciphertext blob is deleted from the SQLite `provider_credentials` table.
2. Native memory buffers holding transient keys are zeroed (via Rust zeroize patterns).
3. The provider readiness status is immediately invalidated and recalculated across the application.

