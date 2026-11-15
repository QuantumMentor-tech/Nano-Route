# Nano Route — Local Audit Trail User Guide & Help Content
**Document Version:** 1.0.0  
**Phase:** Post-Roadmap Product Capability Expansion  
**Status:** Authoritative User Guide  
**Date:** 2026-11-15  

---

## 1. What is the Local Audit Trail?

The Local Audit Trail is an activity journal that keeps track of important changes, security operations, and operational milestones in Nano Route. You can open it from the **Audit** button in the top navigation bar or via the Command Palette (`Ctrl+K` -> &ldquo;Audit&rdquo;).

---

## 2. What Does It Track?

The Audit Trail records high-level operational events, such as:
- **Security & Credentials**: When provider API keys are added, rotated, or removed.
- **Provider & Models**: When providers are enabled, disabled, or endpoints change.
- **Routing & Budget**: When routing rules are changed, manual overrides set, or budget limits reached.
- **Data Lifecycle**: When exports, imports, wipes, or database cleanups take place.
- **Execution & Connectivity**: When requests fail over or network transitions occur.

---

## 3. What Does It NOT Track?

To protect your privacy, Nano Route **never** records:
- Your conversation prompts or messages.
- AI model completions.
- Passwords or API keys.
- Private notes or attached document contents.
- Keystrokes or clicks.

---

## 4. How Do I Export or Prune the Audit Trail?

- **Export**: Click the **Export** button in the Audit Explorer header to download a sanitized JSON record of your audit events.
- **Prune History**: Click the **Prune History** button at the bottom of the Audit Explorer to safely remove events older than 30 days.

