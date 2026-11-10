# NANO ROUTE — LOCAL MODEL MANIFEST & INTEGRITY SPECIFICATION
## Packaging, Checksum Verification & Sequence Limits (Step 26 of 90)

---

## 1. Executive Summary

This document specifies the format, schema validation, cryptographic integrity verification, and runtime sequence boundaries for Nano Route's local SLM models.

To ensure stability, security, and predictability on end-user Windows desktops, models executed by Nano Route's local runtime must adhere to strict manifest contracts before any file is mapped into host memory.

---

## 2. Manifest Schema (`LocalModelManifest`)

Local models are described by a declarative JSON manifest (`manifest.json`):

```json
{
  "model_id": "nano-route-router-v1",
  "name": "Nano Route Router SLM",
  "version": "1.0.0",
  "backend": "onnx",
  "execution_provider": "cpu",
  "model_file": "model.onnx",
  "model_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "model_size_bytes": 45000000,
  "tokenizer_type": "bert_style",
  "tokenizer_vocab_file": "vocab.txt",
  "tokenizer_vocab_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "max_sequence_length": 512,
  "hidden_size": 256,
  "num_classes": 16,
  "labels": [
    "coding",
    "reasoning",
    "creative",
    "factual",
    "summarization",
    "extraction",
    "math",
    "multi_turn",
    "system_instruction",
    "simple_query",
    "complex_workflow",
    "code_generation",
    "code_debugging",
    "translation",
    "analysis",
    "general"
  ]
}
```

---

## 3. Cryptographic & File Integrity Verification

Before creating an `InferenceSession` or opening model files:
1. **Manifest Validation:** Required fields (`model_id`, `name`, `version`, `model_file`, `model_sha256`, `max_sequence_length`) are verified. `max_sequence_length` must be between 1 and 4,096.
2. **File Existence Check:** The binary file specified in `model_file` must exist within the model package directory.
3. **Byte Length Verification:** If `model_size_bytes` is greater than 0, the on-disk file size must match exactly.
4. **SHA-256 Digest Computation:** The complete file is streamed through a SHA-256 hasher. If the hex-encoded digest does not match `model_sha256`, loading is aborted immediately with `LocalSlmErrorKind::ModelIntegrityFailure`.
5. **Tokenizer Asset Verification:** If `tokenizer_vocab_file` is specified, its existence and optional SHA-256 digest are similarly validated before the tokenizer is initialized.

---

## 4. Sequence Length & Bounds Invariants

| Parameter | Default | Hard Minimum | Hard Maximum | Rejection Policy |
|---|---|---|---|---|
| `max_sequence_length` | 512 | 16 | 4,096 | Requests exceeding limit reject with `InputTooLong` |
| `max_queue_capacity` | 32 | 1 | 128 | Requests submitted at capacity reject with `RuntimeBusy` |
| `default_timeout_ms` | 5,000 ms | 100 ms | 30,000 ms | Inference exceeding limit cancels with `InferenceTimedOut` |

### Zero Silent Truncation Invariant
Nano Route enforces that user prompt context is never silently discarded. If a prompt's tokenized length exceeds `max_sequence_length`, the engine returns `LocalSlmError::input_too_long(...)`. The caller (router service in Step 27+) is responsible for applying explicit context windowing or routing directly to large-context cloud models.

---

## 5. Model Packaging & Installation Layout

On the Windows desktop, the local SLM distribution is located at:
```text
%APPDATA%/NanoRoute/models/router/
├── manifest.json
├── model.onnx
└── vocab.txt
```

If the physical model files are absent upon startup, `LocalSlmService` enters `LocalRuntimeState::Uninitialized` with `LocalModelStatus::NotInstalled`. The application remains 100% operational, and testing doubles (`FakeInferenceBackend`) allow full deterministic verification in test environments.

