# Nano Route — Context Error Normalization Model

**Document Version:** 1.0.0  
**Status:** Authoritative  
**Step:** 76 — Context Window Management, Prompt Size Guardrails, Token Budgeting, Request Preflight & Safe Context Optimization  
**Subsystems:** Error Normalizer, Diagnostics, UI Feedback  

---

## 1. Normalized Error Codes

Nano Route maps heterogeneous upstream vendor error formats into standard, actionable error categories:

```typescript
export type ContextErrorCode =
  | "CONTEXT_LIMIT_EXCEEDED"        // Combined prompt + completion tokens exceed context window
  | "INPUT_TOKEN_LIMIT"             // Input prompt alone exceeds model maxInputTokens
  | "OUTPUT_TOKEN_LIMIT"            // User requested output tokens > model ceiling
  | "REQUEST_TOO_LARGE"             // Serialized HTTP body exceeds provider payload limit (HTTP 413)
  | "TOKEN_ESTIMATION_UNAVAILABLE"  // Local tokenization failed
  | "CONTEXT_LIMIT_UNKNOWN";        // Model limit cannot be verified
```

---

## 2. Actionable Remediation Guidelines

Every context error returned to the UI is accompanied by concrete remediation options:
1. **Switch Model**: Direct the user to higher-capacity alternatives (e.g. Gemini 1.5 Pro, Claude 3.5 Sonnet).
2. **Recent Messages**: Allow immediate transmission of the most recent conversation turns without losing chat history.
3. **Start New Chat**: Provide one-click access to open a fresh conversation thread.
4. **Non-Retryable Invariant**: Blind retries are strictly prohibited for context limit errors, as sending identical prompts will predictably yield the same failure.

