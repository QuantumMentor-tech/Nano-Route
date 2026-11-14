# Nano Route — File Type & Size Allowlist Policy
**Step 79 — Authoritative File Policy Specification**

## 1. Supported File Categories & Extensions

| Category | Allowed Extensions | Handling Strategy |
|---|---|---|
| Text Documents | `.txt`, `.md`, `.markdown`, `.log`, `.rtf` | Direct UTF-8 text extraction |
| Structured Data | `.json`, `.csv`, `.tsv`, `.yaml`, `.yml`, `.xml`, `.toml` | Plain text preserved with syntax indicators |
| Code Source | `.js`, `.ts`, `.jsx`, `.tsx`, `.py`, `.rs`, `.go`, `.java`, `.c`, `.cpp`, `.h`, `.cs`, `.rb`, `.php`, `.sql`, `.html`, `.css`, `.sh` | Passive code extraction; no execution |
| Images (Multimodal) | `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.svg` | Base64 data URL preparation for vision models |

## 2. Strictly Prohibited & Rejected Extensions
Executables, scripts, and system binaries are rejected upon selection:
`.exe`, `.bat`, `.cmd`, `.vbs`, `.ps1`, `.com`, `.msi`, `.scr`, `.pif`, `.dll`, `.so`, `.dylib`.

## 3. Quantitative Constraints
- **Max File Size**: 2 MB per file.
- **Max Attachments**: 5 files per message prompt.
- **Max Aggregate Characters**: 60,000 characters across attachments.

