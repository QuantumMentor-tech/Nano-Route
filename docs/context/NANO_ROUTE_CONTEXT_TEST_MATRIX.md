# Nano Route — Context Management Test Matrix

**Document Version:** 1.0.0  
**Status:** Authoritative  
**Step:** 76 — Context Window Management, Prompt Size Guardrails, Token Budgeting, Request Preflight & Safe Context Optimization  
**Subsystems:** Node Test Runner, QA Automation  

---

## 1. Test Execution Matrix

Test Suite: `src/features/context/__tests__/contextManagement.test.ts` (22 passing tests across 9 suites).

| Suite | Scenario | Expected Result | Status |
| :--- | :--- | :--- | :---: |
| **1. Model Context Limits** | Known model lookup (GPT-4o, Sonnet, Gemini 1.5 Pro, Local SLM) | Exact authoritative context constraints returned | **PASS** |
| | Uncatalogued model lookup | Returns explicit `UNKNOWN` descriptor without inventing limits | **PASS** |
| **2. Token Estimation** | Raw text tokens (~3.8 chars/token ceil heuristic) | Exact token count matching character ratio | **PASS** |
| | Message tokens (+4 framing overhead) | Content tokens + 4 framing tokens | **PASS** |
| | Full conversation breakdown (prompt + system + history) | Accurate multi-part breakdown | **PASS** |
| **3. Token Cache** | Repeated identical message token estimation | Instant cache hit with identical value | **PASS** |
| | Cache invalidation by message ID or full clear | Purges target entries and recalculates on demand | **PASS** |
| **4. Output Capacity** | Plentiful headroom with max output ceiling | Available capacity bounded by model `maxOutputTokens` | **PASS** |
| | Heavily consumed context window | Available capacity clamped by remaining headroom | **PASS** |
| **5. Preflight Evaluation** | Ordinary small conversation | Evaluates to `SAFE` with zero warnings | **PASS** |
| | Request approaching 80% or entering safety buffer | Evaluates to `NEAR_LIMIT`, generates non-blocking warning | **PASS** |
| | Input exceeding model `maxInputTokens` | Evaluates to `EXCEEDS_LIMIT`, blocks with `INPUT_TOKEN_LIMIT` | **PASS** |
| | Input + output exceeding total context window | Evaluates to `EXCEEDS_LIMIT`, blocks with `CONTEXT_LIMIT_EXCEEDED` | **PASS** |
| | Requested output exceeding model ceiling | Evaluates to `EXCEEDS_LIMIT`, blocks with `OUTPUT_TOKEN_LIMIT` | **PASS** |
| | Unregistered model | Evaluates to `UNKNOWN`, allows with unverified notice | **PASS** |
| **6. Context Reduction** | `FULL_HISTORY` mode | 100% of messages sent, 0 excluded | **PASS** |
| | `RECENT_WINDOW` mode (e.g. 10 messages) | Last 10 messages sent, 20 excluded, SQLite history preserved | **PASS** |
| | `PROTECTED_ONLY` mode | 0 history messages sent, system and prompt protected | **PASS** |
| **7. Error Normalization** | Upstream `context_length_exceeded` error | Maps to `CONTEXT_LIMIT_EXCEEDED` with actionable remedies | **PASS** |
| | Upstream "prompt is too long" error | Maps to `INPUT_TOKEN_LIMIT` | **PASS** |
| | Upstream HTTP 413 error | Maps to `REQUEST_TOO_LARGE` | **PASS** |
| **8. Security & Privacy** | Secret string in prompt | Preflight and error DTOs contain zero prompt content | **PASS** |

