# NANO ROUTE — INSTALLATION & DEPLOYMENT GUIDE

**Version:** `0.1.0` (Release Candidate 1)  
**Supported OS:** Windows 10 (Build 19041+) / Windows 11 (x86_64)  
**Architecture:** 64-bit Native Desktop Application  

---

## 1. System Requirements

### Minimum Requirements
- **Operating System:** Windows 10 64-bit (Version 2004 or later)
- **Processor:** 64-bit Intel / AMD dual-core processor (2.0 GHz or higher)
- **Memory (RAM):** 4 GB RAM
- **Storage:** 500 MB free disk space for application and local SQLite database
- **Web Runtime:** Microsoft Edge WebView2 Evergreen Runtime (pre-installed on Windows 11 and updated Windows 10 systems)

### Recommended Requirements
- **Processor:** 4 cores or higher with AVX2 support
- **Memory (RAM):** 8 GB RAM (recommended for concurrent local SLM inference)
- **Graphics:** Direct3D 12 compatible GPU for DirectML ONNX hardware acceleration

---

## 2. Installation Procedures

### Standard Windows Installer (NSIS / MSI)
1. Download the release installer `NanoRoute-0.1.0-Setup.exe` (or `.msi`).
2. Run the installer with standard user privileges (Administrator privileges are not required for per-user installation).
3. Follow the on-screen prompts to select the installation destination:
   - Default: `%LOCALAPPDATA%\Programs\Nano Route\`
4. Launch Nano Route from the Start Menu or Desktop shortcut.

### Microsoft Store / MSIX Package
1. Double-click `NanoRoute-0.1.0.msix`.
2. Review the application manifest permissions (restricted strictly to local user capabilities and outbound internet for configured providers).
3. Click **Install**.
4. The application is registered in Windows Settings and Start Menu.

---

## 3. Data Storage & Persistence Locations

Nano Route enforces strict separation between read-only application binaries and writable user data:

- **Database & Telemetry:**  
  `%LOCALAPPDATA%\Nano Route\data\nano_route.db`  
  (SQLite WAL, shared memory, and database journal files)
- **DPAPI Credential Storage:**  
  Encrypted directly into `nano_route.db` using the current Windows user profile master key (`CryptProtectData`).
- **UI State Cache:**  
  Client `localStorage` stores strictly `nr_sidebar_collapsed` (zero credentials or prompt text).
- **Log Files:**  
  `%LOCALAPPDATA%\Nano Route\logs\`

---

## 4. Post-Installation Configuration

### First Launch Checklist
1. Open **Settings** from the sidebar navigation.
2. Under **Provider Management**, select the AI providers you wish to configure (OpenAI, Anthropic, Gemini, Groq, DeepSeek, or Mistral).
3. Enter your API Key. The key is encrypted immediately via Windows DPAPI before being committed to disk. Plaintext keys are never stored.
4. Verify provider readiness by clicking **Test Health**.
5. Navigate to **Chat Studio** and enter your first prompt to verify automatic routing and streaming.

---

## 5. Clean Uninstall & Data Cleanup

### Standard Application Uninstall
1. Open Windows **Settings** → **Installed Apps** (or Control Panel → Programs).
2. Select **Nano Route** and click **Uninstall**.
3. The uninstaller removes application binaries, shortcuts, and registry entries.

### Complete Data Destruction (Optional)
If you wish to perform a complete wipe of all chat history, telemetry, and encrypted credentials prior to uninstallation:
1. Open Nano Route → Navigate to **Settings** → **Data Lifecycle & Privacy**.
2. Locate the **Emergency Full Data Wipe** section.
3. Type the confirmation token `DELETE` and click **Execute Full Data Wipe**.
4. All SQLite tables are purged, the WAL file is truncated, and stored DPAPI keys are zeroized.

