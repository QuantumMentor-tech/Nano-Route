# Nano Route — Context Limit Model

**Document Version:** 1.0.0  
**Status:** Authoritative  
**Step:** 76 — Context Window Management, Prompt Size Guardrails, Token Budgeting, Request Preflight & Safe Context Optimization  
**Subsystems:** Model Registry, Provider Integration, Context Engine  

---

## 1. Context Constraints Data Model

```typescript
export interface ModelContextLimits {
  providerId: string;
  modelId: string;
  displayName: string;
  contextWindow: number;         // Total capacity in tokens
  maxInputTokens: number;        // Maximum allowed in prompt + history
  maxOutputTokens: number;       // Maximum generation ceiling
  combinedLimit: boolean;        // Whether input + output share contextWindow
  source: ContextLimitSource;    // "REGISTRY" | "PROVIDER_REPORTED" | "REQUEST_VALIDATED" | "UNKNOWN" | "STALE"
  confidence: ContextLimitConfidence; // "AUTHORITATIVE" | "DERIVED" | "UNVERIFIED" | "UNKNOWN"
  lastVerifiedAtMs: number;
}
```

---

## 2. Authoritative Provider & Model Context Catalog

| Provider | Model ID | Display Name | Context Window | Max Input Tokens | Max Output Tokens | Source | Confidence |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| `openai` | `gpt-4o` | GPT-4o | 128,000 | 128,000 | 4,096 | `REGISTRY` | `AUTHORITATIVE` |
| `openai` | `gpt-4o-mini` | GPT-4o mini | 128,000 | 128,000 | 16,384 | `REGISTRY` | `AUTHORITATIVE` |
| `openai` | `o1` | OpenAI o1 | 200,000 | 200,000 | 100,000 | `REGISTRY` | `AUTHORITATIVE` |
| `openai` | `o3-mini` | OpenAI o3-mini | 200,000 | 200,000 | 100,000 | `REGISTRY` | `AUTHORITATIVE` |
| `anthropic` | `claude-3-5-sonnet-20241022` | Claude 3.5 Sonnet | 200,000 | 200,000 | 8,192 | `REGISTRY` | `AUTHORITATIVE` |
| `anthropic` | `claude-3-5-haiku-20241022` | Claude 3.5 Haiku | 200,000 | 200,000 | 8,192 | `REGISTRY` | `AUTHORITATIVE` |
| `anthropic` | `claude-3-opus-20240229` | Claude 3 Opus | 200,000 | 200,000 | 4,096 | `REGISTRY` | `AUTHORITATIVE` |
| `gemini` | `gemini-1.5-pro` | Gemini 1.5 Pro | 2,000,000 | 2,000,000 | 8,192 | `REGISTRY` | `AUTHORITATIVE` |
| `gemini` | `gemini-1.5-flash` | Gemini 1.5 Flash | 1,000,000 | 1,000,000 | 8,192 | `REGISTRY` | `AUTHORITATIVE` |
| `gemini` | `gemini-2.0-flash-exp` | Gemini 2.0 Flash | 1,000,000 | 1,000,000 | 8,192 | `REGISTRY` | `AUTHORITATIVE` |
| `deepseek` | `deepseek-chat` | DeepSeek-V3 | 64,000 | 64,000 | 8,192 | `REGISTRY` | `AUTHORITATIVE` |
| `deepseek` | `deepseek-reasoner` | DeepSeek-R1 | 64,000 | 64,000 | 8,192 | `REGISTRY` | `AUTHORITATIVE` |
| `groq` | `llama-3.3-70b-versatile` | Llama 3.3 70B (Groq) | 128,000 | 128,000 | 32,768 | `REGISTRY` | `AUTHORITATIVE` |
| `groq` | `llama-3.1-8b-instant` | Llama 3.1 8B (Groq) | 128,000 | 128,000 | 8,192 | `REGISTRY` | `AUTHORITATIVE` |
| `mistral` | `mistral-large-latest` | Mistral Large | 128,000 | 128,000 | 8,192 | `REGISTRY` | `AUTHORITATIVE` |
| `mistral` | `mistral-small-latest` | Mistral Small | 32,000 | 32,000 | 8,192 | `REGISTRY` | `AUTHORITATIVE` |
| `mistral` | `codestral-latest` | Codestral | 256,000 | 256,000 | 8,192 | `REGISTRY` | `AUTHORITATIVE` |
| `local` | `llama3.2:3b` | Llama 3.2 3B (Local SLM) | 8,192 | 8,192 | 4,096 | `REGISTRY` | `AUTHORITATIVE` |

---

## 3. Uncatalogued Model Policy

When an unknown or custom model is selected:
- Nano Route explicitly emits `contextWindow: 0`, `source: "UNKNOWN"`, and `confidence: "UNKNOWN"`.
- It does **not** assume an arbitrary default limit.
- Outbound requests proceed with safe non-blocking warnings, delegating enforcement to provider-side validation.

