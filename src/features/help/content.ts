/**
 * Nano Route — Local Knowledge Base Catalog
 * File: src/features/help/content.ts
 *
 * Implements authoritative, factual, local-first documentation
 * grounded strictly in actual Nano Route capabilities.
 */

import type { HelpCategoryDescriptor, HelpArticle } from "./types.ts";

export const HELP_CATEGORIES: HelpCategoryDescriptor[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    description: "Orientation, first-run setup, and core workspace fundamentals.",
    iconName: "Compass",
    order: 1,
  },
  {
    id: "routing",
    title: "Intelligent Routing",
    description: "Automatic candidate selection, scoring, manual overrides, and failover.",
    iconName: "GitFork",
    order: 2,
  },
  {
    id: "local-slm",
    title: "Local SLM",
    description: "On-device Small Language Model runtime, ONNX, DirectML, and self-tests.",
    iconName: "Cpu",
    order: 3,
  },
  {
    id: "providers",
    title: "Providers & Credentials",
    description: "Configuring cloud providers, DPAPI key storage, and connection tests.",
    iconName: "Server",
    order: 4,
  },
  {
    id: "chat",
    title: "Chat Studio & Sessions",
    description: "Sending prompts, SSE streaming, cooperative cancellation, and history.",
    iconName: "MessageSquare",
    order: 5,
  },
  {
    id: "analytics",
    title: "Telemetry & Analytics",
    description: "Local execution logs, token counts, cost baselines, and latency tracking.",
    iconName: "BarChart3",
    order: 6,
  },
  {
    id: "settings",
    title: "Settings & Preferences",
    description: "Managing providers, models, routing profiles, and data controls.",
    iconName: "Settings",
    order: 7,
  },
  {
    id: "diagnostics",
    title: "Diagnostics & Health",
    description: "System self-tests, Quick Check, Full Check, and support reports.",
    iconName: "Activity",
    order: 8,
  },
  {
    id: "updates",
    title: "Application Updates",
    description: "Update verification, staging lifecycle, channels, and safe rollbacks.",
    iconName: "RefreshCw",
    order: 9,
  },
  {
    id: "recovery",
    title: "Backup & Recovery",
    description: "Snapshot creation, manifest verification, and safe SQLite restore.",
    iconName: "ShieldAlert",
    order: 10,
  },
  {
    id: "privacy-security",
    title: "Privacy & Security",
    description: "Local data storage boundaries, DPAPI vault, and network disclosures.",
    iconName: "Lock",
    order: 11,
  },
  {
    id: "accessibility",
    title: "Accessibility & Shortcuts",
    description: "Keyboard navigation, screen reader semantics, and high-DPI scaling.",
    iconName: "Eye",
    order: 12,
  },
];

