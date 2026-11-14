# Nano Route — Provider Context Compatibility

**Document Version:** 1.0.0  
**Status:** Authoritative  
**Step:** 76 — Context Window Management, Prompt Size Guardrails, Token Budgeting, Request Preflight & Safe Context Optimization  
**Subsystems:** Provider Adapters, Tokenizer Compatibility, Error Handling  

---

## 1. Provider Context Semantics

Different frontier providers enforce context limits differently:

1. **OpenAI (`openai`)**: Enforces combined prompt + completion limits. Returns HTTP 400 with code `context_length_exceeded`.
2. **Anthropic (`anthropic`)**: Enforces 200k input window with strict 4k/8k max completion caps. Returns HTTP 400 with message `"prompt is too long"`.
3. **Google Gemini (`gemini`)**: Massive context windows (up to 2M tokens). Rejections occur via `RESOURCE_EXHAUSTED` or HTTP 400 with `token count exceeds limit`.
4. **DeepSeek (`deepseek`)**: 64k window. Returns OpenAI-compatible context error messages.
5. **Groq (`groq`)**: Extremely fast LPU inference, 128k context with generous 32k completion ceiling. Returns HTTP 400 or HTTP 413.
6. **Mistral AI (`mistral`)**: Models range from 32k to 256k tokens. Returns standard completion length error bodies.
7. **Local SLM (`local`)**: 8,192 token window running on ONNX Runtime DirectML.

---

## 2. Shared Canonical Token Count Integration

Nano Route guarantees that:
- Step 75 **Budget Preflight** and Step 76 **Context Preflight** consume the identical canonical token estimation.
- Once an outbound request finishes streaming, exact provider-reported token usage (from `usage` or `usageMetadata`) supersedes preflight approximations in Step 43 telemetry records.

