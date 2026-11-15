# Nano Route — Connectivity Privacy Guarantees

## 1. Local-First In-Memory Privacy
1. **Zero External Tracking**: Network status monitoring does not transmit telemetry to any cloud tracking service.
2. **No IP Address Harvesting**: Local IP addresses, MAC addresses, Wi-Fi SSIDs, and BSSIDs are not stored or transmitted.
3. **No Payload Logging**: Request payloads, conversation messages, attachments, and notes are never attached to connectivity state records or transition events.
4. **Ephemeral History**: The 20-event network transition history is stored exclusively in volatile process memory and discarded upon application shutdown.
5. **Sanitized Diagnostics**: Diagnostic reports containing connectivity status reveal only high-level status tags (`ONLINE`, `REACHABLE`, `AUTH_REQUIRED`) with zero environment secrets.

