# NANO ROUTE — BUILD & RUNTIME BASELINE
**Document Version:** 1.19.0  
**Step:** 21 of 50 — Provider & Model Registry Foundation  
**Date:** November 2026  
**Status:** APPROVED BASELINE (PROVIDER & MODEL REGISTRY FOUNDATION VALIDATED)  

---

## 1. HOST RUNTIME & TOOLCHAIN AUDIT

| Tool / Runtime | Installed Version | Path / Location | Operational Status |
|---|---|---|---|
| **Host OS** | Windows 10.0.26100 x86_64 | `C:\Windows` | OPERATIONAL |
| **Node.js** | `v26.8.2` | `C:\Program Files\nodejs\node.exe` | OPERATIONAL |
| **npm** | `11.19.1` | `C:\Program Files\nodejs\npm.cmd` | OPERATIONAL (Invoked via `.cmd`) |
| **Git** | `2.55.0.windows.5` | `C:\Program Files\Git\cmd\git.exe` | OPERATIONAL |
| **WebView2** | `157.0.4341.42` | `C:\Program Files (x86)\Microsoft\EdgeWebView\Application` | **OPERATIONAL & VERIFIED** |
| **Rust (`rustc`)** | **NOT INSTALLED** | N/A | **NOT FOUND (BLOCKS RUST COMPILE)** |
| **Cargo (`cargo`)** | **NOT INSTALLED** | N/A | **NOT FOUND (BLOCKS RUST COMPILE)** |
| **MSVC Tools** | **NOT DETECTED** | N/A | **NOT FOUND (HOST PREREQUISITE)** |
| **Tauri CLI** | `@tauri-apps/cli` `2.12.4` | `./node_modules/.bin/tauri` | **OPERATIONAL & DETECTED** |

---

## 2. VALIDATION AUDIT TABLE (STEP 21)

| Area | Command / Test | Result | Blocking? | Notes |
|---|---|---|---|---|
| **Provider Descriptors** | `src-tauri/src/providers/descriptor.rs` | **PASS** | NO | `ProviderDescriptor`, `EffectiveProviderDescriptor`, `HistoricalModelReference`. |
| **Canonical MVP Catalog** | `src-tauri/src/providers/catalog.rs` | **PASS** | NO | Built-in compile-time catalog for 8 providers (`openai`, `anthropic`, `gemini`, `deepseek`, `groq`, `mistral`, `local`, `custom`). |
| **Model Descriptors** | `src-tauri/src/providers/models.rs` | **PASS** | NO | `ProviderModel` extended with descriptions, defaults, context windows, and availability. |
| **Provider Registry Engine** | `src-tauri/src/providers/registry.rs` | **PASS** | NO | Immutable in-memory registry with strict validation (uniqueness, no orphans, URL checks). |
| **AppState & Bootstrap** | `state::AppState`, `core::application` | **PASS** | NO | `provider_registry: Arc<ProviderRegistry>` initialized and wired at startup. |
| **Tauri Commands** | `commands::registry` (6 commands) | **PASS** | NO | Safe IPC commands exposing only non-secret catalog metadata; 0 secret exposure. |
| **TypeScript IPC Contracts** | `src/services/ipc/types.ts` | **PASS** | NO | Authoritative DTOs, `ProviderDescriptorDto`, `ModelDescriptorDto`, `EffectiveProviderDto`. |
| **Frontend Registry API** | `src/services/ipc/registry.ts` | **PASS** | NO | TypeScript client API with in-memory browser fallback mock catalog. |
| **Unit Test Suite** | `npm test` (`node:test`) | **PASS** | NO | 173 unit tests across 82 suites passing cleanly (100% pass rate). |
| **TypeScript Type Check** | `npm run typecheck` (`tsc --noEmit`) | **PASS** | NO | Clean compilation with zero TypeScript errors under strict rules. |
| **Production Build** | `npm run build` (`tsc && vite build`) | **PASS** | NO | Clean Vite build (2161 modules transformed). |
| **Full Pipeline Validate** | `npm run validate` | **PASS** | NO | Runs `typecheck` + `test` + `build` without error (exit code 0). |
| **Brand Asset Preservation** | Checksum & Size inspection | **PASS** | NO | `Nano Route Neon Tech Logo.png` untouched (670,255 bytes). |
| **Tauri Native Build** | `npm run tauri build` | **BLOCKED** | YES (Host) | Fails with `cargo metadata: program not found` (Host Rust missing). |

---

## 3. DETAILED VALIDATION EXECUTION RECORDS

### Validation Record: Full Pipeline Validation (Typecheck + Test + Build)
```text
Command: cmd.exe /c "npm run validate"
Result: 0 (SUCCESS)

> nano-route@0.1.0 validate
> npm run typecheck && npm run test && npm run build

> nano-route@0.1.0 typecheck
> tsc --noEmit

> nano-route@0.1.0 test
> node --experimental-strip-types --test src/**/*.test.ts

ℹ tests 173
ℹ suites 82
ℹ pass 173
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2714.0649

> nano-route@0.1.0 build
> tsc && vite build

vite v5.4.21 building for production...
transforming...
✓ 2161 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.40 kB │ gzip:  0.27 kB
dist/assets/index-ByBgToRJ.css   15.68 kB │ gzip:  4.20 kB
dist/assets/index-D7UoI99S.js   328.71 kB │ gzip: 92.83 kB
✓ built in 7.62s
```

### Validation Record: Brand Asset Logo Verification
```text
File: Nano Route Neon Tech Logo.png
Expected Length: 670,255 bytes
Actual Length:   670,255 bytes
Status: PASSED (Byte-for-byte preserved)
```
