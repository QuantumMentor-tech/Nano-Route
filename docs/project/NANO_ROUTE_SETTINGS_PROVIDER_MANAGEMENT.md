# Nano Route — Settings, Provider Management & Configuration Control Center

**Step 46 — Phase 10: Release & Production Readiness**
**Authoritative Architectural Specification & User Manual**

---

## 1. Architectural Overview & Responsibility Boundaries

Step 46 establishes a unified, secure, strictly local-first **Settings & Provider Management Workspace** for Nano Route. It integrates the foundational systems implemented across previous roadmap steps:
- **Step 19:** Windows DPAPI Credential Vault (`CryptProtectData` / `CryptUnprotectData`, encrypted SQLite BLOBs)
- **Step 20:** Typed Application Settings (`app_settings` key-value table, virtual defaults, atomic multi-setting updates)
- **Step 21:** Canonical Provider & Model Registry (static descriptors, capabilities, default models, lifecycle states)
- **Step 25:** Provider Runtime Health & Capability Services (passive observations, canonical health states, opt-in probes)
- **Step 30:** Routing Policy Engine & Manual Route Override (candidate scoring integration, modality checks, fallback plans)
- **Step 39:** Context Window Headroom, Token Limits & Availability Preflight
- **Step 45:** Privacy, SQLite Health Auditing, Retention Controls & Full Local Data Wipe

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           React Desktop UI                              │
│  [General]   [Providers]   [Models & Routing]   [Privacy]   [Security]  │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Typed Frontend IPC Client
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Tauri IPC Boundary                            │
│  cmd_get_settings_workspace_snapshot                                    │
│  cmd_save_provider_credential, cmd_delete_provider_credential           │
│  cmd_set_app_setting, cmd_reset_app_setting, cmd_reset_all_settings     │
│  cmd_update_provider_preferences, cmd_reset_provider_preferences        │
│  cmd_check_provider_health, cmd_validate_manual_override                │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Strictly Sanitized DTOs (Zero Plaintext Keys)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          Rust Native Core                               │
│  ┌──────────────────────┐  ┌─────────────────────┐  ┌─────────────────┐ │
│  │ AppSettingsService   │  │ CredentialVault     │  │ ProviderRegistry│ │
│  │ (Validation/Cache)   │  │ (DPAPI Encryption)  │  │ & HealthManager │ │
│  └──────────┬───────────┘  └──────────┬──────────┘  └────────┬────────┘ │
└─────────────┼─────────────────────────┼──────────────────────┼──────────┘
              ▼                         ▼                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   Local Storage & Crypto Boundary                       │
│  - SQLite: app_settings (key/value), api_credentials (DPAPI BLOB)       │
│  - Windows DPAPI: CurrentUser scope, AES-256 equivalent machine auth    │
│  - ZERO Cloud Sync / ZERO Remote Configuration Servers                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Settings Information Architecture & Tabs

The Settings Workspace is organized into 5 coherent, dedicated tabs:

### 1. General Tab (`GeneralSettingsPanel.tsx`)
- **Routing Preference Profile:** Select between `balanced` (default), `quality` (high-capability models prioritized), and `cost_saving` (economical models prioritized). Guides Step 29/30 scoring without modifying core weights.
- **Application Startup Behavior:** `window.start_maximized` toggle to launch in full desktop view.
- **Local Telemetry Collection:** `telemetry.enabled` toggle to collect execution latencies, token counts, and cost metrics strictly in local SQLite.
- **Data Lifecycle Quick Link:** Direct navigation bridge to the Privacy tab for retention and cleanup.
- **Reset Application Settings:** Danger zone action with `ConfirmDialog` to revert application preferences to documented virtual defaults without touching credentials, history, or telemetry.

### 2. Providers Tab (`ProviderManagementPanel.tsx`)
- **Authoritative Provider Cards:** Lists canonical providers (`openai`, `anthropic`, `gemini`, `deepseek`, `groq`, `mistral`).
- **Activation Switch:** Toggles provider eligibility in routing via `setProviderActive(providerId, isActive)`. Preserves credentials, chat history, and telemetry.
- **Windows DPAPI Credential Management:**
  - Password-style masked input with syntax validation.
  - Plaintext key is encrypted natively via DPAPI and immediately wiped from memory.
  - Safe status metadata (`isConfigured: true`, `updatedAt`, `priorityWeight`). Plaintext keys are never returned to frontend.
  - Delete Credential modal with explicit confirmation.
- **Connection Endpoint Configuration:**
  - Displays Default URL vs. Custom URL.
  - Enforces HTTPS or localhost/127.0.0.1 HTTP for dev proxies. Prohibits embedded credentials (`user:pass@host`).
  - "Restore Default" action clears custom endpoint.
- **Priority Weight:** 1 to 10 integer slider (default 5).
- **Explicit Health Probes:** Opt-in "Check Health" button executing a safe, minimal check via `checkProviderHealth` without sending conversational user prompts. Displays freshness timestamp.

### 3. Models & Routing Tab (`ModelsAndRoutingPanel.tsx`)
- **Global Routing Mode Selector:**
  - **Automatic Routing (SLM):** Dynamic intent classification, domain analysis, and multi-dimensional scoring.
  - **Manual Model Override:** Pins a specific provider and model for all submissions.
