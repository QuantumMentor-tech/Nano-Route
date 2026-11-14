# Nano Route — Attachment Provider Capability Policy
**Step 79 — Authoritative Capability Specification**

## 1. Provider & Modality Alignment
Nano Route aligns attachment modalities with target model capabilities:

1. **Text, Code, & Structured Files**:
   - Transformed into standard delimited text context blocks.
   - Compatible with ALL LLM/SLM models (cloud and local ONNX).
2. **Images (PNG, JPG, WEBP, GIF, SVG)**:
   - Converted to data URLs for models with `IMAGE_INPUT` capability (e.g. GPT-4o, Claude 3.5 Sonnet, Gemini 1.5 Pro).
   - If a text-only model or local SLM is targeted, image context flags an advisory compatibility notice in preflight.
3. **No Automatic Stripping**:
   - Nano Route will never silently discard attachments to force compatibility. If a manual model override cannot accept an attachment, the user is alerted to remove it or change models.

