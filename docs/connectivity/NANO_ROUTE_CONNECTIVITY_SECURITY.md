# Nano Route — Connectivity Security

## 1. Zero Trust & Security Boundaries
The connectivity subsystem operates within Nano Route's zero-trust desktop boundary:
1. **No Outbound Analytics**: No external ping servers, heartbeat daemons, or telemetry beacons are contacted.
2. **Credential Sanitization**: Health check probes never transmit authorization headers, API keys, or DPAPI tokens to frontend JavaScript.
3. **Endpoint Validation**: Health checks strictly query provider endpoints configured in the authoritative registry. Probing arbitrary user-entered URLs is forbidden.
4. **TLS Integrity**: Certificate verification is never bypassed, disabled, or degraded for health check probes.
5. **No System Network Administration**: Nano Route does not modify Windows network adapter settings, alter DNS resolvers, establish VPN tunnels, or configure Windows Firewall rules.

