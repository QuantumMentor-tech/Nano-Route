# NANO ROUTE — REQUIREMENTS LOCK & TRACEABILITY MATRIX
**Document Version:** 1.0.0  
**Step:** 1 of 50 — Repository Audit, Requirements Lock & Project Baseline  
**Date:** November 2026  
**Status:** APPROVED BASELINE  

---

## 1. CORE ARCHITECTURAL PRINCIPLES

These ten foundational engineering principles are locked and govern all subsequent design and implementation steps.

### Principle 1: Local-First Routing Intelligence
The routing decision engine must be capable of running locally on the user's workstation without sending user prompt contents to a third-party server merely to decide which model to invoke. The router should function offline or under restricted network conditions.

### Principle 2: Native Core Ownership
Sensitive, native, and business-critical operations belong in the Rust/Tauri core rather than in the frontend WebView. The Rust core owns credential encryption, persistent database access, raw HTTP client sessions, background threads, and SLM model memory.

### Principle 3: Frontend/Native Separation
React/TypeScript communicates with Rust strictly through controlled Tauri IPC channels (`invoke` commands and listenable `event` streams). No direct native filesystem, OS API, or database handle is exposed directly to the frontend context.

### Principle 4: Provider Abstraction
All AI provider integrations (OpenAI, Anthropic Claude, Google Gemini, Groq, Mistral, Ollama, local models) must conform to a standardized, unified provider trait/interface. Routing logic must remain completely decoupled from specific provider SDK quirks.

### Principle 5: Secure Credentials
API keys, OAuth tokens, and private connection strings must never be stored in browser `localStorage`, `sessionStorage`, cookies, unencrypted files, or plain text in SQLite. Windows Data Protection API (DPAPI) is mandatory for credential encryption at rest.

### Principle 6: Non-Blocking Execution
Local SLM inference, external network I/O, database writes, and heavy token computations must execute on background threads (Tokio async tasks or dedicated worker threads). The frontend UI and Tauri main thread must never stutter, freeze, or drop frames.

### Principle 7: Local Persistence
Chat sessions, message history, routing telemetry, cost metrics, and user preferences must be persisted locally in an embedded SQLite database. The user maintains complete sovereignty over their data.

### Principle 8: Fail-Safe Behavior
External provider errors (HTTP 429 rate limits, 5xx outages, network timeouts, context-length overflows) must be trapped by a resilient fallback engine. The router automatically falls back to secondary or tertiary models according to configured policy without crashing the application.

### Principle 9: UI Preservation
The established visual language—premium dark interface, high-contrast typography, neon tech accenting matching `Nano Route Neon Tech Logo.png`—must be strictly preserved across all iterative development steps.

### Principle 10: Incremental Architecture
Every future feature must build incrementally on the established foundational layers. No full-stack rewrites, package manager swaps, or architectural churn will be permitted in later implementation steps.

---

## 2. STRUCTURED REQUIREMENTS TRACEABILITY MATRIX

