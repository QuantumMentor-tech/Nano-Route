# Nano Route — Privacy & Data Governance Center Architecture
**Document Version:** 1.0.0  
**Phase:** Post-Roadmap Product Capability Expansion  
**Status:** Authoritative Architectural Design  
**Date:** 2026-11-15  

---

## 1. Architectural Philosophy

Nano Route's architectural foundation is **local-first autonomy**. All conversation storage, attachment caching, private notes, bookmarks, drafts, routing configurations, and performance telemetry reside within the boundaries of the user's local operating system and file system.

The **Privacy & Data Governance Center** functions as a transparent **control and inspection plane** that sits above existing authoritative subsystems:

```
┌────────────────────────────────────────────────────────────────────────┐
│               Privacy & Data Governance Center (Step 88)               │
│                                                                        │
│  [Posture & Guarantees] [Data Inventory] [Flow & Boundaries]           │
│  [Retention & Housekeeping] [Diagnostics & Invariant Checks]           │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                 ┌───────────────────┴───────────────────┐
                 ▼                                       ▼
    Authoritative Persistence Layers       External Transmission Controls
    • Step 45: Data Inventory & Cleanup    • Step 74: DPAPI Credential Store
    • Step 48: Security Boundary Audit     • Step 79: Local Attachment Intake
    • Step 53: SQLite Backup Engine        • Step 82: Private Notes Isolation
    • Step 62: System Diagnostics          • Step 83: Context Collection Packs
    • Step 66: Retention Preferences       • Step 84: Preflight Request Inspector
    • Step 69: Typed Reset Engine          • Step 86: Connectivity Probes
    • Step 70: Data Export Engine          • Step 87: Model Capability Matrix
    • Step 72: SQLite Integrity Checks     
    • Step 73: Database Maintenance        
```

---

## 2. Core Architectural Pillars

### 2.1 Single Plane of Truth
The Privacy Center does not maintain a second database or parallel policy engine. It queries `getDataInventory()`, `getRetentionPolicy()`, and credential state directly through existing IPC and state bridges.

### 2.2 Strict Secret Isolation Invariant
Plaintext API keys never enter the SQLite database, application state snapshots, log files, telemetry tables, or exported JSON bundles. Provider API keys are protected exclusively via Windows DPAPI and injected solely into outgoing HTTPS request headers at dispatch time.

### 2.3 Transparent Network Boundaries
Opening the Privacy Center triggers **zero external network requests**. The entire inventory, retention analysis, and diagnostic evaluation occur locally in device memory.

### 2.4 Logical Deletion Transparency
Nano Route explicitly discloses SQLite storage semantics. Deletions remove database records and free pages for reuse within the database file; they do not perform forensic disk-sector overwrites.

