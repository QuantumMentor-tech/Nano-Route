# Nano Route — Build System & Environment Specification
**Document Version:** 1.0.0  
**Step:** 4 of 50 — Application Configuration, Environment & Build System  
**Date:** November 2026  
**Status:** APPROVED BUILD SPECIFICATION  

---

## 1. Supported Development Environment

| Component | Target / Required Specification | Host Status | Notes |
|---|---|---|---|
| **Host Operating System** | Windows 10 / Windows 11 (x64) | Windows 10.0.26100 x86_64 | Supported desktop target |
| **Node.js** | Node.js `v20.x` or `v22.x+` (Active LTS / Current) | `v26.8.2` | Operational |
| **Package Manager** | npm `10.x+` | `11.19.1` (Invoked via `npm.cmd`) | Execution policy safe |
| **WebView2 Runtime** | Evergreen WebView2 (Chromium 120+) | `157.0.4341.42` | Operational & verified |
| **Rust Toolchain** | Rust `1.77+` (`x86_64-pc-windows-msvc`) | Not Installed (Host Prerequisite) | Requires `rustup` |
| **Cargo** | Cargo `1.77+` | Not Installed (Host Prerequisite) | Bundled with Rustup |
| **C++ Build Tools** | Visual Studio Build Tools (MSVC v143+) | Not Detected (Host Prerequisite) | Requires VS Build Tools |
| **Git Version Control** | Git `2.40+` | `2.55.0.windows.5` | Operational |

---

## 2. Environment Variables Specification

Strict security rules govern environment variables in Nano Route. The frontend runs in an untrusted context inside WebView2. Therefore, **zero cloud provider credentials, database credentials, or secret keys may be placed in environment variables or exposed to the frontend bundle.**

| Variable | Visibility | Environment | Required | Default / Example | Purpose |
|---|---|---|---|---|---|
| `VITE_APP_ENV` | Public (Frontend) | dev / test / prod | No | `development` | Client-side mode flag |
| `VITE_APP_VERSION` | Public (Frontend) | dev / test / prod | No | `0.1.0` | UI build version display |
| `VITE_ENABLE_DEBUG_OVERLAY` | Public (Frontend) | dev only | No | `false` | Enables client debug badges |
| `VITE_ENABLE_VERBOSE_UI_LOGGING` | Public (Frontend) | dev only | No | `false` | Enables UI console tracing |
| `TAURI_DEV_HOST` | Internal (Tauri CLI)| dev only | No | `false` | Host IP override for HMR |

### Prohibited Environment Variables
The following keys are **strictly forbidden** from `.env` files or frontend compilation:
- ❌ `OPENAI_API_KEY`
- ❌ `ANTHROPIC_API_KEY`
- ❌ `GEMINI_API_KEY`
- ❌ `GROQ_API_KEY`
- ❌ `DATABASE_URL` / `DATABASE_PASSWORD`
- ❌ `WINDOWS_SIGNING_CERTIFICATE_PASSWORD`

*Note:* All AI provider keys are input by the user through the Settings UI, transferred via secure Tauri IPC to the Rust native core, and encrypted at rest using Windows DPAPI (`CryptProtectData`).

---

## 3. Package Scripts & Development Commands

All development, build, and validation operations are standardized in `package.json`:

| Command | Invocation | Purpose | Execution Speed |
|---|---|---|---|
| **install** | `npm install` | Deterministically installs dependencies from `package-lock.json` | ~50s |
| **dev** | `npm run dev` | Launches Vite HMR server on `http://localhost:1420` (strict port) | Immediate |
| **build** | `npm run build` | Executes TypeScript typecheck (`tsc`) and Vite production bundle | ~1.3s |
| **typecheck** | `npm run typecheck` | Strict compiler type verification (`tsc --noEmit`) | ~0.8s |
| **validate** | `npm run validate` | Complete frontend pipeline validation (`typecheck` + `build`) | ~1.4s |
| **preview** | `npm run preview` | Previews the generated production output in `dist/` | Immediate |
| **tauri** | `npm run tauri` | Direct invocation of Tauri v2 CLI | Immediate |
| **tauri:dev** | `npm run tauri:dev` | Runs Vite dev server and launches native Tauri window | Dev mode |
| **tauri:build** | `npm run tauri:build` | Runs `build` hook and compiles release desktop bundle | Release mode |

---

## 4. Build Output & Artifact Locations

```text
Build Layer             Output Path             Format / Contents                      Ignored in Git?
------------------------------------------------------------------------------------------------------
Frontend Production     ./dist/                 index.html, minified JS, CSS chunks    YES (in .gitignore)
Rust Target             ./src-tauri/target/     Debug / Release native binaries, .exe  YES (in .gitignore)
Desktop Bundle          ./src-tauri/target/     NSIS installer (.exe), MSIX (.msix)    YES (in .gitignore)
Platform Icons          ./src-tauri/icons/      Multi-resolution .ico, .icns, .png     TRACKED (Generated)
Brand Master Asset      ./Nano Route Neon Tech Logo.png  Source high-res branding      TRACKED (Protected)
```

---

## 5. Windows Packaging & Release Configuration

### Current Application Metadata
- **Product Name:** `Nano Route`
- **Application Identifier:** `com.nanoroute.desktop`
- **Version:** `0.1.0`
- **Target Platform:** `x86_64-pc-windows-msvc`
- **Window Dimensions:** 1200 x 800 (Resizable, non-fullscreen by default)
- **Security Context:** CSP disabled in dev, strict capability isolation in `capabilities/default.json`
- **Platform Icons:** Generated in `src-tauri/icons/` with contain-fitting from official brand asset

### Release Prerequisites (Pending Production Step)
1. **Code Signing:** Windows Authenticode Certificate (EV / OV certificate or Azure Trusted Signing).
2. **Microsoft Store Publisher Identity:** Windows Partner Center Publisher ID (`CN=...`).
3. **MSIX Packaging Identity:** Package Name, Publisher Display Name, and Package Family Name.
4. **Current Signing Status:** `PENDING RELEASE CONFIGURATION` (Unsigned local desktop build).

---

## 6. Reproducibility & Environment Isolation

- **Deterministic Lockfile:** All dependency versions are locked in `package-lock.json`.
- **Absolute Paths Prohibited:** Zero absolute paths (`C:\Users\...`) exist in configuration or build manifests. All paths are repository-relative.
- **Port Conflict Protection:** Vite is locked to port `1420` with `strictPort: true`. If port 1420 is unavailable, Vite immediately halts with an explicit error rather than silently migrating to an arbitrary port that Tauri cannot connect to.
- **IPC Watcher Isolation:** Vite is explicitly configured with `watch.ignored: ["**/src-tauri/**"]` to prevent cyclic rebuild triggers during Rust compilation.

---
*End of Build System & Environment Specification.*

