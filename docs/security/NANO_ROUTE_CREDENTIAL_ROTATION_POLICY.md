# Nano Route — Credential Rotation Policy

**Document Version:** 1.0.0  
**Status:** Authoritative  
**Step:** 74 — Credential Rotation, Stale Key Warnings & Post-Rotation Validation  
**Subsystems:** Credential Lifecycle Engine, Windows DPAPI, Provider Management  

---

## 1. Overview & Objectives

API key rotation is an essential security hygiene control. Credentials that remain unchanged over long durations accumulate increased exposure risk across development environments, networks, and third-party tools.

Nano Route establishes a clear rotation policy:
- **Recommended Rotation Window:** Maximum 90 days (`CREDENTIAL_STALE_THRESHOLD_MS`).
- **Immediate Post-Rotation Validation:** Validates the newly configured secret instantly via zero-prompt reachability checks.
- **Atomic Replacement:** Replaces old ciphertext without leaving orphaned keys or plaintext remnants.
- **Rollback & Non-Destructive Fallback:** If rotation input fails format validation, existing credentials remain intact.

---

## 2. Staleness Tracking & User Warnings

1. **Staleness Calculation:**
   $$\text{Age}_{\text{ms}} = \text{CurrentTime} - \text{LastRotatedAtMs}$$
   When $\text{Age}_{\text{ms}} \ge 90 \times 24 \times 60 \times 60 \times 1000$ (90 days), the credential is classified as `EXPIRING_OR_STALE`.

2. **Visual Warning Badges:**
   - In Settings $\rightarrow$ Provider Management, stale providers display an amber warning badge: `Stale (> 90 Days)`.
   - The UI surfaces a tooltip reminding the user: *"This API key has not been rotated in over 90 days. We recommend generating a fresh key in your provider console to maintain good security hygiene."*

3. **Non-Blocking Operation:**
   - Staleness warnings are advisory; they do NOT block active chat routing unless the upstream provider itself rejects the token.

---

## 3. Safe Rotation Workflow

```
[ User Generates New Key in Provider Web Console ]
                         |
                         v
[ Clicks "Replace API Key" in Nano Route Settings ]
                         |
                         v
[ Types / Pastes New Secret into Secure Input Field ]
                         |
                         v
[ Clicks "Encrypt & Save" ]
                         |
   +---------------------+---------------------+
   | Format & Length Validation                |
   | (2-64 char provider, non-empty, <4096 ch) |
   +---------------------+---------------------+
                         | (Pass)
                         v
   +-------------------------------------------+
   | Native DPAPI CryptProtectData Encryption  |
   | Overwrites existing SQLite record         |
   | Wipes ephemeral plaintext memory          |
   +---------------------+---------------------+
                         |
                         v
   +-------------------------------------------+
   | Immediate Zero-Prompt Metadata Ping       |
   | (cmd_check_provider_health)               |
   +---------------------+---------------------+
                         |
        +----------------+----------------+
        |                                 |
     (Success: 200 OK)               (Failure: 401 / 403)
        |                                 |
        v                                 v
   [ Mark VALID ]                  [ Mark INVALID / REVOKED ]
   Toast: "API key rotated         Toast: "Rotation saved but upstream
   and verified successfully"      rejected key (HTTP 401)"
```

---

## 4. Key Fingerprinting & Zero Secret Exposure

To assist users in identifying which key version is installed without displaying plaintext secrets:
- Nano Route strictly **prohibits** storing plaintext API keys anywhere in application state or configuration files.
- The UI displays purely metadata: `Last updated: [Date]`, `Validation: [State]`, and endpoint configuration.
- There is **no "Reveal Secret" or "Copy Key" button**. Once entered, the secret is accessible only to the Windows DPAPI kernel subsystem.

