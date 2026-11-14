# Nano Route — Context Collections Provider & Model Compatibility

## 1. Provider Independence
Context Collections produce normalized text reference packs that are compatible with all registered LLM providers (Anthropic, OpenAI, Groq, Mistral, and local SLMs).

## 2. Multimodal & Capability Constraints
If a collection references local attachment contexts (such as images or specialized files):
- The existing Step 56 Model Capability Registry validates whether the target model supports the required modality.
- If a user manually overrides routing to a text-only model while multimodal references are present, Step 76 preflight flags the capability conflict and prevents submission.

## 3. Context Window Headroom
- Reference packs increase the prompt's input token footprint.
- Step 76 Context Preflight calculates exact input tokens and validates that sufficient headroom remains for model completion tokens within `maxInputTokens` and `contextWindow`.

