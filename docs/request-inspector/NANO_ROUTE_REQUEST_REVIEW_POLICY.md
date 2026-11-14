# Nano Route — Request Review Policy

## 1. Composition Transparency
The inspector explicitly distinguishes:
- **Direct Prompt:** What the user typed directly into the input area.
- **Template Contribution:** Injected template text and variable expansions.
- **Context Collection:** Curated reference packs inserted via Step 83.
- **Attachments:** Prepared local file contexts added via Step 79.
- **System Delimiters:** Canonical boundary markers separating reference materials.

## 2. Reversible Adjustments
The inspector permits reversible adjustments:
- Removing an unneeded or oversized attachment directly from the Attachments tab.
- Refreshing the inspection snapshot to reflect edits made in the composer.
- Returning to the composer to adjust text or prompts without losing draft state.

## 3. Submissibility Gate
Submission is blocked if:
- The full assembled prompt is empty.
- Total required tokens exceed model context window limits (`Step 76 BLOCKING`).
- Local monthly budget limit is reached under `HARD_LIMIT` mode (`Step 75 BLOCKING`).
- Attachments failed preparation or exceeded size ceilings.
- Selected model does not support input modalities (e.g. images to text-only SLMs).

