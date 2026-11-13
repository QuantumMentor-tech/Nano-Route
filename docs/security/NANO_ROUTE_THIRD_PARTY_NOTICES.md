# Nano Route Third-Party Software & License Notices (Step 55)

Nano Route bundles or statically links open-source third-party software. This document lists the third-party components, their version, copyright notices, and applicable licenses.

---

## 1. Rust Ecosystem Components

### `tauri` & `tauri-build`
- **Version**: 2.x
- **License**: MIT / Apache-2.0
- **Copyright**: (c) 2019-present, Tauri Programme within The Commons Conservancy.

### `serde` & `serde_json`
- **Version**: 1.x
- **License**: MIT / Apache-2.0
- **Copyright**: (c) 2014-present, Erick Tryzelaar and David Tolnay.

### `tokio` & `tokio-util`
- **Version**: 1.x / 0.7.x
- **License**: MIT
- **Copyright**: (c) 2021 Tokio Contributors.

### `rusqlite`
- **Version**: 0.31 (bundled SQLite 3)
- **License**: MIT (rusqlite wrapper), Public Domain (SQLite 3 core)
- **Copyright**: (c) 2014-present, John Gallagher.

### `sha2`
- **Version**: 0.10
- **License**: MIT / Apache-2.0
- **Copyright**: (c) 2017-present, RustCrypto project developers.

### `async-trait`
- **Version**: 0.1
- **License**: MIT / Apache-2.0
- **Copyright**: (c) 2019 David Tolnay.

---

## 2. Frontend Ecosystem Components

### `react` & `react-dom`
- **Version**: 18.3.1
- **License**: MIT
- **Copyright**: (c) Meta Platforms, Inc. and affiliates.

### `react-router-dom`
- **Version**: 6.28.0
- **License**: MIT
- **Copyright**: (c) Remix Software Inc.

### `lucide-react`
- **Version**: 1.70.0
- **License**: ISC
- **Copyright**: (c) 2020-present, Lucide Project Contributors.

### `@tauri-apps/api`
- **Version**: 2.1.1
- **License**: MIT / Apache-2.0
- **Copyright**: (c) 2019-present, Tauri Programme within The Commons Conservancy.

---

## 3. Compliance Summary

All direct runtime dependencies use permissive open-source licenses (MIT, Apache-2.0, ISC, Public Domain). Zero copyleft (GPL, AGPL) dependencies are bundled in the application binary or distributed frontend bundle.

