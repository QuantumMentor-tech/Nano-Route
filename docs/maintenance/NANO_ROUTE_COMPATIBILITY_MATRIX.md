# NANO ROUTE — WINDOWS COMPATIBILITY MATRIX

**Phase 11: Post-Release Stability & Maintenance — Step 51**  
**Document ID:** MAINT-COMPAT-051  
**Date:** November 13, 2026  

---

## 1. Supported Operating Environments

| Platform / Edition | Architecture | WebView2 State | Verified Status | Operational Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Windows 11 (24H2 / 23H2 / 22H2)** | x86_64 | Evergreen (Bundled in OS) | **FULLY COMPLIANT** | Native DirectML and DPAPI acceleration active |
| **Windows 10 (22H2 / 21H2)** | x86_64 | Evergreen (Requires Runtime) | **FULLY COMPLIANT** | Automatic fallback to CPU if DirectML unavailable |
| **Windows Server 2022 / 2025** | x86_64 | Requires WebView2 Runtime | **COMPATIBLE** | Desktop experience required; DPAPI per-service-account |
| **Windows 10 on ARM (ARM64)** | ARM64 | Prism / WOW64 Emulation | **COMPATIBLE VIA EMULATION**| Native ARM64 compilation planned for future release |

---

## 2. Hardware Resource Profiles

- **Minimum Practical Footprint:** 2 Cores CPU, 4 GB RAM, 500 MB Storage.
- **Recommended Productivity Profile:** 4+ Cores CPU with AVX2, 8 GB RAM, Direct3D 12 GPU.
- **Air-Gapped / High-Security Workstations:** Fully supported. Nano Route operates offline with local SLM routing; zero internet connection is required unless cloud providers are invoked.

