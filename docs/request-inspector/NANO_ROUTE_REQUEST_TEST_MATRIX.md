# Nano Route — Request Inspector Verification Matrix

| Area | Test Suite | Description | Status |
| :--- | :--- | :--- | :--- |
| **Snapshot Assembly** | `requestInspector.test.ts` | Validates direct prompt, routing target, tokens, and headroom. | PASS |
| **Collection Extraction** | `requestInspector.test.ts` | Detects embedded context packs, counts items, and extracts names. | PASS |
| **Private Note Detection** | `requestInspector.test.ts` | Identifies private notes in context and raises security warning. | PASS |
| **Stale Reference Tagging** | `requestInspector.test.ts` | Identifies stale references and alerts user before submission. | PASS |
| **Attachment Footprint** | `requestInspector.test.ts` | Combines attachment text and calculates aggregate tokens. | PASS |
| **Empty Prompt Guard** | `requestInspector.test.ts` | Blocks submission when assembled prompt is whitespace. | PASS |
| **Failed Attachment Guard** | `requestInspector.test.ts` | Blocks submission when attachments have validation errors. | PASS |
| **Capability Validation** | `requestInspector.test.ts` | Blocks multimodal input targeted at text-only local SLM. | PASS |
| **Stale Edit Detection** | `requestInspector.test.ts` | Detects edits made while inspector was open and prompts review. | PASS |
| **Zero Secret Leakage** | `requestInspector.test.ts` | Confirms zero API keys, auth headers, or DPAPI tokens in snapshots. | PASS |
| **Type Safety** | `npm run typecheck` | 0 TypeScript errors across the repository. | PASS |
| **Full Regression** | `npm test` | All 998 tests pass without regression. | PASS |
| **Production Build** | `npm run build` | Clean Vite/Rollup production build. | PASS |

