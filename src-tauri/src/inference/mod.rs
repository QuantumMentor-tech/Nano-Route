//! Nano Route — Local SLM Inference Subsystem
//!
//! Responsibility:
//! - Local model execution (ONNX Runtime / DirectML or llama.cpp / GGUF).
//! - Tokenizer management and prompt template formatting.
//! - Local task classification and intent extraction.
//! - Must NOT own UI presentation or external provider HTTP requests.

