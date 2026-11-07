//! Nano Route — Intelligent Router & Policy Engine
//!
//! Responsibility:
//! - Multi-factor candidate scoring (quality, cost, latency, availability).
//! - Policy evaluation, user preference weighting, and threshold filtering.
//! - Resilient fallback cascade coordination.
//! - Must NOT own UI components, plaintext secret storage, or raw provider HTTP details.

