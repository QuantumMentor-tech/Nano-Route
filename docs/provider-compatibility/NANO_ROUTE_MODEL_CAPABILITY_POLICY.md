# Nano Route — Model Capability Policy

## 1. Capability Extraction & Provenance
Model capabilities must be sourced exclusively from registered, contract-verified capability flags (`capabilities.capabilities` in `ModelDescriptorDto`):
- `text`: Supported if `text_generation` is declared.
- `image`: Supported if `vision` or `image_input` is declared in registered capabilities.
- `audio`: Supported if `audio_input` is declared.
- `file`: Supported locally via Step 79 file context preparation.
- `streaming`: Supported if `streaming` is declared.
- `tool_calling`: Supported if `tool_calling` is declared.
- `structured_output`: Supported if `structured_output` is declared.

## 2. Prohibition on Name-Based Inference
The Compatibility Center strictly forbids deriving capabilities from model strings. For instance:
- Searching for `"vision"` in `modelId` or `displayName` is **forbidden**.
- Searching for `"turbo"`, `"mini"`, or `"chat"` to assume speed or streaming support is **forbidden**.
- All feature flags must be backed by explicit registry metadata.

## 3. Unknown vs. Unsupported Capabilities
- If a capability is not explicitly documented or tested in the registry, it is classified as `UNKNOWN` or omitted from supported modalities.
- Unknown capability is never assumed to be supported.
- Unknown capability does not immediately block requests if the runtime provider contract can safely resolve it at submission time.

