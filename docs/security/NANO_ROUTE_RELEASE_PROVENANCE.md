# Nano Route Release Provenance & Build Traceability (Step 55)

## 1. Authoritative Provenance Record

| Provenance Property | Value / Verification Status |
|---|---|
| **Application Identifier** | `com.nanoroute.desktop` |
| **Application Version** | `0.1.0` |
| **Source Git Commit** | Tracked via Git log (`45d78eb...`) |
| **Frontend Dependency Lock** | `package-lock.json` (SHA-512 subresource integrity hashes) |
| **Rust Dependency Lock** | `src-tauri/Cargo.lock` |
| **Build Target Architecture** | `windows-x86_64` (MSVC toolchain) |
| **SQLite Version & Mode** | SQLite 3.45+ via `rusqlite` bundled C amalgamation, WAL mode |
| **Branding Asset Digest** | `Nano Route Neon Tech Logo.png`: `99179d193ac9cdbb18cbddee3abe2da16b23c26be4958b5dd945c21d873bb804` (670,255 bytes) |
| **Tauri Capabilities** | Minimal least-privilege (`core:default` only in `capabilities/default.json`) |
| **Cryptographic Digest Standard** | SHA-256 (64-character lowercase hex) |
| **Packaging Target** | Windows MSI & Executable Bundle |

---

## 2. Traceability Verification

Every released binary artifact can be deterministically traced to its source repository commit, audited dependency lockfiles, and verified asset digests.

