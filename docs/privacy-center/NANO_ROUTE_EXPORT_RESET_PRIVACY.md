# Nano Route — Export, Import, Reset & Wipe Privacy Specifications
**Document Version:** 1.0.0  
**Phase:** Post-Roadmap Product Capability Expansion  
**Status:** Authoritative Specification  
**Date:** 2026-11-15  

---

## 1. Data Export Boundary (Step 70 Parity)

The user maintains full sovereignty over their data. Nano Route provides structured JSON export capabilities:

### 1.1 Exportable Categories
- Chat Sessions & Message Histories
- Composer Drafts
- Prompt Templates & Request Presets
- Bookmarks & Text Highlights
- Private Conversation Notes
- Context Collections & Reference Packs
- UI Preferences & Non-sensitive Settings
- Operational Telemetry Records (Optional selection)

### 1.2 Strictly Excluded from Exports
- ❌ Provider API Keys & DPAPI Secret Blobs
- ❌ Live In-Flight Task Execution Tokens
- ❌ Encryption Master Salts
- ❌ Local Windows User Identifiers

---

## 2. Untrusted Data Ingestion (Step 71 Parity)

Data imported into Nano Route from external JSON archives is treated as **untrusted user data**:
1. Schemas are strictly validated before insertion.
2. Credentials and API keys are **never imported**.
3. Imported context or notes do not trigger network transmissions to AI providers.

---

## 3. Scoped Reset & Wipe Operations (Step 69 Parity)

Nano Route supports deterministic, non-conflated reset scopes:

| Reset Scope | What is Removed | What Remains | Confirmation Required | Reversible |
| :--- | :--- | :--- | :--- | :--- |
| `RESET_PREFERENCES` | UI theme, layout, font sizes | Conversations, keys, routing | No | No |
| `RESET_WORKSPACE` | Routing rules, model rankings | History, keys, preferences | No | No |
| `REMOVE_PROVIDER_CREDENTIAL`| All DPAPI-protected API keys | History, settings, drafts | **Yes** | No |
| `CLEAR_SELECTED_USER_DATA` | Selected history, drafts, notes | Settings, credentials | **Yes** | No |
| `FULL_LOCAL_DATA_RESET` | All SQLite user content | Preferences & empty schema | **Yes** | No |
| `FACTORY_RESET` | Entire application state & keys | Clean factory install | **Yes (Type Token)** | No |

