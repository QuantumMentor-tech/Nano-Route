# Nano Route Data Import Accessibility & Keyboard Navigation (WCAG 2.1 AA)

## Accessibility Conformance

1. **Semantic HTML & Keyboard Navigation**:
   - The drag-and-drop file upload target maintains an accessible hidden `<input type="file" aria-label="Upload Nano Route Export Package" />` navigable via Tab and triggered with Enter / Space.
   - All interactive checkboxes, collision strategy dropdowns, and buttons feature visible focus indicators meeting 3:1 contrast ratios.
2. **Screen Reader Announcements**:
   - Operation status messages (Validating, Incompatible, Importing, Completed) use ARIA live regions (`role="status"` and `role="alert"`) for non-visual assistive tech feedback.
   - Color coding is paired with distinct status icons (`CheckCircle2`, `AlertTriangle`, `AlertCircle`).

