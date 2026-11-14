# Nano Route — Local Attachment Architecture Specification
**Step 79 — Authoritative Architecture Specification**

## 1. Architectural Positioning & Scope
Local Attachments & File Context is an intake and preparation subsystem that prepares rich text and multimodal context for Nano Route prompts:

```text
+-----------------------------------------------------------------------------------+
|                        ATTACHMENT INTAKE SUBSYSTEM (STEP 79)                      |
|                                                                                   |
|  [ File Selection ] (Native file picker / input accept)                           |
|          |                                                                        |
|          v                                                                        |
|  [ Type & Size Validation ]                                                       |
|  - Extension & MIME categorization                                                |
|  - Max 2 MB per file, max 5 files, rejection of executables/scripts               |
|          |                                                                        |
|          v                                                                        |
|  [ Local Preparation ]                                                            |
|  - Text/Code/JSON/CSV -> Normalized text stream                                   |
|  - Images -> Base64 data URL                                                      |
|          |                                                                        |
|          v                                                                        |
|  [ Composer Chip Row & Context Formatting ]                                       |
|                                                                                   |
+-----------------------------------------------------------------------------------+
                                   | (Prompt + Delimited Context)
                                   v
+-----------------------------------------------------------------------------------+
|                     DOWNSTREAM PIPELINE (STEPS 74 - 78)                           |
|                                                                                   |
|  [ Step 78 Draft Autosave ] -> [ Step 76 Context Preflight ]                      |
|                                   |                                               |
|                                   v                                               |
|  [ Step 75 Budget Guardrails ] -> [ Step 29/30 SLM/Model Routing ]                |
|                                   |                                               |
|                                   v                                               |
|  [ Provider Execution & Streaming ]                                               |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

## 2. Inviolable Guarantees
1. **Never a Pre-Transmission Network Action**: Attaching and preparing local files performs zero network requests or background uploads.
2. **Strict Downstream Preflight**: Formatted file context passes through Step 76 Token Estimation and Context Window Preflight.
3. **No Automatic Code Execution**: Code files are treated as raw string literals; no scripts are executed or compiled.
4. **No Third-Party Cloud Dependency**: Attachments remain 100% on the local device until the user explicitly clicks Send.

