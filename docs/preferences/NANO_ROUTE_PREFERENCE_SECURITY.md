# Nano Route — Preference Security & Data Protection
**Step 66: Security Invariants & Threat Modeling**

## 1. Zero Secret Separation

A foundational security invariant of Nano Route is the strict separation between **unprotected presentation preferences** and **protected credential vaults**:

1. **Credentials**: Stored in a separate DPAPI-encrypted vault. API keys (OpenAI, Anthropic, Gemini, Groq, DeepSeek, Mistral) are encrypted at rest with the Windows user's logon security token.
2. **Preferences**: Stored in plaintext SQLite `app_settings` and strictly limited to non-sensitive presentation flags.

```text
┌─────────────────────────────────┐   ┌───────────────────────────────────┐
│     User Preferences Store      │   │    DPAPI Credential Vault         │
│  (app_settings: theme, density) │   │  (providers: DPAPI ciphertext)   │
│   • Exportable                  │   │   • NEVER Exportable              │
│   • Plaintext in SQLite         │   │   • Encrypted via CryptProtectData│
└─────────────────────────────────┘   └───────────────────────────────────┘
```

---

## 2. Import / Export Security Controls

The JSON preferences portability feature (`preferencesIO.ts`) incorporates strict defensive barriers:

1. **Strict Key Whitelisting**:
   Only keys explicitly enumerated in `EXPORTABLE_PREFERENCE_KEYS` are processed. Injected keys (e.g. `api_key`, `secret_token`, `system_command`) are rejected and discarded.
2. **Strict Domain Validation**:
   Imported values are passed through `validateSetting()` before persistence. Malformed strings or injection payloads are thrown out before touching SQLite.
3. **No Arbitrary Code Execution**:
   Imported configuration is purely parsed via `JSON.parse` with structural validation. No `eval()`, `new Function()`, or dynamic scripting is executed.
4. **No Path or URL Injection**:
   Preferences do not accept local directory paths or external webhook URLs.

