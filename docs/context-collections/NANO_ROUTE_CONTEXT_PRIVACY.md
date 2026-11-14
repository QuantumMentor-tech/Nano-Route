# Nano Route — Context Collections Privacy Model

## 1. Local-Only Storage
All Context Collections, reference items, descriptions, and metadata are stored exclusively in the local SQLite database on the user's workstation. Zero cloud synchronization or telemetry transmission of collection content occurs.

## 2. Explicit User Consent for Notes
Private notes authored in Step 82 are strictly segregated:
- Notes are NEVER automatically added to collections.
- When a user explicitly chooses "Add to Context Collection" on a note, the UI displays a clear privacy notice informing them that the note will be transmitted to the AI provider if the collection is used.
- When viewing or materializing a collection containing notes, an alert banner explicitly highlights the presence of sensitive content.

## 3. Telemetry & Diagnostic Sanitization
- Local telemetry records only lifecycle counts (e.g., `collection_created`, `items_count`).
- Collection names, descriptions, and reference contents are strictly redacted from diagnostic logs and crash reports.

