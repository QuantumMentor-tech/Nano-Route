# Nano Route Repair Action Catalog

## Registered Safe Repairs

### 1. `REBUILD_SEARCH_INDEX`
- **Classification**: `REGENERATIVE`
- **Preconditions**: Source `chat_messages` table intact.
- **Affected Data**: Virtual FTS5 search index table only.
- **Preserved Data**: All chat sessions, messages, prompts, and timestamps.
- **Verification**: Automatically executes `SEARCH-001`.

### 2. `REMOVE_ORPHANED_MESSAGES`
- **Classification**: `NON_DESTRUCTIVE`
- **Preconditions**: Foreign-key check identified unlinked orphan messages.
- **Affected Data**: Unlinked message rows lacking valid parent sessions.
- **Preserved Data**: All existing chat sessions and linked messages.
- **Verification**: Re-runs `HIST-002` and `DB-002`.

### 3. `REPAIR_INVALID_SESSION_ROUTE`
- **Classification**: `CONFIGURATION_CHANGING`
- **Preconditions**: Stored route failed allowlist checking.
- **Affected Data**: `workspace.startup_route` setting key.
- **Preserved Data**: All conversation history and preference values.
- **Verification**: Re-runs `SESS-001`.

### 4. `PRUNE_CORRUPT_PROFILES`
- **Classification**: `DATA_MUTATING`
- **Preconditions**: Profile JSON payload is unparseable.
- **Affected Data**: Malformed custom profile JSON array.
- **Preserved Data**: Built-in profile presets and general settings.
- **Verification**: Re-runs `PROF-001`.

### 5. `RESET_INVALID_PREFERENCES`
- **Classification**: `CONFIGURATION_CHANGING`
- **Preconditions**: One or more settings keys fail domain validation.
- **Affected Data**: Only failing settings keys.
- **Preserved Data**: Conforming settings and all user content.
- **Verification**: Re-runs `PREF-001`.

