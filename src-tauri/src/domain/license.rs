//! Nano Route — License Domain Models
//! Authoritative application license information and entitlements.

use serde::{Deserialize, Serialize};

/// High-level application license information and entitlements.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LicenseInfo {
    pub product_name: String,
    pub edition: String,
    pub license_type: String,
    pub status: String,
    pub status_explanation: String,
    pub copyright: String,
    pub valid_from: String,
    pub valid_until: Option<String>,
    pub activation_required: bool,
    pub is_commercial_allowed: bool,
    pub entitlements: Vec<String>,
    pub license_notice: String,
}

impl Default for LicenseInfo {
    fn default() -> Self {
        Self {
            product_name: "Nano Route".to_string(),
            edition: "Community Edition (Open Source)".to_string(),
            license_type: "MIT License".to_string(),
            status: "active".to_string(),
            status_explanation: "Permissive open-source license. Offline execution with full local feature entitlements. No activation server or remote validation required.".to_string(),
            copyright: "Copyright (c) 2026 Nano Route Engineering".to_string(),
            valid_from: "2026".to_string(),
            valid_until: None,
            activation_required: false,
            is_commercial_allowed: true,
            entitlements: vec![
                "Local SLM Intent Classification & Task Analysis".to_string(),
                "Multi-Dimensional Provider Routing & Scoring".to_string(),
                "Windows DPAPI Encrypted Key Management".to_string(),
                "Local SQLite Chat History & Full-Text Search".to_string(),
                "Privacy-First Local Telemetry & Cost Analytics".to_string(),
                "Data Lifecycle, Retention & Secure Wipe Engine".to_string(),
            ],
            license_notice: "MIT License\n\nCopyright (c) 2026 Nano Route Engineering\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the \"Software\"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.".to_string(),
        }
    }
}

