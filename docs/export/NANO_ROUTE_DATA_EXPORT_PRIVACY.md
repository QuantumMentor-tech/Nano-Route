# Nano Route — User Data Export Privacy Model

**Document Reference:** `docs/export/NANO_ROUTE_DATA_EXPORT_PRIVACY.md`  
**Application:** Nano Route Desktop (Windows 10/11 x64, Tauri v2)  
**Implementation Phase:** Step 70  
**Authoritative Privacy Disclosure**  

---

## 1. Local-First Privacy Guarantees

Nano Route enforces an uncompromised local-first privacy standard during all data export operations:

1. **Zero Remote Transmission:** Export generation is 100% on-device. Exported files are written exclusively to local memory buffers or user-selected local directories. No telemetry ping, remote cloud upload, or third-party service is ever contacted.
2. **Observational Read Operation:** Generating an export does not alter the retention timestamps, database state, or deletion schedules established in Step 45.
3. **No Automatic Background Exports:** Data exports only execute upon explicit, deliberate user initiation within the application interface.

---

## 2. External File Custody & User Responsibilities

Once data is exported outside of Nano Route's sandbox:

- **Boundary Transition:** The exported file transitions into the user's host operating system file system.
- **Operating System Access Controls:** File permissions, access control lists (ACLs), and disk encryption (e.g. Windows BitLocker) govern access to the exported file.
- **User Custody Notice:** The application notifies the user:
  > "Exported files contain your conversation text and application usage history. Once saved outside Nano Route, protect these files using appropriate operating system security controls."

---

## 3. Distinction: Export vs. Backup vs. Diagnostics

| System | Primary Purpose | Privacy Scope | File Protection |
| :--- | :--- | :--- | :--- |
| **Step 70 Export** | Portability, inspection, human/machine readability. | Personal prompts, responses, preferences, telemetry. | User-managed plain JSON/CSV. |
| **Step 53 Backup** | Point-in-time disaster recovery & restore. | Complete SQLite database state. | Checksummed `.db` archive in AppData. |
| **Step 62 Diagnostics** | Technical troubleshooting & issue reporting. | Fully sanitized technical facts (0 user prompts). | Redacted diagnostic bundle. |

