# Nano Route Windows Recovery & Lifecycle Matrix

## 1. Overview
This matrix documents the behavior of Nano Route across Windows lifecycle events: Power Transitions (Sleep, Hibernate, Resume), User Session Transitions (Logoff, Logon, Fast User Switching), and System Restarts.

---

## 2. Windows Lifecycle & State Matrix

| Transition Event | Subsystem Impacted | Expected Behavior | Observed Result | Protection Mechanism |
|:---|:---|:---|:---|:---|
| **System Sleep (S3 / Modern Standby)** | Provider Network / SLM | Inactive sockets suspended; active HTTP streams aborted gracefully. | **PASS** | `evaluatePowerNetworkTransition` flags open streams for re-connection upon wakeup. |
| **System Resume from Sleep** | SQLite / WebView2 | SQLite connections re-validated; UI refreshes network status indicator. | **PASS** | SQLite WAL handles idle sleep without lock loss. No database re-creation needed. |
| **System Hibernate (S4)** | Full Process State | Memory dump to `hiberfil.sys`. Resumed state re-verifies network reachability. | **PASS** | Stale socket timeouts handled gracefully by ProviderClient retry logic. |
| **Windows User Logoff** | DPAPI Context / Tauri | Tauri receives `WM_QUERYENDSESSION` / `WM_ENDSESSION`. Clean exit initiated. | **PASS** | Write locks released; WAL checkpoint executed cleanly. Crash marker updated to clean shutdown. |
| **Fast User Switching** | DPAPI Security Context | Application remains running in background session of User A. User B cannot access credentials. | **PASS** | Windows DPAPI encrypts using User A's master key. User B process cannot decrypt. |
| **Clean Windows Restart** | All Subsystems | Orderly shutdown of tasks, database flushed, clean shutdown marker persisted. | **PASS** | Zero false "crash detected" notices on next boot. |
| **Abrupt Power Loss / Crash** | SQLite / In-flight write | OS crashes during active write. Database remains consistent. | **PASS** | SQLite WAL guarantees atomic commit boundaries; half-written frames rolled back automatically. |
| **Network Transition (WiFi to Offline)** | Frontier Providers | Immediate switch to Offline state. Cloud routing disabled; local SLM active. | **PASS** | IPC error mapped to `NETWORK_UNAVAILABLE`. Local chat and history search fully functional. |
| **Network Transition (Offline to Online)** | Frontier Providers | Connectivity restored. Cloud provider health checks execute silently. | **PASS** | Provider route candidates re-enabled in router selection pool. |

---

## 3. Windows DPAPI Context Invariants
- **Machine Transfer Prohibition:** DPAPI credentials protected with `CRYPTPROTECT_UI_FORBIDDEN` cannot be decrypted on a different physical motherboard or Windows SID.
- **Controlled Invalidation Handling:** If a user clones their `%LOCALAPPDATA%` to another PC, Nano Route catches the `SEC_E_DECRYPT_FAILURE` cleanly and prompts the user to re-enter provider API keys without crashing or corrupting chat history.

