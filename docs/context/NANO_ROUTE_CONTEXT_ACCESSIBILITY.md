# Nano Route — Context Accessibility Specification

**Document Version:** 1.0.0  
**Status:** Authoritative  
**Step:** 76 — Context Window Management, Prompt Size Guardrails, Token Budgeting, Request Preflight & Safe Context Optimization  
**Subsystems:** UI Components, Design System, WCAG 2.1 AA Compliance  

---

## 1. Multi-Attribute Status Indicators

Context headroom states never rely exclusively on color cues:
- **`SAFE`**: Checkmark circle icon + green accent + text "Context Safe" + full token description.
- **`NEAR_LIMIT`**: Warning triangle icon + amber accent + text "Near Context Limit" + warning toast.
- **`EXCEEDS_LIMIT`**: Octagon stop icon + red accent + text "Context Limit Exceeded" + blocking banner.
- **`UNKNOWN`**: Help circle icon + gray accent + text "Unverified Limit".

---

## 2. Screen Reader & Keyboard Operation

1. **Context Indicator**: Renders as a focusable button with an informative `aria-label`:
   > *"Estimated context: approximately 18,200 tokens of a 128,000 token limit. Context Safe."*
2. **Context Review Modal**:
   - Focus is automatically trapped within the modal upon opening.
   - Pressing `Escape` or clicking `Close` returns focus cleanly to the invoking element.
   - Radio buttons and window-size dropdown are fully navigable via standard Arrow and Tab keys.
3. **High Contrast & Reduced Motion**:
   - Meets WCAG 2.1 AA 4.5:1 text contrast ratios.
   - Smooth transitions respect Windows `prefers-reduced-motion` settings.

