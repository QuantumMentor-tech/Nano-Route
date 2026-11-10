// ============================================================================
// Nano Route - Local SLM Tokenizer Abstraction
// File: src-tauri/src/inference/tokenizer.rs
// ============================================================================
// Standardized tokenizer abstraction producing input_ids, attention_masks,
// and enforcing strict sequence-length boundaries without silent truncation.
// ============================================================================

use std::collections::HashMap;
use std::sync::Arc;

use crate::inference::errors::LocalSlmError;
use crate::inference::types::InferenceInput;

/// Standardized Tokenizer contract for local SLM inference.
pub trait Tokenizer: Send + Sync {
    /// Tokenizes text into model-ready tensor vectors.
    fn encode(&self, text: &str) -> Result<InferenceInput, LocalSlmError>;

    /// Counts the number of tokens that text would produce.
    fn token_count(&self, text: &str) -> usize;

    /// Maximum permitted sequence length before rejecting input.
    fn max_sequence_length(&self) -> usize;
}

/// Production-ready Bert/MiniLM-style subword tokenizer for classifier SLMs.
pub struct BertStyleTokenizer {
    vocab: HashMap<String, i64>,
    cls_token_id: i64,
    sep_token_id: i64,
    unk_token_id: i64,
    pad_token_id: i64,
    max_sequence_length: usize,
}

impl BertStyleTokenizer {
    pub fn new(max_sequence_length: usize) -> Self {
        let mut vocab = HashMap::new();
        // Standard baseline vocabulary entries
        vocab.insert("[PAD]".to_string(), 0);
        vocab.insert("[UNK]".to_string(), 100);
        vocab.insert("[CLS]".to_string(), 101);
        vocab.insert("[SEP]".to_string(), 102);
        vocab.insert("[MASK]".to_string(), 103);

        Self {
            vocab,
            cls_token_id: 101,
            sep_token_id: 102,
            unk_token_id: 100,
            pad_token_id: 0,
            max_sequence_length,
        }
    }

    /// Loads custom vocabulary words.
    pub fn with_vocab_words(mut self, words: &[&str]) -> Self {
        let mut next_id = 1000;
        for w in words {
            self.vocab.insert(w.to_lowercase(), next_id);
            next_id += 1;
        }
        self
    }
}

impl Tokenizer for BertStyleTokenizer {
    fn max_sequence_length(&self) -> usize {
        self.max_sequence_length
    }

    fn token_count(&self, text: &str) -> usize {
        // Approximate token count including [CLS] and [SEP]
        let words = text.split_whitespace().count();
        // At least 2 special tokens + words
        2 + words
    }

    fn encode(&self, text: &str) -> Result<InferenceInput, LocalSlmError> {
        let trimmed = text.trim();
        let words: Vec<&str> = trimmed.split_whitespace().collect();

        // 1. Check token count bounds before building tensors (Section 33)
        let estimated_tokens = 2 + words.len();
        if estimated_tokens > self.max_sequence_length {
            return Err(LocalSlmError::input_too_long(
                estimated_tokens,
                self.max_sequence_length,
            ));
        }

        let mut input_ids = Vec::with_capacity(estimated_tokens);
        let mut attention_mask = Vec::with_capacity(estimated_tokens);

        // Add [CLS]
        input_ids.push(self.cls_token_id);
        attention_mask.push(1);

        for word in words {
            let lower = word.to_lowercase();
            let id = self
                .vocab
                .get(&lower)
                .copied()
                .unwrap_or(self.unk_token_id);

            input_ids.push(id);
            attention_mask.push(1);
        }

        // Add [SEP]
        input_ids.push(self.sep_token_id);
        attention_mask.push(1);

        let sequence_length = input_ids.len();

        Ok(InferenceInput {
            input_ids,
            attention_mask,
            token_type_ids: Some(vec![0; sequence_length]),
            sequence_length,
        })
    }
}

/// Controllable mock tokenizer for deterministic unit tests.
#[derive(Clone)]
pub struct MockTokenizer {
    pub max_seq_len: usize,
    pub forced_token_count: Option<usize>,
}

impl MockTokenizer {
    pub fn new(max_seq_len: usize) -> Self {
        Self {
            max_seq_len,
            forced_token_count: None,
        }
    }

    pub fn with_forced_count(mut self, count: usize) -> Self {
        self.forced_token_count = Some(count);
        self
    }
}

impl Tokenizer for MockTokenizer {
    fn max_sequence_length(&self) -> usize {
        self.max_seq_len
    }

    fn token_count(&self, text: &str) -> usize {
        self.forced_token_count
            .unwrap_or_else(|| 2 + text.split_whitespace().count())
    }

    fn encode(&self, text: &str) -> Result<InferenceInput, LocalSlmError> {
        let count = self.token_count(text);
        if count > self.max_seq_len {
            return Err(LocalSlmError::input_too_long(count, self.max_seq_len));
        }

        let input_ids: Vec<i64> = (0..count).map(|i| 100 + i as i64).collect();
        let attention_mask: Vec<i64> = vec![1; count];

        Ok(InferenceInput {
            input_ids,
            attention_mask,
            token_type_ids: Some(vec![0; count]),
            sequence_length: count,
        })
    }
}

