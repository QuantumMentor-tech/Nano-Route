# Nano Route — Request Presets Policy & Operational Invariants
**Step 77 — Authoritative Presets Reference**

## 1. Request Preset Scope & Invariants
Request Presets allow saving pre-configured drafting bundles consisting of:
- An optional associated `templateId`
- Recommended target provider (e.g. `anthropic`, `deepseek`)
- Recommended target model (e.g. `claude-3-5-sonnet-20241022`)
- Optional generation parameters: `temperature` and `maxTokens`
- Optional system instructions

## 2. Strict Boundary Rules
1. **Advisory Preference Only**: Preset configurations provide drafting suggestions to the Composer. They DO NOT bypass:
   - Provider budget caps or monthly spend enforcement (Step 75)
   - Context window evaluation or preflight validation (Step 76)
   - Credential validation or DPAPI access checks (Step 74)
2. **Zero Auto-Execution**: Applying a preset never sends an immediate network request. The Composer is seeded with the configured parameters, awaiting explicit user confirmation and submission.
3. **Graceful Template Deletion**: If a template linked to a preset is deleted, foreign-key rules set `template_id = NULL` on the preset without deleting the preset itself.

