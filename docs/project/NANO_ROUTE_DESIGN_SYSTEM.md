# Nano Route Design System
**Document Version:** 1.0.0  
**Step:** 6 of 50 — Nano Route Design System & Theme Foundation  
**Date:** November 2026  
**Status:** APPROVED DESIGN SYSTEM SPECIFICATION  

---

## 1. Design Philosophy
Nano Route is a technical, local-first desktop AI orchestration workstation. Its visual language prioritizes:
- **Calm, High-Readability Dark Aesthetics:** Low eyestrain across long development and reasoning sessions. Deep Obsidian backgrounds (`#09090b`) with subtle elevation differences rather than harsh pure black or jarring white glare.
- **Intentional, Restrained Accentuation:** Color is used to signal status, active selection, and system state, rather than as ambient decoration. Purple (`#7c3aed`) is the primary brand action color; Blue (`#2563eb`) is the technical routing indicator.
- **System-First Determinism:** Zero remote fonts, zero CDN stylesheets, zero external image assets. The application looks and performs identically offline.
- **Strict Accessibility:** WCAG 2.1 AA compliant contrast ratios, high-visibility keyboard focus rings, reduced-motion overrides, and semantic ARIA labeling for all interactive primitives.

---

## 2. Brand Identity
The brand identity is anchored by the circular neon-tech icon node (`Nano Route Neon Tech Logo.png`):
- **Primary Brand Color:** Electric Violet / Royal Purple (`#7c3aed`) symbolizing intelligent neural dispatch and routing orchestration.
- **Secondary Brand Color:** Precision Blue (`#2563eb`) representing low-latency native execution, system telemetry, and network connections.
- **Primary Surfaces:** Deep Obsidian (`#09090b`), Elevated Panel (`#111318`), and Surface Hover (`#1f232e`).
- **Foreground Contrast:** Crisp White (`#ffffff`) for primary headlines/labels and Zinc (`#a1a1aa`) for body/metadata.

---

## 3. Color Tokens

| Semantic Token | Hex / Value | Role & Usage | Status |
|---|---|---|---|
| `--nr-bg-app` | `#09090b` | Canonical root application background (Deep Obsidian) | **IMPLEMENTED** |
| `--nr-bg-subtle` | `#0b0d13` | Alternate root or sub-region background | **IMPLEMENTED** |
| `--nr-bg-surface` | `#111318` | Standard card, panel, and sidebar surface | **IMPLEMENTED** |
| `--nr-bg-surface-elevated` | `#181b22` | Elevated cards, input fields, popover backgrounds | **IMPLEMENTED** |
| `--nr-bg-surface-overlay` | `#1c1f28` | Modal dialogs, tooltips, flyout menus | **IMPLEMENTED** |
| `--nr-bg-surface-hover` | `#1f232e` | Interactive item hover state | **IMPLEMENTED** |
| `--nr-bg-surface-active` | `#242936` | Selected navigation item, pressed button state | **IMPLEMENTED** |
| `--nr-text-primary` | `#ffffff` | Primary headings, active labels, high-contrast text | **IMPLEMENTED** |
| `--nr-text-secondary` | `#a1a1aa` | Standard body text, descriptions, inactive labels | **IMPLEMENTED** |
| `--nr-text-muted` | `#71717a` | Captions, timestamps, subtle metadata | **IMPLEMENTED** |
| `--nr-text-disabled` | `#52525b` | Disabled controls, unavailable options | **IMPLEMENTED** |
| `--nr-accent-purple` | `#7c3aed` | Primary brand accent, primary CTA buttons, active pills | **IMPLEMENTED** |
| `--nr-accent-purple-hover`| `#6d28d9` | Hover state for primary buttons | **IMPLEMENTED** |
| `--nr-accent-purple-subtle`| `rgba(124, 58, 237, 0.12)` | Subtle badge and selected card backgrounds | **IMPLEMENTED** |
| `--nr-accent-blue` | `#2563eb` | Secondary accent, technical badges, routing indicators | **IMPLEMENTED** |
| `--nr-accent-blue-hover` | `#1d4ed8` | Secondary action hover state | **IMPLEMENTED** |
| `--nr-accent-blue-subtle` | `rgba(37, 99, 235, 0.12)` | Technical data highlights and informational badges | **IMPLEMENTED** |
| `--nr-status-success` | `#10b981` | Online status, successful fallback, verified key | **IMPLEMENTED** |
| `--nr-status-warning` | `#f59e0b` | Rate limit warning, high latency alert | **IMPLEMENTED** |
| `--nr-status-error` | `#ef4444` | Provider failure, network error, destructive actions | **IMPLEMENTED** |
| `--nr-status-info` | `#38bdf8` | General system information, notice badges | **IMPLEMENTED** |

