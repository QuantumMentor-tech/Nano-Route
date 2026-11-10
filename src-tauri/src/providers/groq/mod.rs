// ============================================================================
// Nano Route - Groq Provider Adapter Subsystem
// File: src-tauri/src/providers/groq/mod.rs
// ============================================================================

pub mod client;
pub mod policy;

#[cfg(test)]
mod tests;

pub use client::GroqClient;
pub use policy::{scrub_groq_secrets, GroqErrorDetail, GroqErrorEnvelope, GroqPolicy};

