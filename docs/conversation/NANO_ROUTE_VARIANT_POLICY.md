# Nano Route — Response Variant Policy
**Step 81 — Authoritative Variant Specification**

## 1. Grouping & Indexing
When an assistant response is regenerated for an existing user message:
- The new assistant response is persisted with its own unique `chat_messages.id`.
- A link is registered in `message_response_variants` tracking `user_message_id`, `assistant_message_id`, `variant_index`, and `is_preferred`.
- The user can toggle between response alternatives using the `< 1 / N >` `VariantSwitcher` control on the message bubble.

## 2. Invariants
- Selecting an alternate variant changes which message is considered the preferred ancestor for subsequent turns, without destroying other variants.
- The original response remains safely inspectable at any time.

