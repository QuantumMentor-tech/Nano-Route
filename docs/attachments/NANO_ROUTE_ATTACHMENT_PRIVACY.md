# Nano Route — Attachment Privacy Specification
**Step 79 — Authoritative Privacy Specification**

## 1. Local Processing Guarantee
- **Zero Third-Party Analysis**: Attached files are never inspected by third-party virus or telemetry scanners.
- **Client-Side Preparation**: Text reading and base64 conversions occur solely inside the local application boundary.
- **Redaction from Logs**: Diagnostic support bundles explicitly omit raw file contents and base64 images.
- **Voluntary Transmission**: Files are only transmitted to the chosen model provider when the user explicitly clicks Send.

