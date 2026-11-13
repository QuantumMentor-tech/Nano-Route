# NANO ROUTE — RELEASE ROLLBACK & DATA PRESERVATION POLICY

**Phase 11: Post-Release Stability & Maintenance — Step 51**  
**Document ID:** MAINT-ROLLBACK-051  
**Date:** November 13, 2026  

---

## 1. Rollback Standard & Invariants

In the event that an installed maintenance patch or release candidate exhibits an unexpected regression in production, rollback must be executed under strict data preservation guidelines:

```text
================================================================================
                    CRITICAL ROLLBACK INVARIANT:
               NEVER SACRIFICE USER DATA DURING ROLLBACK
================================================================================
```

### Invariants:
1. **Binary Rollback vs Database Rollback:** Replacing an application binary does NOT revert or destroy SQLite user database records.
2. **Backward Schema Compatibility:** All migrations must maintain non-destructive schema additions (e.g. nullable columns, additive indexes) to ensure previous binary versions can read the database without crashing.
3. **No Automatic Destructive Downgrade:** If an incompatible schema version is encountered, the application must enter a safe diagnostic mode, preserve `nano_route.db`, and prompt the user rather than truncating tables.

---

## 2. Emergency Rollback Procedure

1. **Terminate Active Application:** Close `nano-route.exe` via Task Manager or tray icon.
2. **Backup Local Database:** Create a timestamped copy of `%LOCALAPPDATA%\Nano Route\data\nano_route.db`.
3. **Install Previous Known-Good Build:** Run the installer for the previous release candidate (e.g. `v0.1.0-rc1`).
4. **Launch & Verify:** Verify that chat conversations, pinned sessions, and provider configurations remain intact and accessible.

