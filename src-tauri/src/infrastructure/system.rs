//! System & OS Infrastructure Adapter
//! Pure, safe inspection of operating system and target architecture.

pub struct SystemInfoProvider;

impl SystemInfoProvider {
    /// Returns the target operating system name.
    pub fn os_name() -> &'static str {
        std::env::consts::OS
    }

    /// Returns the target architecture name.
    pub fn arch_name() -> &'static str {
        std::env::consts::ARCH
    }

    /// Returns the build environment (development vs. production).
    pub fn build_environment() -> &'static str {
        if cfg!(debug_assertions) {
            "development"
        } else {
            "production"
        }
    }
}

