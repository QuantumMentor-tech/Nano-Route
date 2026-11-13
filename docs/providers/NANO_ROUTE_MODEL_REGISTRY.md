# Nano Route Model Registry Architecture & Capability Contracts (Step 56)

## 1. Registry Architecture

The Model Registry in Nano Route is immutable at compile time and exposed dynamically via IPC:
- **Rust Core**: Defined in `src-tauri/src/providers/catalog.rs` and managed by `ProviderRegistry`.
- **Frontend Bridge**: Cached and queried via `src/services/ipc/registry.ts`.

---

## 2. Capability Definitions

Models declare factual capabilities using the bitflag/enum system (`ProviderCapability`):

| Capability Flag | Description | Models Supporting |
|---|---|---|
| `TextGeneration` | Fundamental prompt-to-text generation | All models |
| `Streaming` | Token-by-token SSE streaming delivery | All models |
| `Vision` / `ImageInput` | Multimodal image understanding and OCR | `gpt-4o`, `claude-3-5-sonnet`, `gemini-1.5-pro` |
| `AudioInput` | Direct audio token comprehension | `gemini-1.5-pro`, `gemini-1.5-flash` |
| `ToolCalling` | Structured function calling & tool use | `gpt-4o`, `claude-3-5-sonnet`, `gemini-1.5-pro`, `deepseek-chat` |
| `StructuredOutput` | JSON schema enforcement on output | `gpt-4o`, `o1`, `claude-3-5-sonnet`, `gemini-1.5-pro`, `deepseek-chat` |
| `Reasoning` | Native chain-of-thought tokens / reasoning | `o1`, `o3-mini`, `deepseek-reasoner` |
| `LargeContext` | Context windows >= 64,000 tokens | All frontier models (up to 2M in Gemini) |
| `CodeGeneration` | Specialized training on coding benchmarks | All coding-tier models |

---

## 3. Capability Enforcement Invariant

Before submitting any chat prompt:
1. The routing engine verifies that the candidate model declares all required capabilities identified by the Task Analyzer and Intent Classifier.
2. If a manual route override requests a capability that the target model lacks (e.g. asking a pure text model to inspect an image), the override is safely rejected with an explicit validation error rather than failing remotely at the provider endpoint.

