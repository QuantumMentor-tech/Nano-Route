# NANO ROUTE — STEP 49 QA & REGRESSION MASTER TEST PLAN

**Phase 10: Release & Production Readiness — Step 4**  
**Document ID:** QA-PLAN-049  
**Execution Date:** November 13, 2026  
**Auditor / Lead Engineer:** Antigravity Engineering Core  
**Target Release:** Release Candidate 1 (RC1) — Pre-Step 50  

---

## 1. Objective & Scope

The primary objective of Step 49 is to conduct a complete, production-grade quality assurance, edge-case, security regression, and release-candidate validation across the entire Nano Route desktop application stack built across Steps 1 through 48.

This evaluation establishes whether Nano Route satisfies its architectural, functional, security, privacy, and performance invariants to warrant proceeding into **Step 50: Production Build & Windows Packaging**.

### 1.1 In-Scope Test Dimensions (60 Points of Verification)
1. Application startup and shutdown lifecycles
2. Tauri native shell integrity
3. React UI integrity and theme consistency
4. Native Rust core resilience
5. IPC command and event contracts (56+ commands)
6. SQLite persistence and schema migrations
7. Windows DPAPI credential vault protection
8. Provider configuration workflows
9. Provider registry and capability indexing
10. Provider/model readiness and health probe lifecycle
11. Local SLM execution and sandbox bounds
12. Prompt intent classification and taxonomy scoring
13. Routing decision logic and confidence normalization
14. Manual provider/model override precedence
15. Provider capability mismatch handling
16. Chat session creation and metadata initialization
17. Chat message persistence and foreign key cascading
18. Prompt submission and preflight validation
19. Streaming chunk pipelines and UI buffer synchronization
20. Cooperative cancellation protocols
21. Bounded retry behavior on transient errors
22. Automatic failover candidate succession
23. Provider failure classification and recovery
24. Rate-limit (HTTP 429) backoff handling
25. Timeout handling and socket aborts
26. Malformed and corrupted provider response handling
27. History Explorer session list and ordering
28. History local search, token highlighting, and multi-filter queries
29. Telemetry Dashboard operational metric aggregation
30. Token usage analytics (prompt, completion, total)
31. Recorded cost analytics and provider breakdown
32. Routing savings engine and baseline cost metrics
33. Latency distribution (avg, min, max, percentiles P50/P90/P99)
34. Data retention, cleanup, and privacy controls
35. Emergency full local data wipe (`"DELETE"` token enforcement)
36. License page rendering and offline verification
37. About page metadata and architecture breakdown
38. Contact page communication channels and link openers
39. Central Settings workspace and safe reset
40. Zero plaintext secret boundaries
41. Filesystem access restrictions
42. Network boundary and offline-first invariants
43. WebView security and CSP isolation
44. Tauri capability restriction (`core:default` least privilege)
45. Frontend storage restriction (`localStorage` non-sensitive only)
46. Local SLM/model asset hash integrity (SHA-256)
47. Accessibility compliance (ARIA roles, keyboard traversal)
48. Logical tab order and visible focus states
49. Responsive desktop layouts and window resize handling
50. Large-history behavior (pagination, unbounded load prevention)
51. Application restart and crash recovery
52. Corrupted and missing local database scenarios
53. Cross-feature integration workflows (Scenarios A through G)
54. Resource usage and CPU concurrency bounds
55. Memory stability and leak prevention
56. Long-running session stability
57. Test automation quality and determinism
58. Technical documentation synchronization
59. Release blockers evaluation
60. Final QA certification state

---

## 2. Test Environments

| Environment ID | Description | Profile Characteristics | Status |
| :--- | :--- | :--- | :--- |
| **Env A** | Development / Test Workstation | Windows 10/11 x64, Node v26, Vite 5, Tauri v2 core | Active |
| **Env B** | Fresh Local Application Profile | Pristine SQLite database, 0 sessions, 0 credentials | Verified |
| **Env C** | Populated Profile | Realistic chat sessions, multi-day telemetry, active DPAPI keys | Verified |
| **Env D** | Degraded / Missing Resources | Missing optional model files, unconfigured cloud providers | Verified |
| **Env E** | Air-Gapped / Offline | Network disabled; local SLM routing verified without egress | Verified |
| **Env F** | Fault-Injected Network | Simulated 429 rate limits, 500 server errors, streaming drop | Verified |
| **Env G** | Large-Data Scale | 500+ sessions, 100k synthetic telemetry records | Verified |

---

## 3. Testing Methodology & Pyramid

1. **Unit Testing Layer:**  
   Deterministic testing of mathematical formulas (cost per token, savings against baseline, latency percentiles), error classifiers, input length bounds, and URL parsers.
2. **IPC Integration Layer:**  
   Strongly-typed contract tests verifying request/response DTO serialization between frontend TypeScript services and native Rust handlers.
3. **End-to-End Workflow Layer:**  
   Simulation of user journeys: Settings → Chat Studio → Automatic Failover → History Search → Telemetry Aggregation → Data Wipe.
4. **Security & Boundary Regression Layer:**  
   Verification that zero plaintext keys exist in storage, logs, or IPC payloads, and all external navigation is restricted to sanitized protocols.

---

## 4. Entry & Exit Criteria for Step 49

- **Entry Criteria:** Step 48 Security Audit completed; all 549 pre-existing tests passing; zero TypeScript errors.
- **Exit Criteria:**
  - 100% test pass rate across all suites including new E2E and edge-case suites.
  - Zero Critical or High unresolved defects.
  - Verification of master logo byte size (670,255 bytes).
  - Formal publication of all 6 QA documentation artifacts in `docs/qa/`.
  - Authoritative Release Gate determination issued.

