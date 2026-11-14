# Nano Route — Reset Scope Matrix & Authority Specification

**Document Reference:** `docs/reset/NANO_ROUTE_RESET_SCOPE_MATRIX.md`  
**Application:** Nano Route Desktop (Windows 10/11 x64, Tauri v2)  
**Implementation Phase:** Step 69  
**Authoritative Operational Reference**  

---

## 1. Authoritative Reset Scope Matrix

The following table details the impact of each reset operation across all application subsystems. This matrix reflects the exact implementation in `src/features/reset/catalog.ts` and `engine.ts`.

| Operation | Preferences | Custom Profiles | Session State | Provider Credentials | Chat History | Telemetry & Metrics | Database Backups | Model Catalog | Required Confirmation | Irreversible? | Restart / Onboarding |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`RESET_PREFERENCES`** | **Reset** | Preserved | Preserved | Preserved | Preserved | Preserved | Preserved | Preserved | Click confirm | No | No / No |
| **`RESET_WORKSPACE`** | Preserved | **Reset** | **Reset** | Preserved | Preserved | Preserved | Preserved | Preserved | Click confirm | Yes (custom profiles) | No / No |
| **`RESET_SESSION_STATE`**| Preserved | Preserved | **Reset** | Preserved | Preserved | Preserved | Preserved | Preserved | Click confirm | No | No / No |
| **`REMOVE_PROVIDER_CREDENTIAL`** | Preserved | Preserved | Preserved | **Deleted (Target)**| Preserved | Preserved | Preserved | Preserved | Click confirm | Yes (target secret) | No / No |
| **`RESET_APPLICATION_CONFIGURATION`** | **Reset (Core)** | Preserved | Preserved | Preserved | Preserved | Preserved | Preserved | **Reset (Overrides)** | Typed (`"RESET CONFIG"`) | Yes (custom routes) | No / No |
| **`CLEAR_SELECTED_USER_DATA`** | Preserved | Preserved | Preserved | Preserved | **Deleted (Optional)**| **Deleted (Optional)**| Preserved | Preserved | Scope select + confirm | Yes (selected data) | No / No |
| **`FULL_LOCAL_DATA_RESET`** | **Reset** | Preserved | **Reset** | Preserved | **Deleted (All)** | **Deleted (All)** | Preserved | Preserved | Typed (`"DELETE"`) | Yes (all local data) | No / No |
| **`FACTORY_RESET`** | **Reset** | **Reset** | **Reset** | **Deleted (All)** | **Deleted (All)** | **Deleted (All)** | Preserved | **Reset (All)** | Typed (`"FACTORY RESET"`)| Yes (complete wipe) | Yes / **Yes** |

---

## 2. Safety Classifications & Thresholds

| Classification | Meaning & Safeguard Requirements | Operations |
| :--- | :--- | :--- |
| **`NON_DESTRUCTIVE_RESET`** | Visual or layout adjustments. No user data, chats, or credentials are deleted. Simple dialog confirmation is sufficient. | `RESET_PREFERENCES`, `RESET_SESSION_STATE` |
| **`CONFIGURATION_RESET`** | Custom profile or routing overrides are removed. Operational chats and secrets remain intact. | `RESET_WORKSPACE`, `RESET_APPLICATION_CONFIGURATION` |
| **`SECURITY_SENSITIVE`** | Windows DPAPI secrets and API credentials removed. Re-entry from provider developer portals required. | `REMOVE_PROVIDER_CREDENTIAL` |
| **`DATA_DELETION`** | SQLite conversation messages, telemetry records, or search index entries are deleted. Irreversible without prior backup. | `CLEAR_SELECTED_USER_DATA`, `FULL_LOCAL_DATA_RESET` |
| **`IRREVERSIBLE_OR_PRACTICALLY_IRREVERSIBLE`** | Complete erasure of all user state, data, and credentials. Requires typed token (`"FACTORY RESET"`), pre-reset backup offer, and onboarding reinitialization. | `FACTORY_RESET` |

---

## 3. Preserved Infrastructure Guarantees

Across all reset operations, the following components are **never** deleted:
1. **Application Binaries:** Executable binaries, DLLs, and Tauri framework runtime remain untouched.
2. **Local Backup Archives:** Point-in-time database backup files (`*.db` in user AppData) remain preserved and isolated from reset workflows.
3. **Hardware & Operating System State:** No Windows DPAPI master keys, system registry keys, or unrelated user files are modified.

