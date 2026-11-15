# Nano Route — Provider Reachability Policy

## 1. Provider Probe Guarantees
1. **Zero Secret Exposure**: Health checks utilize Step 25 IPC (`checkProviderHealth`). Credentials never pass through frontend JavaScript state or diagnostic reports.
2. **Zero Prompt Transmission**: Probes never send user conversational text, system instructions, attachment data, or private notes.
3. **No Unsolicited Background Polling Loops**: To prevent API quota exhaustion, excessive battery draw, and unwanted remote traffic, health checks are strictly user-initiated or triggered on explicit preflight validation.
4. **Cancellability**: All multi-provider or single-provider probes accept an `AbortSignal` to allow immediate user cancellation.
5. **Short-Circuit on Local Offline**: If `isAppOffline()` is true, remote probes are aborted immediately without dispatching useless network packets.

