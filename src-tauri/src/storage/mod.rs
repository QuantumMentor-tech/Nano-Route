//! Nano Route — Persistence & Local Database Subsystem
//!
//! Responsibility:
//! - Embedded SQLite connection management, WAL mode, and migrations.
//! - Repositories for sessions, messages, telemetry, and encrypted settings.
//! - Must NOT allow raw SQL execution from the frontend.

