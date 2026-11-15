# Nano Route — Privacy Center User Guide & Help Content
**Document Version:** 1.0.0  
**Phase:** Post-Roadmap Product Capability Expansion  
**Status:** Authoritative User Guide  
**Date:** 2026-11-15  

---

## 1. What is the Privacy & Data Governance Center?

The Privacy & Data Governance Center is your command center for understanding and managing how Nano Route handles your data. Accessible from the Dashboard header or the Command Palette (`Ctrl+K` -> "Privacy"), it provides real-time transparency into:

- What data is stored on your device.
- What data is transmitted when you submit a prompt.
- How your external API keys are secured.
- How to export, clean up, or completely reset your local data.

---

## 2. Frequently Asked Questions (FAQ)

### Does Nano Route collect telemetry on remote servers?
**No.** Nano Route has zero cloud telemetry or analytics servers. All performance logs, latency metrics, and token calculations are stored locally in your SQLite database.

### When does my data leave my computer?
Data leaves your computer **only when you explicitly submit a prompt or attachment** to an external AI model provider (such as Anthropic, OpenAI, or Google). Drafts you are typing, private notes, bookmarks, and context collections remain strictly on your machine.

### Where are my API keys stored?
Your API keys are encrypted at rest using the Windows Data Protection API (DPAPI). They are tied to your Windows user account and hardware entropy. They never enter the SQLite database and are never included in data exports or diagnostics.

### How do I delete my data?
You can selectively delete conversation sessions, clear drafts, or purge telemetry logs in Settings. If you wish to wipe all data or start fresh, you can use the Reset Center (`Full Local Data Wipe` or `Factory Reset`).

