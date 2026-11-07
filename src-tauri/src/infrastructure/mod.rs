//! Nano Route — Infrastructure Layer
//!
//! Responsibility:
//! - System adapters and OS helpers.
//! - Concrete implementations of domain/service interfaces.
//! - Low-level platform details isolated from domain and application services.

pub mod system;

pub use system::SystemInfoProvider;
