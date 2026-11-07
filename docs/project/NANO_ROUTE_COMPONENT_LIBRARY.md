# Nano Route Component Library & Interaction Architecture
**Document ID:** `NR-DOC-COMP-001`  
**Step:** 10 of 50  
**Status:** Approved & Implemented  
**Date:** November 2026  
**Audience:** UI Architects, Frontend Engineers, Design System Engineers, Accessibility Engineers, QA Engineers  

---

## 1. Component Architecture
The Nano Route component library establishes a unified interaction and component system for the desktop application. Building upon the visual tokens defined in Step 6, Step 10 establishes the behavior, APIs, keyboard navigation, focus management, and accessibility contracts for all reusable UI components.

The library strictly adheres to the principle:
> **Build reusable interaction primitives once, then reuse them everywhere.**

Components are organized by responsibility in `src/components/`:
```text
src/components/
├── ui/                 # Atomic visual primitives (Button, Input, Select, Badge, Card, etc.)
├── forms/              # Form composition primitives (FormField, SearchField)
├── feedback/           # User feedback primitives (Alert, Toast, ToastContainer, EmptyState)
├── overlays/           # Floating & modal primitives (Dialog, ConfirmDialog, DropdownMenu, Popover)
├── navigation/         # Navigation & sectioning (Sidebar, Tabs)
├── layout/             # Structure & scrolling (SectionHeader, ScrollContainer)
└── index.ts            # Authoritative centralized exports
```

---

## 2. Component Categories
All components are strictly categorized into three tiers:

1. **Primitive Components:** Generic, leaf-level visual elements with minimal internal state (`Button`, `IconButton`, `Input`, `Textarea`, `Select`, `Badge`, `Card`, `Divider`, `Spinner`, `Skeleton`, `Tooltip`, `StatusIndicator`).
2. **Compound / Shared Components:** Reusable interaction patterns composed from primitives (`FormField`, `SearchField`, `Dialog`, `ConfirmDialog`, `DropdownMenu`, `Popover`, `Tabs`, `Alert`, `Toast`, `EmptyState`, `SectionHeader`, `ScrollContainer`).
3. **Feature-Specific Components:** Components strictly bound to product feature domains (e.g., `ChatMessage`, `ProviderCard`, `ModelCard`). *Feature-specific components are explicitly prohibited from the global UI layer.*

---

## 3. Primitive Components

| Component | Responsibility | Props / Key Options | Status |
|---|---|---|---|
| `Button` | Primary action trigger with loading, disabled, icons, and 5 visual variants. | `variant`, `size`, `isLoading`, `leftIcon`, `rightIcon`, `disabled` | IMPLEMENTED |
| `IconButton` | Icon-only button with mandatory accessible name and fixed hit targets (`28px`, `36px`, `44px`). | `icon`, `aria-label`, `variant`, `size`, `isLoading`, `disabled` | IMPLEMENTED |
| `Input` | Text input control with controlled/uncontrolled support, helper text, and error states. | `label`, `error`, `helperText`, `leftIcon`, `rightIcon`, `disabled` | IMPLEMENTED |
| `Textarea` | Multi-line text input with custom scrollbar, min-rows, and error styling. | `label`, `error`, `helperText`, `rows`, `disabled` | IMPLEMENTED |
| `Select` | Native dropdown select with custom SVG caret indicator, label, and error handling. | `label`, `options`, `error`, `helperText`, `disabled` | IMPLEMENTED |
| `Badge` | Inline status/category badge with 7 semantic variants and optional icon slot. | `variant`, `size`, `icon`, `children` | IMPLEMENTED |
| `Card` | Structural surface with 4 variants (`default`, `elevated`, `interactive`, `selected`). | `variant`, `padding`, `children` | IMPLEMENTED |
| `Divider` | Semantic separator supporting horizontal, vertical, and centered text labels. | `orientation`, `label` | IMPLEMENTED |
| `Spinner` | Indeterminate rotational loading indicator with 3 sizes. | `size`, `color` | IMPLEMENTED |
| `Skeleton` | Content placeholder with shimmer animation; respects `prefers-reduced-motion`. | `width`, `height`, `borderRadius` | IMPLEMENTED |
| `Tooltip` | Delayed hover/focus tooltip with Escape dismissal and collision offset. | `content`, `position`, `delayMs`, `disabled` | IMPLEMENTED |
| `StatusIndicator` | Text + color status indicator for system and native core state. | `status`, `label`, `size`, `pulse` | IMPLEMENTED |

---

## 4. Compound Components

