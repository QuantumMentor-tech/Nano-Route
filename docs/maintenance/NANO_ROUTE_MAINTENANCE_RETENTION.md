# Nano Route Maintenance Retention Policy

## Managed Data Artifacts & Expiration Limits

1. **Maintenance History Entries**:
   - Fixed ceiling: 50 records max in circular memory buffer.
   - Contains only operational timing, action ID, and status summary. Zero private user content stored.
2. **Temporary Staging Files**:
   - Application staging files (export zip/csv buffers, import staging blobs) expire after 24 hours.
   - Active files locked by in-flight tasks are strictly protected from deletion.
3. **Notification Records**:
   - Unresolved critical, security, and recovery notifications are retained indefinitely until dismissed by the user.
   - Dismissed / resolved notices older than 30 days are pruned automatically.

