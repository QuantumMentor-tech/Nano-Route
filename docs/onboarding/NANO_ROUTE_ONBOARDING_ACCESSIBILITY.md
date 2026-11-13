# Nano Route Onboarding Accessibility & Inclusive Design Verification

## 1. Compliance Standards
The Guided Onboarding experience is built to comply with **WCAG 2.1 Level AA** standards and leverages the Step 60 accessibility infrastructure:
- Focus trapping within the `OnboardingModal` overlay (`role="dialog"` and `aria-modal="true"`).
- Dynamic progress bar exposing `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, and `aria-valuemax`.
- Consistent heading hierarchy (`<h3 id="onboarding-step-heading">`).
- Color-independent status indicators with explicit vector iconography and readable text badges.
- High-DPI and display scaling adaptability (no clipping or horizontal scrollbars at 150% scaling).

---

## 2. Keyboard Navigation Contracts

| Key Interaction | Scope | Expected Behavior |
|:---|:---|:---|
| **Tab / Shift+Tab** | Onboarding Modal | Cycles focus strictly within the modal container. Does not bleed into background application shell. |
| **Enter** | Action Buttons | Triggers "Continue", "Finish Setup", or "Save Key". |
| **Escape** | Onboarding Modal | Safely dismisses the onboarding modal and returns focus to the triggering CTA in the Dashboard header. |
| **Space** | Toggles | Toggles API key visibility or provider selection badges. |

---

## 3. Screen Reader Verification (Windows Narrator / NVDA)
- **Step Change Announcements:** When advancing from Step 1 to Step 2, the step title and progress are announced cleanly: *"Step 2 of 8: System Readiness"*.
- **Polite Live Regions:** Readiness badges and test probe results use `role="status"` with polite updates, preventing screen reader stutter.
- **Form Associations:** API key input fields feature explicit `<label htmlFor="...">` associations and `aria-label` controls for password visibility toggles.

