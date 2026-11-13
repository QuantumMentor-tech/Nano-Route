# Nano Route Build Supply-Chain Integrity & Hardening (Step 55)

## 1. Attack Surface & Threat Analysis

The build pipeline spans source code checkout, dependency resolution, compilation, bundling, and installer packaging.

```
Source Code (Git Main)
   │
   ▼
Deterministic Dependency Lock (package-lock.json & Cargo.lock)
   │
   ▼
TypeScript Compiler (`tsc --noEmit`)
   │
   ▼
Vite Production Bundler (Rollup static compilation) -> /dist
   │
   ▼
Rust Native Core Compilation (`cargo build --release`)
   │
   ▼
Tauri v2 Bundler (Windows MSI / EXE generation)
   │
   ▼
Windows DPAPI & Security Isolation Execution
```

---

## 2. Hardening Invariants & Controls

1. **Deterministic Lockfiles**:
   - `package-lock.json` and `Cargo.lock` remain strictly committed and enforced.
   - Wildcard versions and floating dependencies are forbidden.
2. **Zero Pre/Post-Install Arbitrary Script Execution**:
   - Audited `package.json`: No `preinstall`, `install`, or `postinstall` lifecycle hooks exist.
   - Package managers execute zero arbitrary shell commands during install.
3. **Rust `build.rs` Isolation**:
   - `src-tauri/build.rs` contains solely `tauri_build::build()`.
   - Zero network requests, zero dynamic downloads, and zero external binary fetching.
4. **Least-Privilege Tauri Capabilities**:
   - `src-tauri/capabilities/default.json` grants only minimal `core:default` permissions.
   - Arbitrary filesystem, raw shell execution, and global HTTP plugin capabilities are explicitly disallowed.
5. **No Secret Ingestion in Bundles**:
   - Bundled frontend assets (`dist/`) contain zero API credentials, private certificates, or developer secrets.