- **Manual Override Preflight:** Live candidate validation via `validateManualOverride` checking modality requirements (vision/audio), model availability, and provider configuration.
- **Explanatory Policy Disclosure:** *"Manual selection affects routing preference. Runtime availability, capability, context, and security checks still apply."*
- **Clear Override Action:** Single click restores dynamic SLM routing.
- **Model Catalog Explorer:** Searchable, filterable table of all canonical models with context window, max tokens, default flags, and capability tags.

### 4. Privacy & Data Tab (`PrivacyDataLifecyclePanel.tsx`)
- Seamlessly mounts the complete Step 45 system:
  - Local dataset inventory (7 canonical tables).
  - SQLite integrity and foreign key audit (`PRAGMA quick_check` / `integrity_check`).
  - Non-destructive safe repair (FTS5 search index rebuild & orphan cleanup).
  - Retention policy configuration (history & telemetry days, pinned session protection).
  - Dry-run preview and targeted batch cleanup.
  - Full Local Data Wipe with explicit two-factor `"DELETE"` confirmation token.

### 5. Security & Diagnostics Tab (`SecurityDiagnosticsPanel.tsx`)
- **Cryptographic Storage Disclosure:** Windows DPAPI protection active, zero plaintext key storage.
- **Offline Architecture Invariant:** 100% on-device operation, zero remote settings backup, zero cloud accounts.
- **System Diagnostics:** Storage engine, active provider count, catalog model counts.
- **Safe Configuration Export:** Downloads JSON export of user preferences and non-secret provider metadata, with strict exclusion of API keys and ciphertext BLOBs.

---

## 3. Security & Privacy Invariants

| Invariant | Implementation Enforcement |
|---|---|
| **Zero Plaintext Key Leakage** | API keys enter native core via transient DTOs, encrypted via DPAPI, stored as BLOBs. Tauri commands never return keys. |
| **No Arbitrary SQL Commands** | Frontend IPC command registry forbids commands containing `"execute"`, `"sql"`, or `"query"`. Verified by automated security test. |
| **No Credential Persistence in Browser** | Web storage (`localStorage`, `sessionStorage`, `IndexedDB`) and React component state never retain API keys post-save. |
| **Network Health Check Isolation** | Opening Settings triggers zero network requests. Health probes are strictly user-initiated on demand. |
| **Provider Deactivation Safety** | Disabling a provider sets `is_active = false` for future routing. Never deletes credentials, chat history, or telemetry. |
| **Settings Reset Isolation** | Reverting application settings clears `app_settings` table. Preserves credentials, chat history, and telemetry. |
| **Safe Settings Export** | JSON export strictly redacts all secret fields and DPAPI ciphertext. |

---

## 4. IPC Commands Reference

| Command | Direction | Description |
|---|---|---|
| `cmd_get_settings_workspace_snapshot` | Frontend $\leftarrow$ Rust | Retrieves consolidated snapshot (settings, providers, models, policy, security) in 1 call |
| `cmd_get_app_settings` | Frontend $\leftarrow$ Rust | Retrieves snapshot of application settings |
| `cmd_set_app_setting` | Frontend $\rightarrow$ Rust | Sets and persists typed setting with validation |
| `cmd_reset_app_setting` | Frontend $\rightarrow$ Rust | Resets single setting to virtual default |
| `cmd_reset_all_settings` | Frontend $\rightarrow$ Rust | Resets all settings in `app_settings` to virtual defaults |
| `cmd_save_provider_credential` | Frontend $\rightarrow$ Rust | Encrypts key with Windows DPAPI and stores in `api_credentials` |
| `cmd_delete_provider_credential` | Frontend $\rightarrow$ Rust | Removes encrypted key and resets configuration state |
| `cmd_set_provider_active` | Frontend $\rightarrow$ Rust | Toggles provider active state in `api_credentials` and health manager |
| `cmd_update_provider_preferences` | Frontend $\rightarrow$ Rust | Atomically updates base URL, priority, and budget limit |
| `cmd_reset_provider_preferences` | Frontend $\rightarrow$ Rust | Resets base URL and priority to defaults (preserves credential) |
| `cmd_check_provider_health` | Frontend $\rightarrow$ Rust | Performs explicit on-demand health probe without user prompt text |
| `cmd_validate_manual_override` | Frontend $\rightarrow$ Rust | Pre-validates manual override against model capabilities |

---

## 5. Verification & Test Coverage

- **Automated Test Suite:** `src/features/settings/__tests__/settingsWorkspace.test.ts` (17 tests covering snapshot retrieval, DPAPI credential lifecycle, endpoint editing, provider activation, manual override persistence, settings reset, health checks, and formatters).
- **Regression Suite:** All 507 tests across 266 suites pass with 0 failures.
- **TypeScript:** Strict typecheck (`tsc --noEmit`) passes with 0 errors.
- **Production Build:** Vite production bundle passes (`dist/` created in 10.75s).
- **Logo Preservation:** `Nano Route Neon Tech Logo.png` length verified at **670,255 bytes**.

