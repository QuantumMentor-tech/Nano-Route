# Nano Route — Step 88: Privacy & Data Governance Center Baseline
**Document Version:** 1.0.0  
**Phase:** Post-Roadmap Product Capability Expansion  
**Status:** Authoritative Baseline  
**Date:** 2026-11-15  

---

## 1. Executive Summary & Purpose

The **Privacy & Data Governance Center** consolidates Nano Route's multi-layered privacy, storage, retention, credential protection, telemetry, diagnostics, data export, data reset, attachment handling, context collections, and provider submission policies into a single, cohesive, user-facing transparency surface and control plane.

Nano Route operates as a **local-first application**. User conversations, drafts, attachments, private notes, bookmarks, context collections, routing configurations, and operational records are stored and processed strictly within the boundary of the local device. Data never leaves the local machine unless the user explicitly composes and submits a request to a remote AI provider endpoint (or configures external provider integration).

This baseline documents the existing authoritative systems, data inventory, transmission boundaries, retention models, and explicit architectural non-goals prior to Step 88 implementation.

---

## 2. Existing Authoritative Systems Audit

The Privacy & Data Governance Center acts as a **presentation and navigation plane** over existing authoritative subsystems. It does not introduce duplicate engines or shadow state:

| Subsystem | Authoritative Source | Primary Responsibility in Nano Route | Privacy Center Relationship |
| :--- | :--- | :--- | :--- |
| **Data Lifecycle & Cleanup** | `src/services/ipc/privacy.ts` (Step 45) | Local SQLite data inventory, retention evaluation, dry-run cleanup, and full data wipe | Sources data inventory counts, storage locations, and deletion policies |
| **Security & Privacy Audit** | `src-tauri/src/services/security.rs` (Step 48) | Security boundary verification, DPAPI key protection, secret isolation | Evaluates privacy posture, findings, and secret isolation status |
| **Backup & Recovery** | `src/services/ipc/backup.ts` (Step 53) | SQLite database snapshots, file restoration, migration safety | Discloses backup scope, exclusion of DPAPI secrets from file backups |
| **Diagnostics & Redaction** | `src/features/diagnostics/` (Step 62) | System diagnostics, environment probes, sanitized diagnostic exports | Redaction transparency, local-only diagnostics assurance |
| **Preferences & Settings** | `src/features/settings/` (Step 66) | User application preferences, retention preferences, appearance | Provides navigation to user-controlled retention and storage preferences |
| **Workspace Profiles** | `src/features/profiles/` (Step 67) | Persona and routing configs, profile switching | Verifies exclusion of secrets and personal messages from profile exports |
| **Application Reset** | `src/features/reset/` (Step 69) | Typed reset operations (Preferences, Workspace, Credentials, Full Wipe, Factory) | Discloses reset scopes, confirmation requirements, and deletion reversibility |
| **Data Export** | `src/features/export/` (Step 70) | User-controlled JSON data export with strict secret exclusion | Displays exportable categories vs. strictly excluded sensitive secrets |
| **Data Import** | `src/features/import/` (Step 71) | Untrusted data ingestion, schema validation, conflict resolution | Reminds users that imported content is untrusted and never imports credentials |
| **Integrity Verification** | `src/features/integrity/` (Step 72) | SQLite schema checks, orphan detection, reference validation | Reports data integrity health separately from privacy posture |
| **Data Maintenance** | `src/features/maintenance/` (Step 73) | Vacuuming, index optimization, cache clearing, orphaned asset purge | Discloses routine maintenance effects and disk space reclamation |
| **Credential Lifecycle** | `src/services/ipc/credentials.ts` (Step 74) | Windows DPAPI user-scoped encryption for provider API keys | Explains zero-plaintext storage and DPAPI isolation; never reveals keys |
| **Local Attachments** | `src/features/attachments/` (Step 79) | Local document intake, token estimation, preflight validation | Explains that file intake is local; content is transmitted only on request submit |
| **Bookmarks & Notes** | `src/features/conversation/` (Step 82) | Message bookmarks, highlights, and private notes | Assures users that private notes remain local unless explicitly injected |
| **Context Collections** | `src/features/context-collections/` (Step 83) | Reusable reference packs and excerpt bundles | Clarifies that collections remain local unless activated in a request |
| **Request Inspector** | `src/features/request-inspector/` (Step 84) | Pre-submission payload inspection, token breakdown | Deep-links to inspection so users see exact outgoing bytes before sending |
| **Active Request Center** | `src/features/execution-center/` (Step 85) | In-flight execution monitoring, task cancellation | Explains ephemeral memory residency of active execution state |
| **Connectivity & Health** | `src/features/connectivity/` (Step 86) | Network status, Windows network transitions, provider reachability | Discloses that network probes send zero user content |
| **Provider Compatibility** | `src/features/provider-compatibility/` (Step 87) | Provider/model capabilities, context limits, readiness matrix | Discloses model capability boundaries and external provider destinations |

