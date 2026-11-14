# Nano Route — Workspace Profile Accessibility & Ergonomics Specification

**Document Reference:** `docs/profiles/NANO_ROUTE_WORKSPACE_PROFILE_ACCESSIBILITY.md`  
**Application:** Nano Route Desktop (Windows 10/11 x64, Tauri v2)  
**Implementation Phase:** Step 67  
**Compliance Standard:** WCAG 2.1 Level AA / Section 508 / EN 301 549  

---

## 1. Overview & Accessibility Mandate

The Workspace Profiles and Preference Presets subsystem is engineered to ensure seamless keyboard navigation, robust screen reader announcements, high visual contrast, and immediate accessibility adaptability.

A core feature of Step 67 is the canonical **High-Visibility Accessibility Preset** (`prof_accessibility`), which provides a one-click mechanism to configure the entire desktop environment for low-vision and motor-sensitive workflows.

---

## 2. The High-Visibility Accessibility Preset (`prof_accessibility`)

| Characteristic | Setting Value | Accessibility Ergonomics & Compliance |
| :--- | :--- | :--- |
| **Canvas Contrast Ratio** | Light Mode (`appearance.theme_mode = "light"`) | Yields a **15.4:1 contrast ratio** between primary text (`#0f172a`) and background canvas (`#ffffff`), far exceeding the WCAG AAA 7:1 threshold. |
| **Typography Scaling** | 110% (`appearance.text_scale = "110%"`) | Increases base font metrics across all UI views, toolbars, and chat turns without clipping or horizontal overflow. |
| **Focus Indicator** | 3px Enhanced Focus (`appearance.enhanced_focus = "true"`) | Renders high-visibility 3px solid focus rings with 2px offset on all interactive buttons, inputs, and tabstops. |
| **Animation & Motion** | Reduced Motion (`appearance.reduced_motion = "reduced"`) | Disables layout shifts, smooth scroll animations, and drawer transitions, protecting users with vestibular conditions. |
| **Notification Longevity**| 8000ms (`notifications.toast_duration_ms = "8000"`) | Extends toast reading time to 8 seconds, ensuring users have ample time to perceive and interact with alerts. |

---

## 3. Keyboard Navigation & Shortcuts

1. **Global Command Palette Integration:**
   - `Ctrl+K`: Opens the Command Palette.
   - Users can type `switch profile` or `profile` to filter profile-switching actions.
   - Quick action shortcuts:
     - `action-switch-default-profile`: "Switch to Default Workspace Profile"
     - `action-switch-focus-profile`: "Switch to Focus & Deep Work Profile"
     - `action-switch-compact-profile`: "Switch to Compact Analytics Profile"
     - `action-switch-a11y-profile`: "Switch to High-Visibility Accessibility Profile"
2. **Settings Tab Navigation:**
   - Settings workspace tablist is fully navigable via `Tab` and `Shift+Tab`.
   - The "Profiles & Presets" tab (`tab=profiles`) is directly linkable and keyboard focusable.
3. **Modal Dialog Controls:**
   - `Escape`: Immediately dismisses the Save Profile or Import Profile modal without state mutation.
   - Focus is automatically trapped within active modal dialogs.

---

## 4. Screen Reader Semantics & ARIA Landmarks

- **Modal Dialogs:** Marked with `role="dialog"`, `aria-modal="true"`, and referenced via `aria-labelledby="save-profile-title"` or `aria-labelledby="import-profile-title"`.
- **Active Profile Badge:** Rendered with clear text indicators (`"Active Profile"`, `"Built-in Preset"` or `"Custom Profile"`) rather than relying solely on color coding.
- **Diffs Table:** Accessible HTML `<table>` with explicit `<th>` headers (`"Preference"`, `"Current"`, `"Imported Target"`), enabling screen reader table traversal.
- **Live Notifications:** Profile creation, activation, deletion, and import events announce changes via Step 64 `publish()` with appropriate assertive/polite priority.

