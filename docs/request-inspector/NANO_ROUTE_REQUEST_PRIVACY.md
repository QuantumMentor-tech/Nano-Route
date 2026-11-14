# Nano Route — Request Inspector Privacy Model

## 1. Local-Only Inspection
Inspecting a request performs calculations entirely within the local desktop application runtime. Zero network packets are sent to remote analytics services, cloud endpoints, or model providers.

## 2. Explicit Private Note Disclosure
When a prompt incorporates references containing Step 82 private notes:
- The Overview and Context tabs prominently display an amber security notice (`Contains private notes`).
- The warning informs the user that private note text will be transmitted to the selected AI provider upon submission.

## 3. Redacted Telemetry
Inspection actions trigger only local lifecycle events (e.g. `request_inspector_opened`). Prompt text, collection contents, and note texts are strictly redacted from diagnostic logs.

