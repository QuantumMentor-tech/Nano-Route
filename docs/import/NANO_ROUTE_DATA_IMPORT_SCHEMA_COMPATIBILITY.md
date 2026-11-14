# Nano Route Data Import Schema Compatibility Specification

## Supported Formats & Versions

| Property | Supported Value | Behavior on Mismatch |
| :--- | :--- | :--- |
| **Package Format** | `nano-route-export-package-v1` | Hard rejection (`INCOMPATIBLE`) |
| **Export Schema Version** | Version `1` | Older supported via migration; newer rejected (`INCOMPATIBLE`) |
| **Application Identifier** | `Nano Route` | Permitted with compatibility warning |
| **Max Payload Size** | `20,971,520 bytes` (20 MB) | Hard rejection (`MALFORMED`) |

## Category Ingestion Support

1. `chat_history`: Reconstructs chat sessions and associated messages into SQLite via typed IPC methods.
2. `user_preferences`: Maps allowlisted preferences through domain validators; non-allowlisted keys are safely ignored.
3. `workspace_profiles`: Imports custom visual profiles, generating collision-safe identifiers where necessary.
4. `telemetry_and_analytics`: Restores historical token and savings telemetry records, deduplicating records by unique ID.

