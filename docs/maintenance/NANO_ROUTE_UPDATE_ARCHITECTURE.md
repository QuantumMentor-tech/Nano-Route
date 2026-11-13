# Nano Route Update Lifecycle & Architecture (Step 52)

## 1. Overview

The Nano Route Application Update Infrastructure provides a fail-safe, verifiable, and non-destructive version lifecycle mechanism. Built during Phase 11 (Post-Release Stability & Maintenance), this subsystem guarantees that application updates never corrupt user data, compromise Windows DPAPI credentials, execute unverified code, or disrupt running tasks.

---

## 2. Core Architectural Principles

1. **Fail-Closed Security**: Updates are treated as untrusted until cryptographically verified against SHA-256 digest expectations, valid HTTPS transport, matching product identifiers (`com.nanoroute.desktop`), matching target architecture (`x86_64`), and valid release channel rules.
2. **SemVer Invariants & Downgrade Prevention**: Strict Semantic Versioning prevents accidental or malicious rollback to older binaries that may possess known vulnerabilities.
3. **Release Channel Isolation**: Update streams are segregated into `stable`, `preview`, and `development`. Cross-channel downgrade or unsanctioned switching is prohibited.
4. **Active Operation Concurrency Guarding**: Update downloads and installations are strictly gated. If an active prompt stream or database transaction is in flight, the update lifecycle refuses to proceed until the system is quiescent.
5. **Pre-Update SQLite Migration Backups**: When an update metadata payload indicates `requiresDatabaseMigration: true`, an atomic pre-update backup plan of `%LOCALAPPDATA%\Nano Route\data\nano_route.db` is generated and verified before binaries are staged.
6. **DPAPI Credential Isolation**: Binary updates touch solely the executable layer; user DPAPI credentials encrypted under Windows user context remain undisturbed in the local vault.

---

## 3. Component Architecture

```
┌────────────────────────────────────────────────────────┐
│                      Desktop UI                        │
│         (Settings > Update / Maintenance Panel)        │
└───────────────────────────┬────────────────────────────┘
                            │ IPC Commands
                            ▼
┌────────────────────────────────────────────────────────┐
│               Tauri IPC Bridge Layer                   │
│   (src/services/ipc/updater.ts & types.ts)             │
│   - SemVer Parser & Comparator                         │
│   - Metadata & Integrity Validator                     │
│   - Active Operation Concurrency Guards                │
│   - Update State Machine Driver                        │
└───────────────────────────┬────────────────────────────┘
                            │ Native IPC Handlers
                            ▼
┌────────────────────────────────────────────────────────┐
│            Rust Core (Tauri v2 Commands)               │
│        (src-tauri/src/commands/updater.rs)             │
│   - Product Identity Verification                      │
│   - System Architecture Check (x86_64)                 │
│   - Stage & Verify Checksum                            │
│   - Rollback & Backup Pre-flight Check                 │
└────────────────────────────────────────────────────────┘
```

---

## 4. Registered Tauri IPC Commands

| Command Name | Description | Concurrency Guarded |
|---|---|:---:|
| `updater:check_for_update` | Checks update feed for target channel, evaluates SemVer | Yes |
| `updater:get_update_state` | Returns current update state machine status & progress | No |
| `updater:download_update` | Downloads signed package payload with progress tracking | Yes |
| `updater:verify_update` | Verifies SHA-256 cryptographic digest against metadata | No |
| `updater:prepare_update` | Generates rollback plan and pre-update DB backup specification | Yes |
| `updater:apply_update` | Stages installation and initiates atomic binary replacement | Yes |
| `updater:dismiss_update` | Clears available update notification without installing | No |

