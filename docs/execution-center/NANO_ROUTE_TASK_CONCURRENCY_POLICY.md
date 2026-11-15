# Nano Route — Task Concurrency Policy

## 1. Concurrency Boundaries
Nano Route supports controlled concurrent execution across interactive requests and background tasks. The concurrency model is designed to prevent local CPU starvation, provider rate limits, and memory exhaustion.

## 2. Concurrency Categorization
Tasks are partitioned into explicit categories:
1. `REQUEST`: User-initiated prompt executions and completions. Bounded by provider limits and UI active session constraints.
2. `BACKGROUND_MAINTENANCE`: Automated integrity checks, cache pruning, and database optimization.
3. `ATTACHMENT_INGESTION`: Local document extraction, OCR, and embedding generation.
4. `HEALTH_CHECK`: Periodic provider connectivity probes.
5. `EXPORT_IMPORT`: Data migration, workspace backup, and restoration.

## 3. Enforcement Invariants
- **Session Mutual Exclusion**: At most one active prompt streaming execution per active chat session at any given time.
- **Provider Request Throttling**: Concurrent requests to identical providers observe Step 38 rate limiting and backoff thresholds.
- **Background Deprioritization**: Background tasks yield immediately when user requests are actively streaming.
- **Cancellation Cooperative Yield**: In-flight tasks check cancellation flags at streaming delta intervals.

