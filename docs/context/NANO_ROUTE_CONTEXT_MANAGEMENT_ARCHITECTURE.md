# Nano Route — Context Window Management Architecture

**Document Version:** 1.0.0  
**Status:** Authoritative  
**Step:** 76 — Context Window Management, Prompt Size Guardrails, Token Budgeting, Request Preflight & Safe Context Optimization  
**Subsystems:** Context Engine, Model Registry, Routing Preflight, Chat Studio, SQLite Ledger  

---

## 1. Executive Summary & Fundamental Invariants

Nano Route orchestrates AI model inferences across local on-device SLMs and multiple cloud frontier providers (OpenAI, Anthropic, Google Gemini, DeepSeek, Groq, Mistral). Every AI model operates within a finite token capacity known as its Context Window.

Step 76 implements a controlled **Context Window Management and Request Size Guardrail system** designed to prevent avoidable failures caused by oversized prompts, unbounded conversation history growth, and excessive context overhead.

### 1.1 Fundamental Principles
1. **Never silently destroy user meaning merely to fit a context window.**
2. **User-visible source data vs Request context**: A message omitted from an individual outbound request remains present in SQLite History unless the user explicitly deletes it.
3. **No silent semantic loss**: The engine never silently summarizes, rewrites, truncates, or deletes user prompts or system instructions.
4. **Local estimation**: All preflight token calculations occur completely offline without invoking remote tokenizers or transmitting prompt contents to third-party endpoints.

---

## 2. Core Architectural Pipeline

```
                                  [ User Input in Chat Studio ]
                                                │
                                                ▼
                               ┌─────────────────────────────────┐
                               │  Canonical Request Preparation  │
                               │  - Current User Prompt          │
                               │  - System Instructions          │
                               │  - Conversation History         │
                               └────────────────┬────────────────┘
                                                │
                                                ▼
                               ┌─────────────────────────────────┐
                               │  Local Token Estimation Engine  │
                               │  - ~3.8 chars/token heuristic   │
                               │  - +4 framing tokens per turn   │
                               │  - Immutable Message Hash Cache │
                               └────────────────┬────────────────┘
                                                │
                                                ▼
                               ┌─────────────────────────────────┐
                               │  Model Registry Constraints     │
                               │  - Context Window Limit         │
                               │  - Max Input Tokens Limit       │
                               │  - Max Output Tokens Ceiling    │
                               └────────────────┬────────────────┘
                                                │
                                                ▼
                               ┌─────────────────────────────────┐
                               │  Context Preflight Evaluation   │
                               │  - Compute Available Headroom   │
                               │  - Compute Available Output     │
                               │  - Classify Headroom State      │
                               └────────────────┬────────────────┘
                                                │
                     ┌──────────────────────────┴──────────────────────────┐
                     │                                                     │
            [ Under Limit ]                                      [ Exceeds Limit ]
                     │                                                     │
           ┌─────────┴─────────┐                                 ┌─────────┴─────────┐
           │                   │                                 │                   │
       [ SAFE ]          [ NEAR_LIMIT ]                  [ INPUT_TOKEN_LIMIT ]  [ CONTEXT_LIMIT_EXCEEDED ]
           │                   │                         [ OUTPUT_TOKEN_LIMIT]               │
           ▼                   ▼                                           │                 │
    [ Proceed ]       [ Non-Blocking Warning ]                             ▼                 ▼
                      [ Context Indicator: ~ ]                     [ BLOCK Outbound Request ]
                                                                   [ Surface Remediation Options ]
                                                                   [ • Recent Messages Window    ]
                                                                   [ • Switch to Larger Model   ]
                                                                   [ • Start New Conversation   ]
```

---

## 3. Separation of Responsibilities

Nano Route strictly segregates five related concepts:

| Concept | Architectural Role | Authority |
| :--- | :--- | :--- |
| **User-Visible Source Data** | Full conversation history, stored permanently in local SQLite. | User & SQLite WAL Store |
| **Request Context** | The subset of conversation turns selected for an individual outbound request. | Chat Studio & Context Plan |
| **Context Policy** | Rules governing message windowing (Full History, Recent Messages, Protected Only). | User Setting & Guardrail Engine |
| **Token Estimate** | Heuristic approximation (~3.8 chars/token) indicating expected context size. | Local Context Engine |
| **Model Context Limit** | Supported context window, input limit, and output ceiling. | Model Registry (Step 21/56) |

