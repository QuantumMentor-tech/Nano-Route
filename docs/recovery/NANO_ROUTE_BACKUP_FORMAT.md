# Nano Route Backup File Format & Manifest Specification (Step 53)

## 1. File Naming Conventions

Backup artifacts are placed in the canonical application directory:
`%LOCALAPPDATA%\Nano Route\backups\`

Each backup consists of a pair of files:
- **Database Snapshot**: `backup_{TIMESTAMP_MS}.db`
- **Metadata Manifest**: `backup_{TIMESTAMP_MS}.manifest.json`

Safety snapshots follow the naming prefix:
- `safety_snapshot_pre_restore_{TIMESTAMP_MS}.db`
- `safety_snapshot_pre_update_{TIMESTAMP_MS}.db`

---

## 2. Backup Format Versioning

The authoritative backup format version is tracked via `backup_format_version`:
- Current version: `1`
- Format specification: SQLite 3 database file alongside JSON manifest.

---

## 3. Manifest JSON Schema

```json
{
  "backupId": "backup_1731500000000",
  "backupFormatVersion": 1,
  "applicationName": "Nano Route",
  "applicationVersion": "0.1.0",
  "databaseSchemaVersion": 6,
  "backupScope": "full_database",
  "createdAtMs": 1731500000000,
  "artifactFilename": "backup_1731500000000.db",
  "artifactSizeBytes": 1048576,
  "sha256Checksum": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "sessionsCount": 14,
  "messagesCount": 86,
  "telemetryRecordsCount": 112,
  "containsDpapiBlob": true,
  "platform": "windows",
  "architecture": "x86_64"
}
```

---

## 4. Manifest Field Definitions

| Field Name | Type | Description |
|---|---|---|
| `backupId` | string | Unique identifier formatted as `backup_{TIMESTAMP}` |
| `backupFormatVersion` | integer | Incremental format version (current `1`) |
| `applicationName` | string | Must strictly match `"Nano Route"` |
| `applicationVersion` | string | Semantic version of Nano Route at backup creation |
| `databaseSchemaVersion` | integer | Active migration version of the SQLite schema (e.g. `6`) |
| `backupScope` | string | One of `"full_database"`, `"configuration_only"`, `"safety_snapshot"` |
| `createdAtMs` | integer | Unix epoch millisecond timestamp |
| `artifactFilename` | string | Name of the SQLite database file |
| `artifactSizeBytes` | integer | File size in bytes |
| `sha256Checksum` | string | 64-character lowercase hex SHA-256 digest |
| `sessionsCount` | integer | Total records in `chat_sessions` |
| `messagesCount` | integer | Total records in `chat_messages` |
| `telemetryRecordsCount` | integer | Total records in `telemetry_records` |
| `containsDpapiBlob` | boolean | Indicates whether table `api_credentials` contains DPAPI blobs |
| `platform` | string | Canonical platform identifier (`"windows"`) |
| `architecture` | string | Canonical CPU architecture (`"x86_64"`) |