---

## 3. Data Categories & Sensitivity Classifications

Nano Route manages several distinct categories of data locally. Each category is strictly classified under one of the authoritative sensitivity tiers:

1. **PUBLIC**: Configuration schemas, default model manifests, system prompts, static help documentation.
2. **INTERNAL**: Application state flags, UI layout configurations, window bounds, cached provider capabilities.
3. **USER_CONTENT**: Chat sessions, prompts, responses, drafts, prompt templates, bookmarks, highlights, context collections, and private notes.
4. **SENSITIVE**: File attachment contents, user-authored prompt inputs containing personal or proprietary text, custom endpoint URLs.
5. **SECRET**: Provider API keys, authorization tokens, authentication secrets. Protected exclusively via Windows DPAPI.
6. **OPERATIONAL**: Telemetry logs (token counts, latencies, model IDs, provider errors, timestamps), diagnostic traces, performance metrics.

---

## 4. Local vs. Remote Data Flow Model

The fundamental guarantee of Nano Route is transparent boundary control:

```
[ User Action / File Intake / Note / Draft ]
                   │
                   ▼ (100% Local Processing & SQLite Storage)
  ┌────────────────────────────────────────────────────────┐
  │ Local Boundary: Device Memory & Windows DPAPI / SQLite │
  │ • Drafts saved locally (Auto-save)                     │
  │ • Bookmarks / Highlights indexed locally               │
  │ • Private Notes stored locally (never auto-sent)       │
  │ • Context Collections stored locally                   │
  │ • Attachments parsed & token-counted locally           │
  │ • Credentials protected via Windows DPAPI              │
  │ • Telemetry logged locally (no prompt content)         │
  └────────────────────────────────────────────────────────┘
                   │
                   ▼ (User Clicks "Send" / Submits Request)
  ┌────────────────────────────────────────────────────────┐
  │ External Boundary: Encrypted HTTPS to Selected Provider│
  │ • Active Prompt + Template text                        │
  │ • Injected Context Collection excerpts (if selected)   │
  │ • Attached document content (if attached)              │
  │ • Provider API Key sent in Authorization header        │
  │                                                        │
  │ ⚠️ External provider's privacy/retention policy applies │
  │ once transmitted outside the local machine.            │
  └────────────────────────────────────────────────────────┘
```

---

## 5. Retention & Deletion Semantics

1. **Logical Deletion in SQLite**: Deleting a session, message, note, draft, or attachment removes the record from the active SQLite database and triggers index re-indexing. In accordance with SQLite's architecture and WAL journal mode, deleted database pages are marked for reuse; this does not constitute forensic disk-sector overwrite.
2. **User-Controlled Retention**: By default, user chat history is retained until explicitly deleted. Telemetry logs can be configured for automatic 30-day (or customized) retention cleanup.
3. **Full Wipe & Reset**: Nano Route provides scoped reset options ranging from preference resets to complete local data wipes. Full wipe cleans the SQLite database, purges cached files, and removes all DPAPI-protected credentials.

---

## 6. Secret Isolation & Zero Content in Telemetry

- **API Keys**: Stored exclusively using Windows Data Protection API (DPAPI) tied to the current Windows user login. Keys never appear in plain text in logs, exports, workspace profiles, or diagnostics.
- **Telemetry**: Contains exclusively operational metadata (timestamp, provider identifier, model identifier, prompt/completion token count, request duration, error category, cost estimate). Under no circumstances are user prompts, model responses, attachment text, or private notes recorded in telemetry tables.

---

## 7. Explicit Non-Goals for Step 88

To maintain architectural integrity, Step 88 strictly prohibits:
- Creating a second privacy architecture or shadow data storage.
- Introducing a second credential vault or encryption mechanism.
- Implementing automatic legal or regulatory compliance certification (e.g. GDPR/HIPAA "compliance seals").
- Adding cloud synchronization, VPNs, or proxy anonymization services.
- Automatic secret scanning or heuristic redaction of user prompts.
- Automatic provider routing based on external privacy scores.

