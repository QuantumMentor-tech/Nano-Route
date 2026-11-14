# Nano Route — Data Export Format & Manifest Envelope

**Document Reference:** `docs/export/NANO_ROUTE_DATA_EXPORT_FORMAT.md`  
**Application:** Nano Route Desktop (Windows 10/11 x64, Tauri v2)  
**Implementation Phase:** Step 70  
**Authoritative Format Specification**  

---

## 1. Export Package Schema & Versioning

Export packages in Nano Route use deterministic envelope formats and integer versioning:

- **Format Identifier:** `nano-route-export-package-v1`
- **Schema Version:** `1` (Integer)
- **Supported Formats:** `json`, `csv`, `json_and_csv`
- **File Naming Convention:** `nano-route-export-YYYY-MM-DD.json` / `<category>.csv`

---

## 2. Manifest Envelope Specification

Every export package includes an explicit `manifest` defining origin, version, record counts, and checksum verification:

```json
{
  "manifest": {
    "format": "nano-route-export-package-v1",
    "application": "Nano Route",
    "appVersion": "0.1.0",
    "exportSchemaVersion": 1,
    "exportedAtMs": 1731585000000,
    "exportedAtIso": "2026-11-14T17:50:00.000Z",
    "categories": [
      "chat_history",
      "user_preferences",
      "workspace_profiles",
      "telemetry_and_analytics"
    ],
    "formatType": "json",
    "recordCounts": {
      "sessionsCount": 12,
      "messagesCount": 84,
      "telemetryCount": 140,
      "preferencesCount": 10,
      "profilesCount": 2,
      "providersCount": 0
    },
    "totalEstimatedRecords": 248,
    "contentWarning": "Chat history contains your personal prompt submissions and AI assistant replies. Store exported files securely.",
    "checksum": "chk_3f8a12bc_45120"
  }
}
```

---

## 3. CSV File Formats & RFC 4180 Standards

When CSV export is selected, data is serialized into discrete RFC 4180 compliant tables with defensive formula sanitization:

### 3.1 `sessions.csv`
```csv
Session ID,Title,Created At,Updated At,Pinned
sess_1731580000,Project Strategy,1731580000000,1731581000000,false
sess_1731582000,Code Review,1731582000000,1731583000000,true
```

### 3.2 `messages.csv`
```csv
Session ID,Message ID,Sender,Content,Created Timestamp,Provider,Model,Tokens,Latency (ms)
sess_1731580000,msg_1,user,Please summarize the release plan,1731580005000,,,,
sess_1731580000,msg_2,assistant,"Here is the release summary:
1. Feature Complete
2. Testing Finished",1731580009000,anthropic,claude-3-5-sonnet,450,1240
```

### 3.3 `telemetry.csv`
```csv
Record ID,Occurred At,Event Type,Provider,Model,Tokens,Cost (USD),Latency (ms),Outcome
tel_101,1731580009000,stream_completed,anthropic,claude-3-5-sonnet,450,0.00315,1240,success
```

