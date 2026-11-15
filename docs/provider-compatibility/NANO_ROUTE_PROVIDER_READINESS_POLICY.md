# Nano Route — Provider Readiness Policy

## 1. Multi-Component Decomposition
Provider readiness is derived from the composition of independent authoritative states:

```text
[Credential Readiness]
  ├── NOT_REQUIRED: Local SLM or zero-auth providers
  ├── READY: API key securely stored and active
  ├── MISSING: No credential configured
  └── NEEDS_ATTENTION: Authentication failed (HTTP 401/403)

[Connectivity Readiness]
  ├── REACHABLE: Endpoint responding normally
  ├── OFFLINE: Local network disconnected or endpoint down
  └── DEGRADED: Partial packet loss or intermittent failures

[Health Readiness]
  ├── READY: Operational runtime
  ├── RATE_LIMITED: Quota or rate limit active (HTTP 429)
  └── UNAVAILABLE: Provider service outage (HTTP 5xx)

[Registry Lifecycle]
  ├── READY: Active, supported model descriptor
  └── DEPRECATED: Flagged as deprecated upstream
```

## 2. Overall Readiness Precedence
1. `DISABLED`: If the provider is disabled in user preferences.
2. `NOT_CONFIGURED`: If mandatory credentials are missing.
3. `AUTH_REQUIRED`: If authentication failed.
4. `OFFLINE`: If local network is offline or endpoint unreachable.
5. `UNAVAILABLE`: If upstream provider is down.
6. `READY_WITH_LIMITATIONS`: If rate-limited or approaching context limits.
7. `DEPRECATED`: If model is scheduled for retirement.
8. `INCOMPATIBLE`: If requirements exceed model capabilities.
9. `READY`: When all components pass validation.

