# NANO ROUTE — PROVIDER & ADAPTER CAPABILITY MATRIX
## Factual Execution Status as of Step 25

**Document Version:** 1.0.0  
**Phase:** 5 (Provider Layer)  
**Status:** Authoritative  
**Rule:** Every entry in this matrix answers **"Can Nano Route execute this capability today?"** rather than what remote provider documentation advertises.

---

## 1. Provider Adapter Capability Matrix

| Provider | Canonical ID | Text Generation | Streaming SSE | Multi-turn Chat | System Messages | Tool / Function Calling | Vision / Image Input | Audio Input | Web Grounding | Embeddings |
|---|---|---|---|---|---|---|---|---|---|---|
| **OpenAI** | `openai` | **Implemented** | **Implemented** | **Implemented** | **Implemented** | *Planned (Step 31+)* | *Planned* | *Planned* | *Planned* | *Planned* |
| **Anthropic** | `anthropic` | **Implemented** | **Implemented** | **Implemented** | **Implemented** | *Planned (Step 31+)* | *Planned* | *Planned* | *Planned* | *Planned* |
| **Google Gemini** | `gemini` | **Implemented** | **Implemented** | **Implemented** | **Implemented** | *Planned (Step 31+)* | *Planned* | *Planned* | *Planned* | *Planned* |
| **DeepSeek** | `deepseek` | **Implemented** | **Implemented** | **Implemented** | **Implemented** | *Planned (Step 31+)* | *Unsupported* | *Unsupported* | *Unsupported* | *Planned* |
| **Groq** | `groq` | **Implemented** | **Implemented** | **Implemented** | **Implemented** | *Planned (Step 31+)* | *Planned* | *Unsupported* | *Unsupported* | *Planned* |
| **Mistral AI** | `mistral` | **Implemented** | **Implemented** | **Implemented** | **Implemented** | *Planned (Step 31+)* | *Planned* | *Unsupported* | *Unsupported* | *Planned* |
| **Local SLM / Ollama** | `local` | *Planned (Step 26)* | *Planned (Step 26)* | *Planned (Step 26)* | *Planned (Step 26)* | *Planned* | *Planned* | *Unsupported* | *Unsupported* | *Planned* |

---

## 2. Model Catalog Context Ceilings & Features

| Provider | Model ID | Display Name | Context Window | Max Output Tokens | Availability | Implemented in Nano Route |
|---|---|---|---|---|---|---|
| **OpenAI** | `gpt-4o` | GPT-4o | 128,000 | 4,096 | Available | Yes (Text / Stream) |
| **OpenAI** | `gpt-4o-mini` | GPT-4o mini | 128,000 | 16,384 | Available | Yes (Text / Stream) |
| **OpenAI** | `o1` | o1 Reasoning | 200,000 | 100,000 | Available | Yes (Text / Stream) |
| **Anthropic** | `claude-3-5-sonnet-20241022` | Claude 3.5 Sonnet | 200,000 | 8,192 | Available | Yes (Text / Stream) |
| **Anthropic** | `claude-3-5-haiku-20241022` | Claude 3.5 Haiku | 200,000 | 8,192 | Available | Yes (Text / Stream) |
| **Anthropic** | `claude-3-opus-20240229` | Claude 3 Opus | 200,000 | 4,096 | Available | Yes (Text / Stream) |
| **Google Gemini** | `gemini-1.5-pro` | Gemini 1.5 Pro | 2,000,000 | 8,192 | Available | Yes (Text / Stream) |
| **Google Gemini** | `gemini-1.5-flash` | Gemini 1.5 Flash | 1,000,000 | 8,192 | Available | Yes (Text / Stream) |
| **Google Gemini** | `gemini-2.0-flash-exp` | Gemini 2.0 Flash (Exp) | 1,000,000 | 8,192 | Preview | Yes (Text / Stream) |
| **DeepSeek** | `deepseek-chat` | DeepSeek-V3 | 64,000 | 8,192 | Available | Yes (Text / Stream) |
| **DeepSeek** | `deepseek-reasoner` | DeepSeek-R1 | 64,000 | 8,192 | Available | Yes (Text / Stream) |
| **Groq** | `llama-3.3-70b-versatile` | Llama 3.3 70B (Groq) | 128,000 | 32,768 | Available | Yes (Text / Stream) |
| **Groq** | `llama-3.1-8b-instant` | Llama 3.1 8B (Groq) | 128,000 | 8,192 | Available | Yes (Text / Stream) |
| **Mistral AI** | `mistral-large-latest` | Mistral Large | 128,000 | 8,192 | Available | Yes (Text / Stream) |
| **Mistral AI** | `mistral-small-latest` | Mistral Small | 32,000 | 8,192 | Available | Yes (Text / Stream) |
| **Mistral AI** | `codestral-latest` | Codestral | 256,000 | 8,192 | Available | Yes (Text / Stream) |

---

## 3. Preflight Capability Rejection Policy

When a request specifies requirements:
1. If the request requires `ToolCalling`, `Vision`, `AudioInput`, or `Embeddings`, Nano Route's `PreflightEvaluator` immediately blocks the request locally with:
   ```json
   {
     "allowed": false,
     "block_reason": "capability_unsupported",
     "message": "Missing capabilities: [\"ToolCalling\"]"
   }
   ```
2. If `required_context_tokens` exceeds the model's `context_window`, `PreflightEvaluator` immediately blocks with:
   ```json
   {
     "allowed": false,
     "block_reason": "context_length_exceeded"
   }
   ```
3. Neither condition causes network traffic or counts as a provider outage.