| Component | Responsibility | Props / Key Options | Status |
|---|---|---|---|
| `FormField` | Semantic composition linking Label, Control, Description, and Error with `useId`. | `id`, `label`, `description`, `error`, `required`, `children` | IMPLEMENTED |
| `SearchField` | Specialized search input with search icon, clear button (`X`), and Escape clearing. | `value`, `defaultValue`, `onClear`, `placeholder` | IMPLEMENTED |
| `Dialog` | Modal dialog with backdrop blur, focus trap, focus restoration, and Escape dismissal. | `isOpen`, `onClose`, `title`, `description`, `footer`, `maxWidth` | IMPLEMENTED |
| `ConfirmDialog` | Confirmation modal for critical actions with explicit destructive styling. | `isOpen`, `onConfirm`, `onCancel`, `title`, `confirmLabel`, `isDestructive` | IMPLEMENTED |
| `DropdownMenu` | Action menu (distinct from Select) with keyboard traversal and item shortcuts. | `trigger`, `items`, `align` | IMPLEMENTED |
| `Popover` | Contextual floating panel anchored to a trigger with click-outside dismissal. | `trigger`, `content`, `position`, `isOpen`, `onOpenChange` | IMPLEMENTED |
| `Tabs` | Accessible tablist/tab/tabpanel system with Arrow navigation and aria attributes. | `value`, `defaultValue`, `onValueChange`, `children` | IMPLEMENTED |
| `Alert` | Persistent inline notification banner (`info`, `success`, `warning`, `error`). | `variant`, `title`, `onDismiss`, `action`, `children` | IMPLEMENTED |
| `Toast` / `ToastContainer` | Transient notification toast stack with auto-dismiss and pause on hover. | `variant`, `title`, `message`, `durationMs` | IMPLEMENTED |
| `EmptyState` | Standardized empty placeholder with icon, title, description, and action buttons. | `icon`, `title`, `description`, `primaryAction`, `secondaryAction` | IMPLEMENTED |
| `SectionHeader` | Reusable section header with title, subtitle, optional badge, and action slot. | `title`, `description`, `badge`, `action`, `headingLevel` | IMPLEMENTED |
| `ScrollContainer` | Standardized desktop scrollable container with thin custom scrollbars. | `direction`, `maxHeight`, `maxWidth` | IMPLEMENTED |

---

## 5. Feedback Components
- **Alert:** Intended for persistent, page-level messages or configuration warnings. Does not self-dismiss unless an explicit `onDismiss` callback is provided.
- **Toast:** Intended for short-lived operational feedback (e.g., "Settings saved", "Build ID copied"). Managed via `useToast()` hook. Capped at a maximum queue of 5 visible toasts. Error toasts display for 6,000ms by default; other variants display for 4,000ms. Pauses countdown when hovered.
- **EmptyState:** Intended for surfaces awaiting user data (e.g. History, Models, Providers). Communicates what data is missing and provides a primary action to initiate the workflow.

---

## 6. Form Components
- **FormField Association:** Utilizes React 18 `useId()` to generate deterministic, collision-free HTML IDs.
  - `label` references the input via `htmlFor`.
  - Input is connected to helper text and errors via `aria-describedby="{id}-err {id}-desc"`.
  - When an error exists, the input receives `aria-invalid="true"`, and the error message renders with `role="alert"`.
- **SearchField:** Automatically renders a clear button when content is present. The clear button is typed `type="button"` to prevent accidental form submission and preserves input focus upon clearing.

---

## 7. Overlay Components
- **Modal vs. Popover:** Modals (`Dialog`, `ConfirmDialog`) render full viewport backdrops, trap focus within their container, and prevent background interaction. Popovers (`Popover`) anchor to their trigger without blocking background interaction.
- **Select vs. DropdownMenu:**
  - `Select` allows the user to choose a value from a discrete set of options.
  - `DropdownMenu` triggers discrete actions (e.g. "Export", "Purge Cache", "Copy ID").
- **Focus Restoration:** Every overlay records `document.activeElement` before opening and restores focus to the trigger element when closed.

---

## 8. Navigation Components
- **Tabs:** Adheres to the WAI-ARIA Tabs design pattern. The tab list acts as a single composite widget where tabs are navigated via `ArrowLeft` / `ArrowRight` and activated via `Enter` or `Space`. Only the currently selected tab panel is mounted in the tab sequence (`tabIndex={0}`).

---

## 9. Interaction Patterns
- **Hover Transitions:** Interactive components use `var(--nr-transition-fast)` (150ms) for background and border transitions.
- **Click-Outside:** Overlays listen for `mousedown` events on `document` and dismiss safely if the target is outside both the floating element and trigger.
- **Escape Key:** Standardized across all overlays (`Dialog`, `ConfirmDialog`, `DropdownMenu`, `Popover`, `Tooltip`). Pressing `Escape` closes the topmost active overlay without affecting the application shell.

---

## 10. Accessibility Rules (WCAG 2.1 AA)
1. **Mandatory Accessible Names:** Icon-only buttons (`IconButton`) require an explicit string for `aria-label`.
2. **Color Independence:** Status is never conveyed through color alone; every `Badge`, `Alert`, and `StatusIndicator` includes accessible text or icon pairings.
3. **Contrast:** Text colors adhere to a minimum 4.5:1 contrast ratio against their respective surface backgrounds (`var(--nr-bg-surface)` and `var(--nr-bg-surface-elevated)`).

---

## 11. Keyboard Rules & Matrix

