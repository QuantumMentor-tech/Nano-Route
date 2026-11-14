# NANO ROUTE — HELP ACCESSIBILITY AUDIT
## Step 63 Accessibility Standards, WCAG 2.1 AA Compliance & Keyboard Workflows

---

## 1. KEYBOARD NAVIGATION MODEL

The Help Center is 100% operable via standard keyboard controls without mouse interaction:

- **`Tab` / `Shift+Tab`**: Moves focus logically through the search input, category cards, article links, action buttons, and back controls.
- **`Enter` / `Space`**: Activates the selected category, opens the targeted help article, or executes an in-app action link.
- **Focus Restoration**: Navigating back from an article returns focus cleanly to the category explorer or search bar.
- **Visible Focus Rings**: All interactive cards and buttons display high-contrast focus rings (`rgba(167, 139, 250, 0.6)`).

---

## 2. SCREEN READER SUPPORT

- **Semantic Landmarks**: Utilizes `<main id="main-content">`, `<header>`, `<article>`, `<section>`, and `<footer>` elements.
- **Headings Hierarchy**: Strict heading levels from `<h1>` (Page title) to `<h2>` (Sections, Article title) and `<h3>` (Troubleshooting headings).
- **Non-Color Status Cues**: Troubleshooting steps and category cards pair color styling with clear iconography and explicit textual labels.
- **Live Search Status**: Results count announcements provide immediate screen reader feedback as search queries are entered.

---

## 3. HIGH-DPI & RESPONSIVE SCALING

The Help Center is built to accommodate desktop scaling up to 200% without horizontal overflow or text clipping:
- Uses flexible grid columns with `minmax(280px, 1fr)`.
- Responsive padding and fluid typography.
- Retains readable contrast across light text on dark obsidian backgrounds (minimum contrast ratio > 7:1).

