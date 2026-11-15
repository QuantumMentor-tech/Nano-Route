# Nano Route — Request Eligibility Explanation Policy

## 1. Request-Specific Evaluation
The Compatibility Center evaluates model eligibility dynamically against the specific requirements of the active prompt, attachments, and routing preferences:

```text
Request Requirements:
  ├── Estimated Prompt Tokens
  ├── Image Input Needed (Attachments)
  ├── Streaming Requested
  ├── Tool / Function Calling Needed
  └── Requested Max Output Tokens
```

## 2. Plain-Language Explanation Standards
Explanations must be plain, actionable, and free from internal code references:

- **Modality Incompatibility**:
  *"Request contains image attachments, but this model only supports text."*
- **Context Window Overflow**:
  *"Prompt size (150,000 tokens) exceeds model context window (128,000 tokens)."*
- **Output Capacity Exceeded**:
  *"Requested output (16,000 tokens) exceeds maximum generation limit (4,096 tokens)."*
- **Network Offline**:
  *"Provider endpoint is unreachable or application network is offline."*
- **Credential Missing**:
  *"API key is not configured in Provider Settings."*
- **Authentication Failure**:
  *"Provider authentication failed. Update API key in Provider Settings."*
- **Budget Guardrail**:
  *"Request is blocked by local monthly budget limit guardrail."*
- **Fully Eligible**:
  *"All capabilities, context window bounds, credentials, and network connectivity are verified."*