---

## 4. Surface Hierarchy

```text
Level 0: Application Viewport Background (--nr-bg-app: #09090b)
   │
   ├── Level 1: Primary Chrome & Sidebar (--nr-bg-surface: #111318)
   │      │
   │      └── Level 2: Content Cards & Panels (--nr-bg-surface-elevated: #181b22)
   │             │
   │             └── Level 3: Overlay Dialogs & Menus (--nr-bg-surface-overlay: #1c1f28)
   │                    │
   │                    └── Level 4: Tooltips & Status Badges (Floating: #1c1f28 + border)
```

Surfaces are distinguished through subtle luminance deltas and crisp 1px borders (`--nr-border-default`: `#27272a`), avoiding heavy drop shadows or distracting neon glows.

---

## 5. Typography
All fonts are native Windows system fonts. No network requests are made for typography.

- **Primary Sans Stack (`--nr-font-sans`):** `"Segoe UI Variable", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, Roboto, sans-serif`
- **Monospace Stack (`--nr-font-mono`):** `"Cascadia Code", "Consolas", ui-monospace, Menlo, Monaco, monospace`

### Typography Scale
- **Display:** `2rem` (32px) / Line Height: `1.25` / Weight: `700`
- **Page Title (`.nr-title-page`):** `1.5rem` (24px) / Line Height: `1.3` / Weight: `700`
- **Section Title (`.nr-title-section`):** `1.25rem` (20px) / Line Height: `1.35` / Weight: `600`
- **Subsection Title (`.nr-title-subsection`):** `1.125rem` (18px) / Line Height: `1.4` / Weight: `600`
- **Body Text (`.nr-body`):** `0.9375rem` (15px) / Line Height: `1.5` / Weight: `400`
- **Body Small (`.nr-body-small`):** `0.875rem` (14px) / Line Height: `1.5` / Weight: `400`
- **Label (`.nr-label`):** `0.8125rem` (13px) / Line Height: `1.4` / Weight: `500`
- **Caption (`.nr-caption`):** `0.75rem` (12px) / Line Height: `1.4` / Weight: `400`
- **Code (`.nr-code`):** `0.875rem` (14px) / Line Height: `1.5` / Font: Monospace

---

## 6. Iconography
- **System:** `lucide-react` (SVG, stroke width: `1.75px`–`2px`).
- **Default Color:** `#ffffff` for active/primary controls; `#a1a1aa` for inactive navigation items.
- **Size Scale:**
  - `14px` (Small / Inline metadata)
  - `16px` (Standard controls / Button icons)
  - `18px` (Navigation items)
  - `24px` (Section headers / Primary page badges)
- **Accessibility:** All icon-only buttons require an explicit, descriptive `aria-label`.

---

## 7. Spacing
Consistent 4px-based spacing scale:
- `--nr-space-1`: `0.25rem` (4px)
- `--nr-space-2`: `0.5rem` (8px)
- `--nr-space-3`: `0.75rem` (12px)
- `--nr-space-4`: `1rem` (16px)
- `--nr-space-5`: `1.25rem` (20px)
- `--nr-space-6`: `1.5rem` (24px)
- `--nr-space-8`: `2rem` (32px)
- `--nr-space-10`: `2.5rem` (40px)
- `--nr-space-12`: `3rem` (48px)

---

## 8. Borders
- **Default Border (`--nr-border-default`):** `1px solid #27272a`
- **Subtle Divider (`--nr-border-subtle`):** `1px solid #1f222b`
- **Strong Border (`--nr-border-strong`):** `1px solid #3f3f46`
- **Active Focus Border:** `1px solid #7c3aed`

---

## 9. Radius
- **Small (`--nr-radius-sm`):** `4px` (Tooltips, badges, code tags)
- **Medium (`--nr-radius-md`):** `8px` (Buttons, inputs, cards, selects)
- **Large (`--nr-radius-lg`):** `12px` (Panels, modal dialogs)
- **Extra Large (`--nr-radius-xl`):** `16px` (Outer window layouts)
- **Pill / Circular (`--nr-radius-full`):** `9999px` (Status badges, avatars)

---

## 10. Shadows
- `--nr-shadow-sm`: `0 1px 2px 0 rgba(0, 0, 0, 0.4)`
- `--nr-shadow-md`: `0 4px 6px -1px rgba(0, 0, 0, 0.5)`
- `--nr-shadow-lg`: `0 10px 15px -3px rgba(0, 0, 0, 0.6)`
- `--nr-shadow-dialog`: `0 20px 25px -5px rgba(0, 0, 0, 0.7)`

