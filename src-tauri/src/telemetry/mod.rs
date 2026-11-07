//! Nano Route — Local Telemetry & Performance Measurement
//! File: src-tauri/src/telemetry/mod.rs
//!
//! Responsibility:
//! - Measurement of routing decisions, provider latency, token consumption, and cost estimates.
//! - Local-first aggregation committed to SQLite.
//! - Must NOT transmit private user data to third-party tracking services.

pub use crate::domain::telemetry::{
    TelemetryAggregateReport, TelemetryEventType, TelemetryFilter, TelemetryOutcome, TelemetryRecord,
};
pub use crate::services::telemetry::{RecordTelemetryInput, TelemetryService};
pub use crate::storage::repositories::TelemetryRepository;
