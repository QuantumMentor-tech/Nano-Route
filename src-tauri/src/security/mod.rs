//! Nano Route — Native Security & Windows DPAPI Subsystem
//!
//! Responsibility:
//! - Windows Data Protection API (DPAPI) encryption/decryption of API keys at rest.
//! - In-memory secure credential management (Zeroize on drop).
//! - Must NOT expose plaintext keys across the Tauri IPC boundary to the frontend.

