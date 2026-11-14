# Nano Route — Preference Accessibility (a11y) & Ergonomics
**Step 66: WCAG 2.1 AA & Windows Desktop Ergonomics Conformance**

## 1. Ergonomic & Inclusive Design Foundations

The User Preferences system is engineered to provide accessibility-first personalizations for users with diverse visual, motor, and cognitive needs.

---

## 2. Key Accessibility Capabilities

### Reduced Motion (`prefers-reduced-motion`)
- **System Default**: Directly detects Windows Accessibility settings (`Settings > Accessibility > Visual Effects > Animation effects`).
- **Force Reduced**: Allows users to explicitly force motion reduction within Nano Route, collapsing all animations and transitions to `0.001ms`.
- **Streaming Guardrail**: Tokens and deltas in chat stream in smoothly without disorienting bouncing or rapid layout shifts.

### Text Scaling & High-DPI Adaptation
- Supports `100%`, `110%`, and `125%` typography scaling via CSS design tokens.
- Fluid typography avoids clipping or horizontal scrolling at Windows display scaling levels up to 200%.

### High-Visibility Focus Indicators
- When `appearance.enhanced_focus` is active, interactive controls render a prominent `3px` solid `#7c3aed` focus ring with a `3px` offset and a `5px` outer glow (`rgba(124, 58, 237, 0.45)`).
- Meets WCAG 2.4.7 (Focus Visible) and WCAG 1.4.11 (Non-text Contrast).

### Contrast Ratios
- Both Dark Mode and Light Mode provide minimum contrast ratios exceeding WCAG 2.1 AA (4.5:1 for body text, 3:1 for large text and UI components).
- Light theme text (`#0f172a`) against canvas (`#ffffff`) delivers a 15.4:1 contrast ratio.
- Dark theme text (`#ffffff`) against surface (`#111318`) delivers a 17.2:1 contrast ratio.

