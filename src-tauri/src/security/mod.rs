//! Nano Route — Native Security & Windows DPAPI Subsystem
//! File: src-tauri/src/security/mod.rs
//!
//! Responsibility:
//! - Windows Data Protection API (DPAPI) encryption/decryption of API keys at rest.
//! - In-memory secure credential management (Zeroize on drop).
//! - Strictly prevents plaintext key exposure to React, logs, or unencrypted SQLite.

pub mod dpapi;
pub mod secret;

pub use dpapi::DpapiProtector;
pub use secret::{SecretBytes, SecretString};
