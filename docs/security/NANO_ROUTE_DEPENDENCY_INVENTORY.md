# Nano Route Complete Software & Dependency Inventory (Step 55)

## 1. Overview & Scope

Nano Route is an offline-capable, local-first AI orchestration desktop application built on Tauri v2, Rust native core, SQLite persistence, and React 18 frontend.

This document provides the complete software dependency inventory across both npm and Cargo ecosystems, documenting their scope, purpose, licenses, and security profiles.

---

## 2. Frontend Ecosystem (npm / Node.js)

### Direct Production Runtime Dependencies (`package.json`)

| Package Name | Version | License | Direct/Transitive | Purpose in Nano Route | Security Profile |
|---|---|---|---|---|---|
| `@tauri-apps/api` | `^2.1.1` | MIT / Apache-2.0 | Direct | Typed IPC bridge between WebView2 and Rust core | Secure (Verified) |
| `lucide-react` | `^1.70.0` | ISC | Direct | Desktop UI icon library | Secure (No known CVEs) |
| `react` | `^18.3.1` | MIT | Direct | React core UI library | Secure (Production vetted) |
| `react-dom` | `^18.3.1` | MIT | Direct | React DOM renderer | Secure (Production vetted) |
| `react-router-dom` | `^6.28.0` | MIT | Direct | Client-side routing across 7 canonical workspaces | Documented in Exception Register |

### Direct Development & Build Dependencies (`devDependencies`)

| Package Name | Version | License | Purpose in Build Pipeline |
|---|---|---|---|
| `@tailwindcss/vite` | `^4.3.4` | MIT | Tailwind CSS v4 Vite integration plugin |
| `@tauri-apps/cli` | `^2.1.0` | MIT / Apache-2.0 | Native packaging and Windows build harness |
| `@types/node` | `^26.6.6` | MIT | TypeScript type declarations for Node.js |
| `@types/react` | `^18.3.12` | MIT | TypeScript type declarations for React |
| `@types/react-dom` | `^18.3.1` | MIT | TypeScript type declarations for React DOM |
| `@vitejs/plugin-react` | `^4.3.4` | MIT | Fast refresh and React compiler integration |
| `tailwindcss` | `^4.3.4` | MIT | Styling framework |
| `typescript` | `^5.6.3` | Apache-2.0 | Static type validation compiler |
| `vite` | `^5.4.11` | MIT | Frontend development server & Rollup-based production bundler |

---

## 3. Native Ecosystem (Cargo / Rust)

### Direct Dependencies (`src-tauri/Cargo.toml`)

| Crate Name | Version | License | Purpose in Native Core |
|---|---|---|---|
| `tauri` | `2.x` | MIT / Apache-2.0 | Tauri application lifecycle, window management, and IPC dispatcher |
| `serde` | `1.x` (`features = ["derive"]`) | MIT / Apache-2.0 | Serialization/deserialization of IPC DTOs and database records |
| `serde_json` | `1.x` | MIT / Apache-2.0 | Manifest parsing, telemetry aggregation, JSON config handling |
| `tokio` | `1.x` (`sync`, `rt`, `time`) | MIT | Asynchronous runtime, task concurrency limiting, background timers |
| `tokio-util` | `0.7` (`sync`) | MIT | Tokio synchronization primitives and cancellation tokens |
| `async-trait` | `0.1` | MIT / Apache-2.0 | Trait definitions for asynchronous ProviderClient interfaces |
| `rusqlite` | `0.31` (`features = ["bundled"]`) | MIT | SQLite 3 embedded database connection with bundled C amalgamation |
| `sha2` | `0.10` | MIT / Apache-2.0 | Cryptographic SHA-256 calculation for backup and update validation |

### Build Dependencies (`src-tauri/Cargo.toml`)

| Crate Name | Version | License | Purpose in Build Pipeline |
|---|---|---|---|
| `tauri-build` | `2.x` | MIT / Apache-2.0 | Generates compile-time Tauri configuration and manifests |

---

## 4. Native Binary & Asset Inventory

| Asset Name | Canonical Path | Format / Size | Cryptographic SHA-256 Digest | Purpose |
|---|---|---|---|---|
| `Nano Route Neon Tech Logo.png` | Project root | PNG / 670,255 bytes | `99179d193ac9cdbb18cbddee3abe2da16b23c26be4958b5dd945c21d873bb804` | Authoritative branding asset |
| `desktop-schema.json` | `src-tauri/gen/schemas/` | JSON Schema | Generated | Tauri v2 permissions & capabilities |