| Component | Enter | Space | Escape | Arrow Keys | Tab |
|---|---|---|---|---|---|
| **Button** | Activate | Activate | — | — | Focus next/prev |
| **IconButton** | Activate | Activate | — | — | Focus next/prev |
| **Input / Search** | Submit form / Default | Space char | Clear search (if non-empty) | Cursor move | Focus next/prev |
| **Dialog / Modal** | Primary action | Primary action | Close modal | In-content move | Cycle inside modal (Focus Trap) |
| **DropdownMenu** | Open / Execute item | Open / Execute item | Close menu | Navigate items (ArrowUp / ArrowDown) | Close menu & focus next |
| **Tabs** | Select tab | Select tab | — | Navigate tabs (ArrowLeft / ArrowRight) | Move focus to tab panel |
| **Select** | Select option | Open / Select | Close dropdown | Navigate options | Focus next/prev |
| **Tooltip** | — | — | Dismiss tooltip | — | Show on focus / Hide on blur |

---

## 12. Loading Rules
1. **Dimension Preservation:** Buttons maintain their computed height and padding when transitioning to `isLoading=true`.
2. **Spinner Usage:** Spinners indicate inline indeterminate operations.
3. **Skeleton Usage:** Skeletons represent content layout shapes during initial loading; static immediate data must never show artificial skeleton flashes.
4. **Accessible Busy State:** Buttons and inputs render `aria-busy="true"` during asynchronous operations.

---

## 13. Error Rules
- Components do not swallow errors or show generic alerts.
- Error messages are styled with high-contrast error tokens (`var(--nr-status-error)`).
- Destructive operations require explicit confirmation via `ConfirmDialog`.

---

## 14. Disabled vs. Read-Only Rules
- **Disabled (`disabled`):** Element is muted (opacity 0.5), cursor is `not-allowed`, removed from keyboard tab order, and non-interactive.
- **Read-Only (`readOnly`):** Element remains focusable and selectable for copying text, but input modification is prevented.

---

## 15. Responsive Rules
- Text inputs, buttons, and form fields use fluid widths (`width: 100%`) constrained by their parent layout containers.
- Dialogs define a `maxWidth` (default 500px) and a `maxHeight: calc(100vh - 4rem)` with scrollable content bodies to prevent window overflow.

---

## 16. Naming Rules
- Components follow standard PascalCase domain naming (`Button`, `FormField`, `ConfirmDialog`, `DropdownMenu`).
- Arbitrary marketing prefixes (`MagicButton`, `UltraModal`) are strictly prohibited.
- Props follow standard React conventions (`disabled`, `isLoading`, `value`, `defaultValue`, `onConfirm`, `onCancel`).

---

## 17. API Design Rules
- Strongly typed TypeScript interfaces with sensible default values.
- Ref forwarding (`React.forwardRef`) implemented on input primitives, buttons, and scroll containers.
- Children support both direct JSX elements and typed render props where appropriate.

---

## 18. Forbidden Patterns
- ❌ Do NOT use browser `alert()`, `confirm()`, or `prompt()` anywhere in the application.
- ❌ Do NOT store API keys, tokens, or plaintext secrets in shared UI components.
- ❌ Do NOT import remote fonts, scripts, or CDN stylesheets.
- ❌ Do NOT create feature-specific components inside `src/components/`.

---

## 19. Testing
The component layer is verified via:
1. **Unit Test Suite:** `src/components/__tests__/components.test.ts` (12 assertions covering Toast queues, FormField ID chaining, DropdownMenu keyboard traversal, and Alert accessibility roles).
2. **Interactive Showcase:** Embedded within the Dashboard Diagnostics Disclosure, allowing live interactive testing of all dialogs, alerts, tabs, and inputs.
3. **Static Analysis:** TypeScript strict type checking (`tsc --noEmit`).

---

## 20. Current Components Status

```text
PRIMITIVES:
- Button:               IMPLEMENTED
- IconButton:           IMPLEMENTED
- Input:                IMPLEMENTED
- Textarea:             IMPLEMENTED
- Select:               IMPLEMENTED
- Badge:                IMPLEMENTED
- Card:                 IMPLEMENTED
- Divider:              IMPLEMENTED
- Spinner:              IMPLEMENTED
- Skeleton:             IMPLEMENTED
- Tooltip:              IMPLEMENTED
- StatusIndicator:      IMPLEMENTED

COMPOUND & FEEDBACK:
- FormField:            IMPLEMENTED
- SearchField:          IMPLEMENTED
- Dialog:               IMPLEMENTED
- ConfirmDialog:        IMPLEMENTED
- DropdownMenu:         IMPLEMENTED
- Popover:              IMPLEMENTED
- Tabs:                 IMPLEMENTED
- Alert:                IMPLEMENTED
- Toast / Container:    IMPLEMENTED
- EmptyState:           IMPLEMENTED
- SectionHeader:        IMPLEMENTED
- ScrollContainer:      IMPLEMENTED

FEATURE COMPONENTS:
- ChatMessage:          DEFERRED (Step 22)
- ProviderCard:         DEFERRED (Step 17)
- ModelCard:            DEFERRED (Step 11)
- TelemetryChart:       DEFERRED (Step 26)
```

