# Nano Route — Step 47: License Management, Application About & Contact Workspace

## 1. Overview & Objectives

**Step 47** of the Nano Route master engineering roadmap implements the production-quality desktop screens for:
1. **License & Entitlements Page (`/license`)**
2. **About Nano Route Page (`/about`)**
3. **Contact & Support Page (`/contact`)**

These three pages form a native, cohesive part of the Nano Route desktop application shell, providing transparent product identity, authoritative open-source licensing terms, local feature entitlement guarantees, system runtime specifications, and official communication channels.

---

## 2. Page Architectures

### A. License Page (`src/features/about/components/LicenseView.tsx`)
- **Product Identity Banner:** Displays canonical Nano Route branding, product name (`Nano Route`), edition (`Community Edition (Open Source)`), and copyright.
- **License Model:** Factual presentation of the **MIT License** (permissive open-source model).
- **Zero Fabrication Rule:** Strictly eliminates fabricated commercial tiers (`Pro`, `Premium`, `Enterprise`, `Lifetime`, `Trial`).
- **Zero Online Activation Requirement:** Explicitly states that Nano Route operates completely offline; no DRM, seat counters, or remote activation servers are required.
- **Perpetual Validity:** No artificial expiration dates or time-bombs.
- **Authorized Local Entitlements:** Confirms that all core local features are unlocked:
  - Local SLM Intent Classification & Task Analysis (ONNX Runtime)
  - Multi-Dimensional Provider Routing & Scoring (11 Normalized Dimensions)
  - Windows DPAPI Encrypted Key Management (`CryptProtectData`)
  - Local SQLite Chat History & Full-Text Search (FTS5)
  - Privacy-First Local Telemetry & Cost Analytics
  - Data Lifecycle, Retention & Secure Wipe Engine
- **Unmodified Legal Text:** Embeds the complete MIT License notice from the repository's root `LICENSE` file within a contained, scrollable view, accompanied by a copy action.

### B. About Page (`src/features/about/components/AboutView.tsx`)
- **Branding Hero:** Official logo, application name, version badge, build channel badge, and a one-click build copy button.
- **Dynamic System & Runtime Specifications:** Queries `getNativeAppInfo()` with offline fallback to display:
  - Target Platform: Windows Desktop (`x86_64`)
  - Core Runtime: Rust Native Core (Tokio Async)
  - Local SLM Engine: ONNX Runtime (DirectML / CPU Local Execution)
  - Persistence Engine: Embedded SQLite 3 (WAL Mode, Zero Arbitrary SQL)
  - Credential Vault: Windows DPAPI (`CryptProtectData` OS-Level Encryption)
  - Desktop Host: Tauri v2 + Rust Core + React 18 / TypeScript
- **Executive Overview:** Factual product description detailing local SLM prompt evaluation and frontier LLM dispatch.
- **Implementation Status Breakdown:** Strict architectural separation between **Active MVP Capabilities** (implemented and verified across Steps 1–46) and **Planned Future Milestones** (such as additional local model runtimes, fine-tuned weights, plugin marketplace, and MSIX packaging).
- **Open-Source Foundations & Acknowledgements:** Recognizes foundational technologies (Tauri v2, React 18, TypeScript, Tokio, SQLite, ONNX Runtime, Lucide React, Vite) and their corresponding licenses.
- **Ownership Notice:** "Copyright (c) 2026 Nano Route Engineering. All rights reserved."

### C. Contact & Support Page (`src/features/about/components/ContactView.tsx`)
- **Support Expectations:** Realistic guidelines clarifying that support is provided on an open-source basis without fabricating unverified "24/7 SLAs" or "Instant Reply" claims.
- **Four Canonical Communication Channels:**
  1. **Email Support:** Direct technical assistance and security disclosures (`mailto:`).
  2. **WhatsApp Community:** Announcements and community troubleshooting (`whatsapp:` or `https:`).
  3. **Official Website:** Project homepage, documentation, and releases (`https:`).
  4. **YouTube Channel:** Video tutorials and architecture walkthroughs (`https:`).
- **Unconfigured Destination Safety:** In compliance with Step 47 rules, channels lacking an authoritative destination in repository metadata remain explicitly marked as `Not Configured`, with disabled action buttons, preventing broken or dead links.
- **Graceful Failure & Privacy Guard:** When external link opening fails, an actionable notice instructs the user to copy the address manually. Confirms that local chats, keys, or telemetry are never transmitted through support actions.

---

## 3. Data Sources & Authority

| Entity | Source of Truth | Fallback / Context |
|---|---|---|
| Application Name | `Cargo.toml`, `tauri.conf.json`, `package.json` | `"Nano Route"` |
| Version | Rust `AppService` -> Tauri IPC `cmd_get_app_info` | `"0.1.0"` |
| Build Channel | `APP_METADATA.buildChannel` | `"Alpha Development"` |
| Copyright & Ownership | Root `LICENSE`, `Cargo.toml` (`authors`) | `"Copyright (c) 2026 Nano Route Engineering"` |
| License State & Notice | `LICENSE` file, Rust `AppService` -> `cmd_get_license_info` | MIT License Text |
| Contact Configuration | `src/features/about/config/appMetadata.ts` (`CONTACT_CONFIG`) | Unconfigured defaults |

---

## 4. Security & Privacy Invariants

1. **Protocol Whitelisting:** External links are strictly validated against an approved scheme whitelist (`https:`, `mailto:`, `whatsapp:`). Any `javascript:`, `data:`, `file:`, `vbscript:`, or `about:` protocols are rejected prior to execution.
2. **Rel Protections:** Browser windows are opened with `rel="noopener noreferrer"` to prevent window spoofing and reverse-tabnabbing.
3. **Zero Plaintext Key Exposure:** The License and About screens never access or serialize DPAPI credentials or SQLite sensitive tables.
4. **Zero Remote Telemetry:** Navigating to License, About, or Contact pages generates zero network requests or third-party web tracking pixels.
5. **No Database Dependencies:** The pages read static build metadata and lightweight IPC runtime diagnostics, operating instantly without touching the SQLite database.

---

## 5. Verification & Test Suite

The test suite in `src/features/about/__tests__/aboutWorkspace.test.ts` covers:
- **Authoritative Application Metadata:** Canonical name, version, channel, and distinction between implemented and planned features.
- **License State Model:** Verifies MIT license terms, entitlement grants, and absence of fabricated commercial tiers.
- **Contact Configuration:** Verifies presence of all 4 canonical channels, safe unconfigured defaults, and test override support.
- **Security Validation:** Rigorous protocol validation and rejection of dangerous URL schemes.
- **Link Opener Resilience:** Safe failure handling without crashing the UI.
- **Shell & Navigation:** Verifies routes (`/license`, `/about`, `/contact`) and sidebar registration under the Application section.

**Validation Status:** 529 automated tests passing across 273 suites (0 failures).