---

## 11. Buttons
Supported variants in `src/components/ui/Button.tsx`:
1. **Primary (`variant="primary"`):** Solid Purple (`#7c3aed`), White text. Used for main action on each view (Send, Route, Save).
2. **Secondary (`variant="secondary"`):** Surface elevated background (`#181b22`) + 1px border. Used for supporting actions.
3. **Outline (`variant="outline"`):** Transparent background + border.
4. **Ghost (`variant="ghost"`):** Transparent background with hover luminance. Used for compact actions.
5. **Destructive (`variant="destructive"`):** Error red (`#ef4444`). Used for delete session, clear cache.
- **States:** Default, Hover, Active, Focus-Visible, Disabled, Loading (`isLoading` with spinner).

---

## 12. Inputs
Supported in `src/components/ui/Input.tsx` and `Textarea.tsx`:
- Dark elevated background (`#181b22`), subtle border (`#27272a`), crisp white input text.
- Focus-visible ring in brand purple (`var(--nr-focus-ring)`).
- Prefix and suffix icon slots (e.g. search magnifying glass, key lock).
- Validation error state (`aria-invalid="true"`) with red border and descriptive error text.

---

## 13. Badges
Supported in `src/components/ui/Badge.tsx`:
- Compact pill-shaped metadata tags with uppercase monospace font.
- Variants: `default`, `purple`, `blue`, `success`, `warning`, `error`, `info`.
- Used for model tags (e.g., `CLAUDE 3.5 SONNET`, `LLAMA 3.2 3B`), latency metrics, and connection states.

---

## 14. Cards and Panels
Supported in `src/components/ui/Card.tsx`:
- Variants: `default` (standard surface), `elevated` (subtle shadow), `interactive` (hover transform), `selected` (purple border ring).
- Consistent padding options (`none`, `sm`, `md`, `lg`).

---

## 15. Focus States
- Global `:focus-visible` rule in `src/styles/reset.css`:
  `box-shadow: 0 0 0 2px #09090b, 0 0 0 4px #7c3aed;`
- High-contrast 2px gap separation ensuring visibility against dark surfaces.
- Outlines are never suppressed without this active indicator.

---

## 16. Motion
- Micro-interactions use snappy cubic-bezier transitions (`150ms`–`200ms`).
- Keyframes defined for loading spinners (`nr-spin`) and skeleton shimmers (`nr-skeleton-shimmer`).

---

## 17. Accessibility
- All text meets WCAG AA contrast against its respective surface (minimum 4.5:1 for body text, 3:1 for large headlines).
- Full keyboard navigation supported across buttons, inputs, selects, and dialog triggers.
- Form inputs include properly associated `<label htmlFor="...">` and `aria-describedby` error bindings.
- Non-interactive icons are hidden via `aria-hidden="true"`.

---

## 18. Scrollbars
- Desktop-tailored thin dark scrollbars (6px width) styled in `src/styles/reset.css`.
- Thumb: `#27272a` with hover `#3f3f46`.
- Completely unobtrusive; track is transparent to preserve dark surface uniformity.

---

## 19. Responsive Behavior
- **Primary Desktop:** Minimum window width `960px`, default `1200px` x `800px`.
- **Narrow Window (Graceful Compression):** Grids collapse to single columns; secondary metadata wraps.
- **Zero Horizontal Window Overflow:** Body `overflow-x: hidden` with scrolling confined to dedicated panel containers.

---

## 20. Component Rules
- Reusable components live in `src/components/ui/` and export typed props.
- Components consume CSS custom properties (`var(--nr-*)`) or Tailwind utilities.
- Components must NEVER make direct network calls, call Tauri IPC, or contain AI routing logic.

---

## 21. Forbidden Patterns
- ❌ Hardcoded random hex colors (e.g. `bg-[#134981]`).
- ❌ External CDN font or stylesheet imports (Google Fonts, unpkg, etc.).
- ❌ Emoji as primary interface icons.
- ❌ Giant glowing neon borders or distracting cyber-HUD aesthetics.
- ❌ Full-screen red error modals for ordinary API rate limits.
- ❌ Overly thick outlines or border-radius values exceeding 16px.

---

## 22. Current Deviations
- **None:** The design token system is now canonical and fully established in `src/styles/`.

---

## 23. Future Extension Rules
- When new features require additional colors, tokens must be registered in `src/styles/tokens.css` first.
- If light theme support is ever required post-v1.0, tokens will be remapped under `[data-theme="light"]` without modifying component markup.

---
*End of Design System Specification. Source of Truth for Step 6.*

