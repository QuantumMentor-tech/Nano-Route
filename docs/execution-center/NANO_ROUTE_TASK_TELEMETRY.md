# Nano Route — Task Telemetry & Performance Metrics

## 1. Local Observability Metrics
The Active Request Center coordinates closely with the Step 18 / Step 41 telemetry subsystem to measure execution performance accurately without compromising user privacy.

## 2. Tracked Operational Telemetry
- **Elapsed Duration (`elapsedMs`)**: Milliseconds from task dispatch to final token receipt or failure.
- **Token Throughput**: Running tally of prompt and generated completion tokens.
- **Lifecycle Transition Latencies**: Time spent in `PREPARING`, `ROUTING`, and `CONNECTING` stages, enabling rapid identification of SLM routing or DNS/TLS bottlenecks.
- **Failover & Retry Counters**: Total physical attempts required to achieve completion.
- **Cancellation Latency**: Time between user cancellation signal dispatch and native provider socket drop.
- **Terminal State Distributions**: Aggregated counts of successful, failed, cancelled, and blocked tasks for session performance audits.

