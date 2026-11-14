# Nano Route — Request Snapshot Policy

## 1. Snapshot Immutability & Ephemerality
A `CanonicalRequestSnapshot` represents a frozen, read-only representation of a proposed request at a specific instant in time. Snapshots:
- Are assigned unique IDs (`req_snap_<timestamp>_<rand>`).
- Are completely ephemeral (held in memory during inspection; not persisted to disk).
- Do not mutate automatically while the user is actively reading inspection fields.

## 2. Stale Snapshot Detection
If the user modifies prompt text, removes an attachment, or changes settings while the inspector modal is open:
- The snapshot is marked `isStale = true`.
- Clicking "Send Request" triggers pre-submission revalidation.
- If a material difference is detected, the UI prompts the user to review the updated preview before transmission.

## 3. Ephemeral Isolation
Snapshots are discarded upon modal dismissal or successful request submission, preventing memory accumulation or sensitive text retention.

