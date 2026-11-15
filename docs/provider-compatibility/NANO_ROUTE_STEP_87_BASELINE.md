# Nano Route — Step 87 Baseline

## 1. Executive Summary & Existing Subsystem Audit
Nano Route has established authoritative, domain-segregated native and frontend subsystems across:
- **Provider & Model Registry (Step 21 / Step 56)**: Canonical catalog of registered providers (`openai`, `anthropic`, `gemini`, `deepseek`, `groq`, `mistral`, `local`, `custom`) and model descriptors containing context windows, output limits, pricing, and capability tags.
- **Provider Health & Capability (Step 25 / Step 56)**: Dynamic runtime health states (`ready`, `rate_limited`, `authentication_failed`, `provider_unavailable`), effective capabilities query, and preflight evaluation.
- **Provider Management & Settings (Step 46 / Step 74)**: Windows DPAPI credential vault, priority weights, base URLs, and active/disabled switches.
- **Budget Guardrails (Step 75)**: UTC calendar month spend derivation from telemetry records, soft/hard budget policies, and quota monitoring.
- **Context Management (Step 76)**: Token estimation, combined context limits, max output limits, and non-destructive context reduction planning.
- **Attachments (Step 79)**: Multimodal categorization (images, documents, text files, structured code) and token budgeting.
- **Request Inspector (Step 84)**: Canonical request snapshot assembly and unified warning synthesis.
- **Active Request Center (Step 85)**: Execution lifecycle monitoring and cooperative cancellation.
- **Connectivity & Network Health (Step 86)**: Local network state observation, flap stabilization, decoupled provider reachability, and offline protection.

### Problem Statement Prior to Step 87
Prior to Step 87, these disparate sources of truth were scattered across distinct engine modules. Users, operators, and developers had no consolidated, single-pane-of-glass interface to inspect:
- Which providers and models are configured and enabled?
- Which are currently reachable over the network vs. offline?
- Which credentials are valid vs. missing or unauthorized?
- What exact modalities and limits (context, output, images, tools) does each model support?
- Why is a specific model eligible or ineligible for a particular prompt or attachment mix?

---

## 2. Core Architectural Principles for Step 87
1. **Authoritative Synthesis, Zero Heuristic Invention**: The Compatibility Center is strictly a read-only presentation and evaluation layer. It consumes authoritative state directly from Step 21/56 (Registry), Step 25/56 (Health), Step 46/74 (Credentials), Step 86 (Connectivity), Step 75 (Budget), Step 76 (Context), and Step 79 (Attachments).
2. **Never Infer Capabilities from Model Names**: No string parsing of model names (e.g. searching for `"vision"` or `"turbo"`). Modalities and features are sourced exclusively from registered capability sets.
3. **No Second Routing Engine**: The center provides human-readable facts and request eligibility diagnostics. It does **not** rank models, select providers automatically, or override Step 29/30 routing policy.
4. **No Hidden Provider Execution or Billing**: Merely opening the Compatibility Center or browsing model cards executes zero billable inference requests, transmits zero user prompts, and performs zero unsolicited network probes.
5. **Clear Component Decomposition**: Readiness is presented as a composition of discrete authorities:
   - `Registry`: Is the model descriptor active, current, or deprecated?
   - `Credential`: Is an API key configured and active in the DPAPI vault?
   - `Connectivity`: Is the remote endpoint reachable over the local network?
   - `Health`: Is the provider runtime ready or encountering rate limits/outages?
   - `Capability`: Does the model support the requested modalities (e.g. images, streaming)?
   - `Context`: Does the prompt fit within the model's context window?
   - `Budget`: Does the monthly spend policy permit this request?
6. **Zero Plaintext Secret Exposure**: API keys, DPAPI blobs, authorization headers, and credential fragments are never displayed, logged, or serialized into compatibility snapshots.

---

## 3. Explicit Non-Goals
- No new routing algorithms or provider ranking systems.
- No automatic model or provider selection.
- No automatic model installation or external model-download systems.
- No external price-scraping from third-party websites.
- No remote benchmark testing or synthetic billable test generations.
- No continuous high-frequency provider health polling.
- No automatic credential discovery or rotation.

