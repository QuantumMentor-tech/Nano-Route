# Nano Route — Compatibility Test Matrix

## 1. Test Coverage Overview
The Compatibility Center test suite (`src/features/provider-compatibility/__tests__/providerCompatibility.test.ts`) verifies operational and safety guarantees:

| Test Case | Scope | Expected Outcome | Status |
| :--- | :--- | :--- | :--- |
| **Catalog Normalization** | Providers and models loading | Normalizes canonical providers with active readiness states | PASS |
| **Capability Extraction** | Registered modalities | `image` extracted only when `vision` or `image_input` is present; text always present | PASS |
| **Standard Text Eligibility** | Text prompt on text models | Eligible with verification reason | PASS |
| **Image Incompatibility** | Image request on text model | Marked ineligible: *"Request contains image attachments, but this model only supports text."* | PASS |
| **Context Window Overflow** | 160K tokens on 128K model | Marked ineligible: exceeds context window. 2M Gemini model remains eligible | PASS |
| **Offline Invalidation** | Network state `OFFLINE` | Remote models marked ineligible; Local SLM remains eligible | PASS |
| **Search & Filtering** | Search and modality filters | Matches exact substrings; filters vision models accurately | PASS |
| **Model Comparison** | Up to 4 models compared | Returns structured comparison table across context, output, modalities, cost | PASS |
| **Secret Protection** | Serialized snapshot audit | Zero API keys, `sk-`, `Bearer `, or DPAPI ciphertext exposed | PASS |

