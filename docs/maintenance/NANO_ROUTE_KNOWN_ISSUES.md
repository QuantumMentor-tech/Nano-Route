# NANO ROUTE — KNOWN ISSUES & MAINTENANCE REGISTER

**Phase 11: Post-Release Stability & Maintenance — Step 51**  
**Document ID:** MAINT-ISSUES-051  
**Date:** November 13, 2026  

---

## 1. Issue Reconciliation & Status

| Issue ID | Severity | Category | Title | Status | Workaround |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ISSUE-051-001** | Low | Packaging | Host Native Build Toolchain Dependency | Open / Documented | Pre-compile via CI or install VS Build Tools |
| **ISSUE-051-002** | Low | Security | Authenticode SmartScreen Warning on Unsigned RC | Open / Documented | Sign binary using corporate EV certificate |
| **ISSUE-051-003** | Low | Provider | Multimodal Image Attachments Excluded in Chat | Deferred (Enhancement) | Text-based prompt routing and code analysis |
| **ISSUE-051-004** | Low | Routing | Offline Fallback When ONNX Weights Absent | Operational / Safe | Heuristic rule-based fallback active |
| **ISSUE-051-005** | Low | Dependency | Vite Dev-Server Prototype Pollution Advisory | Accepted / Dev-Only | Inapplicable to production desktop runtime |

---

## 2. Detailed Issue Records

### ISSUE-051-001: Host Native Build Toolchain Dependency
- **Category:** Packaging / Build
- **Severity:** Low (Operational Boundary)
- **Affected Component:** `src-tauri` / Build Tooling
- **Current Status:** Open / Documented
- **Reproduction:** Running `npx tauri build` on a machine lacking `rustc` or Visual Studio MSVC C++ Build Tools produces environment prerequisite warnings.
- **Expected Behavior:** Native binaries are generated on development workstations equipped with the C++ build tools.
- **Actual Behavior:** Frontend distribution assets (`dist/`) compile cleanly; native bundling requires the MSVC Rust toolchain.
- **Known Workaround:** Use CI/CD GitHub Actions or Azure DevOps runners with `windows-latest` image to produce the release installer.
- **Release Impact:** None for end users installing via `.msi` or `.exe`.
- **Next Action:** Provide automated CI workflow script in future maintenance update.

---

### ISSUE-051-002: Authenticode SmartScreen Warning on Unsigned RC
- **Category:** Security / Packaging
- **Severity:** Low (Distribution Prerequisite)
- **Affected Component:** Windows Installer (`.exe` / `.msi`)
- **Current Status:** Open / Documented
- **Reproduction:** Launching unsigned release candidate binaries on a fresh Windows 10/11 workstation triggers a SmartScreen "Unknown Publisher" prompt.
- **Expected Behavior:** Unsigned binaries trigger standard Windows OS protection warnings.
- **Actual Behavior:** Standard SmartScreen dialog displayed.
- **Known Workaround:** Click "More info" → "Run anyway" during testing; sign via `signtool.exe` in production.
- **Release Impact:** Standard for pre-release candidates prior to EV certificate application.
- **Next Action:** Integrate signing secrets in CI pipeline according to `docs/release/NANO_ROUTE_SIGNING_GUIDE.md`.

---

### ISSUE-051-003: Multimodal Image Attachments Excluded in Chat Studio
- **Category:** Enhancement (Roadmap Boundary)
- **Severity:** Low (Out of Scope for v0.1.0)
- **Affected Component:** Chat Studio UI / Provider Dispatch
- **Current Status:** Deferred to Future Roadmap Phase
- **Reproduction:** User attempts to drag-and-drop or upload images into chat composer.
- **Expected Behavior:** Chat composer accepts text-only prompt input.
- **Actual Behavior:** Text composer processes all code, markdown, and text prompts.
- **Known Workaround:** Transcribe or copy relevant image text/code into prompt.
- **Release Impact:** None; text routing is the defined scope of v0.1.0.
- **Next Action:** Track as candidate feature for future major releases.

