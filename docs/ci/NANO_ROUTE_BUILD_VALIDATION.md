# Nano Route Build Validation & Packaging Verification (Step 57)

## 1. Production Build & Packaging Verification

Building a release candidate requires consistent validation of:

1. **Frontend Asset Minification & Bundling**:
   - `vite build` must compile 2,240+ modules into `/dist`.
   - `dist/index.html` and hashed asset bundles (`index-*.js`, `index-*.css`) must be verified for presence and valid non-zero byte size.
2. **Native Tauri Packaging**:
   - `tauri build` compiles the native Rust core with release optimizations (`opt-level = 3`, `lto = "thin"`).
   - Generates Windows installer (`.msi`) and standalone executable (`.exe`).
3. **Artifact Integrity Verification**:
   - Cryptographic SHA-256 digests are computed for all generated release artifacts and recorded in the release manifest prior to distribution.

