# Nano Route Temporary Dependency Exception Register (Step 55)

## 1. Exception Registry Table

| Exception ID | Package Name | Affected Version | Advisory ID | Severity | Reason Not Upgraded Immediately | Mitigation / Reachability Proof | Planned Review Date |
|---|---|---|---|---|---|---|---|
| **EXC-001** | `esbuild` (via `vite`) | `<=0.24.2` | GHSA-67mh-4wv8-2f99 | Moderate | Upgrading requires breaking transition to Vite 6/8 and esbuild major rewrite, affecting build pipeline stability. | **Unreachable in production runtime**: `esbuild` is a dev-time-only bundler. The development server is not included in the packaged Windows application. | Next major version cycle (v0.2.0) |
| **EXC-002** | `react-router` / `react-router-dom` | `6.28.0` | GHSA-337j-9hxr-rhxg | High | Upgrading to v7 is a major breaking change requiring full routing API migration across 7 screens. | **Unreachable**: Relates to SSR error deserialization (`deserializeErrors()`). Nano Route is purely client-side SPA with zero SSR. | Next major version cycle (v0.2.0) |
| **EXC-003** | `react-router` / `react-router-dom` | `6.28.0` | GHSA-wrjc-x8rr-h8h6 | Moderate | Upgrading to v7 is a breaking framework migration. | **Mitigated**: Routes are strictly hardcoded constants; user input is never parsed into navigational URLs or redirects. | Next major version cycle (v0.2.0) |

---

## 2. Policy Invariants

1. No exceptions are permitted for known secret leaks, active arbitrary code execution in production runtime, or unverified native binaries.
2. All exceptions in this register have verified non-reachability in the production Windows desktop deployment.

