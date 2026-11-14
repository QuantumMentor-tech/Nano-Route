# Nano Route Integrity Severity Model

## Severity Level Definitions

- **`INFORMATIONAL`**: Routine verification metrics with no invariant violations.
- **`LOW`**: Minor anomalies or non-impacting observations (e.g. telemetry timestamps recorded with small future skew).
- **`MEDIUM`**: Search index drift, invalid preference keys, or malformed custom profile payloads that affect secondary capabilities.
- **`HIGH`**: Relational constraint violations, foreign-key orphans, or inconsistent message attribution.
- **`CRITICAL`**: Fundamental database corruption or unreadable storage threatening data persistence.

