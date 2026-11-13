# NANO ROUTE — AUTHENTICODE SIGNING GUIDE

**Security Level:** Production Authenticode / Windows SmartScreen  
**Digest Algorithm:** SHA-256 with RFC 3161 Timestamping  

---

## 1. Code-Signing Overview

To establish trust on Windows 10/11 and prevent Windows SmartScreen "Unknown Publisher" warnings, production executables and installers must be signed using a valid code-signing certificate (Standard or Extended Validation EV).

---

## 2. Signing Procedure via SignTool

```powershell
# Locate Windows SDK signtool.exe
$SignTool = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe"

# Execute dual SHA-256 signing with RFC 3161 timestamping
& $SignTool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 /f "C:\secure\certificates\nanoroute-cert.pfx" /p "$env:SIGNING_CERT_PASSWORD" "src-tauri\target\release\bundle\nsis\NanoRoute_0.1.0_x64-setup.exe"

# Verify signature
& $SignTool verify /pa /v "src-tauri\target\release\bundle\nsis\NanoRoute_0.1.0_x64-setup.exe"
```

---

## 3. Tauri Automated Signing Configuration

In `src-tauri/tauri.conf.json`, the certificate thumbprint and timestamp server can be configured for automated CI/CD signing:

```json
"windows": {
  "certificateThumbprint": "YOUR_CERTIFICATE_THUMBPRINT",
  "digestAlgorithm": "sha256",
  "timestampUrl": "http://timestamp.digicert.com"
}
```
*(Leave thumbprint null in repository source to prevent leaking private certificate fingerprints.)*

