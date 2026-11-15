# Nano Route — Telemetry Privacy & Operational Metadata Policy
**Document Version:** 1.0.0  
**Phase:** Post-Roadmap Product Capability Expansion  
**Status:** Authoritative Policy  
**Date:** 2026-11-15  

---

## 1. Zero Cloud Telemetry Guarantee

Nano Route operates **zero cloud telemetry servers**. No analytical pings, user activity events, or usage metrics are ever transmitted outside the user's personal computer.

All telemetry records are stored in the local SQLite table `telemetry_events`.

---

## 2. Telemetry Schema & Permitted Fields

Telemetry records exclusively capture technical operational metrics required for intelligent routing, budget tracking, and performance optimization:

| Field Category | Recorded Fields | Purpose |
| :--- | :--- | :--- |
| **Identifiers** | `providerId`, `modelId`, `requestId`, `sessionId` | Associating metrics with routing decisions |
| **Performance** | `latencyMs`, `timeToFirstTokenMs`, `durationMs` | Scoring provider responsiveness and routing SLM |
| **Token Counts** | `inputTokens`, `outputTokens`, `totalTokens` | Budget tracking and usage rate limits |
| **Financials** | `estimatedCostUsd` | Budget guardrail enforcement |
| **Outcomes** | `statusCode`, `errorCategory`, `success` | Failover triggering and provider health assessment |

---

## 3. Strict Content Exclusions

Under no circumstances does Nano Route record the following in telemetry:
- ❌ User prompt text or input strings
- ❌ Model completion text or responses
- ❌ Attachment file names or file contents
- ❌ Private notes or bookmark contents
- ❌ Context collection excerpts
- ❌ Provider API keys or authorization headers
- ❌ Windows user account names or sensitive filesystem paths

