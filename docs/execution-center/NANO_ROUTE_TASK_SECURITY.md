# Nano Route — Task Security

## 1. Security Architecture
The Active Request Center operates within Nano Route's zero-trust desktop boundary. It acts as an observational window and control point without possessing privileged access to mutate persistent user data or bypass safety gates.

## 2. Security Invariants
- **No Secret Exposure**: API keys, DPAPI encrypted tokens, master passwords, or authorization headers are never placed into task state, error logs, or UI strings.
- **Redaction of Sensitive Content**: Prompt snippets are truncated to 100 characters and stripped of control characters before storage in memory.
- **Origin & Capability Verification**: Operations initiated via IPC are strictly verified against sender process IDs and window instances.
- **Defense in Depth**: The Active Request Center modal cannot be leveraged by third-party scripts or malicious IPC events to inject arbitrary tasks into the registry.
- **No Direct Network Access**: The execution center engine makes zero external HTTP, TCP, or WebSocket requests directly.

