// ============================================================================
// Nano Route - Classifier Input Preprocessing
// File: src-tauri/src/classification/preprocessor.rs
// ============================================================================
// Validates, formats, and bounds text prompts for local SLM intent classification.
// Preserves code blocks, syntax, markdown, and unicode without aggressive stripping.
// Strictly enforces sequence limits without silent truncation.
// ============================================================================

use crate::classification::errors::{ClassificationError, ClassificationErrorKind, ClassificationStage};
use crate::classification::types::IntentClassificationRequest;

/// Maximum number of recent conversation turns allowed in classification context.
pub const MAX_CONTEXT_TURNS: usize = 2;

/// Formats and validates user input for the local classification model.
pub fn preprocess_classification_input(
    request: &IntentClassificationRequest,
    max_sequence_length: usize,
) -> Result<String, ClassificationError> {
    let trimmed = request.text.trim();

    // 1. Empty or whitespace-only input check (Section 37)
    if trimmed.is_empty() {
        return Err(ClassificationError::empty_input());
    }

    // 2. Assemble bounded prompt with conversation context (if supplied)
    let formatted_prompt = if let Some(ref turns) = request.conversation_context {
        if turns.is_empty() {
            trimmed.to_string()
        } else {
            let mut buf = String::new();
            // Take at most the last MAX_CONTEXT_TURNS
            let recent_turns = if turns.len() > MAX_CONTEXT_TURNS {
                &turns[turns.len() - MAX_CONTEXT_TURNS..]
            } else {
                turns.as_slice()
            };

            for turn in recent_turns {
                let turn_trimmed = turn.trim();
                if !turn_trimmed.is_empty() {
                    buf.push_str("[PREV] ");
                    buf.push_str(turn_trimmed);
                    buf.push('\n');
                }
            }
            buf.push_str("[USER] ");
            buf.push_str(trimmed);
            buf
        }
    } else {
        trimmed.to_string()
    };

    // 3. Approximate word token count check against max sequence limit
    // Tokenizer enforces exact limit; this provides fast pre-flight boundary check
    let estimated_tokens = formatted_prompt.split_whitespace().count() + 2;
    if estimated_tokens > max_sequence_length {
        return Err(ClassificationError::input_too_long(
            estimated_tokens,
            max_sequence_length,
        ));
    }

    Ok(formatted_prompt)
}

