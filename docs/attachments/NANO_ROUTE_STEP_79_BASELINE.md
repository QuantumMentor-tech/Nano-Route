# Nano Route — Step 79 Pre-Implementation Audit & Baseline
**Local Attachments, File Context, Document Intake & Secure Multimodal Request Preparation**

## 1. Architectural Positioning
The local attachment intake and file context subsystem is an additive preparation layer positioned strictly upstream of the request pipeline:

```text
Local File(s)
   ↓
Attachment Intake (Native Picker / Drag-and-Drop)
   ↓
Security & Type / Size Validation
   ↓
Local Text / Multimodal Content Preparation
   ↓
Composer Attachment Chips & Preview
   ↓
Composer Prompt + Prepared Attachment Context
   ↓
Step 76 Context Window Preflight (Token & Limit Checks)
   ↓
Step 75 Provider Budget Guardrails
   ↓
Step 29/30 Intelligent Routing & Multimodal Capability Filtering
   ↓
Provider Execution / Streaming
```

## 2. Existing Subsystems & Integration Points
- **Composer** (`src/features/chat/components/Composer.tsx`):
  - Multiline input with dynamic auto-sizing.
  - Step 78 draft autosaving (`useComposerDraft`) and undo/redo.
  - Step 77 prompt template integration modal.
  - Context Indicator badge (Step 76).
  - Draft status indicator (`DraftStatusIndicator`).
- **Context Engine** (`src/features/context/engine.ts`):
  - Canonical token estimation and model context limit validation.
  - `evaluateContextPreflight(...)` inspects proposed prompt + history against target model.
  - Attachment context is appended directly to the input evaluation.
- **Provider Capability Alignment**:
  - Text/Code/JSON/CSV/Markdown files are extracted safely into text context.
  - Multimodal images (PNG, JPEG, WEBP, GIF) are converted into base64 data URLs only for models with image input capability.
- **Security & Privacy Invariants**:
  - File reading and intake occur 100% locally.
  - No remote cloud upload, no third-party scanning, and no automatic background telemetry containing file payloads.
  - Disallowing executable scripts (`.exe`, `.bat`, `.sh`, `.cmd`, `.vbs`, etc.).
  - Bounded size limits: default 2 MB per file, max 5 attachments per prompt, aggregate context capped at 50,000 characters.

## 3. Strict Non-Goals
- No cloud synchronization (Drive, OneDrive, Dropbox).
- No OCR engine or binary disassembly.
- No automatic execution or code execution from attached files.
- No automatic provider switching or routing authority usurpation.

