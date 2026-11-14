# Nano Route — Preference Migration & Backward Compatibility
**Step 66: Persistence Migration & Resilience Strategy**

## 1. Upgrade from Pre-Step 66 Installations

Prior to Step 66, the `app_settings` SQLite table persisted only operational settings:
- `routing.preference_mode`
- `telemetry.enabled`
- `history.retention_days`
- `window.start_maximized`
- `routing.manual_override_*`

### Zero Schema Breaking Changes
The `app_settings` table uses a simple key-value schema:
```sql
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

Because Step 66 preference keys are stored as standard string rows, no destructive SQL DDL migration is required. Existing installations continue to read their persisted settings, while newly introduced preference keys resolve safely to their documented virtual defaults.

---

## 2. Safe Fallback Matrix for Missing or Malformed Values

When `getAppSettings()` queries SQLite, it applies safe parsing and normalization helpers:

| Stored Row Value | Parsed Result | Recovery Action |
|---|---|---|
| Key does not exist | Virtual Default (e.g. `"dark"`, `"comfortable"`) | Transparent virtual fallback |
| Invalid Enum (e.g. `"matrix-green"`) | Safe Default (`"dark"`) | Fallback without exception |
| Corrupted Number (e.g. `"abc"`) | Default Duration (`5000`) | Fallback without exception |
| Out of Bounds Number (`45000`) | Default Duration (`5000`) | Clamp/fallback without exception |
| Invalid Boolean (`"yes"`) | Safe Default (`false`) | Fallback without exception |

---

## 3. Rollback Safety

If the application is downgraded to a pre-Step 66 release:
- Pre-Step 66 binaries query only their recognized setting keys (`routing.*`, `telemetry.*`, etc.).
- Unknown Step 66 keys (`appearance.*`, `chat.*`, etc.) are completely ignored by older versions.
- Stored credentials, chat history, and telemetry remain 100% intact.

