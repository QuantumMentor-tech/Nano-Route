# Nano Route — Context Collections Security Architecture

## 1. Input Sanitization & Bounds
- **Collection Name:** Stripped of leading/trailing whitespace, bounded to a maximum of 100 characters.
- **Description:** Bounded to 500 characters.
- **Items Per Collection:** Bounded to 50 items.
- **Collections Per Workspace:** Bounded to 100 collections.
- **Excerpt Text:** Bounded to 8,000 characters.

## 2. Injection Prevention
- All persistence logic utilizes parameterized SQLite statements.
- In UI rendering, collection names and excerpt text are treated as untrusted text and safely escaped.
- Markdown rendering adheres to Step 80's HTML sanitization policy.

## 3. Network Isolation
Viewing, browsing, creating, reordering, and deleting context collections triggers zero network activity. Provider network calls only occur if and when the user submits a prompt containing the collection context.