| ID | Requirement Description | Category | Status | Evidence | Priority | Future Step |
|---|---|---|---|---|---|---|
| **REQ-001** | Brand Asset Preservation (`Nano Route Neon Tech Logo.png`) | Brand / UI | **EXISTING** | File present at root (670,255 bytes) | P0 | Ongoing |
| **REQ-002** | Windows Desktop Application Shell (Tauri v2) | Architecture | **PARTIAL** | Tauri v2 project & config established (`src-tauri/`) | P0 | Step 2 (Awaiting Rust toolchain) |
| **REQ-003** | Host Toolchain Setup (Rustup, Cargo, MSVC) | Toolchain | **BLOCKED** | Cargo/rustc missing on host (Reported prerequisite) | P0 | Prerequisite |
| **REQ-004** | React + TypeScript + Vite Frontend Foundation | Frontend | **EXISTING** | Fully implemented, typechecked, and built (`dist/`) | P0 | Completed (Step 2) |
| **REQ-005** | Tailwind CSS Dark Mode Design System | Styling | **EXISTING** | Tailwind v4, tokens.css, 12 UI primitives in `src/components/ui/` | P0 | Completed (Step 6) |
| **REQ-006** | Local SQLite Database Engine (Chat & Telemetry) | Persistence | **MISSING** | No database files or schema | P0 | Step 4 |
| **REQ-007** | Database Migration Management System | Persistence | **MISSING** | Migrations absent | P0 | Step 4 |
| **REQ-008** | Windows DPAPI Key Encryption at Rest | Security | **MISSING** | No DPAPI implementation in Rust | P0 | Step 5 |
| **REQ-009** | Secure In-Memory Credential Cache | Security | **MISSING** | Pre-scaffold | P0 | Step 5 |
| **REQ-010** | Zero Plaintext Credential Exposure across IPC | Security | **CONFIRMED** | Architectural Rule Locked | P0 | Step 5+ |
| **REQ-011** | Unified AI Provider Trait / Abstraction Layer | AI / Backend | **MISSING** | Provider clients absent | P0 | Step 6 |
| **REQ-012** | Anthropic Claude Provider Client (Messages API) | Providers | **MISSING** | Client absent | P1 | Step 7 |
| **REQ-013** | OpenAI Provider Client (Chat Completions) | Providers | **MISSING** | Client absent | P1 | Step 7 |
| **REQ-014** | Google Gemini Provider Client | Providers | **MISSING** | Client absent | P1 | Step 8 |
| **REQ-015** | Groq & Ultra-Fast Inference Provider Client | Providers | **MISSING** | Client absent | P1 | Step 8 |
| **REQ-016** | Local Endpoint Provider (Ollama / LocalAI / LM Studio) | Providers | **MISSING** | Client absent | P1 | Step 9 |
| **REQ-017** | Real-time Streaming Response Engine (SSE to IPC) | Streaming | **MISSING** | Streaming pipeline absent | P0 | Step 10 |
| **REQ-018** | Local SLM Router Engine (Task Analysis & Classification) | AI / SLM | **MISSING** | Inference engine absent | P0 | Step 11-13 |
| **REQ-019** | Dynamic Model Registry (Pricing, Context, Modalities) | AI / Metadata| **MISSING** | Registry absent | P1 | Step 14 |
| **REQ-020** | Multi-Factor Routing Policy Engine (Cost/Speed/Quality) | AI / Routing | **MISSING** | Policy engine absent | P0 | Step 15 |
| **REQ-021** | Resilient Automatic Fallback & Retry Cascade | AI / Routing | **MISSING** | Fallback absent | P1 | Step 16 |
| **REQ-022** | Responsive Desktop App Shell & Navigation | UI / UX | **MISSING** | Frontend views absent | P1 | Step 17 |
| **REQ-023** | Orchestration Dashboard & Live Health Monitor | UI / UX | **MISSING** | Dashboard absent | P1 | Step 18 |
| **REQ-024** | Chat Studio with Live Routing Inspector Pill | UI / UX | **MISSING** | Chat studio absent | P0 | Step 19-21 |
| **REQ-025** | Router Rule Matrix & Policy Tuning Interface | UI / UX | **MISSING** | Rule matrix absent | P1 | Step 22 |
| **REQ-026** | Provider & Key Management UI with Health Checks | UI / UX | **MISSING** | Settings UI absent | P0 | Step 23 |
| **REQ-027** | Telemetry Aggregator & Token Spend Tracker | Telemetry | **MISSING** | Telemetry engine absent | P1 | Step 24 |
| **REQ-028** | Session History & Conversation Search | Data Access | **MISSING** | Data access layer absent | P1 | Step 25 |
| **REQ-029** | Keyboard Shortcuts & Windows Accessibility (a11y) | Accessibility| **MISSING** | Shortcuts absent | P2 | Step 30 |
| **REQ-030** | Local SLM Model Engine Selection (ONNX vs GGUF) | Architecture | **OPEN DECISION** | Evaluation required in Step 11| P1 | Step 11 |
| **REQ-031** | Automated Unit & Integration Test Suite | QA / Test | **MISSING** | Test framework absent | P0 | Step 35-40 |
| **REQ-032** | Windows Packaging (MSIX / Signed NSIS / Store Ready) | Release | **MISSING** | Installer configs absent | P1 | Step 45-50 |

---

## 3. REQUIREMENTS CLASSIFICATION

### 3.1 Confirmed Requirements
1. Application runs as a native Windows desktop client using Tauri v2.
2. React + TypeScript + Tailwind CSS for the user interface.
3. Windows DPAPI encryption protects all API keys and secrets at rest.
4. Embedded SQLite database for local chat history, preferences, and telemetry.
5. Local SLM router analyzes tasks and dispatches to optimal providers without blocking the UI.
6. Unified provider abstraction covering OpenAI, Anthropic, Gemini, Groq, and local endpoints.
7. Fallback policies trigger automatically when upstream providers fail or rate-limit.
8. UI reflects the established neon tech brand aesthetic.

### 3.2 Existing Implementation
- High-resolution brand identity file: `Nano Route Neon Tech Logo.png`.

### 3.3 Missing Implementation
- All application source code, build manifests, package configurations, Rust crates, database schemas, and user interface components.

### 3.4 Open Decisions for Future Steps
- **OD-01 (Step 11): Local SLM Runtime Selection:** Choose between `ort` (ONNX Runtime with DirectML hardware acceleration) and `llama-cpp-rs` (GGUF CPU/Vulkan/CUDA).  
  *Recommendation:* ONNX Runtime via DirectML provides excellent out-of-the-box Windows GPU acceleration across Intel/AMD/Nvidia GPUs without requiring heavy external CUDA runtimes.
- **OD-02 (Step 4): SQLite Rust Driver:** Choose between `rusqlite` (synchronous with connection pooling / dedicated thread) and `sqlx` (asynchronous).  
  *Recommendation:* `rusqlite` with `r2d2` connection pooling or `sqlx-sqlite` in Tokio async mode.
- **OD-03 (Step 2): Frontend State Management:** Choose between Zustand and Jotai for lightweight reactive client state.  
  *Recommendation:* Zustand for simple, minimal boilerplate and fast TypeScript integration.

### 3.5 Optional Enhancements (Deferred Post-v1.0)
- Multi-model consensus voting (running 2+ models and synthesizing answers).
- Speculative decoding / execution across heterogeneous providers.
- Custom local fine-tuned LoRA routing adapter.
- Peer-to-peer telemetry syncing across user devices.

---
*End of Requirements Lock Document. Governed by Step 1 preservation rules.*

