# NANO ROUTE — HELP SECURITY & PRIVACY
## Step 63 Content Security, Scheme Validation & IPC Boundary Isolation

---

## 1. CONTENT TRUST BOUNDARIES

Help content is treated as trusted, static application assets compiled directly into the client bundle:
- **No Remote Fetching**: Content is never retrieved from remote CMS servers or untrusted third-party APIs.
- **No Unsanitized HTML**: Content is rendered via React JSX text nodes, eliminating Cross-Site Scripting (XSS) risks from untrusted Markdown or unescaped HTML strings.

---

## 2. EXTERNAL LINK SECURITY

When an article includes an external documentation link, navigation is gated by strict scheme validation (`src/features/about/utils/externalLinks.ts`):

- **Whitelisted Schemes**: Only `https:`, `mailto:`, and `whatsapp:` are permitted.
- **Blocked Dangerous Schemes**: `javascript:`, `data:`, `file:`, `vbscript:`, and `about:` are strictly rejected before navigation is attempted.
- **Opener Isolation**: All external browser tabs open with `rel="noopener noreferrer"` to prevent window manipulation.

---

## 3. ZERO IPC EXPOSURE

The Help Center requires zero specialized native IPC commands:
- No file-system loading APIs.
- No remote documentation fetching commands.
- No shell execution bridges.
- All actions route cleanly through existing, validated internal routes (`navigate("/settings")`, `navigate("/diagnostics")`).

