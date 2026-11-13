# Nano Route First-Run Experience & Guided Onboarding Architecture

## 1. Executive Summary & Design Principle
The First-Run Experience (Step 61) provides a deterministic, guided onboarding workflow that introduces new users to Nano Route without duplicating or bypassing any existing production subsystems. 

### Core Architectural Principle
> **Guided presentation and orchestration layer over existing capabilities, not a replacement.**

Onboarding consumes the existing authoritative services:
- **Provider & Model Catalog:** Consumes `src/services/ipc/registry.ts`.
- **Credential Storage:** Consumes `src/services/ipc/credentials.ts` (Windows DPAPI Vault).
- **Application Preferences:** Consumes `src/services/ipc/settings.ts`.
- **Local SLM Engine:** Consumes `src/services/ipc/local_slm.ts`.
- **Diagnostic Probes:** Consumes `src/services/ipc/provider_health.ts`.
- **Accessibility:** Adheres to WCAG 2.1 AA standards and Step 60 focus management rules.

---

## 2. Onboarding Lifecycle & First-Run Detection

```
               [ Launch Application ]
                         │
                         ▼
        ┌──────────────────────────────────┐
        │ Has Existing History or Secrets? │
        └──────────────────────────────────┘
                 │                │
            Yes  │                │ No
                 ▼                ▼
        ┌────────────────┐   ┌───────────────────────────┐
        │ Bypass Guided  │   │ Check Onboarding Storage  │
        │ Onboarding     │   │ Key (nr_onboarding_v1)    │
        └────────────────┘   └───────────────────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │ State: NOT_STARTED        │
                        │ -> Auto-open Guided Modal │
                        └───────────────────────────┘
```

1. **Non-Intrusive Invariant:** Users with existing chat history, saved DPAPI keys, or marked completion are never trapped in onboarding.
2. **Re-entrant Design:** Users can re-launch the Guided Setup at any time from the Dashboard header ("Setup Guide" button) or Settings workspace.

---

## 3. Step Sequence & Screen Breakdown

| Screen # | Step Identifier | User Objective | Underwriting Service | Optional? |
|:---|:---|:---|:---|:---|
| **Screen 1** | `welcome` | Understand Nano Route hybrid routing concept and local-first privacy. | Core Application State | No |
| **Screen 2** | `system_readiness` | Verify runtime health across SQLite, SLM, DPAPI, and Model Registry. | `evaluateSystemReadiness()` | No |
| **Screen 3** | `local_slm` | Review on-device Llama 3.2 SLM role in zero-latency prompt evaluation. | `getLocalRuntimeStatus()` | No |
| **Screen 4** | `provider_setup` | Configure frontier model API keys (OpenAI, Anthropic, Gemini, Groq, etc.). | `saveProviderCredential()` | **Yes (Skippable)** |
| **Screen 5** | `model_readiness` | Review authoritative model catalog, context limits, and cost metrics. | `listRegisteredModels()` | **Yes (Skippable)** |
| **Screen 6** | `routing_readiness` | Understand multi-factor routing policies (Balanced vs Manual override). | `getAppSettings()` | **Yes (Skippable)** |
| **Screen 7** | `test_readiness` | Optional explicit network probe to verify provider endpoint responsiveness. | `checkProviderHealth()` | No |
| **Screen 8** | `complete` | Review setup summary and proceed into Chat Studio or Settings. | `markOnboardingCompleted()` | No |

---

## 4. Security & Privacy Boundaries
- **Zero Plaintext Secrets in Storage:** The onboarding progress record (`nr_onboarding_progress_v1`) stores only step numbers, state enums, and timestamps.
- **DPAPI Credential Isolation:** Any API key entered during Step 4 is encrypted immediately via native Windows DPAPI (`CryptProtectData`). The React state is wiped immediately following the IPC call.
- **Zero Hidden Telemetry:** Onboarding does not transmit beacons, pings, or analytics to external servers.
- **Explicit Network Operations:** Screen 7 (Test Readiness) does not execute automatic network requests; health probes are user-initiated and clearly state that an outbound HTTPS request is being made.

