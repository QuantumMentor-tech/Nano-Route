// ============================================================================
// Nano Route - Database Path Resolution Subsystem
// File: src-tauri/src/storage/path.rs
// ============================================================================
// Resolves application-specific persistent local data paths on Windows desktop.
// Enforces dedicated directory isolation, directory creation, and test overrides.
// ============================================================================

use crate::storage::errors::DatabaseError;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

pub const DEFAULT_DB_FILENAME: &str = "nano_route.db";
pub const APP_SUBDIR: &str = "Nano Route";
pub const DATA_SUBDIR: &str = "data";
pub const ENV_DB_PATH_OVERRIDE: &str = "NANO_ROUTE_DB_PATH";

/// Path resolver for the application's embedded SQLite database.
pub struct DatabasePathResolver;

impl DatabasePathResolver {
    /// Resolves the canonical path to the production SQLite database file.
    ///
    /// Priority:
    /// 1. `NANO_ROUTE_DB_PATH` environment variable override (for tests and isolated dev runs).
    /// 2. Windows `%LOCALAPPDATA%\Nano Route\data\nano_route.db` (or platform equivalent).
    pub fn resolve_path() -> Result<PathBuf, DatabaseError> {
        // 1. Check for explicit environment override
        if let Ok(override_path) = env::var(ENV_DB_PATH_OVERRIDE) {
            let path = PathBuf::from(override_path.trim());
            if !path.as_os_str().is_empty() {
                Self::ensure_parent_directory(&path)?;
                return Ok(path);
            }
        }

        // 2. Resolve platform-specific Local AppData path
        let base_dir = Self::get_local_appdata_dir()?;
        let data_dir = base_dir.join(APP_SUBDIR).join(DATA_SUBDIR);

        Self::ensure_directory_exists(&data_dir)?;
        let db_path = data_dir.join(DEFAULT_DB_FILENAME);

        Ok(db_path)
    }

    /// Resolves a temporary or test database path within a given root directory.
    pub fn resolve_custom_path(root: &Path, filename: &str) -> Result<PathBuf, DatabaseError> {
        let full_path = root.join(filename);
        Self::ensure_parent_directory(&full_path)?;
        Ok(full_path)
    }

    /// Guarantees that the parent directory for a database file exists.
    pub fn ensure_parent_directory(db_path: &Path) -> Result<(), DatabaseError> {
        if let Some(parent) = db_path.parent() {
            Self::ensure_directory_exists(parent)?;
        }
        Ok(())
    }

    /// Creates directory hierarchy if not already present and verifies it is a directory.
    pub fn ensure_directory_exists(dir: &Path) -> Result<(), DatabaseError> {
        if !dir.exists() {
            fs::create_dir_all(dir).map_err(|e| {
                DatabaseError::invalid_path(format!(
                    "Failed to create database directory '{}': {}",
                    dir.display(),
                    e
                ))
            })?;
        } else if !dir.is_dir() {
            return Err(DatabaseError::invalid_path(format!(
                "Database path '{}' exists but is not a directory",
                dir.display()
            )));
        }
        Ok(())
    }

    /// Discovers the local application data directory across supported operating systems.
    fn get_local_appdata_dir() -> Result<PathBuf, DatabaseError> {
        #[cfg(windows)]
        {
            if let Ok(local_appdata) = env::var("LOCALAPPDATA") {
                return Ok(PathBuf::from(local_appdata));
            }
            if let Ok(userprofile) = env::var("USERPROFILE") {
                return Ok(PathBuf::from(userprofile).join("AppData").join("Local"));
            }
        }

        #[cfg(not(windows))]
        {
            if let Ok(xdg_data_home) = env::var("XDG_DATA_HOME") {
                return Ok(PathBuf::from(xdg_data_home));
            }
            if let Ok(home) = env::var("HOME") {
                return Ok(PathBuf::from(home).join(".local").join("share"));
            }
        }

        // Fallback to temp directory if all environment indicators are missing
        Ok(env::temp_dir())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_custom_path_resolution() {
        let temp_dir = env::temp_dir().join("nano_route_test_storage");
        let path = DatabasePathResolver::resolve_custom_path(&temp_dir, "test.db").unwrap();

        assert!(path.ends_with("test.db"));
        assert!(temp_dir.exists());

        // Cleanup
        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_env_override_resolution() {
        let override_file = env::temp_dir().join("nano_route_override_test.db");
        env::set_var(ENV_DB_PATH_OVERRIDE, override_file.to_str().unwrap());

        let resolved = DatabasePathResolver::resolve_path().unwrap();
        assert_eq!(resolved, override_file);

        env::remove_var(ENV_DB_PATH_OVERRIDE);
        let _ = fs::remove_file(override_file);
    }
}

