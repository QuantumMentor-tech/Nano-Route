# Nano Route Update Security & Integrity Model (Step 52)

## 1. Threat Model & Safeguards

The update lifecycle is a primary security boundary for desktop applications. The Nano Route update subsystem safeguards against the following classes of attacks:

| Threat Vector | Mitigation Strategy | Enforcement Layer |
|---|---|---|
| **Man-in-the-Middle (MitM) Tampering** | Enforce HTTPS protocol on all package download URLs; reject HTTP or cleartext URLs | TypeScript & Rust validation |
| **Corrupted / Truncated Binary** | Cryptographic SHA-256 verification of downloaded payload prior to staging | Rust `updater:verify_update` & TS validation |
| **Spoofed / Wrong Application Binary** | Strict check that `productId === "com.nanoroute.desktop"` | Dual-layer TS and Rust validation |
| **Mismatched Architecture** | Strict check that target platform and architecture is `windows-x86_64` | Native Rust sys-info check |
| **Malicious Downgrade Attack** | SemVer comparator rejects version payloads where candidate `<` current | `compareSemVer` logic |
| **State Corruption During Stream** | Active operation concurrency guard blocks update download/apply while prompt streams or DB operations run | `getActiveOperations()` IPC check |
| **Irreversible DB Migration Failure** | Mandatory pre-update SQLite backup snapshot plan if `requiresDatabaseMigration` is flagged | `updater:prepare_update` plan |
| **Credential Hijacking** | DPAPI keys are stored under OS user DPAPI keys and isolated from executable bundles | Windows OS DPAPI architecture |

---

## 2. Release Channels

Nano Route implements three strictly isolated release channels:

1. **`stable`**: Recommended for daily production operation. Only receives stable SemVer releases (e.g. `v0.1.0` -> `v0.1.1`).
2. **`preview`**: Receives release candidates (`-rc*`) and early features for testing.
3. **`development`**: Nightly or development builds (`-alpha*`, `-beta*`).

Cross-channel updates are strictly governed:
- A user configured on the `stable` channel will never automatically download prerelease or candidate builds.
- Channel switches require explicit user confirmation.

