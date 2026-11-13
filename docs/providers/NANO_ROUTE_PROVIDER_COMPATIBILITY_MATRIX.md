# Nano Route Frontier Provider & Model Registry Compatibility Matrix (Step 56)

## 1. Implemented Provider Ecosystem

Nano Route integrates 6 frontier cloud providers plus the local SLM subsystem via a unified, capability-driven `ProviderClient` trait architecture.

| Provider ID | Display Name | Native Client Module | Authentication Strategy | Default Endpoint | Streaming Format | Usage Tracking | Implemented State |
|---|---|---|---|---|---|---|:---:|
| `openai` | OpenAI | `providers::openai` | Bearer Token (`Authorization: Bearer <KEY>`) | `https://api.openai.com/v1` | SSE (`data: {"choices":[{"delta":{"content":"..."}}]}`) | `usage` (prompt/completion tokens) | **Active / Implemented** |
| `anthropic` | Anthropic | `providers::anthropic` | Header (`x-api-key: <KEY>`), `anthropic-version: 2023-06-01` | `https://api.anthropic.com` | SSE (`content_block_delta`, `message_delta`) | `usage` in message delta | **Active / Implemented** |
| `gemini` | Google Gemini | `providers::gemini` | Header (`x-goog-api-key: <KEY>`) or URL param | `https://generativelanguage.googleapis.com` | SSE (`server-sent events`) / chunked JSON | `usageMetadata` (promptTokenCount, candidatesTokenCount) | **Active / Implemented** |
| `deepseek` | DeepSeek | `providers::deepseek` | Bearer Token (`Authorization: Bearer <KEY>`) | `https://api.deepseek.com` | OpenAI-compatible SSE | `usage` in completion chunk | **Active / Implemented** |
| `groq` | Groq | `providers::groq` | Bearer Token (`Authorization: Bearer <KEY>`) | `https://api.groq.com/openai/v1` | OpenAI-compatible SSE | `x_groq.usage` / standard `usage` | **Active / Implemented** |
| `mistral` | Mistral AI | `providers::mistral` | Bearer Token (`Authorization: Bearer <KEY>`) | `https://api.mistral.ai/v1` | OpenAI-compatible SSE | `usage` in completion chunk | **Active / Implemented** |

---

## 2. Canonical Model Registry & Capabilities

### OpenAI (`openai`)
- `gpt-4o`: 128k context, multimodal (text/vision), code generation, tool calling.
- `gpt-4o-mini`: 128k context, high speed, cost-effective.
- `o1`: 200k context, deep chain-of-thought reasoning.
- `o3-mini`: 200k context, STEM/coding-optimized reasoning.

### Anthropic (`anthropic`)
- `claude-3-5-sonnet-20241022`: 200k context, state-of-the-art coding and complex analysis.
- `claude-3-5-haiku-20241022`: 200k context, low-latency execution.
- `claude-3-opus-20240229`: 200k context, foundational research and creative tasks.

### Google Gemini (`gemini`)
- `gemini-1.5-pro`: 2,000,000 token context window, audio/video/document multimodal comprehension.
- `gemini-1.5-flash`: 1,000,000 token context window, high-throughput lightweight inference.
- `gemini-2.0-flash-exp`: 1,000,000 token context, experimental next-gen multimodal reasoning.

### DeepSeek (`deepseek`)
- `deepseek-chat` (DeepSeek-V3): 64k context, multi-task general programming and conversation.
- `deepseek-reasoner` (DeepSeek-R1): 64k context, open reasoning with transparent CoT tokens.

### Groq (`groq`)
- `llama-3.3-70b-versatile`: 128k context, ultra-high tokens-per-second streaming on Groq LPUs.
- `llama-3.1-8b-instant`: 128k context, sub-second latency for classification and routing.

### Mistral AI (`mistral`)
- `mistral-large-latest`: 128k context, premier reasoning and multilingual mastery.
- `mistral-small-latest`: 32k context, efficient everyday coding and conversation.
- `codestral-latest`: 256k context, purpose-built code generation and fill-in-the-middle completion.

