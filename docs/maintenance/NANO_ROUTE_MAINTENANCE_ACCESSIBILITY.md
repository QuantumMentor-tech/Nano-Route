# Nano Route Maintenance Accessibility & Inclusive UX (WCAG 2.1 AA)

## Accessibility Conformance

1. **Keyboard-Only Operation**:
   - The entire maintenance workspace can be navigated using Tab and activated with Enter / Space.
   - Action triggers feature high-contrast visible focus rings adhering to 3:1 contrast ratios.
2. **Screen Reader Optimization**:
   - Status transitions and check evaluations use semantic ARIA regions (`role="status"`).
   - Clear text labels accompany all health states (`HEALTHY`, `MAINTENANCE_RECOMMENDED`, `ATTENTION_REQUIRED`) rather than relying on color alone.

