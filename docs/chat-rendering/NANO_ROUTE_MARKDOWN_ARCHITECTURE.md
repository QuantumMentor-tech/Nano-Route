# Nano Route — Safe Markdown & Response Rendering Specification
**Step 80 — Authoritative Architecture Specification**

## 1. Subsystem Architecture Overview
The response presentation layer translates raw LLM responses and historical messages into readable, accessible, and sandboxed visual elements:

```text
+-----------------------------------------------------------------------------------+
|                        RESPONSE PRESENTATION LAYER (STEP 80)                      |
|                                                                                   |
|  [ Raw Assistant / User / System Message ]                                        |
|          |                                                                        |
|          v                                                                        |
|  [ Pure React Safe Markdown Parser ]                                              |
|  - Blocks: Headings, Code Fences, Blockquotes, Lists, Paragraphs                  |
|  - Inlines: Bold, Italic, Code Spans, Safe Links (`https:`, `http:`)              |
|  - Zero dangerouslySetInnerHTML (100% XSS immune)                                 |
|          |                                                                        |
|          v                                                                        |
|  [ Interactive Visual Presentation ]                                              |
|  - CodeBlock with language pill, expand/collapse (> 25 lines), and copy action    |
|  - ModelBadge with routing explanation toggle & diagnostics inspection            |
|  - Message Actions: Copy raw text / markdown to clipboard                         |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

## 2. Inviolable Security & Presentation Invariants
1. **Zero Execution**: Code snippets are displayed with monospace styling only; code is never executed, compiled, or evaluated.
2. **Strict Sanitization**: Raw `<script>`, `<iframe>`, `<object>`, and `onclick`/`onerror` attributes are rendered inertly as escaped text nodes.
3. **No Automatic Network Fetching**: Rendered links do not pre-fetch remote assets or generate network previews.
4. **Canonical Storage**: Messages remain stored in SQLite as clean, logical text strings. Rendered HTML is never persisted.