export const HELP_ARTICLES: HelpArticle[] = [
  // ─── GETTING STARTED ───
  {
    id: "what-is-nano-route",
    categoryId: "getting-started",
    title: "What is Nano Route?",
    summary: "An overview of Nano Route's desktop AI orchestration architecture.",
    keywords: ["overview", "architecture", "local", "orchestration", "router", "slm"],
    content: [
      "Nano Route is a production-oriented Windows desktop application that intelligently orchestrates queries across an on-device Small Language Model (SLM) and optional cloud frontier AI providers.",
      "The native core is built with Rust and Tauri v2, pairing secure native system integration with a high-performance React/TypeScript user interface and a local SQLite database for conversation storage.",
      "Every prompt submitted to Nano Route is evaluated locally to determine the most cost-effective and capable routing candidate, ensuring privacy, predictability, and full user ownership.",
    ],
    whatItDoes: "Coordinates local and cloud AI models based on task requirements, user preferences, and real-time candidate availability.",
    howItWorks: "Queries are evaluated by the local SLM to classify complexity, assess capability requirements, and select the optimal execution candidate before any outbound request is made.",
    relatedArticles: ["how-routing-works", "first-run-setup"],
    relatedActions: [
      { type: "route", path: "/chat", label: "Open Chat Studio" },
      { type: "route", path: "/settings", label: "Open Settings" },
    ],
    version: "1.0.0",
    lastReviewedVersion: "0.1.0",
  },
  {
    id: "first-run-setup",
    categoryId: "getting-started",
    title: "First-Run Setup & Onboarding",
    summary: "How to configure Nano Route after installation for local or cloud usage.",
    keywords: ["onboarding", "setup", "first run", "quickstart", "start"],
    content: [
      "When launching Nano Route for the first time, the guided onboarding wizard presents the system orientation, checks runtime health, and helps you configure your preferred operating mode.",
      "Nano Route can operate in 100% Local-Only Mode using the bundled SLM runtime with zero external network access, or in Hybrid Mode by adding one or more cloud API keys (OpenAI, Anthropic, Gemini, DeepSeek, Groq, Mistral).",
      "All credentials entered during setup are immediately encrypted using the Windows Data Protection API (DPAPI) and never stored in plaintext.",
    ],
    whatYouNeed: "A Windows 10/11 64-bit desktop with WebView2 runtime installed, and optionally one or more provider API keys.",
    troubleshooting: [
      {
        check: "Is the local database accessible?",
        expected: "SQLite status 'Ready' in Dashboard or Diagnostics.",
        remediation: "Run Quick Diagnostics to verify SQLite WAL file locks and permissions.",
      },
    ],
    relatedArticles: ["what-is-nano-route", "provider-credentials"],
    relatedActions: [
      { type: "route", path: "/settings?tab=providers", label: "Configure Providers" },
      { type: "route", path: "/diagnostics", label: "Run Quick Diagnostics" },
    ],
    version: "1.0.0",
    lastReviewedVersion: "0.1.0",
  },

  // ─── ROUTING ───
  {
    id: "how-routing-works",
    categoryId: "routing",
    title: "How Automatic Routing Works",
    summary: "Understand the local preflight evaluation, capability scoring, and candidate selection.",
    keywords: ["routing", "policy", "scoring", "candidates", "auto", "selection"],
    content: [
      "Automatic routing evaluates incoming queries using a multi-factor decision matrix executed entirely on your local machine.",
      "The evaluation considers task complexity, required capabilities (such as code synthesis, long context, or structured reasoning), current provider health, rate limit cooldowns, and your selected preference profile.",
      "If the selected primary provider encounters an HTTP 429 rate limit or unexpected connection timeout, Nano Route automatically initiates failover to the next qualified candidate without duplicating user prompts.",
    ],
    whatItDoes: "Selects the optimal model candidate for each prompt based on capability matching and cost/quality trade-offs.",
    howItWorks: "1. Prompt analysis -> 2. Capability preflight -> 3. Routing policy evaluation -> 4. Execution dispatch -> 5. Automatic fallback if transient error occurs.",
    relatedArticles: ["routing-preference-profiles", "manual-routing-override"],
    relatedActions: [
      { type: "route", path: "/settings?tab=models", label: "Routing Settings" },
    ],
    version: "1.0.0",
    lastReviewedVersion: "0.1.0",
  },
  {
    id: "routing-preference-profiles",
    categoryId: "routing",
    title: "Routing Preference Profiles",
    summary: "Differences between Quality, Balanced, and Cost Saving routing modes.",
    keywords: ["profile", "quality", "balanced", "cost saving", "preference", "tradeoff"],
    content: [
      "Nano Route supports three deterministic routing preference profiles configurable in Settings:",
      "1. Quality: Prioritizes frontier models and high-parameter reasoning capabilities, favoring task accuracy over token cost.",
      "2. Balanced (Default): Dynamically selects the local SLM for straightforward interactions while elevating complex queries to mid-tier or frontier cloud models.",
      "3. Cost Saving: Maximizes on-device SLM execution and prioritizes cost-effective high-throughput models (e.g., Groq Llama, Gemini Flash, GPT-4o-mini).",
    ],
    relatedArticles: ["how-routing-works", "manual-routing-override"],
    relatedActions: [
      { type: "route", path: "/settings?tab=models", label: "Change Routing Profile" },
    ],
    version: "1.0.0",
    lastReviewedVersion: "0.1.0",
  },
  {
    id: "manual-routing-override",
    categoryId: "routing",
    title: "Manual Provider & Model Override",
    summary: "Pinning specific models directly for specialized tasks or testing.",
    keywords: ["manual", "override", "pinning", "lock", "select model", "force"],
    content: [
      "While automatic routing is designed for hands-free optimization, you can manually lock prompt execution to a specific provider and model.",
      "When a manual override is active, the automatic router is bypassed. However, preflight validation continues to ensure that the chosen provider is enabled and has valid credentials.",
      "To prevent accidental cloud costs, automatic failover is strictly disabled during manual override sessions; if the selected model fails, the specific error is surfaced immediately.",
    ],
    relatedArticles: ["how-routing-works", "provider-health"],
    relatedActions: [
      { type: "route", path: "/chat", label: "Open Chat Studio" },
    ],
    version: "1.0.0",
    lastReviewedVersion: "0.1.0",
  },

  // ─── LOCAL SLM ───
  {
    id: "local-slm-runtime",
    categoryId: "local-slm",
    title: "Local SLM Architecture & DirectML",
    summary: "How the on-device model runs privately with zero data transmission.",
    keywords: ["slm", "local model", "directml", "onnx", "gpu", "cpu", "offline"],
    content: [
      "The local Small Language Model (SLM) runs directly on your Windows PC using native ONNX Runtime bindings and hardware-accelerated DirectML where supported.",
      "All on-device inferences occur strictly in local session memory. Raw prompt text, user tokens, and internal attention states never leave your machine.",
      "DirectML acceleration automatically leverages compatible DirectX 12 graphics hardware (AMD, Intel, NVIDIA). If a discrete GPU is not available, the runtime gracefully defaults to CPU execution.",
    ],
    whatItDoes: "Performs privacy-preserving on-device inference, query classification, and routing recommendations.",
    troubleshooting: [
      {
        check: "Is the local model loaded in memory?",
        expected: "State 'ready' with model loaded.",
        remediation: "Open Diagnostics to run the explicit SLM Synthetic Self-Test (SLM-002).",
      },
    ],
    relatedArticles: ["slm-self-test", "what-is-nano-route"],
    relatedActions: [
      { type: "route", path: "/diagnostics", label: "Run SLM Self-Test" },
      { type: "route", path: "/settings?tab=models", label: "Inspect Model Settings" },
    ],
    version: "1.0.0",
    lastReviewedVersion: "0.1.0",
  },
  {
    id: "slm-self-test",
    categoryId: "local-slm",
    title: "Running the SLM Synthetic Self-Test",
    summary: "Verify local model execution readiness with a non-conversational benchmark.",
    keywords: ["self-test", "slm test", "synthetic", "benchmark", "diagnostics", "check"],
    content: [
      "To verify that your local SLM runtime and DirectML execution providers are operational, you can trigger an explicit self-test from the Diagnostics Center.",
      "The self-test executes a deterministic 2-token synthetic prompt against the local model in memory and measures round-trip inference latency.",
      "The synthetic prompt and its completion are never saved to SQLite chat history and never recorded in user telemetry tables.",
    ],
    relatedArticles: ["local-slm-runtime", "diagnostics-overview"],
    relatedActions: [
      { type: "route", path: "/diagnostics", label: "Open Diagnostics Center" },
    ],
    version: "1.0.0",
    lastReviewedVersion: "0.1.0",
  },

  // ─── PROVIDERS ───
  {
    id: "provider-credentials",
    categoryId: "providers",
    title: "Windows DPAPI Credential Protection",
    summary: "How provider API keys are encrypted securely under current user session.",
    keywords: ["dpapi", "credentials", "api key", "encryption", "vault", "security"],
    content: [
      "Nano Route protects all cloud provider credentials using the Windows Data Protection API (DPAPI CryptProtectData).",
      "Encryption keys are derived by the Windows kernel and tied exclusively to your Windows user logon session. Other local user accounts or unauthenticated processes cannot decrypt stored secrets.",
      "At no point are plaintext API keys emitted across the frontend IPC boundary, rendered in diagnostic views, or written into exported support reports.",
    ],
    troubleshooting: [
      {
        check: "Are provider credentials present?",
        expected: "DPAPI vault operational with configured provider keys.",
        remediation: "Navigate to Provider Settings to enter or update your API key.",
      },
    ],
    relatedArticles: ["credential-lifecycle-and-secret-hygiene", "provider-health", "privacy-guarantees"],
    relatedActions: [
      { type: "route", path: "/settings?tab=providers", label: "Manage Credentials" },
      { type: "route", path: "/diagnostics", label: "Inspect DPAPI Status" },
    ],
    version: "1.0.0",
    lastReviewedVersion: "0.1.0",
  },
  {
    id: "credential-lifecycle-and-secret-hygiene",
    categoryId: "providers",
    title: "Secure Credential Lifecycle & Secret Hygiene",
    summary: "Key rotation policies, zero-prompt validation, custom endpoint security, and compromise response.",
    keywords: [
      "rotation",
      "secret hygiene",
      "validation",
      "compromise",
      "leak",
      "tls",
      "revoke",
      "stale",
      "dpapi",
    ],
    content: [
      "Nano Route enforces strict credential lifecycle controls: separating key presence from upstream validity, prohibiting in-memory secret persistence, and preventing secret leakage into exports, telemetry, or notifications.",
      "Key Rotation: Rotating an API key replaces the DPAPI ciphertext and executes immediate zero-prompt validation to verify upstream reachability without transmitting conversational chat prompts.",
      "Custom Endpoint Security: Custom base URLs require TLS (HTTPS) unless targeting local development addresses (localhost / 127.0.0.1). Embedded credentials and query-string token leaks are strictly rejected.",
      "Compromise Response: If an API key is suspected to be leaked, you can execute an emergency local purge from the DPAPI vault. Because local deletion does NOT revoke keys on the provider's servers, you must also revoke the key in the cloud provider's console.",
    ],
    whatItDoes: "Maintains cryptographic secret isolation, audits endpoint security, and guides incident containment during suspected key leaks.",
    troubleshooting: [
      {
        check: "Is the credential marked Stale or Expiring?",
        expected: "Credentials rotated within 90 days.",
        remediation: "Open Provider Settings -> Replace API Key to rotate your provider secret.",
      },
      {
        check: "Did a custom endpoint fail validation?",
        expected: "HTTPS protocol or http://localhost without embedded userinfo or query tokens.",
        remediation: "Correct the base URL to use HTTPS and ensure keys are entered only into the DPAPI field.",
      },
    ],
    relatedArticles: ["provider-credentials", "provider-health"],
    relatedActions: [
      { type: "route", path: "/settings?tab=providers", label: "Open Provider Management" },
    ],
    version: "1.0.0",
    lastReviewedVersion: "0.1.0",
  },
  {
    id: "provider-budget-guardrails-and-quota-awareness",
    categoryId: "providers",
    title: "Provider Budget Controls, Quota Awareness & Spend Guardrails",
    summary: "Configuring monthly spending limits, preflight guardrails, spend reconciliation, and quota awareness.",
    keywords: [
      "budget",
      "spending limit",
      "guardrail",
      "quota",
      "cost enforcement",
      "spend reconciliation",
      "nano-usd",
      "preflight",
      "hard limit",
      "soft limit",
      "warn only",
    ],
    content: [
      "Nano Route provides a strict local spending guardrail system that protects users against unexpected cloud API costs without pretending to be a cloud billing portal or payment authority.",
      "1. Clear Separation of Responsibilities:",
      "- Cost Analytics (Step 43): Historical ledger recording the actual computed cost of past requests.",
      "- Budget Control (Step 75): Local user-configured spending policies evaluated before dispatching requests.",
      "- Provider Quota (Step 75): Upstream quota or remaining balance explicitly reported by providers, tracked with staleness indicators (>1 hour).",
      "- Usage Estimation (Step 75): Conservative preflight cost calculation based on prompt tokens, max output tokens, and versioned pricing tables.",
      "- Enforcement (Step 75): Guardrail action taken when budget limits are approached or reached (OFF, WARN_ONLY, SOFT_LIMIT, HARD_LIMIT).",
      "2. Deterministic UTC Calendar Monthly Periods: Budgets strictly reset at midnight UTC on the first of each month (YYYY-MM-01T00:00:00.000Z).",
      "3. Authoritative Spend Derivation: Current-month spend is derived directly from Step 43 telemetry cost records using exact nano-USD integer arithmetic ($1 = 1,000,000,000 nano-USD), completely eliminating floating-point accumulation drift.",
      "4. Spend Reconciliation: The engine continuously compares cached database spend against authoritative telemetry records and flags any drift for instant one-click reconciliation.",
      "5. Ephemeral In-Flight Cost Reservations: When a request begins, estimated costs are temporarily reserved against the budget and released upon request completion, cancellation, or failure.",
      "6. Distinct Local Budget Blocks: If a request is blocked by a HARD_LIMIT, Nano Route raises a clear LOCAL_BUDGET_BLOCK error, explicitly distinguishing local budget enforcement from upstream provider network or HTTP failures.",
    ],
    whatItDoes: "Enforces preflight spend guardrails, tracks upstream provider quotas, reconciles cached spend with telemetry, and prevents runaway cloud billing.",
    troubleshooting: [
      {
        check: "Why did a request fail with LOCAL_BUDGET_BLOCK?",
        expected: "Local spend plus reserved cost exceeded the configured HARD_LIMIT budget for this provider.",
        remediation: "Open Settings -> Providers to adjust your monthly budget limit, switch to WARN_ONLY mode, or route requests to local SLM models.",
      },
      {
        check: "Why is spend marked 'MISMATCH_DETECTED'?",
        expected: "Authoritative telemetry records and cached counter differ by more than $0.01.",
        remediation: "Click 'Reconcile' in the Provider Guardrails panel to synchronize cached spend to authoritative telemetry.",
      },
    ],
    relatedArticles: ["provider-credentials", "credential-lifecycle-and-secret-hygiene", "telemetry-and-savings"],
    relatedActions: [
      { type: "route", path: "/settings?tab=providers", label: "Configure Budget Guardrails" },
      { type: "route", path: "/analytics", label: "View Cost Analytics" },
    ],
    version: "1.0.0",
    lastReviewedVersion: "0.1.0",
  },
  {
    id: "provider-health",
    categoryId: "providers",
    title: "Provider Health, Timeouts & Rate Limits",
    summary: "Understanding reachability probes, rate limits, and 429 backoff handling.",
    keywords: ["health", "rate limit", "429", "timeout", "network", "probe", "connection"],
    content: [
      "When communicating with cloud frontier providers, Nano Route tracks live operational status including network latency, DNS resolution, and rate limits.",
      "If a provider responds with HTTP 429 (Too Many Requests), Nano Route reads the Retry-After header, temporarily isolates the provider from automatic candidate selection, and safely fails over to another eligible model.",
      "Explicit reachability probes in Diagnostics allow you to verify outbound connectivity on-demand without sending conversational chat messages.",
    ],
    troubleshooting: [
      {
        check: "Is the provider endpoint reachable?",
        expected: "HTTP 200 with low latency.",
        remediation: "Verify internet connection and inspect Provider Settings for correct base URL.",
      },
    ],
    relatedArticles: ["provider-credentials", "diagnostics-overview"],
    relatedActions: [
      { type: "route", path: "/settings?tab=providers", label: "Provider Settings" },
      { type: "route", path: "/diagnostics", label: "Run Provider Reachability Test" },
    ],
    version: "1.0.0",
    lastReviewedVersion: "0.1.0",
  },

  // ─── CHAT ───
  {
    id: "chat-studio-basics",
    categoryId: "chat",
    title: "Chat Studio, Streaming & Cancellation",
    summary: "Managing conversations, real-time token streaming, and cooperative cancellation.",
    keywords: ["chat", "streaming", "cancellation", "tokens", "session", "stop"],
    content: [
      "Chat Studio provides real-time Server-Sent Events (SSE) token streaming, rendering responses incrementally as they are generated by the active model.",
      "You can cancel active generation at any time by pressing Escape or clicking the Stop button. Cancellation uses a cooperative cancellation hierarchy that immediately terminates active HTTP connections without leaving orphaned background tasks.",
      "Cancelled prompts never persist partial assistant completions as final messages, preserving the clean state of your conversation history.",
    ],
    relatedArticles: ["history-and-search", "how-routing-works"],
    relatedActions: [
      { type: "route", path: "/chat", label: "Open Chat Studio" },
      { type: "route", path: "/history", label: "View History" },
    ],
    version: "1.0.0",
    lastReviewedVersion: "0.1.0",
  },
  {
    id: "context-window-and-token-guardrails",
    categoryId: "chat",
    title: "Context Windows, Token Estimation & Request Size Guardrails",
    summary: "Understanding model context limits, prompt preflight, token estimation, and safe context reduction.",
    keywords: [
      "context window",
      "tokens",
      "preflight",
      "token estimation",
      "guardrails",
      "context limit",
      "headroom",
      "recent messages",
      "output tokens",
      "input tokens",
    ],
    content: [
      "Every AI model operates within a finite token capacity known as its Context Window. Nano Route includes a built-in Context Window Management and Request Size Guardrail engine to prevent avoidable transmission failures, excessive billing, and runaway prompt growth.",
      "1. Context Limits vs Token Types:",
      "- Total Context Window: The absolute maximum tokens (input tokens + output tokens) that the model can process in a single request.",
      "- Input Limit: The maximum number of tokens allowed in the prompt, system instructions, and conversation history.",
      "- Output Limit: The maximum number of completion tokens the model can generate in its response.",
      "2. Local Token Estimation Heuristic: Nano Route estimates token counts locally using ~3.8 characters per token plus protocol framing overhead (+4 tokens per message turn). This operates completely offline with zero remote telemetry or vendor tokenization calls.",
      "3. Why Estimates May Differ from Provider Billing: Different AI providers use proprietary BPE/WordPiece tokenizers (e.g., tiktoken for OpenAI, SentencePiece for Gemini). Preflight counts are approximate (~), while post-request telemetry records reflect exact provider-reported values.",
      "4. Request Preflight & Headroom: Before transmitting an outbound request, Nano Route checks if the combined input and requested output tokens fit comfortably within the candidate model. If usage enters the safety buffer (>= 80%), a non-blocking warning is displayed. If the request definitely exceeds the context limit, it is blocked locally to save cost, quota, and time.",
      "5. Safe, Non-Destructive Context Reduction: In Chat Studio, you can switch to 'Recent Messages Window' mode to transmit only the most recent conversation turns (e.g., last 10 messages). Crucially, older messages REMAIN preserved in local SQLite History and are NEVER deleted!",
      "6. Starting a New Conversation: If a conversation becomes too extensive, starting a new chat session gives you a clean context window while leaving the previous session intact in History.",
    ],
    whatItDoes: "Calculates conversation token requirements, verifies model context headroom, warns on near-limit states, and blocks oversized requests locally.",
    troubleshooting: [
      {
        check: "Why was a request blocked with CONTEXT_LIMIT_EXCEEDED?",
        expected: "The conversation history and prompt exceed the model's supported context window.",
        remediation: "Click the Context indicator in Chat Studio to open Context Review, select 'Recent Messages' mode, switch to a larger-context model (like Gemini 1.5 Pro or Claude 3.5 Sonnet), or start a new conversation.",
      },
      {
        check: "Why is available output capacity lower than expected?",
        expected: "Output capacity is bounded by remaining context headroom (context_window - input_tokens) and model maxOutputTokens.",
        remediation: "Reduce prompt size or select Recent Messages mode to free up output capacity.",
      },
    ],
    relatedArticles: ["chat-studio-basics", "history-and-search", "provider-budget-guardrails-and-quota-awareness"],
    relatedActions: [
      { type: "route", path: "/chat", label: "Open Chat Studio" },
      { type: "route", path: "/settings?tab=models", label: "Inspect Model Limits" },
    ],
    version: "1.0.0",
    lastReviewedVersion: "0.1.0",
  },
  {
    id: "history-and-search",
    categoryId: "chat",
    title: "Conversation History & Local Search",
    summary: "Browsing, searching, pinning, and deleting local conversations.",
    keywords: ["history", "search", "sessions", "pinned", "delete", "messages"],
    content: [
      "All conversations in Nano Route are persisted locally in SQLite under Write-Ahead Logging (WAL) mode for maximum data integrity.",
      "The History workspace provides fast lexical search across session titles, prompt text, and assistant replies.",
      "You can pin important sessions to keep them at the top of the history list, or permanently purge individual sessions or all history from the Privacy & Data controls.",
    ],
    relatedArticles: ["chat-studio-basics", "privacy-guarantees"],
    relatedActions: [
      { type: "route", path: "/history", label: "Open History Workspace" },
      { type: "route", path: "/settings?tab=privacy", label: "Data Wipe Settings" },
    ],
    version: "1.0.0",
    lastReviewedVersion: "0.1.0",
  },

  // ─── ANALYTICS ───
  {
    id: "telemetry-and-savings",
    categoryId: "analytics",
    title: "Telemetry, Token Usage & Cost Savings",
    summary: "How cost and savings metrics are computed against frontier baselines.",
    keywords: ["analytics", "cost", "tokens", "savings", "telemetry", "metrics"],
    content: [
      "Nano Route tracks operational telemetry locally to give you full visibility into token consumption, inference latency, and estimated cost savings.",
      "Cost savings are calculated by comparing the actual cost of the routed candidate (or $0.00 for local SLM) against a standardized frontier baseline (GPT-4o).",
      "Telemetry records never store user prompt strings or assistant responses. You can inspect or clear all telemetry records at any time from Settings.",
    ],
    relatedArticles: ["history-and-search", "privacy-guarantees"],
    relatedActions: [
      { type: "route", path: "/", label: "View Dashboard Analytics" },
      { type: "route", path: "/settings?tab=privacy", label: "Telemetry Controls" },
    ],
    version: "1.0.0",
    lastReviewedVersion: "0.1.0",
  },

  // ─── SETTINGS ───
  {
    id: "settings-overview",
    categoryId: "settings",
    title: "Application Settings Overview",
    summary: "Configuring general options, providers, models, routing, and data controls.",
    keywords: ["settings", "general", "providers", "models", "privacy", "configuration"],
    content: [
      "Nano Route's Settings page organizes all application configurations into dedicated tabs:",
      "- General: Window state, theme preferences, and update channel selection.",
      "- Providers: Enable/disable providers and securely store DPAPI credentials.",
      "- Models: Review model catalog capabilities and routing context bounds.",
      "- Routing: Configure preference profiles and manual candidate overrides.",
      "- Privacy & Data: Manage local SQLite storage, export verified backups, and clear telemetry.",
    ],
    relatedArticles: ["provider-credentials", "routing-preference-profiles", "backup-and-recovery"],
    relatedActions: [
      { type: "route", path: "/settings", label: "Open Settings" },
    ],
    version: "1.0.0",
    lastReviewedVersion: "0.1.0",
  },

  // ─── DIAGNOSTICS ───
  {
    id: "diagnostics-overview",
    categoryId: "diagnostics",
    title: "Diagnostics Center & Self-Tests",
    summary: "Running Quick Check, Full Check, and generating sanitized support reports.",
    keywords: ["diagnostics", "quick check", "full check", "support report", "health", "test"],
    content: [
      "The Diagnostics Center provides structured, read-mostly visibility into the operational health of all core Nano Route subsystems.",
      "Quick Check inspects local subsystems (database, DPAPI vault, SLM presence, update staging, recovery readiness) with zero outbound network calls.",
      "Full Check adds opt-in provider reachability probes and synthetic SLM inference benchmarking.",
      "If you experience an issue, you can generate a sanitized Diagnostic Report that redacts all secret keys and chat content before saving.",
    ],
    troubleshooting: [
      {
        check: "Are all core tests showing PASS?",
        expected: "Overall health status 'HEALTHY'.",
        remediation: "Inspect individual failing test rows and click 'Open Settings' to resolve missing configurations.",
      },
    ],
    relatedArticles: ["slm-self-test", "provider-health"],
    relatedActions: [
      { type: "route", path: "/diagnostics", label: "Open Diagnostics Center" },
    ],
    version: "1.0.0",
    lastReviewedVersion: "0.1.0",
  },

  // ─── UPDATES ───
  {
    id: "update-lifecycle",
    categoryId: "updates",
    title: "Secure Update Lifecycle & Integrity Verification",
    summary: "How updates are checked, verified via SHA-256 checksums, and safely staged.",
    keywords: ["updates", "updater", "version", "sha256", "verification", "lifecycle"],
    content: [
      "Nano Route features a secure update lifecycle designed to prevent interrupted or unauthenticated software modifications.",
      "Every update package is cryptographically verified against a 64-character SHA-256 digest before staging. Updates strictly require HTTPS transport.",
      "If an update requires a database migration, Nano Route creates an automatic safety snapshot before applying changes, allowing seamless rollback if needed.",
    ],
    relatedArticles: ["backup-and-recovery", "diagnostics-overview"],
    relatedActions: [
      { type: "route", path: "/settings?tab=general", label: "Check for Updates" },
    ],
    version: "1.0.0",
    lastReviewedVersion: "0.1.0",
  },

  // ─── RECOVERY ───
  {
    id: "backup-and-recovery",
    categoryId: "recovery",
    title: "Disaster Recovery & Backup Management",
    summary: "Creating verified user-data snapshots and restoring SQLite databases safely.",
    keywords: ["backup", "restore", "recovery", "snapshot", "disaster", "manifest"],
    content: [
      "Nano Route includes built-in disaster recovery to protect your conversation history, settings, and telemetry.",
      "Backups generate a verified SQLite database snapshot paired with an immutable JSON manifest containing SHA-256 integrity digests.",
      "To prevent accidental data loss, restoring a backup requires explicit typing of the confirmation token 'RESTORE' and automatically takes a pre-restore safety snapshot.",
    ],
    troubleshooting: [
      {
        check: "Is backup manifest valid?",
        expected: "SHA-256 checksum matches stored file exactly.",
        remediation: "If manifest validation fails, restore is blocked to protect against database corruption.",
      },
    ],
    relatedArticles: ["update-lifecycle", "privacy-guarantees"],
    relatedActions: [
      { type: "route", path: "/settings?tab=privacy", label: "Manage Backups" },
    ],
    version: "1.0.0",
    lastReviewedVersion: "0.1.0",
  },

  // ─── STEP 68 SESSION CONTINUITY & RESUME ───
  {
    id: "session-continuity-and-restoration",
    categoryId: "recovery",
    title: "Workspace Session Continuity & Safe Restoration",
    summary: "How Nano Route restores your safe workspace navigation context after restart or unexpected termination.",
    keywords: ["session", "continuity", "restore", "resume", "crash recovery", "restart", "workspace"],
    content: [
      "Nano Route includes a local session continuity system that restores your safe navigation context after application restart, Windows reboot, or unexpected termination.",
      "1. What Nano Route Restores: Your last visited application route (e.g. Chat, History, Settings), active workspace profile ID, and sidebar layout.",
      "2. What Nano Route DOES NOT Restore: Active streaming requests, token generation, Tokio task handles, native sockets, or uncommitted database operations.",
      "Important Note: Restoring the workspace does not resume interrupted provider or SLM operations.",
      "3. Crash Recovery Behavior: If the application terminates abnormally, Nano Route detects the unexpected exit, restores the last known safe snapshot, and informs you via a non-intrusive notification. If a crash occurred on an unstable route, safe fallback to the Dashboard is applied automatically to prevent crash loops.",
      "4. User Control: You can toggle automatic session restoration in Settings > General > 'Restore Previous Workspace Session'.",
    ],
    troubleshooting: [
      {
        check: "Did Nano Route open to the Dashboard instead of your last route?",
        expected: "Normal behavior if session restoration is disabled, or if previous session state was corrupted or caused an unexpected exit.",
        remediation: "Verify Settings > General > 'Restore Previous Workspace Session' is enabled.",
      },
    ],
    relatedArticles: ["backup-and-recovery", "diagnostics-overview"],
    relatedActions: [
      { type: "route", path: "/settings?tab=general", label: "General Settings" },
    ],
    version: "1.0.0",
    lastReviewedVersion: "0.1.0",
  },
  {
    id: "application-reset-and-factory-defaults",
    categoryId: "recovery",
    title: "Application Reset & Factory Defaults Guide",
    summary: "Understand the differences between preference reset, workspace reset, credential removal, data cleanup, and factory reset.",
    keywords: ["reset", "factory reset", "defaults", "erase data", "wipe", "restore defaults", "credentials", "profiles"],
    content: [
      "Nano Route provides a controlled reset framework with clear separation between non-destructive adjustments and permanent data erasures:",
      "1. Reset Interface Preferences: Restores appearance, theme, density, typography, and notification preferences to default values without affecting chat history, credentials, or telemetry.",
      "2. Reset Workspace Profiles: Deletes user-created custom profiles, sets active profile back to 'Default Balanced', and resets sidebar layout without touching conversation history.",
      "3. Reset Session State: Clears saved route navigation and layout snapshots so the application starts fresh at the Dashboard.",
      "4. Remove Provider Credential: Safely deletes the Windows DPAPI-encrypted API key for an individual provider without modifying other configured providers.",
      "5. Reset Application Configuration: Reverts routing modes, telemetry switches, retention policies, and model routing parameters to factory defaults while preserving chat messages and credentials.",
      "6. Clear Selected User Data: Selectively purges chat history or telemetry records from local SQLite storage.",
      "7. Erase All Local User Data: Permanently deletes all conversation sessions, messages, and telemetry from the local database while preserving independent backup archives.",
      "8. Factory Reset: Complete restoration to pristine post-installation baseline. Erases all chats, telemetry, DPAPI credentials, settings, and custom profiles, and re-activates the initial onboarding wizard for the next launch.",
      "Safety Invariant: High-impact and factory reset operations require typed confirmation tokens (e.g. 'FACTORY RESET') and offer to generate a verified SQLite backup archive first.",
    ],
    troubleshooting: [
      {
        check: "Are you unsure if Factory Reset will delete your backups?",
        expected: "Backups are stored as independent *.db files on disk and are not deleted by Factory Reset.",
        remediation: "You can find your backup archives in Settings > Privacy & Data > Backups.",
      },
    ],
    relatedArticles: ["backup-and-recovery", "privacy-guarantees", "session-continuity-and-restoration"],
    relatedActions: [
      { type: "route", path: "/settings?tab=reset", label: "Reset Settings" },
    ],
    version: "1.0.0",
    lastReviewedVersion: "0.1.0",
  },

  // ─── PRIVACY & SECURITY ───
  {
    id: "privacy-guarantees",
    categoryId: "privacy-security",
    title: "Privacy & Data Storage Guarantees",
    summary: "Clear distinctions between on-device processing and optional provider network calls.",
    keywords: ["privacy", "security", "data", "storage", "telemetry", "gdpr", "local-first"],
    content: [
      "Nano Route operates under a strict local-first privacy model:",
      "1. What stays local: Chat conversations, SQLite database, telemetry aggregates, DPAPI credential keys, and local SLM model weights never leave your computer.",
      "2. What leaves the machine: When you explicitly send a prompt routed to a cloud provider, only that specific prompt text and system instructions are transmitted via encrypted HTTPS to that designated provider.",
      "3. Zero third-party analytics: Nano Route includes zero external trackers, advertising SDKs, or background telemetry beacons.",
    ],
    relatedArticles: ["provider-credentials", "telemetry-and-savings"],
    relatedActions: [
      { type: "route", path: "/settings?tab=privacy", label: "Privacy Settings" },
    ],
    version: "1.0.0",
    lastReviewedVersion: "0.1.0",
  },
  {
    id: "user-data-export-and-portability",
    categoryId: "privacy-security",
    title: "User Data Export & Privacy Portability Guide",
    summary: "How to export your locally stored chats, preferences, profiles, and telemetry to JSON or CSV.",
    keywords: ["export", "data export", "portability", "json", "csv", "download", "privacy", "disclosure"],
    content: [
      "Nano Route provides a local-first user data export and privacy portability system designed to give you complete visibility and ownership over your data.",
      "1. Export is Disclosure, Not Deletion: Exporting creates a portable copy for inspection, archiving, or transfer. Generating an export never deletes or modifies your local database records.",
      "2. Exportable Categories: You can selectively export (a) Chat conversations and messages, (b) UI preferences, (c) Workspace profiles, (d) Operational telemetry and cost analytics, and (e) Provider catalog descriptors.",
      "3. Strict Secret Exclusion: Windows DPAPI credentials, encrypted API keys, and bearer tokens are strictly barred from all exports. Plaintext keys are never written to exported files.",
      "4. Supported Formats: Choose between structured JSON packages, tabular RFC 4180 CSV tables, or combined packages.",
      "5. CSV Formula Injection Defense: If CSV format is selected, cell values starting with formula characters (=, +, -, @) are automatically sanitized to prevent spreadsheet macro execution.",
      "6. External File Responsibility: Once files are exported outside Nano Route, operating system file permissions govern access. Protect your exported files appropriately.",
    ],
    troubleshooting: [
      {
        check: "Does your exported CSV open with leading single quotes?",
        expected: "This is deliberate formula injection defense (CWE-1236) to prevent spreadsheet applications from executing untrusted text as formulas.",
        remediation: "No remediation required. The underlying text remains completely intact.",
      },
    ],
    relatedArticles: ["privacy-guarantees", "backup-and-recovery", "application-reset-and-factory-defaults"],
    relatedActions: [
      { type: "route", path: "/settings?tab=export", label: "Data Export Settings" },
    ],
    version: "1.0.0",
    lastReviewedVersion: "0.1.0",
  },
  {
    id: "user-data-import-and-migration",
    categoryId: "privacy-security",
    title: "User Data Import & Migration Assistant Guide",
    summary: "How to safely import conversations, preferences, and profiles from Nano Route export packages.",
    keywords: ["import", "data import", "migration", "merge", "conflict", "portability", "json", "restore"],
    content: [
      "Nano Route includes a robust User Data Import and Migration Assistant for restoring conversations, preferences, and profiles from previously generated export packages (nano-route-export-package-v1).",
      "1. Untrusted Input Boundary: All imported files are treated as untrusted. They are strictly validated against schema contracts before any local database modifications can occur.",
      "2. Permanent Credential Rejection: API keys, tokens, DPAPI blobs, or credentials present in imported files are detected and permanently stripped at the parser boundary. Nano Route never imports or stores untrusted external keys.",
      "3. Configurable Collision Policies: Choose how to handle conflicting records: (a) Skip Duplicates ensures existing records remain untouched, (b) Import as New creates distinct copies with new IDs, and (c) Keep Existing preserves current preferences.",
      "4. Pre-Import Safety Snapshots: A full database safety backup can be created automatically prior to applying changes, allowing seamless recovery in the event of an unintended import.",
      "5. Automatic Search Index Rebuilding: When chat conversations are imported, the SQLite FTS5 search index is automatically re-indexed to ensure full searchability across past prompts and responses.",
      "6. Offline Operation: Importing never contacts external servers or cloud providers to validate historical data.",
    ],
    troubleshooting: [
      {
        check: "Why is my import file marked as 'Incompatible package format'?",
        expected: "Nano Route requires valid 'nano-route-export-package-v1' JSON packages generated via Data Export.",
        remediation: "Ensure the file was generated from Nano Route Data Export and has not been truncated or corrupted.",
      },
      {
        check: "Did importing wipe my existing conversations?",
        expected: "Imports are non-destructive and additive. By default, existing items are skipped or safely appended.",
        remediation: "Check your Chat Studio session list or use Disaster Recovery to restore your pre-import safety backup if needed.",
      },
    ],
    relatedArticles: ["user-data-export-and-portability", "privacy-guarantees", "backup-and-recovery"],
    relatedActions: [
      { type: "route", path: "/settings?tab=import", label: "Data Import Assistant" },
    ],
    version: "1.0.0",
    lastReviewedVersion: "0.1.0",
  },
  {
    id: "data-integrity-and-reconciliation",
    categoryId: "privacy-security",
    title: "Post-Import Reconciliation & Data Integrity Guide",
    summary: "How to verify database integrity, foreign keys, search index synchronicity, and perform safe targeted repairs.",
    keywords: ["integrity", "reconciliation", "repair", "database", "foreign keys", "fts5", "consistency", "corrupt"],
    content: [
      "Nano Route includes a deterministic Data Integrity & Reconciliation system to verify local database health, conversational parent-child linkages, FTS5 search index synchronicity, and configuration conformity.",
      "1. Verification First, Repair Second: Running integrity checks is completely read-only and never silently mutates user records. Any safe repair requires explicit user confirmation.",
      "2. Controlled Status Vocabulary: Results are classified objectively into PASS, PASS_WITH_WARNING, INCONSISTENT, or CORRUPT. Ambiguity is never falsely reported as corruption.",
      "3. Relational Foreign Key Integrity: Verifies that all chat messages correctly reference existing conversation sessions, flagging orphaned message rows.",
      "4. Search Index Synchronicity: Compares SQLite FTS5 index counts against stored message tables, offering a zero-data-loss rebuild action if an entry mismatch occurs.",
      "5. Targeted Safe Repairs: Approved repairs (such as Rebuilding Search Index or Pruning Orphaned Messages) operate transactionally and verify post-repair consistency.",
      "6. Disaster Recovery Integration: If deep database corruption is identified, users are guided to Disaster Recovery rather than attempting speculative or risky writes.",
    ],
    troubleshooting: [
      {
        check: "What should I do if a check reports 'INCONSISTENT'?",
        expected: "Inconsistencies (such as search index drift or orphan messages) can be resolved safely using the 'Repair Issue' button.",
        remediation: "Click 'Repair Issue' next to the finding to view a preview and execute the safe repair.",
      },
      {
        check: "What if a check reports 'CORRUPT'?",
        expected: "Corrupt status indicates structural database damage where automated local repair is unsafe.",
        remediation: "Navigate to Settings -> Reset & Recovery to restore a known-good backup created by the Disaster Recovery system.",
      },
    ],
    relatedArticles: ["user-data-import-and-migration", "privacy-guarantees", "backup-and-recovery"],
    relatedActions: [
      { type: "route", path: "/settings?tab=integrity", label: "Data Integrity Center" },
    ],
    version: "1.0.0",
    lastReviewedVersion: "0.1.0",
  },
  {
    id: "preventive-maintenance-and-data-health",
    categoryId: "privacy-security",
    title: "Data Health Monitoring & Preventive Maintenance Guide",
    summary: "How to monitor local storage overhead, clean stale temporary staging files, and run safe housekeeping.",
    keywords: ["maintenance", "housekeeping", "temporary files", "staging", "health", "optimization", "clean"],
    content: [
      "Nano Route provides a local, low-overhead Preventive Maintenance and Data Health Monitoring system to detect gradual storage overhead and keep local data structures running efficiently.",
      "1. Monitoring vs Maintenance vs Repair: Monitoring evaluates current state without making changes. Maintenance performs safe, bounded housekeeping. Repair resolves specific integrity violations.",
      "2. No Silent Self-Healing: The application never silently deletes chat history, resets preferences, or changes credentials. Housekeeping operations are explicit and documented.",
      "3. Safe Temporary Staging Cleanup: Deletes abandoned export or import staging files older than 24 hours while ensuring active streaming or file tasks remain completely uninterrupted.",
      "4. Operation Safety Locks: Maintenance actions are safely blocked during active prompt streaming, backup generation, or update installation to prevent concurrency conflicts.",
      "5. Automatic Lightweight Housekeeping: Low-impact operations (such as clearing stale locks or pruning expired temporary staging files) can run automatically without user friction.",
      "6. Complete Verification & History: Every housekeeping operation logs a bounded summary entry and re-verifies target health status.",
    ],
    troubleshooting: [
      {
        check: "Why is a maintenance action marked as 'Blocked'?",
        expected: "Maintenance actions are locked whenever prompt streaming, database writes, backups, or updates are active.",
        remediation: "Wait for the active chat stream or backup to complete before retrying the maintenance action.",
      },
    ],
    relatedArticles: ["data-integrity-and-reconciliation", "privacy-guarantees", "backup-and-recovery"],
    relatedActions: [
      { type: "route", path: "/settings?tab=maintenance", label: "Maintenance Center" },
    ],
    version: "1.0.0",
    lastReviewedVersion: "0.1.0",
  },

  // ─── ACCESSIBILITY ───
  {
    id: "accessibility-and-shortcuts",
    categoryId: "accessibility",
    title: "Accessibility, Screen Readers & Keyboard Shortcuts",
    summary: "Complete keyboard navigation instructions, high-contrast support, and ARIA landmarks.",
    keywords: ["accessibility", "keyboard", "shortcuts", "screen reader", "aria", "focus"],
    content: [
      "Nano Route is designed to be fully navigable without a mouse, adhering to WCAG 2.1 AA accessibility guidelines.",
      "Core Keyboard Shortcuts:",
      "- Tab / Shift+Tab: Move logical focus through interactive elements.",
      "- Enter / Space: Activate focused buttons, open expandable rows, or submit forms.",
      "- Escape: Cancel active streaming in Chat Studio or dismiss open modals.",
      "- Ctrl+Enter: Send prompt from the chat input box.",
      "Screen Reader Support: All regions utilize semantic ARIA landmarks (main, navigation, region), live status announcements for async operations, and non-color-dependent status cues.",
    ],
    relatedArticles: ["chat-studio-basics", "diagnostics-overview"],
    relatedActions: [
      { type: "route", path: "/", label: "Dashboard Home" },
    ],
    version: "1.0.0",
    lastReviewedVersion: "0.1.0",
  },

  // ─── PROMPT TEMPLATES & PRESETS ───
  {
    id: "prompt-templates-and-presets",
    categoryId: "chat",
    title: "Prompt Templates & Request Presets",
    summary: "Create, organize, resolve variables, and safely insert reusable prompt templates into the Composer.",
    keywords: ["templates", "presets", "prompts", "placeholders", "variables", "reuse", "composer"],
    content: [
      "Nano Route includes a local-first Prompt Templates & Request Presets library designed to streamline recurring drafting tasks while preserving full user oversight and safety.",
      "Key Principles & Operational Behavior:",
      "1. Composition Layer Only: Applying a template or preset only ever populates the Composer draft text. It never executes code, never accesses external networks, and never bypasses human review. Prompts are never automatically submitted without explicit user confirmation.",
      "2. Variable Placeholders: Define structured variables using {{variable_name}} syntax. When applying a template with placeholders, a Variable Resolution dialog appears to let you populate values and inspect live resolved preview before inserting into the Composer.",
      "3. Strict Validation & Safety: Template names are capped at 100 characters and content at 32,768 characters. Script tags (<script>) and active macros are strictly rejected during parsing and saving.",
      "4. Complete Data Portability: Templates can be exported to JSON packages and imported using standard conflict resolution strategies (Skip, Overwrite, or Keep Both). Templates are stored locally and are completely independent of secret credentials.",
      "5. Full Downstream Integration: Once inserted into the Composer, the prompt draft seamlessly passes through Context Preflight (token estimation and context limits) and Budget Guardrails before routing to local SLMs or cloud providers.",
    ],
    troubleshooting: [
      {
        check: "Why did a template fail validation when saving?",
        expected: "Template names must be between 1 and 100 characters, content must not exceed 32KB, and content must not contain script tags or invalid placeholder syntax.",
        remediation: "Check the validation errors listed in the template editor, remove any script tags or unclosed braces, and ensure required fields are filled.",
      },
    ],
    relatedArticles: ["chat-studio-basics", "history-and-search", "context-window-and-token-guardrails"],
    relatedActions: [
      { type: "route", path: "/chat", label: "Open Chat Studio" },
    ],
    version: "1.0.0",
    lastReviewedVersion: "0.1.0",
  },
];

