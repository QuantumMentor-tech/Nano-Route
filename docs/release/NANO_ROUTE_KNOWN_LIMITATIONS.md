# NANO ROUTE — KNOWN LIMITATIONS & OPERATIONAL BOUNDARIES

**Version:** `0.1.0` (Release Candidate 1)  
**Date:** November 13, 2026  
**Document ID:** REL-LIMITS-050  

---

## 1. Environment & Build Tooling Boundaries

### 1.1 Host-Specific Native Compilation
- **Limitation:** In host environments without Visual Studio MSVC C++ Build Tools and the Rust toolchain installed, running `npx tauri build` will fail to compile the native Rust binary locally.
- **Remediation & Recommendation:** The production frontend bundle (`dist/`) is compiled, verified, and packaged into the repository release manifest. To generate the final binary on Windows, ensure the MSVC toolchain is installed via `vs_BuildTools.exe` and Rust is configured via `rustup-init.exe`.

### 1.2 Authenticode Code-Signing State
- **Limitation:** Production code-signing certificates (`.pfx`) are not embedded in the source repository for security reasons. Local release candidate binaries are generated unsigned.
- **Operational Impact:** When launching the unsigned installer on clean Windows machines, Windows SmartScreen will display an "Unknown Publisher" prompt until an official Authenticode or Microsoft Store signature is affixed.
- **Remediation:** Sign the executable using `signtool.exe` with a corporate EV code-signing certificate during the CI/CD release stage.

---

## 2. Functional & Provider Boundaries

### 2.1 Multimodal (Vision & Audio) Input
- **Limitation:** The current Chat Studio workspace is optimized for text-based reasoning, coding, analysis, and conversation. Image attachment and multimodal uploads are scheduled for future roadmap phases.
- **Handling:** Prompts containing requests for image generation or image inspection are handled via text routing, and unsupported capability requests are flagged gracefully by preflight checks.

### 2.2 Offline SLM Inference Requirements
- **Limitation:** Local routing requires an ONNX runtime execution provider and local model weights.
- **Handling:** If local model weights are absent from the application directory, Nano Route enters a safe degraded mode that routes prompts using deterministic rule-based heuristics and user manual overrides.

### 2.3 Single-User Profile Scoping (Windows DPAPI)
- **Limitation:** API credentials protected via DPAPI are cryptographically bound to the current Windows user profile (`SID`).
- **Operational Impact:** Moving `nano_route.db` across different machines or different Windows user accounts will cause DPAPI unprotect operations to fail closed.
- **Handling:** If a database is migrated to an unauthorized user profile, Nano Route detects the cryptographic mismatch, clears the unrecoverable key safely, and prompts the user to re-enter their credential without crashing.

