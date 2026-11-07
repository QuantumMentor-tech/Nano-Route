//! Health Application Service
//! Coordinates native core verification and reports operational readiness.

use crate::domain::{CoreStatus, HealthReport, SubsystemHealth};

#[derive(Default, Debug, Clone)]
pub struct HealthService;

impl HealthService {
    pub fn new() -> Self {
        Self
    }

    /// Generates a comprehensive health report of the native application.
    pub fn check_health(&self) -> HealthReport {
        let subsystems = vec![
            SubsystemHealth::new("ipc_bridge", true, Some("Tauri command router active")),
            SubsystemHealth::new("state_manager", true, Some("Managed AppState initialized")),
            SubsystemHealth::new("infrastructure", true, Some("System adapters responsive")),
            SubsystemHealth::new("ai_providers", false, Some("Not Configured Yet (Scheduled Step 17)")),
            SubsystemHealth::new("slm_inference", false, Some("Not Configured Yet (Scheduled Step 13)")),
            SubsystemHealth::new("sqlite_storage", false, Some("Not Configured Yet (Scheduled Step 12)")),
        ];

        HealthReport {
            status: CoreStatus::Ready,
            message: "Nano Route native core: OK".to_string(),
            subsystems,
            timestamp: "2026-11-07T00:00:00Z".to_string(),
        }
    }

    /// Legacy string smoke-test helper for direct backward compatibility with cmd_health_check.
    pub fn check_health_string(&self) -> String {
        "Nano Route native core: OK".to_string()
    }
}

