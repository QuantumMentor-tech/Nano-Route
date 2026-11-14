# NANO ROUTE — DIAGNOSTIC TEST CATALOG
## Step 62 Authoritative Diagnostic Test Taxonomy & Metadata Specifications

---

## 1. CATALOG OVERVIEW

The Diagnostic Test Catalog defines 12 standard diagnostic probes covering all primary subsystems of the Nano Route Windows desktop application. Each probe operates under strict constraints regarding network activity, execution bounds, timeout limits, and privacy guarantees.

---

## 2. DETAILED TEST SPECIFICATIONS

### `RT-001` — Application Runtime Health
- **Category**: `runtime`
- **Network Bound**: `false` (Local-only)
- **Timeout**: `3,000 ms`
- **Cancellation Support**: `true`
- **Purpose**: Verifies that the React 18 frontend runtime, React Router DOM, and native Tauri core IPC channels are responsive and operating within nominal lifecycle parameters.
- **Preconditions**: Desktop application process running.
- **Expected Results**:
  - `PASS`: Frontend hydrated, native bridge responsive, lifecycle state `ready`.
  - `FAIL`: Native core unreachable, IPC handshake timeout.
- **Remediation**: Restart application or check Windows Task Manager for hung background processes.
- **Privacy Impact**: Local operational inspection; zero personal information inspected.

---

### `ENV-001` — Windows Desktop Environment
- **Category**: `environment`
- **Network Bound**: `false` (Local-only)
- **Timeout**: `2,000 ms`
- **Cancellation Support**: `true`
- **Purpose**: Validates host operating system platform, 64-bit architecture qualification, and Evergreen Microsoft Edge WebView2 runtime availability.
- **Preconditions**: Windows desktop host environment.
- **Expected Results**:
  - `PASS`: Windows x64 host detected, Evergreen WebView2 runtime verified.
  - `WARNING`: Outdated WebView2 installation or unexpected OS configuration.
- **Remediation**: Install or update Microsoft Edge WebView2 Evergreen Runtime.
- **Privacy Impact**: Host OS version and arch only; no device serial numbers, usernames, or telemetry identifiers collected.

---

### `DB-001` — SQLite Database & WAL Integrity
- **Category**: `database`
- **Network Bound**: `false` (Local-only)
- **Timeout**: `5,000 ms`
- **Cancellation Support**: `true`
- **Purpose**: Inspects SQLite database connection, applies PRAGMA quick_check read-only integrity inspection, verifies WAL journaling mode, and confirms schema migrations.
- **Preconditions**: SQLite database file accessible in application data directory.
- **Expected Results**:
  - `PASS`: Schema v6 current, WAL journaling active, database file readable and unlocked.
  - `FAIL`: Database file locked, corrupt header, or migration version incompatible.
- **Remediation**: Open Database & Privacy Settings (`/settings?tab=privacy`) to inspect database diagnostics or restore a previous verified backup.
- **Privacy Impact**: Structural schema and integrity checks only; zero conversational content or query text inspected.

---

### `SLM-001` — Local SLM Manifest & Runtime
- **Category**: `slm`
- **Network Bound**: `false` (Local-only)
- **Timeout**: `4,000 ms`
- **Cancellation Support**: `true`
- **Purpose**: Inspects local Small Language Model (SLM) manifest, loaded session state, and native execution provider (DirectML / CPU).
- **Preconditions**: Local runtime service initialized.
- **Expected Results**:
  - `PASS`: Local model loaded and ready in session memory.
  - `WARNING`: Local SLM offline or model not loaded (cloud fallback active if credentials configured).
- **Remediation**: Navigate to Model Settings (`/settings?tab=models`) to verify local model asset installation.
- **Privacy Impact**: Inspects model identifiers and runtime status; zero user prompts loaded.

---

### `SLM-002` — Local SLM Synthetic Self-Test
- **Category**: `slm`
- **Network Bound**: `false` (Local-only)
- **Timeout**: `8,000 ms`
- **Cancellation Support**: `true`
- **Purpose**: Executes an explicit, bounded on-device synthetic inference with non-conversational test text ("test", max 2 tokens) to confirm native engine execution without network calls or history persistence.
- **Preconditions**: Local model must be loaded into memory.
- **Expected Results**:
  - `PASS`: Synthetic inference completes and produces output tokens within timeout.
  - `WARNING`: Local model offline, DirectML allocation issue, or execution failure.
- **Remediation**: Check GPU driver compatibility or switch local execution provider to CPU in Model Settings.
- **Privacy Impact**: Zero user content involved; synthetic prompt strictly discarded; not persisted to chat history or telemetry.

---

### `CRED-001` — Windows DPAPI Vault & Credentials
- **Category**: `credentials`
- **Network Bound**: `false` (Local-only)
- **Timeout**: `3,000 ms`
- **Cancellation Support**: `true`
- **Purpose**: Verifies that the Windows Data Protection API (DPAPI) credential vault is operational and reports credential presence flags per provider.
- **Preconditions**: Windows DPAPI subsystem operational for current user session.
- **Expected Results**:
  - `PASS`: DPAPI vault accessible, at least one provider credential securely stored.
  - `PASS_WITH_LIMITATION`: DPAPI vault operational, but zero cloud provider credentials configured (Local-only mode).
