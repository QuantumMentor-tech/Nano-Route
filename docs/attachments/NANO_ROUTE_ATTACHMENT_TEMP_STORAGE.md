# Nano Route — Attachment Temporary Storage & Resource Management
**Step 79 — Authoritative Resource Reference**

## 1. Storage Footprint & Lifecycle
- **Memory-First Processing**: Attachments are read into local client memory via the browser File API during active drafting.
- **Immediate Cleanup**: Once a message is submitted or cancelled, attachments are cleared from memory.
- **Zero Disk Residue**: Temporary scratch files are not written to the OS temp directory unless explicit disk caching is enabled in Step 73 maintenance routines.
- **Cascading Reset**: Reset operations (Step 69) and draft discards (Step 78) immediately flush any held attachment references.

