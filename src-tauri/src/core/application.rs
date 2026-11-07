//! Application Composition Root
//! Responsible for explicitly constructing the native runtime dependency graph.

use std::sync::Arc;
use crate::errors::AppError;
use crate::services::{AppService, HealthService};
use crate::state::AppState;

pub struct Application;

impl Application {
    /// Bootstraps the application services and returns the managed AppState.
    pub fn bootstrap() -> Result<AppState, AppError> {
        let app_service = Arc::new(AppService::new());
        let health_service = Arc::new(HealthService::new());

        let state = AppState::new(app_service, health_service);
        state.mark_initialized("2026-11-07T00:00:00Z");

        Ok(state)
    }
}

