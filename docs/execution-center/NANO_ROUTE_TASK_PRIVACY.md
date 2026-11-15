# Nano Route — Task Privacy Guarantees

## 1. Local-First In-Memory Isolation
All execution state within the Active Request Center is kept entirely in ephemeral process memory. No execution telemetry or operational task logs are sent to remote analytics servers or third-party tracking services.

## 2. Privacy Guarantees
- **Ephemeral Storage**: Running and recent tasks are stored exclusively in an in-memory Map and bounded ring buffer. When the app exits, the execution history is discarded.
- **Private Notes Shielding**: References to private notes or encrypted workspace collections used during request preflight are displayed only by reference count or generalized category, never raw text.
- **Zero Cloud Sync**: Execution states are not synchronized across devices, maintaining complete local sovereignty.
- **User-Initiated Purge**: Users can clear recent completed and terminal task history with one click ("Clear Recent").

