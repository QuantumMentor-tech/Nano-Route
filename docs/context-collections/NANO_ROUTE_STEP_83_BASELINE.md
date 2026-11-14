# Nano Route — Step 83 Baseline & Architecture Audit

## 1. System Context & Intent
Nano Route Step 83 establishes a secure, local-first Context Collections & Reference Packs subsystem. The objective is to allow users to assemble previously saved conversation artifacts (bookmarked messages, excerpts, user-authorized notes, and attachment contexts) into structured reference packs that can be reviewed, reordered, token-measured, and explicitly inserted into the chat composer.

## 2. Pre-Implementation Audit of Prior Steps
- **Step 76 Context Window Management:** Authoritative token estimation (`estimateTextTokens`), preflight headroom calculations, and context reduction planning. Materialized collections directly feed Step 76 evaluations.
- **Step 75 Budget Guardrails:** Ensures requests incorporating reference packs respect hard/soft monthly spend limits before network dispatch.
- **Step 77 Prompt Templates:** Preserves compatibility with template variable expansion without conflating template placeholders with collection references.
- **Step 78 Composer Drafts:** Draft persistence protects in-progress composition; collection insertion mutates composer drafts non-destructively without auto-submitting.
- **Step 79 Attachments:** Supports incorporating validated text/code representations of local files while respecting size and security boundaries.
- **Step 80 Rich Message Rendering:** Provides message action integration ("Collect" button) for seamless reference capture.
- **Step 81 Conversation Branching:** Preserves branch identifiers in reference records so branch-specific turns are accurately resolved.
- **Step 82 Conversation Organization:** Enables deliberate incorporation of private notes only through explicit user action, with strict sensitivity warnings.

## 3. Strict Non-Goals & Invariants
- **No Automatic Semantic Retrieval / RAG:** Zero vector databases, zero embeddings, zero background indexing.
- **Explicit Context Activation Only:** Stored knowledge never enters a request payload merely because it exists.
- **Zero Automatic Note Inclusion:** Notes are never attached to requests automatically.
- **Immutability of Chat History:** Adding, reordering, or deleting collection references never mutates canonical records in `chat_messages`.

