# Nano Route User Data Recovery Guide (Step 53)

## 1. Introduction

Nano Route operates as an autonomous, local-first AI orchestration desktop application. All your conversation threads, messages, routing statistics, and model configurations are stored strictly on your local PC.

This guide explains how to back up your data, how to verify its integrity, and how to safely restore it in the event of an issue.

---

## 2. Creating a Backup

1. Navigate to **Settings** > **Maintenance & Privacy** (or the Data Lifecycle panel).
2. Click **Create Backup**.
3. Nano Route will quiesce pending writes, generate a consistent SQLite database snapshot, and compute a cryptographic SHA-256 integrity checksum.
4. Your backup will be saved in:
   `%LOCALAPPDATA%\Nano Route\backups\`
5. A metadata manifest file (`backup_{timestamp}.manifest.json`) is saved alongside the database file (`backup_{timestamp}.db`), recording your session count, message count, and verification status.

---

## 3. How to Restore from a Backup

1. In the **Backups & Recovery** section, locate the backup you wish to restore.
2. Click **Review & Restore**.
3. Nano Route will run an automatic preflight check:
   - Verifying the file's SHA-256 checksum to ensure it hasn't been corrupted.
   - Checking SQLite internal database integrity.
   - Confirming that the schema is compatible with your current version of Nano Route.
4. If the backup passes validation, you will see a preview summarizing the number of sessions and messages that will be restored.
5. To proceed, type `RESTORE` into the confirmation field and click **Confirm Restore**.
6. **Automatic Safety Snapshot**: Before touching your current data, Nano Route automatically creates a temporary safety snapshot of your current database. If anything goes wrong, your original data is preserved.
7. Once promoted, the History search index (FTS5) is automatically rebuilt.

---

## 4. Understanding Windows DPAPI Credentials

- Your provider API keys (OpenAI, Anthropic, Gemini, Groq, Mistral, DeepSeek) are encrypted using **Windows DPAPI** (Data Protection API), which ties encryption keys to your specific Windows user profile.
- When restoring a backup on the **same computer and Windows account**, your API keys remain intact and functional.
- If you move a backup file to a **different computer** or a **different Windows user profile**, the conversation history and settings will restore cleanly, but Windows will prevent DPAPI from decrypting the foreign keys. Simply re-enter your API keys in the Settings page.

---

## 5. What to Do If Restore Fails

If a restore operation is rejected:
- **Corrupted File**: The file was modified or truncated. Use a different backup point.
- **Newer Version**: The backup was made with a newer release of Nano Route. Please update your application first.
- **Active Streaming**: Ensure no prompts are currently streaming before restoring.

