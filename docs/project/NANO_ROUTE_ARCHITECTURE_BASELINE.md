# NANO ROUTE — ARCHITECTURE BASELINE & DESIGN LOCK
**Document Version:** 1.1.0  
**Step:** 2 of 50 — Tauri v2 + Rust + React + TypeScript Project Foundation  
**Date:** November 2026  
**Status:** APPROVED BASELINE (FOUNDATION ESTABLISHED)  

---

## 1. ARCHITECTURAL HIERARCHY & COMPONENT STATUS

The following diagram maps the target architecture for Nano Route. Every block is explicitly marked with its status: **[EXISTING ASSET]**, **[FOUNDATION IMPLEMENTED]**, or **[PLANNED]**.

```text
+-------------------------------------------------------------------------------+
|                       NANO ROUTE SYSTEM ARCHITECTURE                          |
+-------------------------------------------------------------------------------+

[EXISTING ASSET]
* Brand Identity & Visual Asset: "Nano Route Neon Tech Logo.png" (Root)

---------------------------------------------------------------------------------

[FOUNDATION IMPLEMENTED - React 18 + TypeScript + Vite 5]
|
+---> Presentation Root [FOUNDATION IMPLEMENTED]
|     +-- Entry Point (`index.html`, `src/main.tsx`) [FOUNDATION IMPLEMENTED]
|     +-- Foundation Root Component (`src/App.tsx`) [FOUNDATION IMPLEMENTED]
|     +-- Base Theme Styles (`src/index.css`, `src/App.css`) [FOUNDATION IMPLEMENTED]
|     +-- Dashboard & Health Monitor View [PLANNED - Step 18]
|     +-- Chat Studio (Multi-turn, Streaming) [PLANNED - Steps 19-21]
|     +-- Router Engine Matrix (Weights, Rules) [PLANNED - Step 22]
|     +-- Provider & Key Management [PLANNED - Step 23]
|     +-- Telemetry & Cost Analytics View [PLANNED - Step 24]
|
+---> Frontend State & Store (Zustand) [PLANNED - Step 3+]
|     +-- Session Store [PLANNED]
|     +-- Provider Configuration Store [PLANNED]
|     +-- Routing Telemetry Store [PLANNED]
|
+---> Tauri IPC Client Wrapper [FOUNDATION IMPLEMENTED]
      +-- Typed Command Invocation (`invoke("cmd_health_check")`) [FOUNDATION IMPLEMENTED]
      +-- Streaming Event Listeners (`listen("stream-chunk")`) [PLANNED - Step 10]

==================================== TAURI IPC ==================================
  [FOUNDATION IMPLEMENTED] Tauri v2 IPC Bridge with Capability & Permission Enforcement
  - Capability Configuration (`src-tauri/capabilities/default.json`) [FOUNDATION IMPLEMENTED]
  - Command Channel: Async typed request/response with JSON serialization [FOUNDATION IMPLEMENTED]
  - Event Channel: Push-based unidirectional streaming tokens from Rust to WebView [PLANNED]
=================================================================================

[FOUNDATION IMPLEMENTED - Rust + Tauri v2 Core Scaffold]
|
+---> Tauri Command Router & Capability Filter [FOUNDATION IMPLEMENTED]
|     +-- `cmd_health_check` [FOUNDATION IMPLEMENTED]
|     +-- `cmd_send_chat_message` [PLANNED - Step 10]
|     +-- `cmd_test_provider_key` [PLANNED - Step 6]
|     +-- `cmd_save_provider_key` [PLANNED - Step 5]
|     +-- `cmd_get_routing_metrics` [PLANNED - Step 15]
|     +-- `cmd_get_chat_history` [PLANNED - Step 4]
|     +-- `cmd_test_provider_key` [PLANNED]
|     +-- `cmd_save_provider_key` [PLANNED]
|     +-- `cmd_get_routing_metrics` [PLANNED]
|     +-- `cmd_get_chat_history` [PLANNED]
|
+---> Intelligent Router Engine [PLANNED]
|     +-- Task Complexity Classifier [PLANNED]
|     +-- Cost-Latency-Quality Scoring Matrix [PLANNED]
|     +-- Fallback & Retry Cascade Manager [PLANNED]
|
+---> Local SLM Inference Subsystem [PLANNED]
|     +-- Runtime Engine (ONNX Runtime / DirectML or Llama.cpp GGUF) [PLANNED]
|     +-- Tokenizer & Prompt Template Formatter [PLANNED]
|     +-- Local Heuristic Intent Fallback Classifier [PLANNED]
|
+---> Unified Provider Client Engine [PLANNED]
|     +-- Base `ProviderClient` Async Trait [PLANNED]
|     +-- Anthropic Claude Client [PLANNED]
|     +-- OpenAI Client [PLANNED]
|     +-- Google Gemini Client [PLANNED]
|     +-- Groq High-Speed Client [PLANNED]
|     +-- Local Endpoint Client (Ollama / LM Studio) [PLANNED]
|     +-- Streaming Token Buffer & Backpressure Handler [PLANNED]
|
+---> Security & Credential Subsystem [PLANNED]
|     +-- Windows DPAPI (Crypt32) Native Encryptor [PLANNED]
|     +-- In-Memory Secure Key Cache [PLANNED]
|     +-- Zero-Leak Masking Policy [PLANNED]
|
+---> Persistence & Storage Subsystem [PLANNED]
|     +-- SQLite Connection Pool (WAL mode, foreign keys active) [PLANNED]
|     +-- Migration Runner [PLANNED]
|     +-- Session & Message Repository [PLANNED]
|     +-- Telemetry & Token Expenditure Repository [PLANNED]
|     +-- Encrypted Settings Repository [PLANNED]
|
+---> Background Execution & Task Scheduling [PLANNED]
      +-- Tokio Multi-Thread Async Runtime [PLANNED]
      +-- Dedicated Blocking Thread Pool for SLM Inference [PLANNED]

=============================== EXTERNAL BOUNDARY ===============================
  [PLANNED] External AI Providers & Endpoints (Outbound HTTPS / Localhost HTTP)
  - Anthropic API: `api.anthropic.com`
  - OpenAI API: `api.openai.com`
  - Gemini API: `generativelanguage.googleapis.com`
  - Groq API: `api.groq.com`
  - Localhost Ollama: `127.0.0.1:11434`
=================================================================================
```

