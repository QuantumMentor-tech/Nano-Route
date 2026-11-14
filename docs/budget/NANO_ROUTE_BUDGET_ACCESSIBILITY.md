# Nano Route — Budget & Quota UI Accessibility Specification

**Document Version:** 1.0.0  
**Status:** Authoritative  
**Step:** 75 — Provider Budget Controls, Quota Awareness, Spend Guardrails, Usage Limits & Cost-Safe Request Enforcement  
**Subsystems:** React UI, Design System, WCAG 2.1 AA Compliance  

---

## 1. Multi-Attribute Status Indicators

Status badges for budget health (`HEALTHY`, `WARN_THRESHOLD_REACHED`, `LIMIT_EXCEEDED`, `UNLIMITED`) never rely solely on color cues. Each badge includes:
1. Distinct semantic icon (e.g., check circle, warning triangle, shield alert).
2. Explicit textual descriptor (e.g., "Within Budget", "Approaching Limit (85%)", "Budget Exceeded").
3. Semantic ARIA role (`role="status"` or `role="alert"`).

---

## 2. Keyboard Navigation & Screen Reader Support

1. **Form Controls**: Budget input fields (`budgetLimitUsd`, enforcement mode radio/select) provide accessible `id` and `aria-label` or `<label for="...">` associations.
2. **Reconciliation Action**: The "Reconcile Spend" button announces completion via `aria-live="polite"` regions so screen reader users receive confirmation without losing focus.
3. **Contrast Compliance**: Text colors against background badges meet the minimum WCAG 2.1 AA contrast ratio of 4.5:1.

