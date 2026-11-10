# NANO ROUTE — LOCAL SLM RUNTIME & ON-DEVICE INFERENCE ENGINE
## Architecture, Execution Engine, Worker Queue & Lifecycle (Step 26 of 90)

---

## 1. Executive Summary

Step 26 establishes Nano Route's dedicated, on-device Small Language Model (SLM) runtime and native inference engine.

The local SLM runtime acts as Nano Route's zero-cloud, privacy-preserving classification and intelligence backbone. It runs entirely on the user's local Windows machine, ensuring:
- **Zero Cloud Leakage:** Prompts, classification tasks, and raw feature vectors are never transmitted over the internet or sent to external model providers.
- **Offline Autonomy:** The engine operates without internet access, active cloud credentials, or DPAPI keys.
- **Deterministic Routing Foundations:** Provides fast (<20ms target), predictable tokenization and inference outputs for subsequent intent, task, and complexity analysis (Step 27+).
- **Concurrency & Memory Safety:** Built in Rust with a dedicated OS worker thread managing mutable inference sessions, preventing thread contention and ONNX Runtime concurrency hazards.

---

## 2. Architectural Overview

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        Tauri Frontend / IPC Layer                      │
│        (cmd_get_local_runtime_status, cmd_run_local_inference)         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          LocalSlmService                               │
│  - State Machine (Uninitialized -> Loading -> Ready -> Disposed)       │
│  - Manifest Discovery & SHA-256 Integrity Validation                   │
│  - Tokenizer Coordination (Max Sequence Enforced, No Silent Truncation)│
│  - Moving Average Metric Tracking (Cold Load, Inference, Queue Wait)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Bounded MPSC Channel (Capacity: 32)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     Inference Worker OS Thread                         │
│  - Holds exclusive `&mut dyn InferenceSession`                         │
│  - Serializes on-device tensor execution safely                        │
│  - Enforces cooperative cancellation & timeout checks                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  InferenceBackend Boundary (Trait)                     │
│    ┌──────────────────────────────┴──────────────────────────────┐     │
│    ▼                                                             ▼     │
│ [OnnxBackend / OnnxNativeSession]                 [Future GGUF/llama.cpp]│
│ - ONNX Runtime native bindings                    - Preserved abstraction│
│ - CPU Execution Provider (Win Desktop default)                           │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Engine Components

### 3.1 State Machine & Lifecycle (`LocalRuntimeState`)
The runtime state is tracked via thread-safe atomic status:
- `Uninitialized`: Engine created; model assets not yet loaded into RAM.
- `Initializing`: Manifest discovery, file integrity verification, and runtime initialization underway.
- `Ready`: Model weights loaded into native session; worker thread ready for inference.
- `Degraded`: Running in fallback/mock mode or under performance constraints.
- `Error`: Fatal initialization or runtime failure (e.g., corrupt manifest, missing weights).
- `Disposed`: Model session and worker thread explicitly torn down to reclaim memory.

### 3.2 Single-Worker Mutable Session Architecture
Because native ONNX Runtime sessions (`ort::Session::run`) require mutable references (`&mut self`), direct multi-threaded sharing leads to synchronization locks or undefined behavior. Nano Route solves this by:
1. Spawning a dedicated background OS thread (`inference_worker`).
2. Giving the worker thread sole ownership of the mutable `InferenceSession`.
3. Communicating via a bounded FIFO MPSC channel (default max queue: 32).
4. If the queue reaches capacity, immediately returning a typed `LocalSlmError::runtime_busy` to protect host memory.

### 3.3 Tokenizer Safety & Input Boundaries
- **Trait-Based Tokenizer:** `Tokenizer` trait defines subword/wordpiece tokenization.
- **Strict Bounds Checking:** When input tokens exceed `max_sequence_length` (e.g., 512 tokens), the tokenizer immediately rejects the request with `InputTooLong`.
- **No Silent Truncation:** Critical routing prompts are never silently truncated, ensuring classification decisions are always based on full user context.

### 3.4 Cooperative Cancellation & Timeouts
Inference requests carry an optional `TaskContext` and explicit timeout (e.g., default 5,000ms):
1. **Pre-Queue Check:** If the cancellation token is already triggered, the job aborts immediately without enqueueing.
2. **Worker Dequeue Check:** Prior to invoking `session.run()`, the worker checks if the request was cancelled while waiting in queue.
3. **Cooperative Channel Response:** Cancelled or timed-out requests yield `InferenceCancelled` / `InferenceTimedOut` without poisoning the session.

---

## 4. Metrics & Performance Targets

| Metric | Target | Description |
|---|---|---|
| **Cold Load Time** | < 1,500 ms | Time to discover manifest, verify checksums, and instantiate ONNX session. |
| **Warm Inference Latency** | < 25 ms | Time to run forward tensor inference on local CPU for routing prompts. |
| **Tokenization Latency** | < 2 ms | Time to tokenize inputs up to 512 tokens without allocation bottlenecks. |
| **Queue Wait Time** | < 5 ms | Latency between request submission and worker dequeuing under normal load. |
| **Memory Footprint** | < 250 MB | Total RAM consumed by the local SLM session and tokenizer. |

All metrics are tracked via a rolling 100-sample window and exposed to the desktop UI via `cmd_get_local_runtime_metrics`.

---

## 5. Security & Privacy Guarantees

1. **No External Network I/O:** The local SLM engine contains zero HTTP clients, sockets, or network bindings.
2. **Zero Telemetry Leaks:** User prompts and raw output tensors are strictly prohibited from log statements, error payloads, or analytics.
3. **Integrity-First Loading:** Weights cannot be loaded without a valid manifest containing matching SHA-256 hashes and file size declarations.

---

## 6. Future Backend Extensions (GGUF / llama.cpp)

The `InferenceBackend` and `InferenceSession` traits provide a clean architectural boundary:
```rust
pub trait InferenceBackend: Send + Sync {
    fn backend_type(&self) -> InferenceBackendType;
    fn create_session(&self, manifest: &LocalModelManifest) -> Result<Box<dyn InferenceSession>, LocalSlmError>;
}
```
While ONNX Runtime is the production default for Step 26, future steps can introduce a GGUF backend (`InferenceBackendType::GgufLlamaCpp`) without modifying the `LocalSlmService` or IPC surface.

