# Nano Route — Data Flow & Transmission Boundary Policy
**Document Version:** 1.0.0  
**Phase:** Post-Roadmap Product Capability Expansion  
**Status:** Authoritative Policy  
**Date:** 2026-11-15  

---

## 1. Local-First Processing Boundary

Nano Route enforces an absolute local-first architecture:
1. **Interactive Authoring**: Typing in the message composer, switching tabs, viewing templates, modifying workspace profiles, and navigating the application generate **zero external network requests**.
2. **Draft Autosave**: Drafts are committed to local SQLite and session cache. They are never sent to external servers while in a draft state.
3. **Attachment Intake**: Selecting files from disk parses, validates, and token-counts content locally. Files remain under user ownership and are not uploaded upon selection.
4. **Private Notes**: Annotations added to conversation messages remain strictly local in the database. They never enter the request pipeline unless deliberately curated into a Context Collection attached to a request.
5. **Bookmarks & Highlights**: Stored strictly in local SQLite tables (`annotations`).

---

## 2. Remote Transmission Boundary

Data crosses the local machine boundary **only upon explicit user action**:

```
[ Explicit User Request Submission ]
                 │
                 ▼
  ┌────────────────────────────────────────────────────────┐
  │ Outgoing Request Bundle (Encrypted HTTPS)              │
  │ • User Prompt Text                                     │
  │ • Activated Template & Preset Text                     │
  │ • Resolved Excerpts from Active Context Collections    │
  │ • Multimodal Attachment Payloads (if attached)         │
  │ • Provider API Key (Injected into Authorization Header)│
  └────────────────────────┬───────────────────────────────┘
                           │
                           ▼
  ┌────────────────────────────────────────────────────────┐
  │ Designated External AI Provider Endpoint               │
  │ (e.g. Anthropic, OpenAI, OpenRouter, Google, Custom)   │
  │                                                        │
  │ ⚠️ Notice: Once transmitted, data handling is governed │
  │ by that provider's own retention and privacy policies. │
  └────────────────────────────────────────────────────────┘
```

---

## 3. Disclosures by Feature Area

| Feature | Local Behavior | When Transmitted | Remote Destination | Guarantee |
| :--- | :--- | :--- | :--- | :--- |
| **Chat Messages** | Stored in local SQLite database | User clicks Send | Selected Provider | Unsent prompts remain local |
| **Drafts** | Autosaved to local storage | User clicks Send | None while drafting | Drafts never leave the computer |
| **Attachments** | Parsed locally | Request submitted | Selected Provider | Selecting a file does not upload it |
| **Private Notes** | Stored in local SQLite | Injected into collection | None by default | Notes stay local unless explicitly selected |
| **Bookmarks** | Stored in local SQLite | Never | None | Zero network traffic |
| **Context Collections**| Stored in local SQLite | Activated in request | Selected Provider | Storing collections does not transmit data |
| **Credentials** | Encrypted via Windows DPAPI | Sent as HTTP Header | Provider Endpoint | Never written to logs or exported |
| **Telemetry** | Stored in local SQLite | Never | None | Zero prompt content in telemetry |
| **Diagnostics** | Executed locally | User exports file | None by default | Redacted and sanitized |
| **Connectivity** | Local adapter probes | Health check pings | Provider hostnames | Zero user content in reachability probes |

