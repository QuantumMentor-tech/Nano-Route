//! Application Metadata Service
//! Coordinates product identity, versioning, and environment diagnostics.

use crate::domain::{AppInfo, LicenseInfo};
use crate::infrastructure::SystemInfoProvider;

const APP_NAME: &str = "Nano Route";
const APP_VERSION: &str = "0.1.0";

#[derive(Default, Debug, Clone)]
pub struct AppService;

impl AppService {
    pub fn new() -> Self {
        Self
    }

    /// Retrieves authoritative application metadata.
    pub fn get_app_info(&self) -> AppInfo {
        AppInfo::new(
            APP_NAME,
            APP_VERSION,
            SystemInfoProvider::build_environment(),
            SystemInfoProvider::os_name(),
            SystemInfoProvider::arch_name(),
        )
    }

    /// Retrieves authoritative license and entitlement metadata.
    pub fn get_license_info(&self) -> LicenseInfo {
        LicenseInfo::default()
    }
}

