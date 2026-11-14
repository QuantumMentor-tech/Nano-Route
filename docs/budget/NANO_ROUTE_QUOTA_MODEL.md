# Nano Route — Provider Quota Model & Staleness Policy

**Document Version:** 1.0.0  
**Status:** Authoritative  
**Step:** 75 — Provider Budget Controls, Quota Awareness, Spend Guardrails, Usage Limits & Cost-Safe Request Enforcement  
**Subsystems:** Provider Integration, Telemetry, Cache Management  

---

## 1. Provider Quota vs Local Budget

Nano Route strictly differentiates:
- **Local Budget**: A ceiling set by the desktop user inside Nano Route.
- **Provider Quota**: The remaining balance, rate limit ceiling, or spend allowance granted by the cloud vendor on their billing servers.

---

## 2. Quota Information Data Model

```typescript
export interface ProviderQuotaInfo {
  providerId: string;
  source: QuotaSource;           // "PROVIDER_REPORTED" | "LOCAL_HEURISTIC" | "UNSPECIFIED"
  quotaLimitUsd: number | null;
  quotaRemainingUsd: number | null;
  quotaRemainingTokens: number | null;
  resetAtMs: number | null;
  reportedAtMs: number;
  isStale: boolean;
  rawHeaderSnapshot?: Record<string, string>;
}
```

---

## 3. Staleness Evaluation Rules

Provider quota headers (such as `x-ratelimit-remaining-tokens`, `anthropic-ratelimit-requests-remaining`, or balance endpoints) are snapshot observations. They become stale quickly due to out-of-band usage (e.g., curls, web UI, other tools).

A quota record is evaluated as **`isStale = true`** if:
1. Current timestamp $\ge$ `resetAtMs` (the reported reset window has expired).
2. Or elapsed time since `reportedAtMs` exceeds $3,600,000\text{ ms}$ (1 hour) when `resetAtMs` is absent.

Stale quota metadata is clearly marked with a warning indicator in the UI to prevent users from making financial decisions based on outdated information.

