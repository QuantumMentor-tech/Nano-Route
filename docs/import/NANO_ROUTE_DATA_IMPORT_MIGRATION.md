# Nano Route Data Migration & Version Translation

## Backward Compatibility & Format Evolution

Nano Route guarantees schema forward and backward compatibility across versions:

1. **Version 1 Manifests**: Packages declaring `exportSchemaVersion: 1` map 1:1 to current SQLite domain types.
2. **Future Schema Version Handling**: If an export package with version $> 1$ is detected, the import validator flags an `INCOMPATIBLE` error instructing the user to update the desktop client.
3. **Missing Optional Fields**: Fallback defaults are injected gracefully (e.g. absent message tokens default to 0, missing pinned status defaults to `false`).

