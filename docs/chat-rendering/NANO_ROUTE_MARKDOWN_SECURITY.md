# Nano Route — Markdown & Code Security Policy
**Step 80 — Authoritative Security Specification**

## 1. Threat Mitigation Matrix

| Threat Vector | Mitigation Strategy | Enforcement |
|---|---|---|
| Script Execution | Pure React elements without `dangerouslySetInnerHTML` | `SafeMarkdown.tsx` |
| Malicious URLs | Scheme allowlist enforcing only `https:` and `http:` | `isSafeUrl` function |
| Remote Image Leakage | Disallowing unvetted remote image fetching | SafeMarkdown token policy |
| Unbounded Code Height | Collapsible code blocks (> 25 lines) with expand/collapse control | `CodeBlock.tsx` |
| DOM Nesting Exploits | Bounded regex tokenization with depth limits | `parseBlocks` utility |

## 2. Invariant Verification
All tests in `src/features/chat/__tests__/markdownParser.test.ts` verify that hostile `<script>` tags remain inert and unclosed code fences during streaming do not trigger exceptions.

