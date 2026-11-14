# Nano Route — Budget & Financial Privacy Guarantees

**Document Version:** 1.0.0  
**Status:** Authoritative  
**Step:** 75 — Provider Budget Controls, Quota Awareness, Spend Guardrails, Usage Limits & Cost-Safe Request Enforcement  
**Subsystems:** Privacy Core, Local Storage, Telemetry  

---

## 1. Local-First Financial Data Guarantees

1. **Zero Cloud Reporting**: Spending limits, alert thresholds, and actual expenditures are stored purely in local SQLite tables and local preferences. They are never phoned home to Nano Route developers or third-party analytics services.
2. **Zero Prompt Text Storage in Budget Records**: Budget records and reservations store only numeric counters: prompt token count, completion token count, estimated cost, and timestamp. The actual textual contents of user prompts and model completions are strictly segregated into the chat history store and are never accessed by budget calculation engines.
3. **Data Portability & Deletion**: When a user executes a data wipe or data export (Step 69 / Step 70), budget policies and spend records respect data category boundaries (`configuration` vs `operational_telemetry`).

