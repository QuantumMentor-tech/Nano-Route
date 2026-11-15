# Nano Route — Provider & Model Compatibility Architecture

## 1. Architectural Philosophy
The Provider & Model Compatibility Center serves as Nano Route's authoritative human-readable capability map. It unifies disparate operational truths—model descriptors, credential vault states, network reachability, runtime health snapshots, token limits, and budget policies—into an observational diagnostic and readiness matrix.

## 2. Unification Pipeline
```text id="compat_pipeline"
Authoritative Subsystems:
  ├── Step 21/56 Provider & Model Registry (Descriptors, Context Limits, Modalities)
  ├── Step 46/74 Credential Vault (DPAPI statuses: Configured, Active, Priority)
  ├── Step 86 Connectivity Center (Reachable, Offline, Flap-stabilized)
  ├── Step 25/56 Provider Health (Ready, Rate-limited, Outage)
  ├── Step 76 Context Window Engine (Input limits, Headroom, Output limits)
  ├── Step 75 Budget Guardrails (Monthly limits, Spend thresholds)
  └── Step 79 Local Attachments (Multimodal requirements: Image, File, Code)
                              ↓
  Authoritative Synthesis Engine (`src/features/provider-compatibility/engine.ts`)
                              ↓
  Normalized Compatibility State:
    ├── Provider Compatibility Records (Readiness, Credential, Connectivity, Health)
    └── Model Compatibility Records (Modalities, Context, Limits, Request Eligibility)
                              ↓
  User Presentation & Safety Surfaces:
    ├── Compatibility Center Modal (`CompatibilityCenterModal.tsx`)
    ├── Header Trigger (`DashboardHeader.tsx`)
    ├── Request Inspector Integration (`RequestInspectorModal.tsx`)
    ├── Command Palette (`COMMAND_REGISTRY`)
    └── Settings & Diagnostics Navigation
```

## 3. Strict Boundary Rules
- **No Second Routing Engine**: The center provides human-readable facts and request eligibility diagnostics. It does **not** rank models, select providers automatically, or override Step 29/30 routing policy.
- **Zero Billable Network Traffic**: Merely opening the Compatibility Center or browsing model cards executes zero billable inference requests, transmits zero user prompts, and performs zero unsolicited network probes.
- **No Capability Inference**: Capabilities are extracted strictly from registered capability sets, never guessed from model names.

