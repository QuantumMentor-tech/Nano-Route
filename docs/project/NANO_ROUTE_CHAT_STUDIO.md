# Nano Route — Chat Studio Architecture & Conversation Workspace

**Roadmap Phase**: Phase 7, Chat Experience  
**Step**: 31 of 90  
**Title**: Chat Studio UI & Conversation Workspace  
**Status**: COMPLETE  
**Primary Stack**: React 18, TypeScript 5, Tauri v2, SQLite persistence  

---

## 1. Executive Summary

Step 31 introduces the **Chat Studio UI and Conversation Workspace**, establishing the frontend conversational interface for Nano Route. The workspace is designed for privacy-preserving AI orchestration with native dark mode aesthetics, interactive session management, an auto-scrolling message timeline, and safe pure-React Markdown rendering.

The Chat Studio is strictly decoupled from prompt execution and model routing: it persists messages and emits strongly-typed `SubmitPromptIntent` records without making provider network requests or performing SLM inference directly.

---

## 2. Architecture & Component Hierarchy

```
src/features/chat/
├── types.ts                      # ChatStudioState, SubmitPromptIntent, ComposerState, ChatError
├── useChatStudio.ts              # Session lifecycle, persistence, stale-request protection hook
├── index.ts                      # Public barrel exports
└── components/
    ├── ChatStudio.tsx            # Root container uniting sidebar, header, timeline & composer
    ├── ChatSessionSidebar.tsx    # Session list, "+ New Chat" button, search/filter & delete modal
    ├── ChatSessionItem.tsx       # Individual session row with title, timestamp, pin & delete actions
    ├── ChatHeader.tsx            # Conversation header with inline rename, pin toggle & delete modal
    ├── MessageTimeline.tsx       # Scrollable stream with intelligent auto-scroll & "Jump to latest"
    ├── MessageItem.tsx           # Type dispatcher for user, assistant, and system message bubbles
    ├── UserMessage.tsx           # User prompt card with timestamp and copy button
    ├── AssistantMessage.tsx      # Assistant response bubble with SafeMarkdown and ModelBadge
    ├── SystemMessage.tsx         # Centered status/orchestration event pill
    ├── ModelBadge.tsx            # Routed provider, model, latency, and token consumption badge
    ├── Composer.tsx              # Multiline textarea with bounded auto-growth and keyboard handling
    ├── CodeBlock.tsx             # Monospace code container with language indicator and copy button
    ├── SafeMarkdown.tsx          # Pure React markdown tokenizer (zero innerHTML, XSS-immune)
    ├── EmptyChatState.tsx        # Zero-message starter screen with prompt chips and shortcut hints
    ├── EmptyNoSessionState.tsx   # Placeholder when no session is selected
    ├── ChatLoadingState.tsx      # Staggered message skeleton placeholders
    └── ChatErrorState.tsx        # Actionable error banner with retry and dismiss options
```

---

## 3. Core Functional Contracts

### 3.1 Safe Pure-React Markdown Parser (`SafeMarkdown.tsx`)
- Zero external libraries and zero `dangerouslySetInnerHTML`.
- Fenced code blocks (```` ```lang ... ``` ````) are parsed and passed to `<CodeBlock />`.
- Headings (`#`, `##`, `###`) are rendered as accessible `<h2>`–`<h4>` elements.
- Unordered lists (`- `, `* `) and ordered lists (`1. `) are parsed into semantic `<ul>` and `<ol>`.
- Blockquotes (`> `) are rendered with distinct styling and purple left border.
- Inline formatting tokens (`**bold**`, `*italic*`, `` `inline code` ``, `[label](url)`).
- **Security Invariant**: Link URLs are strictly validated to permit only `https://` and `http://` protocols, completely neutralizing `javascript:` or `data:` attack vectors.

### 3.2 Monospace Code Block (`CodeBlock.tsx`)
- Monospace font (`var(--nr-font-mono)`), subtle dark background, and top header with language label.
- Accessible "Copy" button with clipboard fallback.
- Visual feedback transitioning from "Copy" to "Copied!" with checkmark for 2 seconds.

### 3.3 Dynamic Auto-Growing Composer (`Composer.tsx`)
- Height adjusts automatically between `44px` and `160px` based on content `scrollHeight`.
- **Keyboard Handling**:
  - `Enter` (without Shift): Validates and submits the prompt.
  - `Shift + Enter`: Inserts a newline.
- Client-side validation: Blocks empty/whitespace submissions and enforces maximum character constraint (default 16,000 characters).
- Live character counter and shortcut hints.

### 3.4 Session Management & Prioritization (`useChatStudio.ts`)
- Pinned sessions are always sorted to the top, followed by `updatedAt` descending.
- Search filter enables instant case-insensitive filtering by conversation title.
- **Stale-Request Protection**: Uses an internal request sequence counter (`messageRequestSeqRef`) to discard asynchronous message load results if the user rapidly switches sessions before the network/IPC responds.

### 3.5 Decoupled Prompt Submission Contract
- When the user sends a prompt:
  1. Input is validated.
  2. If no session is active, a new conversation is automatically created.
  3. The prompt is appended to SQLite persistence via `appendChatMessage({ sessionId, sender: "user", content })`.
  4. The local timeline updates immediately.
  5. A typed `SubmitPromptIntent` is emitted:
     ```ts
     export interface SubmitPromptIntent {
       sessionId: string;
       prompt: string;
       timestamp: number;
     }
     ```
  6. The prompt text is cleared from the composer.
- Strictly decoupled: does NOT call cloud providers, does NOT invoke local SLM inference, and does NOT decode SSE streaming chunks. (Reserved for Step 32+).

---

## 4. Test & Verification Summary

- **Frontend Tests**: 290 passed tests across 145 test suites.
- **TypeScript Typecheck**: 0 errors (`tsc --noEmit`).
- **Production Build**: Clean Vite build (`dist/assets/index-*.js`).
- **Logo Size Invariant**: `Nano Route Neon Tech Logo.png` verified at exactly 670,255 bytes.

