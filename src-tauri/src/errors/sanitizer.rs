// ============================================================================
// Nano Route - Error Sanitizer
// File: src-tauri/src/errors/sanitizer.rs
// ============================================================================
// Centralized security sanitizer for scrubbing API keys, tokens, credentials,
// and local user paths from technical and user-facing error strings (Step 36).
// ============================================================================

/// Maximum allowed length of a technical error string before truncation.
pub const MAX_ERROR_TEXT_LEN: usize = 4096;

/// Sanitizes error text by redacting secret patterns and local file paths.
pub fn sanitize_error_text(input: &str) -> String {
    if input.is_empty() {
        return String::new();
    }

    // Step 1: Bounded length slice
    let bounded = if input.len() > MAX_ERROR_TEXT_LEN {
        format!("{}... [TRUNCATED]", &input[..MAX_ERROR_TEXT_LEN])
    } else {
        input.to_string()
    };

    let mut result = bounded;

    // Step 2: Redact known secret prefixes
    let secret_prefixes = [
        ("Bearer ", "Bearer [REDACTED_TOKEN]"),
        ("bearer ", "bearer [REDACTED_TOKEN]"),
        ("x-api-key: ", "x-api-key: [REDACTED_KEY]"),
        ("api_key=", "api_key=[REDACTED]"),
        ("apikey=", "apikey=[REDACTED]"),
        ("token=", "token=[REDACTED]"),
        ("secret=", "secret=[REDACTED]"),
        ("password=", "password=[REDACTED]"),
        ("access_token=", "access_token=[REDACTED]"),
    ];

    for (prefix, replacement) in secret_prefixes {
        let mut start_idx = 0;
        while let Some(found_rel) = result[start_idx..].find(prefix) {
            let abs_start = start_idx + found_rel;
            let val_start = abs_start + prefix.len();

            let val_end = result[val_start..]
                .find(|c: char| c.is_whitespace() || c == ',' || c == '"' || c == '\'' || c == '&' || c == ';')
                .map(|offset| val_start + offset)
                .unwrap_or(result.len());

            if val_end > val_start {
                let prefix_part = &result[..abs_start];
                let suffix_part = &result[val_end..];
                result = format!("{}{}{}", prefix_part, replacement, suffix_part);
                start_idx = abs_start + replacement.len();
            } else {
                start_idx = val_start;
            }

            if start_idx >= result.len() {
                break;
            }
        }
    }

    // Step 3: Redact specific known provider token formats (OpenAI, Gemini, Groq, GitHub)
    let token_markers = [
        ("sk-", "[REDACTED_API_KEY]", 8),
        ("AIzaSy", "[REDACTED_GEMINI_KEY]", 20),
        ("gsk_", "[REDACTED_GROQ_KEY]", 15),
        ("ghp_", "[REDACTED_TOKEN]", 20),
    ];

    for (marker, replacement, min_len) in token_markers {
        let mut start_idx = 0;
        while let Some(found_rel) = result[start_idx..].find(marker) {
            let abs_start = start_idx + found_rel;
            let token_slice = &result[abs_start..];
            let token_len = token_slice
                .find(|c: char| !c.is_alphanumeric() && c != '_' && c != '-')
                .unwrap_or(token_slice.len());

            if token_len >= min_len {
                let prefix_part = &result[..abs_start];
                let suffix_part = &result[abs_start + token_len..];
                result = format!("{}{}{}", prefix_part, replacement, suffix_part);
                start_idx = abs_start + replacement.len();
            } else {
                start_idx = abs_start + marker.len();
            }

            if start_idx >= result.len() {
                break;
            }
        }
    }

    // Step 4: Redact sensitive local user home/profile filesystem paths
    // e.g. "C:\Users\username\" or "/home/username/"
    result = redact_local_paths(&result);

    result
}

fn redact_local_paths(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut remaining = text;

    // Pattern A: Windows path starting with drive letter and Users or Documents
    while let Some(idx) = remaining.find(":\\Users\\") {
        // Find drive letter before ':\'
        let drive_start = if idx > 0 { idx - 1 } else { idx };
        out.push_str(&remaining[..drive_start]);

        let path_part = &remaining[drive_start..];
        // Path ends at quote, whitespace, comma, or end of string
        let path_end = path_part
            .find(|c: char| c.is_whitespace() || c == '"' || c == '\'' || c == ',' || c == ')')
            .unwrap_or(path_part.len());

        out.push_str("[REDACTED_LOCAL_PATH]");
        remaining = &path_part[path_end..];
    }

    // Pattern B: Unix /home/username/ paths
    while let Some(idx) = remaining.find("/home/") {
        out.push_str(&remaining[..idx]);
        let path_part = &remaining[idx..];
        let path_end = path_part
            .find(|c: char| c.is_whitespace() || c == '"' || c == '\'' || c == ',' || c == ')')
            .unwrap_or(path_part.len());

        out.push_str("[REDACTED_LOCAL_PATH]");
        remaining = &path_part[path_end..];
    }

    out.push_str(remaining);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitizes_bearer_and_tokens() {
        let raw = "Error with Authorization: Bearer sk-1234567890abcdef and token=secrettoken123";
        let clean = sanitize_error_text(raw);
        assert!(!clean.contains("sk-1234567890abcdef"));
        assert!(!clean.contains("secrettoken123"));
        assert!(clean.contains("[REDACTED_TOKEN]"));
    }

    #[test]
    fn test_sanitizes_windows_user_path() {
        let raw = "Database open failed at C:\\Users\\Alice\\AppData\\Local\\NanoRoute\\db.sqlite";
        let clean = sanitize_error_text(raw);
        assert!(!clean.contains("Alice"));
        assert!(clean.contains("[REDACTED_LOCAL_PATH]"));
    }

    #[test]
    fn test_sanitizes_gemini_and_groq_keys() {
        let raw = "Failed to connect using AIzaSyD987654321012345678901234567890 and gsk_abcdef1234567890123456";
        let clean = sanitize_error_text(raw);
        assert!(!clean.contains("AIzaSyD987654321012345678901234567890"));
        assert!(!clean.contains("gsk_abcdef1234567890123456"));
        assert!(clean.contains("[REDACTED_GEMINI_KEY]"));
        assert!(clean.contains("[REDACTED_GROQ_KEY]"));
    }
}

