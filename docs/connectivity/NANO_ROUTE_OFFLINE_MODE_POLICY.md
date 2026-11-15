# Nano Route — Offline Mode Policy

## 1. Local Sovereignty & Offline Feature Availability
Nano Route is an offline-capable, local-first application. When internet connectivity is severed, the following features remain 100% operational:
- **Local SLM Runtime**: On-device synthetic inference, prompt completion, and intent classification.
- **Chat Studio**: History navigation, branch exploration, session review, and message search.
- **Composer & Drafts**: Prompt composition, autosave, drafts, and undo/redo.
- **Attachments**: Local file parsing, text extraction, token estimation, and context preparation.
- **Context Collections & Reference Packs**: Assembly, editing, and sensitive note filtering.
- **Bookmarks, Highlights & Notes**: Full local organization.
- **Settings & Preferences**: Complete local configuration.
- **Diagnostics & Self-Tests**: Runtime, database, and local SLM benchmarks.
- **Export & Import**: Full data portability and backup/restore.

## 2. Remote Request Protection
When a user attempts to dispatch a prompt to a remote AI provider while offline:
- The request is intercepted gracefully at preflight (`useChatStudio.ts`).
- The composer draft is **preserved** without deletion.
- Attachments remain safely staged in the composer.
- No phantom or broken assistant message is injected into the chat history.
- An informative error message indicates offline status, inviting the user to retry when connectivity returns or switch to Local SLM.

