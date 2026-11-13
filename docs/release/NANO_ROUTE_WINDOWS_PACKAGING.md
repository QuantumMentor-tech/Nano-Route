# NANO ROUTE — WINDOWS PACKAGING & BUILD GUIDE

**Version:** `0.1.0` (Release Candidate 1)  
**Tauri Framework:** Tauri v2.1.1  
**Build Tooling:** `@tauri-apps/cli` 2.12.4  

---

## 1. Prerequisites for Windows Packaging

To produce standalone `.exe`, `.msi`, or `.msix` Windows packages from this repository:

1. **Node.js:** v20+ LTS or v26+
2. **Rust Toolchain:** Stable x86_64-pc-windows-msvc (install via `rustup-init.exe`)
3. **Microsoft Visual Studio 2022:** Visual Studio Community or Build Tools with "Desktop development with C++" workload installed
4. **Microsoft Edge WebView2:** Evergreen runtime (pre-installed on Windows 11)

---

## 2. Production Build Commands

```powershell
# 1. Install frontend dependencies
npm install

# 2. Run TypeScript check and test suites
npm run typecheck
npm test

# 3. Build optimized frontend distribution assets (dist/)
npm run build

# 4. Generate native Windows binaries and installers via Tauri CLI
npx tauri build
```

The resulting installers will be generated under:
`src-tauri/target/release/bundle/nsis/NanoRoute_0.1.0_x64-setup.exe` (or `.msi` / `.msix`).

