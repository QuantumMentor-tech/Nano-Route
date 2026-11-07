//! Native Application State
//! Thread-safe container for shared services and runtime metadata managed by Tauri.

use std::sync::{Arc, RwLock};
use crate::services::{AppService, HealthService};

pub struct AppState {
    pub app_service: Arc<AppService>,
    pub health_service: Arc<HealthService>,
    pub initialized_at: RwLock<Option<String>>,
}

impl AppState {
    pub fn new(app_service: Arc<AppService>, health_service: Arc<HealthService>) -> Self {
        Self {
            app_service,
            health_service,
            initialized_at: RwLock::new(None),
        }
    }

    /// Marks the native core as initialized with an ISO 8601 timestamp.
    pub fn mark_initialized(&self, timestamp: impl Into<String>) {
        if let Ok(mut lock) = self.initialized_at.write() {
            *lock = Some(timestamp.into());
        }
    }

    /// Checks if the native core has completed initialization.
    pub fn is_initialized(&self) -> bool {
        self.initialized_at
            .read()
            .map(|opt| opt.is_some())
            .unwrap_or(false)
    }
}