---

## 2. COMPONENT DEEP DIVE & CURRENT STATUS

### 2.1 Frontend Presentation Tier
- **Current Status:** **PLANNED** (0 components implemented).
- **Architecture:** Single Page Application (SPA) embedded inside Windows WebView2 via Tauri v2.
- **Key Boundaries:** The frontend is strictly untrusted with respect to credentials. It never sees raw API keys or executes raw SQL queries.

### 2.2 Tauri IPC Boundary
- **Current Status:** **PLANNED**.
- **Protocols:**
  - `invoke(command, payload)`: Typed command/response handling for database reads, configuration updates, and prompt submission.
  - `listen(event_name, handler)`: High-throughput token streaming using Tauri's push event bus. Each chunk carries token deltas, timing telemetry, and source provider metadata.
- **Capabilities & Permissions:** Tauri v2 capability files (`src-tauri/capabilities/default.json`) will strictly restrict window permissions and disable dangerous shell/filesystem plugins from the WebView context.

### 2.3 Rust Native Core
- **Current Status:** **PLANNED**.
- **Runtime Model:** Multi-threaded asynchronous execution managed by `tokio`.
  - Tokio worker threads handle non-blocking HTTP requests and streaming events.
  - Dedicated `std::thread` or `tokio::task::spawn_blocking` instances handle CPU-intensive SLM inference to avoid starving the async network reactor.
- **Persistence Architecture:** Embedded SQLite running in Write-Ahead Logging (`WAL`) mode with `PRAGMA foreign_keys = ON;` and `PRAGMA busy_timeout = 5000;`.
- **Security Engine:** Direct integration with Windows Win32 API (`CryptProtectData` and `CryptUnprotectData` via `windows-sys` or `dpapi` Rust crate). Keys are encrypted with the active Windows user session before persisting to SQLite.

### 2.4 AI Routing & Provider Architecture
- **Current Status:** **PLANNED**.
- **Routing Decision Pipeline:**
  1. *Prompt Ingestion:* User message received in Rust core.
  2. *Feature Extraction:* Token count, presence of code, analytical tone, multimodal attachments, complexity markers.
  3. *Local SLM / Heuristic Classification:* Local model generates a structured routing vector: `{ task_type: "code_gen", complexity: "high", speed_priority: 0.2, cost_sensitivity: 0.8 }`.
  4. *Scoring & Provider Selection:* Model scored against active configured models in dynamic registry.
  5. *Dispatch & Streaming:* Outbound request sent to selected provider.
  6. *Fallback Cascade:* In case of HTTP 429 / 503 / timeout, fallback policy sequentially dispatches to secondary provider candidate.
  7. *Telemetry Commit:* Latency, input/output tokens, estimated cost, and router decision metrics committed asynchronously to SQLite.

---

## 3. ARCHITECTURAL RISKS & MITIGATION STRATEGY

| Risk ID | Identified Risk | Impact | Architectural Mitigation |
|---|---|---|---|
| **AR-001** | Missing Rust toolchain on host system | Blocking for Tauri builds | Document prerequisite in Step 1; install Rustup + MSVC build tools prior to Step 2 compilation. |
| **AR-002** | Local SLM inference CPU/RAM starvation | UI freezing / system lag | Isolate SLM inference in dedicated background worker thread pool; support lightweight quantized models (Q4_K_M) and rule-based heuristic fallbacks. |
| **AR-003** | High IPC overhead on streaming tokens | WebView stutter at high token rates (e.g. Groq 200+ tok/s) | Implement token chunk batching in Rust core (flush every ~16ms / 60fps or 10 tokens) before emitting Tauri events. |
| **AR-004** | Plaintext credential leak via debugging logs | Critical security compromise | Strict Rust `Zeroize` memory clearing on deallocation; mask keys in all logging layers; DPAPI encryption at rest. |
| **AR-005** | Upstream AI API outages / breaking schema changes | Application failure | Unified provider trait abstracts provider APIs; automatic fallback engine cascades through alternative providers. |

---
*End of Architecture Baseline Document. Source of truth for Step 1.*

