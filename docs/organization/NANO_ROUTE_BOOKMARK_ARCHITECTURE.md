# Nano Route — Conversation Organization Architecture Specification
**Step 82 — Authoritative Architecture Specification**

## 1. Subsystem Architecture Overview
Conversation Organization (Bookmarks, Highlights & Notes) provides a metadata layer over Nano Route's conversational workspace without modifying canonical message records:

```text
+-----------------------------------------------------------------------------------+
|                   CONVERSATION ORGANIZATION SUBSYSTEM (STEP 82)                   |
|                                                                                   |
|  [ Canonical Message Turn ] <----+                                                |
|          |                       |                                                |
|          | (ID reference)        |                                                |
|          v                       |                                                |
|  [ Organization Metadata ]       |                                                |
|  - Bookmarks (`conversation_bookmarks`) with labels & categories                  |
|  - Private Notes (`conversation_notes`) for local-only commentary                 |
|  - Visual BookmarkButton in Assistant Message Header                              |
|          |                                                                        |
|          v (Anchor Navigation)                                                    |
|  [ Message Jump & Focus ]                                                         |
|  - Preserves exact session, branch context, and scroll anchor                     |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

## 2. Inviolable Guarantees
1. **Never a Modified Message**: Bookmarks and notes reference `message_id`; the underlying message in `chat_messages` is never modified or duplicated.
2. **Zero Provider Leakage**: Private notes and bookmark labels are NEVER transmitted to external LLM providers, never included in prompt context, and never fed into SLM routing models.
3. **Cascading Integrity**: Deleting a session or message automatically cascades to remove associated bookmarks and notes via foreign keys.

