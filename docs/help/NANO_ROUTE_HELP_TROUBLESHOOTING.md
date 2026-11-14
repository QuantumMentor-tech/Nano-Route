# NANO ROUTE — HELP TROUBLESHOOTING & RUNBOOKS
## Step 63 Structured Diagnostics Integration & Remediation Guidance

---

## 1. RUNBOOK PATTERN

Every troubleshooting section in the Help Center follows a deterministic three-part structure:

1. **Check**: What condition or state should be examined?
2. **Expected**: What is the nominal, healthy outcome?
3. **Action / Remediation**: What exact safe step should the user perform to resolve the discrepancy?

---

## 2. COMMON TROUBLESHOOTING RUNBOOKS

### A. Provider Authentication Failure (HTTP 401)
- **Check**: Is the provider API key valid and actively enabled in Settings?
- **Expected**: DPAPI vault status reports provider configured.
- **Action**: Open Provider Settings (`/settings?tab=providers`), re-enter the API key, and click **Test Connection** in Diagnostics.

### B. Provider Rate Limit (HTTP 429)
- **Check**: Has the provider exhausted its query quota or rate limit?
- **Expected**: Outbound requests complete without HTTP 429 status codes.
- **Action**: Nano Route automatically initiates failover to another candidate. If manual override was active, switch to Automatic Routing or wait for the provider's `Retry-After` window.

### C. Local SLM Offline / DirectML Error
- **Check**: Is the local SLM model loaded into memory?
- **Expected**: Runtime status 'ready' with loaded model identifier.
- **Action**: Open Diagnostics Center (`/diagnostics`) and run the **SLM Synthetic Self-Test (SLM-002)**. If DirectML fails, switch the execution provider to CPU in Model Settings.

### D. SQLite Database Lock
- **Check**: Is the SQLite database readable with WAL active?
- **Expected**: `DB-001` test passes with schema v6.
- **Action**: Verify file permissions in `%LOCALAPPDATA%`, restart the application, or restore a verified backup via Disaster Recovery (`/settings?tab=privacy`).

