# Nano Route — Credential Compromise Response

**Document Version:** 1.0.0  
**Status:** Authoritative  
**Step:** 74 — Suspected Compromise Response, Local Containment & Remote Revocation Runbooks  
**Subsystems:** Credential Lifecycle Engine, Security Diagnostics, Settings UI  

---

## 1. Overview & Threat Model

If an API key is suspected to be compromised (e.g., inadvertently committed to a public Git repository, pasted into an unencrypted chat channel, or exposed in an infected development environment), immediate containment is essential to prevent unauthorized usage and financial loss.

A common pitfall in desktop applications is giving users a false sense of security by offering a "Delete Key" button without informing them that **local deletion does NOT revoke the credential on the cloud provider's servers**.

Nano Route enforces an explicit compromise response protocol:
1. **Immediate Local Containment:** Instant local purge or deactivation.
2. **Clear Upstream Revocation Separation:** Explicitly prompts the user with direct administrative console links to revoke the credential at the source.
3. **Structured Incident Runbooks:** Step-by-step guidance to audit billing and rotate credentials safely.

---

## 2. Local Action vs Remote Revocation Matrix

| Action | Local Effect in Nano Route | Upstream Cloud Provider Effect | Financial & Leak Protection |
| :--- | :--- | :--- | :--- |
| **Local Purge** | Ciphertext permanently deleted from DPAPI SQLite vault. | **NONE.** The key remains fully valid on OpenAI/Anthropic/Google servers. | Protects local machine; third parties holding the leaked key can still incur charges. |
| **Local Disable** | Credential retained in DPAPI but deactivated from routing. | **NONE.** The key remains fully valid on cloud servers. | Prevents local invocation; does not stop external misuse. |
| **Remote Revocation** | Nano Route will receive HTTP 401/403 upon next request. | **PERMANENT INVALIDATION.** Upstream servers reject all future requests globally. | **Full Protection:** Terminates all external consumption and unauthorized billing. |

---

## 3. Compromise Containment Workflow

In Settings $\rightarrow$ Provider Management $\rightarrow$ Expand Provider:
1. Click **Compromise Response** (marked with a prominent ShieldAlert icon).
2. The UI displays the Critical Security Notice:
   > *"Local actions in Nano Route (delete or disable) protect your local machine, but DO NOT revoke the key on the cloud provider's servers. You must revoke the key in the provider console to prevent unauthorized charges."*
3. The user selects containment strategy:
   - **Emergency Purge from DPAPI (Recommended):** Immediately deletes the key from local storage.
   - **Disable Locally Only:** Deactivates the key from routing while keeping the ciphertext.
4. Upon clicking confirm:
   - Local action executes atomically.
   - The modal updates to show the **Incident Response Runbook** with a direct, verified link to the provider's API key management console.

---

## 4. Provider Console Revocation Links

Nano Route maintains authoritative direct links to provider key management dashboards:

- **OpenAI:** `https://platform.openai.com/api-keys`
- **Anthropic:** `https://console.anthropic.com/settings/keys`
- **Google Gemini:** `https://aistudio.google.com/app/apikey`
- **Groq:** `https://console.groq.com/keys`
- **DeepSeek:** `https://platform.deepseek.com/api_keys`
- **Mistral AI:** `https://console.mistral.ai/api-keys`

---

## 5. Post-Incident Remediation Checklist

1. [ ] Log in to the provider web console and permanently revoke the compromised key.
2. [ ] Review usage logs and billing dashboards for unexpected spikes during the exposure window.
3. [ ] If organization-wide access keys were compromised, rotate team access tokens.
4. [ ] Generate a fresh API key with minimal necessary permissions.
5. [ ] Enter the new key into Nano Route via Settings $\rightarrow$ Provider Management $\rightarrow$ Add API Key.

