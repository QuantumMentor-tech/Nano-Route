# Nano Route — Request Inspector Architecture

## 1. Architectural Philosophy
The Request Inspector acts as a transparent pre-flight glass cockpit. It enables users to verify the exact payload composition, context contributions, attachment files, routing decisions, token usage, and budget impacts before any data leaves the local workstation.

## 2. Component Pipeline
```
[User Input in Composer]
       ↓ (Prompt + Attachments + Collections)
[Canonical Request Assembly]
       ↓
[Step 76 Context Preflight] + [Step 75 Budget Preflight]
       ↓
[Request Inspector Snapshot]
       ↓ (User Reviews Details & Warnings)
[Review Complete → Send]
       ↓
[Authoritative Pre-Submit Revalidation]
       ↓ (If Valid & Fresh)
[Authoritative Submission Pipeline (`onSubmit`)]
```

## 3. Core Modules
1. **Engine (`src/features/request-inspector/engine.ts`):** Assembles immutable `CanonicalRequestSnapshot` records and performs pre-submit revalidation.
2. **Types (`src/features/request-inspector/types.ts`):** Defines snapshot schemas, unified warnings, and review contracts.
3. **Inspector Modal (`src/features/request-inspector/components/RequestInspectorModal.tsx`):** Provides a progressive-disclosure review interface (Overview, Prompt, Context, Attachments, Preflight & Budget).
4. **Composer Integration (`Composer.tsx`):** Exposes an "Inspect" button directly in the chat composer bar.

