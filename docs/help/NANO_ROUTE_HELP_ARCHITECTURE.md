# NANO ROUTE — HELP CENTER ARCHITECTURE
## In-App Help Center, Contextual Guidance & Troubleshooting System (Step 63)

---

## 1. ARCHITECTURAL OVERVIEW

The **In-App Help Center** delivers local-first, offline-capable documentation and contextual assistance embedded directly into the Nano Route Windows desktop application.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        React 18 / TypeScript UI                        │
│   HelpPage (/help)                                                     │
│   ├── Deterministic Local Search Bar (lexical keyword matching)        │
│   ├── Category Explorer Grid (12 core functional domains)              │
│   ├── Structured Article Viewer (What it does, How it works)           │
│   ├── Troubleshooting Runbooks (Check, Expected, Action)               │
│   └── Safe Navigation Bridges (/settings, /diagnostics, /chat)         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Pure In-Memory Functional Layer
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Local Knowledge Base Catalog & Search                │
│   src/features/help/content.ts                                         │
│   src/features/help/search.ts                                          │
│   ├── Static Bundled Articles (Zero remote CMS or HTTP requests)       │
│   ├── Deterministic Weighted Relevance Index                           │
│   └── Safe External Link Validator (Allowed schemes: https, mailto)    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. CORE ARCHITECTURAL INVARIANTS

1. **Local-First & Offline**: Help content is bundled with the desktop application binary. It operates with 100% fidelity when completely disconnected from the internet.
2. **Read-Mostly Information Layer**: The Help Center does not duplicate or alter state. Whenever a user needs to take action, it routes them into authoritative existing application destinations (`/settings`, `/diagnostics`, `/chat`, `/history`).
3. **No Speculative or Invented Features**: All articles reflect actual, implemented capabilities of Nano Route as of Step 63.
4. **Zero Arbitrary Execution**: Articles are rendered using structured React components without arbitrary raw HTML injection or script execution. External links are verified via strict scheme whitelists (`https:`, `mailto:`, `whatsapp:`).
5. **No AI Search Dependencies**: Search is implemented as a fast, deterministic lexical token-matching engine that requires no local SLM inference or cloud LLM calls.

