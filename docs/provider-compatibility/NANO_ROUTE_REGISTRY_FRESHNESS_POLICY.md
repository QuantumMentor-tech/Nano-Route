# Nano Route — Registry Freshness & Drift Policy

## 1. Registry Source of Truth
Nano Route relies on the static and contract-validated model descriptors bundled into the desktop core (Step 21 & Step 56).

## 2. Drift Detection & Handling
When upstream providers introduce new models, rename existing endpoints, or deprecate older variants:
- **No Silent Modification**: The Compatibility Center will never silently rewrite registry files or synthesize unverified capabilities in memory.
- **Contract Test Synchronization**: Drift is detected through Step 56 provider contract tests.
- **Deprecation Visibility**: Models flagged as deprecated display a distinct amber badge (`Deprecated`) and explanation, informing the user while still allowing execution until retired.
- **No Automatic Remote Catalog Downloads**: Nano Route does not execute unauthenticated remote catalog fetches at runtime.

