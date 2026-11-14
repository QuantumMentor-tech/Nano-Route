# Nano Route Data Import Conflict Resolution Policies

## Supported Strategies

### 1. `SKIP_DUPLICATES` (Default Safe Mode)
- **Chat Conversations**: If a session with matching ID already exists, its metadata is preserved, and duplicate messages within it are omitted from insertion.
- **Preferences**: Retains the user's existing local preference setting.
- **Workspace Profiles**: Skips import if another profile shares the same ID or sanitized name.
- **Telemetry**: Skips ingestion if the telemetry event ID already exists in SQLite.

### 2. `IMPORT_AS_NEW` (Clone & Disambiguate)
- **Chat Conversations**: Creates a new session record with an updated unique ID, appending the `(Imported)` suffix to its title. All constituent messages are copied to the new session thread.
- **Preferences**: Not applicable (preferences are singleton key-value pairs).
- **Workspace Profiles**: Generates a new random profile ID and appends `(Imported)` to the profile name if an existing profile shares the name.

### 3. `KEEP_EXISTING` (Preservation Priority)
- Strictly retains local system state and discards competing imported candidate data.

