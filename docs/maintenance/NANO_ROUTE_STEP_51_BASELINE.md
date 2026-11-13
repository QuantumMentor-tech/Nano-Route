# NANO ROUTE — POST-RELEASE STABILITY BASELINE

**Phase 11: Post-Release Stability & Maintenance — Step 51**  
**Document ID:** MAINT-BASE-051  
**Baseline Date:** November 13, 2026  
**Lead Maintenance Engineer:** Antigravity Engineering Core  

---

## 1. Executive Baseline Declaration

This document establishes the official engineering baseline for **Phase 11 (Post-Release Stability & Maintenance)** of Nano Route, succeeding the completed 50-step initial architecture roadmap.

```text
================================================================================
                    NANO ROUTE POST-RELEASE BASELINE
================================================================================
Application:          Nano Route
Authoritative Version: 0.1.0
Git Commit:           45d78eb (with Step 48–50 Hardening Commits)
Phase:                Phase 11: Post-Release Stability & Maintenance
Step:                 Step 51
Build State:          Production Ready (dist/ transformed in 11.04s)
Windows Package:      Tauri v2.1.1 Native Bundle Target (NSIS / MSI / MSIX configured)
Signing State:        Unsigned Local Candidate (Authenticode procedure defined)
Database State:       SQLite 3 WAL Mode, Migrations 001–005 embedded
SLM State:            ONNX Router Manifest v1.0.0, DirectML / CPU fallback
QA State:             QA PASSED (568 tests passing, 0 failures, 291 suites)
Security Gate:        PASSED WITH DOCUMENTED LOW-RISK FINDINGS
Master Brand Logo:    670,255 bytes (Verified Intact)
================================================================================
```

---

## 2. Technical Stack & Toolchain Baseline

| Component | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Desktop Shell** | Tauri v2 | 2.1.1 (`tauri-cli` 2.12.4) | Native host, window management, system tray, IPC |
| **Native Core** | Rust 2021 Edition | MSVC x86_64 target | Core routing logic, DPAPI vault, SQLite storage |
| **Frontend UI** | React / TypeScript | React 18.3.1 / TS 5.6.3 | Responsive desktop UI, Virtual DOM rendering |
| **CSS Framework** | Tailwind CSS | 4.3.4 | Dark Obsidian styling (`#09090b`), elevated panels |
| **Persistence** | Embedded SQLite 3 | rusqlite 0.31 (bundled) | Chat conversations, telemetry metrics, app settings |
| **Credential Vault** | Windows DPAPI | Win32 CryptProtectData | Operating system-level encrypted API key storage |
| **Local SLM Engine** | ONNX Runtime | DirectML / CPU | On-device intent classification & routing |
| **WebView Engine** | Microsoft Edge WebView2 | Evergreen 157.0.4341.57 | Sandboxed HTML/CSS/JS desktop presentation |

---

## 3. Persistent Data Boundaries & Filesystem Standard

- **Production Database:** `%LOCALAPPDATA%\Nano Route\data\nano_route.db`
- **Application Logs:** `%LOCALAPPDATA%\Nano Route\logs\`
- **UI State Cache:** Standard `localStorage` (restricted strictly to `nr_sidebar_collapsed`)
- **Memory Security:** Decrypted keys are wrapped in `SecretString` and zeroized on drop; zero plaintext keys reside on disk.

---

## 4. Known Baseline Limitations

1. **Host-Specific Native Compilation:** Host machines compiling the native Rust binary via `npx tauri build` require Visual Studio MSVC C++ Build Tools and the Rust toolchain installed.
2. **Authenticode Production Signing:** Code-signing certificates are deliberately omitted from source control and must be attached in the deployment CI runner.
3. **Air-Gapped SLM Inference:** Local model execution requires pre-downloaded ONNX model weights in the local application directory.

