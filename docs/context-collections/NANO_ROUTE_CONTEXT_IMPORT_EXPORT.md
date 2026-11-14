# Nano Route — Context Collections Portability (Export & Import)

## 1. Export Format
Context Collections export to standard JSON adhering to Schema Version 1:
```json
{
  "schemaVersion": 1,
  "exportedAtMs": 1731600000000,
  "collections": [
    {
      "id": "cc_12345",
      "name": "System Architecture",
      "description": "Core reference items",
      "isFavorite": true,
      "createdAt": 1731600000000,
      "updatedAt": 1731600000000,
      "schemaVersion": 1
    }
  ],
  "items": [
    {
      "id": "cci_67890",
      "collectionId": "cc_12345",
      "sourceType": "MESSAGE",
      "sourceId": "msg_abc",
      "sessionId": "sess_xyz",
      "position": 0,
      "label": "Architecture Prompt",
      "excerptText": null,
      "createdAt": 1731600000000,
      "updatedAt": 1731600000000
    }
  ]
}
```

## 2. Security Safeguards
- Zero API keys, credentials, or session tokens are included in the export payload.
- File paths are not exposed.

## 3. Conflict Resolution Strategies
- **SKIP:** Discards imported collections if an identical ID exists in the local database.
- **REPLACE:** Overwrites existing collection metadata and items with imported records.
- **KEEP_BOTH (Default):** Re-keys the imported collection with a newly generated unique ID.

