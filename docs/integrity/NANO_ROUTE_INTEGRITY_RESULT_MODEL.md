# Nano Route Integrity Result Model

## Result State Enumeration

- **`PASS`**: Data strictly conforms to authoritative application invariants.
- **`PASS_WITH_WARNING`**: Data exhibits unusual anomalies (e.g. historical timestamps in the future or untitled sessions) but is structurally valid.
- **`INCONSISTENT`**: A documented invariant is violated (e.g. search index drift or orphan message rows), for which a safe, deterministic repair is available.
- **`CORRUPT`**: Data structure is invalid or unreadable, requiring Disaster Recovery backup restoration.
- **`BLOCKED`**: The check could not be evaluated because a prerequisite check failed.
- **`NOT_CHECKED`**: Check omitted under the active execution mode.
- **`NOT_APPLICABLE`**: Check does not apply to the current runtime environment.

## Report Envelope Structure
Every verification execution emits a typed `IntegrityRunReport` capturing execution mode, timings, check counts, domain breakdown, structured findings, and available repair actions.

