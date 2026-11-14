# Nano Route — Prompt Templates & Request Presets Architecture
**Step 77 — Authoritative Architecture Specification**

## 1. Subsystem Architecture Overview
The Prompt Templates & Request Presets subsystem is an additive user-enablement layer positioned strictly upstream of Nano Route's core request execution pipeline.

```
+-----------------------------------------------------------------------------------+
|                           COMPOSITION LAYER (STEP 77)                             |
|                                                                                   |
|  [ Built-in / Custom Templates ]      [ Request Presets Catalog ]                 |
|                   |                                 |                             |
|                   v                                 v                             |
|          [ Template Resolver ]            [ Template / Preset Apply ]             |
|          - Placeholder parsing                    |                               |
|          - Variable values modal                  |                               |
|                   |                               |                               |
|                   +-------------------------------+                               |
|                                   |                                               |
|                                   v                                               |
|                      [ Composer Input Draft Area ]                                |
|                                   |                                               |
+-----------------------------------|-----------------------------------------------+
                                    | (Normal Human Edit & Submit)
                                    v
+-----------------------------------------------------------------------------------+
|                        CORE EXECUTION PIPELINE (EXISTING)                         |
|                                                                                   |
|  [ Context Construction ] -> [ Context Preflight (Step 76) ]                      |
|                                   |                                               |
|  [ Budget Guardrails (Step 75) ] <-+                                              |
|         |                                                                         |
|         v                                                                         |
|  [ SLM Routing / Manual Override ] -> [ Provider Execution / Streaming ]          |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

## 2. Inviolable Architectural Principles
1. **Composition Layer Exclusivity**: Applying a template or preset only ever populates the text in the Composer draft. It NEVER submits requests automatically.
2. **Zero Authority Usurpation**: Templates and presets do not override or alter:
   - Dynamic routing engine or scoring
   - Context window truncation, compaction, or preflight rules (Step 76)
   - Provider budget limits or spend enforcement (Step 75)
   - DPAPI secret storage or API key lifecycle (Step 74)
   - Local SLM ONNX/DirectML execution
3. **Passive Content Only**: Templates contain plain text and delimited `{{variable_name}}` placeholders. They do not contain executable scripts, macros, network references, or shell commands. `<script>` tags are strictly rejected on validation.
4. **Zero Credential Contamination**: Templates and presets NEVER store, reference, export, or import API keys or DPAPI tokens.

