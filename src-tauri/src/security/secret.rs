// ============================================================================
// Nano Route - Secure In-Memory Secret Wrapper
// File: src-tauri/src/security/secret.rs
// ============================================================================
// Memory-hygiene wrapper for sensitive cryptographic material.
// Zeroizes buffer contents upon drop, forbids automatic serialization,
// and strictly masks Debug output to prevent accidental secret leakage.
// ============================================================================

use std::fmt;

/// Secure memory container for string secrets with zeroization on drop.
pub struct SecretString(String);

impl SecretString {
    pub fn new(val: impl Into<String>) -> Self {
        Self(val.into())
    }

    /// Exposes the underlying plaintext secret reference.
    pub fn expose_secret(&self) -> &str {
        &self.0
    }

    /// Returns byte length of the secret.
    pub fn len(&self) -> usize {
        self.0.len()
    }

    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }

    /// Converts into raw SecretBytes without leaving plaintext in String.
    pub fn into_bytes(mut self) -> SecretBytes {
        let bytes = std::mem::take(&mut self.0).into_bytes();
        SecretBytes(bytes)
    }
}

impl Drop for SecretString {
    fn drop(&mut self) {
        // Safe in-place memory zeroization
        unsafe {
            let vec = self.0.as_mut_vec();
            for byte in vec.iter_mut() {
                std::ptr::write_volatile(byte, 0);
            }
        }
    }
}

impl Clone for SecretString {
    fn clone(&self) -> Self {
        Self(self.0.clone())
    }
}

impl fmt::Debug for SecretString {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "SecretString([REDACTED])")
    }
}

/// Secure memory container for binary secret bytes with zeroization on drop.
pub struct SecretBytes(Vec<u8>);

impl SecretBytes {
    pub fn new(val: Vec<u8>) -> Self {
        Self(val)
    }

    /// Exposes a slice of the protected secret bytes.
    pub fn as_bytes(&self) -> &[u8] {
        &self.0
    }

    /// Converts into a SecretString if UTF-8 valid.
    pub fn to_secret_string(&self) -> Result<SecretString, std::string::FromUtf8Error> {
        let s = String::from_utf8(self.0.clone())?;
        Ok(SecretString(s))
    }

    pub fn len(&self) -> usize {
        self.0.len()
    }

    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }
}

impl Drop for SecretBytes {
    fn drop(&mut self) {
        // Safe in-place memory zeroization
        for byte in self.0.iter_mut() {
            unsafe {
                std::ptr::write_volatile(byte, 0);
            }
        }
    }
}

impl Clone for SecretBytes {
    fn clone(&self) -> Self {
        Self(self.0.clone())
    }
}

impl fmt::Debug for SecretBytes {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "SecretBytes([REDACTED])")
    }
}

