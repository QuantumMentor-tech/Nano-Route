# Nano Route Support Diagnostics & Privacy-Preserving Evidence Guide

## 1. Zero-Cloud Telemetry Guarantee
Nano Route operates under a strict privacy-preserving architectural invariant:
- **No Background Telemetry:** The application does not send telemetry, analytics, pingbacks, or crash reports to any external server or cloud service.
- **User-Initiated Export Only:** Diagnostic logs and system summaries are generated only when explicitly initiated by the user via the Security & Diagnostics panel or support export dialog.
- **Client-Side Redaction:** All sensitive data (credentials, DPAPI BLOBs, private directories, user messages) is irrevocably stripped before the diagnostic bundle is saved to disk or viewed.

---

## 2. Redaction Specification & Scrubbing Rules

### 2.1 Credential & Token Redaction
The following patterns are matched and replaced with `[REDACTED_SECRET]`:
- OpenAI API Keys: `sk-[A-Za-z0-9_-]{8,}`
- Google Gemini API Keys: `AIza[0-9A-Za-z-_]{30,}`
- Groq API Keys: `gsk_[A-Za-z0-9_-]{16,}`
- GitHub Personal Tokens: `ghp_[A-Za-z0-9]{30,}`
- Bearer Authorization Headers: `Bearer\s+[A-Za-z0-9._-]+`
- Generic key-value credentials: `(?:key|secret|password|token)=[^\s&"']+`
- DPAPI Encrypted Blobs: Entire binary payloads are excluded; only a boolean `isConfigured: true` indicator is surfaced.

### 2.2 Filesystem Path Sanitization
The following patterns are matched and replaced with `[REDACTED_PATH]`:
- Windows Absolute User Paths: `[A-Za-z]:\\[^\\/:*?"<>|\r\n\t]+` (e.g. `C:\Users\JohnDoe\AppData\...`)
- POSIX Home/System Paths: `/(?:Users|home|var|tmp|etc|usr)[^\s"':;]+`

### 2.3 User Conversation Privacy
- User prompt text, assistant response text, and chat history are **never** included in technical support diagnostics bundles.
- Only token counts, latency metrics, and error codes are exported for performance troubleshooting.

---

## 3. Diagnostic Bundle Schema

When an evidence bundle is produced via `generateSupportEvidenceBundle`, it strictly complies with the following structure:

```json
{
  "bundleId": "diag_1700000000000_abc1234",
  "generatedAt": "2026-11-13T18:00:00.000Z",
  "appVersion": "0.1.0",
  "category": "CAT_D_PROVIDER_DRIFT_OUTAGE",
  "severity": "SEV-3",
  "systemSummary": {
    "os": "Windows",
    "arch": "x64"
  },
  "sanitizedLogs": [
    "Connecting to https://api.openai.com with [REDACTED_SECRET]",
    "Database access verified at [REDACTED_PATH]"
  ],
  "sanitizedConfigSnapshot": {
    "routingPreferenceMode": "hybrid",
    "telemetryEnabled": false,
    "apiToken": "[REDACTED_SECRET]"
  },
  "startupMarkerState": {
    "cleanShutdownPrior": true,
    "consecutiveCrashCount": 0
  },
  "invariantsVerified": {
    "zeroPlaintextKeys": true,
    "dpapiBlobOmitted": true,
    "pathsSanitized": true
  }
}
```

---

## 4. User Verification Instructions
Users may inspect the downloaded diagnostic JSON file in any text editor before attaching it to a support ticket. They can verify:
1. No passwords or API tokens appear anywhere in the file.
2. Their Windows username does not appear in file paths.
3. No chat messages or prompts are stored.

