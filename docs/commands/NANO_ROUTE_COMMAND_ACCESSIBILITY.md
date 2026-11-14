# Nano Route — Command Palette Accessibility (a11y) & UX Conformance
**Step 65: WCAG 2.1 AA & Section 508 Conformance**

## 1. WAI-ARIA Modal & Combobox Design Pattern

The Command Palette adheres to the official W3C WAI-ARIA Combobox and Dialog pattern for desktop assistive technologies.

```html
<div role="dialog" aria-modal="true" aria-label="Global Command Palette">
  <div role="search">
    <input 
      role="combobox"
      aria-autocomplete="list"
      aria-expanded="true"
      aria-controls="command-palette-results"
      aria-activedescendant="command-item-nav.chat"
      ...
    />
  </div>
  <div id="command-palette-results" role="listbox" aria-label="Command search results">
    <div id="command-item-nav.chat" role="option" aria-selected="true">
      ...
    </div>
  </div>
</div>
```

---

## 2. Keyboard & Focus Management

- **Automatic Focus Trapping**: When opened, focus immediately snaps to the search input (`autoFocus`). Focus is trapped within the dialog container until dismissed.
- **Restoration of Pre-Launch Focus**: When closed via `Escape` or selection, focus returns cleanly to the previously active element (e.g. the trigger button or main content container).
- **Virtual Cursor via `aria-activedescendant`**: When the user presses `ArrowDown` or `ArrowUp`, the input retains native text cursor focus while updating `aria-activedescendant` to announce the highlighted option to screen readers.
- **Automatic Scrolling (`scrollIntoView`)**: The active option automatically scrolls into visible viewport bounds during keyboard traversal.

---

## 3. Visual & Cognitive Ergonomics

- **Contrast Ratios**: Exceeds WCAG 2.1 AA 4.5:1 ratio for all text elements in dark and light themes. Active items use distinct highlight backgrounds (`#3b82f6` with `#ffffff` text).
- **Category Chips**: Clear visual and accessible filters allowing users with motor or cognitive difficulties to narrow choices without typing extensive search phrases.
- **Empty States**: Clear, encouraging messaging when zero results match, with recommendations to broaden keywords or switch category filters.

