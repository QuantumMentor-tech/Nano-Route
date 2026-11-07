// ============================================================================
// Nano Route - Windows DPAPI Wrapper
// File: src-tauri/src/security/dpapi.rs
// ============================================================================
// Native FFI boundary for Windows Data Protection API (DPAPI).
// Operates in user-scope (CRYPTPROTECT_UI_FORBIDDEN, no CRYPTPROTECT_LOCAL_MACHINE).
// Guarantees proper LocalFree memory reclamation and zero leakage of raw buffers.
// ============================================================================

use crate::errors::AppError;
use crate::security::secret::SecretBytes;

#[cfg(target_os = "windows")]
#[repr(C)]
struct DATA_BLOB {
    cbData: u32,
    pbData: *mut u8,
}

#[cfg(target_os = "windows")]
const CRYPTPROTECT_UI_FORBIDDEN: u32 = 0x1;

#[cfg(target_os = "windows")]
#[link(name = "crypt32")]
extern "system" {
    fn CryptProtectData(
        pDataIn: *const DATA_BLOB,
        szDataDescr: *const u16,
        pOptionalEntropy: *const DATA_BLOB,
        pvReserved: *mut std::ffi::c_void,
        pPromptStruct: *mut std::ffi::c_void,
        dwFlags: u32,
        pDataOut: *mut DATA_BLOB,
    ) -> i32;

    fn CryptUnprotectData(
        pDataIn: *const DATA_BLOB,
        ppszDataDescr: *mut *mut u16,
        pOptionalEntropy: *const DATA_BLOB,
        pvReserved: *mut std::ffi::c_void,
        pPromptStruct: *mut std::ffi::c_void,
        dwFlags: u32,
        pDataOut: *mut DATA_BLOB,
    ) -> i32;
}

#[cfg(target_os = "windows")]
#[link(name = "kernel32")]
extern "system" {
    fn LocalFree(hMem: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
    fn GetLastError() -> u32;
}

pub struct DpapiProtector;

impl DpapiProtector {
    /// Encrypts plaintext bytes using user-scoped Windows DPAPI.
    /// Resulting ciphertext is bound to the current Windows user profile.
    #[cfg(target_os = "windows")]
    pub fn protect(plaintext: &[u8]) -> Result<Vec<u8>, AppError> {
        if plaintext.is_empty() {
            return Err(AppError::InvalidInput(
                "Cannot encrypt empty credential buffer".to_string(),
            ));
        }

        let desc: Vec<u16> = "Nano Route Provider Credential\0"
            .encode_utf16()
            .collect();

        let data_in = DATA_BLOB {
            cbData: plaintext.len() as u32,
            pbData: plaintext.as_ptr() as *mut u8,
        };

        let mut data_out = DATA_BLOB {
            cbData: 0,
            pbData: std::ptr::null_mut(),
        };

        // SAFETY: CryptProtectData allocates data_out.pbData via LocalAlloc on success,
        // which we immediately copy into a Rust Vec<u8> and free using LocalFree.
        let success = unsafe {
            CryptProtectData(
                &data_in,
                desc.as_ptr(),
                std::ptr::null(), // No optional entropy
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                CRYPTPROTECT_UI_FORBIDDEN, // Strictly user-scoped, non-interactive
                &mut data_out,
            )
        };

        if success == 0 {
            let error_code = unsafe { GetLastError() };
            return Err(AppError::Internal(format!(
                "Windows DPAPI CryptProtectData failed with OS error code: {}",
                error_code
            )));
        }

        // Copy encrypted output into safe Rust memory
        let ciphertext = unsafe {
            std::slice::from_raw_parts(data_out.pbData, data_out.cbData as usize).to_vec()
        };

        // Free the native Windows allocation
        unsafe {
            LocalFree(data_out.pbData as *mut std::ffi::c_void);
        }

        Ok(ciphertext)
    }

    /// Decrypts ciphertext bytes using user-scoped Windows DPAPI.
    /// Reclaims decrypted plaintext into a zeroizing SecretBytes container.
    #[cfg(target_os = "windows")]
    pub fn unprotect(ciphertext: &[u8]) -> Result<SecretBytes, AppError> {
        if ciphertext.is_empty() {
            return Err(AppError::InvalidInput(
                "Cannot decrypt empty ciphertext buffer".to_string(),
            ));
        }

        let data_in = DATA_BLOB {
            cbData: ciphertext.len() as u32,
            pbData: ciphertext.as_ptr() as *mut u8,
        };

        let mut data_out = DATA_BLOB {
            cbData: 0,
            pbData: std::ptr::null_mut(),
        };

        // SAFETY: CryptUnprotectData validates integrity and allocates data_out.pbData,
        // which we copy into SecretBytes and immediately free via LocalFree.
        let success = unsafe {
            CryptUnprotectData(
                &data_in,
                std::ptr::null_mut(),
                std::ptr::null(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                CRYPTPROTECT_UI_FORBIDDEN, // Strictly user-scoped, non-interactive
                &mut data_out,
            )
        };

        if success == 0 {
            let error_code = unsafe { GetLastError() };
            return Err(AppError::Internal(format!(
                "Windows DPAPI CryptUnprotectData failed (tampered ciphertext or wrong user context). OS code: {}",
                error_code
            )));
        }

        let plaintext = unsafe {
            std::slice::from_raw_parts(data_out.pbData, data_out.cbData as usize).to_vec()
        };

        unsafe {
            LocalFree(data_out.pbData as *mut std::ffi::c_void);
        }

        Ok(SecretBytes::new(plaintext))
    }

    /// Non-Windows platform fallback stub (returns platform unsupported error).
    #[cfg(not(target_os = "windows"))]
    pub fn protect(_plaintext: &[u8]) -> Result<Vec<u8>, AppError> {
        Err(AppError::Internal(
            "Windows DPAPI is not supported on non-Windows platforms".to_string(),
        ))
    }

    /// Non-Windows platform fallback stub (returns platform unsupported error).
    #[cfg(not(target_os = "windows"))]
    pub fn unprotect(_ciphertext: &[u8]) -> Result<SecretBytes, AppError> {
        Err(AppError::Internal(
            "Windows DPAPI is not supported on non-Windows platforms".to_string(),
        ))
    }
}

