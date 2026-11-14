# Nano Route Preventive Maintenance Privacy Guarantees

## Local-First & Zero-Leakage Assurances

1. **100% On-Device Operation**:
   - Zero telemetry upload, cloud monitoring, or remote health diagnostics.
   - All maintenance evaluations run locally against on-device SQLite databases and local configuration files.
2. **Zero Sensitive Content in History**:
   - Maintenance log entries record timestamps, action identifiers, and item count summaries.
   - User prompts, assistant replies, model outputs, and API credentials are never written to maintenance history.

