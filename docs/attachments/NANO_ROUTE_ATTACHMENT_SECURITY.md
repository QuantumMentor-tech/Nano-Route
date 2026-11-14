# Nano Route — Attachment Security Specification
**Step 79 — Authoritative Security Specification**

## 1. Threat Mitigation Strategies

| Threat Vector | Mitigation Strategy | Enforcement Layer |
|---|---|---|
| Executable Launch | Rejection of `.exe`, `.bat`, `.cmd`, `.ps1`, `.vbs`, etc. | Validator (`validateAttachment`) |
| Unbounded File Size | 2 MB hard limit per file, 60,000 char aggregate cap | Validator (`validateAttachment`) |
| Script Injection (`<script>`) | Context rendered as text nodes within virtual DOM | React DOM rendering |
| Path Traversal / LFI | Files accessed purely through user-initiated browser File API | Native input boundary |
| Cloud Leakage | Zero upload or remote transmission prior to user submit | Local FileReader |
| Credential Exposure | Attachments cannot query Windows DPAPI vault | Architecture Boundary |

## 2. Invariant Verification
All tests in `src/features/attachments/__tests__/attachments.test.ts` assert that forbidden extensions are flagged as `UNSUPPORTED` and oversized files are flagged as `TOO_LARGE`.