- **Remediation**: Add cloud provider API keys in Provider Settings (`/settings?tab=providers`) if frontier models are needed.
- **Privacy Impact**: Queries boolean configuration status only; never decrypts, retrieves, or logs plaintext keys.

---

### `PROV-CONFIG-001` — Provider Configuration Consistency
- **Category**: `providers`
- **Network Bound**: `false` (Local-only)
- **Timeout**: `3,000 ms`
- **Cancellation Support**: `true`
- **Purpose**: Validates consistency of registered provider catalog entries, protocol adapters, and default base URL formats.
- **Preconditions**: Registry service initialized.
- **Expected Results**:
  - `PASS`: Providers registered with valid protocol endpoints and supported adapters.
  - `FAIL`: Registry empty or corrupted configuration detected.
- **Remediation**: Reset application settings to virtual defaults in Settings.
- **Privacy Impact**: Reads static in-memory descriptors; zero network communication.

---

### `PROV-CONN-001` — Frontier Provider Reachability
- **Category**: `providers`
- **Network Bound**: `true` (Outbound HTTPS Network Probe)
- **Timeout**: `10,000 ms`
- **Cancellation Support**: `true`
- **Purpose**: Performs an opt-in, user-initiated outbound HTTPS ping check against a configured cloud provider endpoint to verify DNS resolution, TLS handshake, and endpoint reachability.
- **Preconditions**: Active internet connection, provider enabled.
- **Expected Results**:
  - `PASS`: Provider endpoint responds with valid HTTP status within timeout bounds.
  - `WARNING`: Endpoint unreachable, DNS lookup failure, or HTTP 401/429 status.
- **Remediation**: Check network connection or verify API key in Provider Settings (`/settings?tab=providers`).
- **Privacy Impact**: Does not send user conversational prompts; outbound request sends minimal protocol health ping.

---

### `MODEL-001` — Authoritative Model Catalog
- **Category**: `models`
- **Network Bound**: `false` (Local-only)
- **Timeout**: `3,000 ms`
- **Cancellation Support**: `true`
- **Purpose**: Validates registered model catalog descriptors, context limits, capability flags, and pricing parameters across local and cloud models.
- **Preconditions**: Registry service loaded.
- **Expected Results**:
  - `PASS`: Model catalog populated with valid bounds and capabilities.
  - `FAIL`: Zero models found or malformed model descriptor entries.
- **Remediation**: Restore default model catalog configuration.
- **Privacy Impact**: Inspects static registry catalog metadata only.

---

### `ROUTE-001` — Routing Configuration & Prerequisites
- **Category**: `routing`
- **Network Bound**: `false` (Local-only)
- **Timeout**: `3,000 ms`
- **Cancellation Support**: `true`
- **Purpose**: Validates active routing profile (quality, balanced, cost_saving) and confirms that at least one candidate (local SLM or cloud provider) is available to execute requests.
- **Preconditions**: App settings and registry available.
- **Expected Results**:
  - `PASS`: Active routing profile valid and at least one routing candidate is operational.
  - `WARNING`: Neither local SLM nor cloud credentials available; requests cannot be routed.
- **Remediation**: Open Settings (`/settings?tab=models`) to configure either local SLM or a cloud provider.
- **Privacy Impact**: Inspects routing configuration flags only; no historical message re-scoring.

---

### `UPD-001` — Application Update Subsystem
- **Category**: `updater`
- **Network Bound**: `false` (Local-only)
- **Timeout**: `3,000 ms`
- **Cancellation Support**: `true`
- **Purpose**: Inspects the update lifecycle state machine (Step 52) to verify no corrupted, incomplete, or interrupted update staging artifacts exist.
- **Preconditions**: Update service initialized.
- **Expected Results**:
  - `PASS`: Update subsystem idle or in a valid transition state; staging directories clean.
  - `FAIL`: Interrupted update detected, unverified staged binary present.
- **Remediation**: Navigate to Update Settings (`/settings?tab=general`) to clear staged artifacts or check for updates.
- **Privacy Impact**: Local filesystem staging check; zero network requests made.

---

### `REC-001` — Disaster Recovery & Backups
- **Category**: `recovery`
- **Network Bound**: `false` (Local-only)
- **Timeout**: `4,000 ms`
- **Cancellation Support**: `true`
- **Purpose**: Validates disaster recovery subsystem readiness (Step 53) and inspects available local backup manifests and staging accessibility.
- **Preconditions**: Backup directory accessible.
- **Expected Results**:
  - `PASS`: Recovery subsystem ready, backup manifests parseable and intact.
  - `FAIL`: Backup storage unwriteable or manifest corruption detected.
- **Remediation**: Open Backup & Recovery Settings (`/settings?tab=privacy`) to generate a fresh verified backup.
- **Privacy Impact**: Inspects backup metadata counts; zero conversational content decrypted or extracted.

