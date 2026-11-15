# Nano Route — Connectivity State Model

## 1. Normalized Local Network States
- `ONLINE`: Active network interface detected. Remote AI provider endpoints can be contacted.
- `OFFLINE`: Network interfaces report disconnected. Remote provider requests are blocked at preflight.
- `DEGRADED`: Local network path exists, but one or more major provider endpoints are failing or rate-limited.
- `UNKNOWN`: Available evidence is insufficient to make a definitive determination.
- `TRANSITIONING`: An operating system network state transition is currently within the flap debounce stabilization window.

## 2. Provider Reachability States
- `REACHABLE`: Health probe succeeded with HTTP 200 OK within latency bounds.
- `UNREACHABLE`: Socket connection refused, DNS lookup failed, TLS handshake failed, or connection timed out.
- `AUTH_REQUIRED`: Provider endpoint responded with HTTP 401 Unauthorized or HTTP 403 Forbidden. The network is healthy, but the user's API key is invalid, expired, or missing permissions.
- `RATE_LIMITED`: Provider endpoint responded with HTTP 429 Too Many Requests. The network is healthy, but quota or rate limits are exhausted.
- `SERVICE_ERROR`: Provider returned HTTP 5xx Server Error or maintenance status.
- `NOT_CONFIGURED`: No API key or credential has been supplied in Provider Settings.
- `UNKNOWN`: Provider has not yet been probed in the current session.

## 3. Strict Truthfulness Invariants
- An authentication error (401/403) is **never** classified as `OFFLINE`.
- A rate limit response (429) is **never** classified as `OFFLINE`.
- A provider-specific outage does **not** degrade local network state to `OFFLINE`.
- Local SLM availability is completely decoupled from remote provider reachability.

