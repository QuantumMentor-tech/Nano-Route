# Nano Route — Step 80 Pre-Implementation Audit & Baseline
**Rich Message Rendering, Safe Markdown, Code Blocks, Message Actions & Response Presentation**

## 1. Current State Assessment
- **Message Rendering Pipeline**:
  - `MessageTimeline.tsx` manages scrollable chat flow with auto-scroll anchoring and jump-to-bottom controls.
  - `MessageItem.tsx` branches by sender: `user`, `assistant`, `system`.
  - `UserMessage.tsx` displays user prompt bubbles with timestamp and retry action.
  - `AssistantMessage.tsx` displays bot avatar, routed model badge (`ModelBadge`), timestamp, copy button, routing explanation toggle (`RoutingExplanationPanel`), and parsed response content via `SafeMarkdown.tsx`.
- **Markdown & Code Rendering**:
  - `SafeMarkdown.tsx` uses custom parser `parseBlocks` (`src/features/chat/utils/markdownParser.ts`).
  - Supports headings (`#`, `##`, `###`), blockquotes (`>`), lists (`-`, `*`, `1.`), bold (`**`), italic (`*`), code spans (`...`), and safe URLs (`https:`, `http:`).
  - Code blocks (`CodeBlock.tsx`) render monospace preformatted text with language labels and clipboard copy with 2-second visual feedback.
  - Zero `dangerouslySetInnerHTML`, ensuring zero XSS vulnerabilities from untrusted LLM outputs.
- **Identified Enhancement Opportunities**:
  - Expand/collapse toggle for long code blocks (> 25 lines) to maintain conversational flow.
  - Message-level actions: Copy Raw Markdown vs Copy Plain Text.
  - Stream-safe handling for partial code fences and markdown tags without jarring layout shifts.
  - Enhanced table rendering with horizontal scroll encapsulation.
  - Full keyboard accessibility and ARIA live regions for response completion.

## 2. Inviolable Architectural Boundaries
1. **Presentation Layer Only**: Rendering transforms presentation, not content or meaning.
2. **Canonical Message Storage**: Raw logical markdown continues to be persisted in SQLite `chat_messages.content`. No HTML or rendered DOM is ever written to storage.
3. **Zero Authority Usurpation**: The renderer never modifies provider routing, SLM decisions, context window preflight (Step 76), provider budget limits (Step 75), or credential stores (Step 74).
4. **Security Invariant**: Never execute `<script>`, event attributes (`onclick`, `onerror`), or active content.

