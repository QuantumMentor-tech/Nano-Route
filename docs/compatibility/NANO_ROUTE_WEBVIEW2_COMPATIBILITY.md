# Nano Route Microsoft Edge WebView2 Compatibility & Runtime Qualification

## 1. Overview & Architectural Role
Microsoft Edge WebView2 serves as the presentation runtime for Nano Route's React/TypeScript frontend inside Tauri v2. WebView2 embeds the Chromium browser engine into the desktop application process while delegating native OS operations (SQLite, DPAPI, file I/O, local SLM inference) to the compiled Rust backend via an asynchronous IPC boundary.

---

## 2. Runtime Distribution Models

Nano Route supports the **Evergreen Distribution Mode**:
- **Mechanism:** Leverages the centrally installed Microsoft Edge WebView2 runtime shared across the Windows operating system.
- **Auto-Update:** Maintained and patched automatically via Windows Update.
- **Minimum Required Version:** `109.0.1518.78` (Final build supporting Windows 7/8.1, ensuring broad baseline compatibility across all Windows 10/11 updates).
- **Recommended Production Version:** `120.0.0.0` or higher.

---

## 3. Failure Isolation & Security Invariants

### 3.1 Renderer Process Crash Isolation
If the WebView2 renderer process encounters an unexpected termination (e.g., out-of-memory in DOM rendering or GPU crash):
1. **Native Process Protection:** The Rust core process and background task threads remain alive and operational.
2. **Data Protection:** In-flight database transactions are protected by SQLite WAL journals; no corruption occurs.
3. **Zero Secret Exposure:** Credentials are never passed to the renderer DOM as plain text. The renderer holds only ephemeral correlation tokens.

### 3.2 Missing Runtime Handling
When an environment lacks the WebView2 runtime (e.g. stripped Windows Server instances):
- **Pre-flight Check:** Tauri v2 pre-flight detection identifies the missing registry key:  
  `HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-992A-44A6-9E3D-0F4150346083}`
- **User Action:** Surfaces an explicit native Windows dialog directing the user to download the official Microsoft Evergreen Bootstrapper:
  ```text
  Nano Route requires Microsoft Edge WebView2 Runtime.
  Please download and install it from Microsoft:
  https://developer.microsoft.com/en-us/microsoft-edge/webview2/
  ```
- **Fail-Safe Invariant:** The application does not attempt to fall back to legacy Internet Explorer WebOC (`MSHTML`) or arbitrary unvetted web runtimes.

---

## 4. WebView2 Feature & Capability Qualifications

| Feature Domain | Tested Capability | Status | Qualification Notes |
|:---|:---|:---|:---|
| **WebSockets** | Local SLM streaming & Live API bridges | **QUALIFIED** | Low-latency binary and text framing operational. |
| **CSS Modern Standards**| CSS Grid, Flexbox, Container Queries, Backdrop Filter | **QUALIFIED** | Glassmorphism and responsive sidebar render accurately. |
| **Storage Isolation** | IndexedDB, LocalStorage, Cache API | **QUALIFIED** | Sandboxed within `%LOCALAPPDATA%\Nano Route\EBWebView\`. |
| **Hardware Acceleration**| Direct3D 11/12 GPU Canvas & WebGL 2.0 | **QUALIFIED** | Smooth 60 FPS transitions and chart rendering. |
| **Clipboard API** | Async Clipboard Read/Write | **QUALIFIED** | Controlled access with user confirmation. |
| **DevTools Integration** | Remote Debugging Port (`--remote-debugging-port`) | **RESTRICTED** | Disabled in production builds; enabled only in dev mode. |

