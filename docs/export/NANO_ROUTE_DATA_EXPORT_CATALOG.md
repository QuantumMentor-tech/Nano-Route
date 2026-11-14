# Nano Route — User Data Export Catalog Specification

**Document Reference:** `docs/export/NANO_ROUTE_DATA_EXPORT_CATALOG.md`  
**Application:** Nano Route Desktop (Windows 10/11 x64, Tauri v2)  
**Implementation Phase:** Step 70  
**Authoritative Operational Catalog**  

---

## 1. Exportable Categories Catalog

The following table details the 5 approved export categories, their data classifications, allowed properties, and excluded internals.

| Category ID | Display Name | Classification | Sensitivity | Included Fields | Excluded Internals | Default Selected |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **`chat_history`** | Chat Conversations & Messages | `USER_CONTENT` | Private Content | Session ID, title, created/updated timestamps, pinned status; Message ID, session ID, sender (`user`/`assistant`), content, timestamps, routed provider/model, token counts, latency. | Raw SQLite page IDs, in-flight task handles, stream cancellation tokens, unsent draft buffers. | **Yes** |
| **`user_preferences`** | User Interface Preferences | `USER_CONFIGURATION` | Configuration | Appearance theme mode, density, reduced motion, text scale, enhanced focus; workspace startup route, sidebar state; chat formatting options; notification durations; routing preference mode; telemetry switch. | DPAPI API credentials, master encryption keys, machine GUID, system internal settings keys. | **Yes** |
| **`workspace_profiles`** | Custom Workspace Profiles | `USER_CONFIGURATION` | Configuration | Profile ID, name, description, isBuiltin flag, creation timestamp, snapshot of preference key-value pairs. | Secret tokens, credentials, prompt contents. | **Yes** |
| **`telemetry_and_analytics`** | Telemetry & Cost Analytics | `ANALYTICS_DATA` | Analytics | Event ID, timestamp, event type, provider ID, model ID, prompt/completion/total tokens, cost (USD), latency (ms), outcome status. | Prompt text, assistant response text, user session titles, IP addresses, MAC addresses, device GUIDs. | **Yes** |
| **`provider_registry_metadata`** | Provider Catalog & Capabilities | `METADATA_ONLY` | Public Metadata | Provider ID, display name, default model ID, credentialRequired flag, isConfigured boolean status. | API keys, DPAPI ciphertexts, authorization headers, private webhook tokens, custom base URLs with credentials. | No |

---

## 2. Category Sensitivity & Disclosure Warnings

### Category: `chat_history`
- **Sensitivity:** `USER_CONTENT` (Private Content)
- **Disclosure Notice:** "Chat history contains your personal prompt submissions and AI assistant replies. Store exported files securely."

### Category: `telemetry_and_analytics`
- **Sensitivity:** `ANALYTICS_DATA` (Operational Analytics)
- **Disclosure Notice:** "Usage analytics reflect provider call frequencies, token numbers, and cost calculations."

---

## 3. Explicitly Forbidden Properties & Secret Keys

The following properties are **strictly excluded** from export packages:
- `api_key`, `apikey`, `apiKey`
- `password`, `secret`, `token`
- `authorization`, `dpapi`, `credential`
- `private_key`, `ciphertext`
- `sk-[a-zA-Z0-9]{20,}` (API key patterns)

