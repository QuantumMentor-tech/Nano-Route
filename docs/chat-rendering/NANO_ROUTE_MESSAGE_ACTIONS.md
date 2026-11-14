# Nano Route — Message Actions & Copy Policy
**Step 80 — Authoritative Interaction Specification**

## 1. Supported Message Actions
- **Message Content Copying**:
  - Located on the message header for assistant and user messages.
  - Copies canonical markdown/plain-text string directly to the clipboard.
  - Emits 2-second visual feedback (`Copied!`) without full-screen alerts or toast spam.
- **Code Block Copying**:
  - Located on the code block title bar.
  - Copies pure code text excluding language identifiers or UI markers.
  - Preserves exact whitespace and indentation.
- **Code Block Expand / Collapse**:
  - Automatically enabled for code blocks exceeding 25 lines.
  - Preserves viewport stability and conversation readability.

