# Nano Route Dependency Security & Vulnerability Analysis (Step 55)

## 1. Vulnerability Audit Results

Audit Execution Date: 2026-11-13  
Scanner: `npm audit` / lockfile inspection

### Summary of Advisory Findings:

| Advisory / CVE | Package | Affected Version Range | Reported Severity | Exploitability in Nano Route Desktop | Status / Remediation |
|---|---|---|:---:|---|---|
| **GHSA-67mh-4wv8-2f99** | `esbuild` / `vite` | `esbuild <=0.24.2`, `vite <=6.4.3` | Moderate | **Unreachable in Production**: Affects local dev server HTTP listener during active development. Production builds compile to static artifacts (`dist/`) bundled into the native installer. | Documented & Managed |
| **GHSA-wrjc-x8rr-h8h6** | `react-router` | `6.0.0 - 7.17.0` | Moderate | **Unreachable**: Relates to open redirects via backslash in user-supplied `<Link>` targets. Nano Route routes are strictly hardcoded constants (`/`, `/chat`, `/history`, `/settings`, etc.). | Documented & Managed |
| **GHSA-337j-9hxr-rhxg** | `react-router` | `6.0.0 - 7.17.0` | High | **Unreachable**: Relates to Server-Side Rendering (SSR) hydration error deserialization (`deserializeErrors()`). Nano Route is an entirely local client-side SPA in WebView2 with 0 SSR components. | Documented & Managed |

---

## 2. Reachability & False Positive Verification

1. **Vite / esbuild Dev Server**:
   - `vite` is located exclusively in `devDependencies`.
   - In production packaging, `vite build` generates static HTML/JS/CSS assets. No Node.js web server or esbuild process ships inside the packaged Windows `.msi` or executable.
2. **React Router SSR Deserialization**:
   - The advisory applies exclusively when React Router is used in SSR frameworks (Remix, Next.js hydration).
   - Nano Route uses `HashRouter` / `MemoryRouter` / `BrowserRouter` client-side only; `deserializeErrors()` is never invoked.
3. **Open Redirect in React Router**:
   - All navigation targets in Nano Route originate from internal navigation components ([Sidebar.tsx], router config) with strictly validated internal route paths.

