# Nano Route — Composer Drafts User Guide & Help Center
**Step 78 — Authoritative Help Reference**

## Overview
Nano Route automatically safeguards your unfinished messages with continuous, local-first draft persistence.

## Key Behaviors
1. **Autosave**: As you type in the Chat Studio Composer, your changes are saved locally after a brief typing pause (500ms).
2. **Draft Status**: A small badge next to the character counter shows the current draft status:
   - `Saved`: All changes are saved safely to disk.
   - `Saving...`: Persisting your latest edits.
   - `Unsaved changes`: Fresh edits awaiting debounce.
   - `Draft recovered`: An unsent message from a previous session or restart was safely restored.
3. **Undo / Redo**:
   - Press `Ctrl+Z` to undo your last edit in the active composer.
   - Press `Ctrl+Y` or `Ctrl+Shift+Z` to redo.
4. **Discarding a Draft**:
   - To discard unfinished work, click the `Discard` link next to the draft status or clear the text manually.
5. **Session Isolation**:
   - Drafts are stored individually per conversation session. Switching between sessions preserves each conversation's draft cleanly.

