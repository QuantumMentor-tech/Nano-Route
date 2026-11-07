//! Application Metadata Domain Models
//! Pure representation of application identity, build metadata, and environment.

use serde::{Deserialize, Serialize};

/// High-level application metadata.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub environment: String,
    pub target_os: String,
    pub arch: String,
}

impl AppInfo {
    pub fn new(
        name: impl Into<String>,
        version: impl Into<String>,
        environment: impl Into<String>,
        target_os: impl Into<String>,
        arch: impl Into<String>,
    ) -> Self {
        Self {
            name: name.into(),
            version: version.into(),
            environment: environment.into(),
            target_os: target_os.into(),
            arch: arch.into(),
        }
    }
}

