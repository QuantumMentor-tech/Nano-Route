# Nano Route Incident-Driven Regression Test Strategy

## 1. Objective
This strategy governs how production incidents and crash diagnostics are codified into automated regression tests. The goal is to ensure that once a defect or crash scenario is discovered, contained, and fixed, it can never silently regress in future releases.

---

## 2. Test Architecture for Incident Regression

Incident regression tests are maintained under `src/features/maintenance/__tests__/` and integrated directly into the `npm test` pipeline.

### Test Categories
1. **Taxonomy & Classification Tests (`incidentResponseDiagnostics.test.ts`):**
   - Asserts that all incident categories (CAT_A to CAT_M) map to appropriate mitigation handlers.
   - Evaluates severity calculations against worst-case scenario inputs.
2. **Redaction & Privacy Tests:**
   - Tests log scrubbing against synthetic payloads containing real API token patterns (`sk-`, `AIzaSy`, `gsk_`, `ghp_`, Bearer tokens).
   - Validates that Windows drive letters and username directory paths are sanitized.
3. **Crash Marker & Startup State Tests:**
   - Asserts that consecutive crash markers trigger safe-mode boot flags rather than infinite crash loops.
4. **Subsystem Resilience Tests:**
   - Provider drift handling (Step 56).
   - Backup corruption & restoration failover (Step 53).
   - Update signature tampering rejection (Step 52).

---

## 3. Test Fixture Guidelines
- **Synthetic Secret Fixtures:** Never use real API keys or credentials in test fixtures. Use well-known dummy strings matching regex structures (e.g. `sk-proj-testkey1234567890`).
- **Deterministic Execution:** Tests must not connect to live external endpoints or depend on network availability. All network behaviors must be mocked or asserted via offline functions.
- **Speed Invariant:** The maintenance and incident test suite must execute in under 3 seconds to preserve fast feedback in CI Level 1 gates.

