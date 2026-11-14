# Nano Route Maintenance Security Model

## Security Defenses & Privilege Boundaries

1. **Predefined Operation Allowlist**:
   - The frontend cannot pass arbitrary file paths or SQL strings to maintenance handlers.
   - All actions map directly to pre-compiled native functions in `MAINTENANCE_ACTIONS_CATALOG`.
2. **Path Traversal Protection**:
   - Temporary file scanning and cleanup are constrained strictly to the application-owned temporary subdirectories.
   - Arbitrary filesystem scanning or deletion outside application roots is impossible.
3. **No Arbitrary Shell or Process Execution**:
   - Zero invocation of external operating system shells or batch scripts.

