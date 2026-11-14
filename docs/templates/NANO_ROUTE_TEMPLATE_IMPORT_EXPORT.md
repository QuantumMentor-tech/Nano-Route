# Nano Route — Prompt Template Import & Export Specification
**Step 77 — Authoritative Data Portability Reference**

## 1. Export Package Structure
Export packages are local JSON payloads strictly isolated from secrets:

```json
{
  "format": "nano-route-templates-v1",
  "version": "1.0.0",
  "exportedAtMs": 1725000000000,
  "templates": [ ... ],
  "presets": [ ... ]
}
```

## 2. Conflict Strategies (Aligned with Step 71)
When importing a template package where IDs collide with existing items:

1. **SKIP**:
   - The colliding incoming item is skipped and retained unchanged in the local store.
2. **OVERWRITE**:
   - The existing local item with the same ID is updated with incoming content, maintaining the ID.
3. **KEEP_BOTH**:
   - The imported item is assigned a new generated ID (`tpl_<timestamp>_<random>`) and a title suffix `(Imported)`, preserving both original and imported copies.

## 3. Secret Sanitization Guarantee
Template and preset exports NEVER include:
- DPAPI ciphertext or decrypted tokens
- Provider API keys (OpenAI, Anthropic, Gemini, Groq, DeepSeek, Mistral)
- User environment variables or auth tokens

