# Nano Route Supported Environment Policy

## 1. Scope & Purpose
This document defines the official desktop environment support policy for **Nano Route**. Nano Route is engineered as a local-first Windows desktop application leveraging Tauri v2, Rust native services, SQLite embedded persistence, Windows Data Protection API (DPAPI), and Microsoft Edge WebView2 Evergreen runtime.

---

## 2. Environment Classification Model

Every desktop environment evaluated by engineering is categorized into one of four distinct states:

| Status Code | Classification | Meaning | Production Support Commitment |
|:---|:---|:---|:---|
| **`SUPPORTED`** | Tier-1 Qualified | Formally verified via automated and manual test suites on matching hardware/OS configurations. | Full active defect resolution, regression testing, and security updates. |
| **`SUPPORTED_WITH_LIMITATIONS`** | Tier-2 Constrained | Operates successfully with documented functional or performance constraints (e.g. ARM64 translation). | Support provided within documented constraints; performance limitations noted. |
| **`NOT_YET_QUALIFIED`** | Evaluation Pending | Architecture or OS release not yet fully tested in continuous integration or hardware labs. | Community feedback accepted; no formal stability guarantees. |
| **`UNSUPPORTED`** | Incompatible | Operating systems or CPU architectures lacking necessary APIs or runtimes. | Application rejects installation/launch with clear error guidance. |

---

## 3. Operating System Support Matrix

### 3.1 Supported Windows Releases (Tier-1)
- **Windows 11 (64-bit):**
  - Versions: 21H2 (Build 22000), 22H2 (Build 22621), 23H2 (Build 22631), 24H2 (Build 26100+).
  - Architecture: x86_64 (`x64`).
  - Status: **`SUPPORTED`**.
- **Windows 10 (64-bit):**
  - Versions: 20H1 (Build 19041), 20H2 (Build 19042), 21H1 (Build 19043), 21H2 (Build 19044), 22H2 (Build 19045).
  - Architecture: x86_64 (`x64`).
  - Status: **`SUPPORTED`**.
- **Windows Server (64-bit):**
  - Versions: Windows Server 2022, Windows Server 2025 (Desktop Experience enabled).
  - Status: **`SUPPORTED_WITH_LIMITATIONS`** (Requires Edge WebView2 runtime installation).

### 3.2 Constrained Architectures (Tier-2)
- **Windows 11 on ARM64:**
  - Emulation: Executed via Windows 11 x64 emulation / Prism translation.
  - Status: **`SUPPORTED_WITH_LIMITATIONS`**.
  - Limitations: CPU-only SLM execution; DirectML GPU acceleration requires native ARM64 compilation (planned future roadmap).

### 3.3 Unsupported Operating Systems
- **Windows 7, Windows 8, Windows 8.1, Windows XP, Windows Vista:**
  - Status: **`UNSUPPORTED`**.
  - Reason: Lack of WebView2 Evergreen runtime support, modern DPAPI CNG enhancements, and Tauri v2 Windows dependencies.
- **32-Bit (x86 / IA-32) Windows:**
  - Status: **`UNSUPPORTED`**.
  - Reason: Nano Route requires 64-bit address spaces for local SLM weights, model memory allocation, and high-performance SQLite caching.

---

## 4. Minimum Hardware & System Requirements

| Resource | Minimum Requirement | Recommended Production Target |
|:---|:---|:---|
| **CPU** | 64-bit Dual-Core x86_64 processor (Intel Core 6th Gen / AMD Ryzen 1st Gen) | 64-bit Quad-Core with AVX2 support (Intel 10th Gen+ / AMD Ryzen 3000+) |
| **RAM** | 4 GB System Memory (Cloud Provider routing only) | 16 GB System Memory (Local SLM Q4_K_M model execution) |
| **GPU** | Integrated Graphics (Intel HD 520+ / AMD Radeon Vega) | Discrete GPU with DirectML support (NVIDIA RTX / AMD RX / Intel Arc) |
| **Storage** | 500 MB free storage for base application & database | 10 GB+ free NVMe SSD storage for local SLMs and history backups |
| **Display** | 1280 × 720 display resolution at 100% scaling | 1920 × 1080 or higher at 100% – 150% scaling |
| **Runtime** | Microsoft Edge WebView2 Evergreen Runtime (Build 109.0.1518.78+) | Latest Evergreen Release (Managed via Windows Update) |

---

## 5. Security & Isolation Invariants
1. **Windows DPAPI Binding:** Credential storage is bound to the current Windows user login security identifier (SID). Copying database files across distinct user accounts or machines does not expose credentials.
2. **Local Administrator Privileges:** Nano Route does **not** require elevation or Administrator rights to run. Standard user accounts are fully supported.
3. **Local AppData Isolation:** Persistent databases, models, and caches reside strictly in `%LOCALAPPDATA%\Nano Route\`.

