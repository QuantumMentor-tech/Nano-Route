# Nano Route — Step 78 Pre-Implementation Audit & Baseline
**Composer Draft Persistence, Autosave, Undo/Redo, Recovery & Safe Composition Continuity**

## 1. Current State Assessment
- **Composer Component** (`src/features/chat/components/Composer.tsx`):
  - Controlled text state `text` initialized from `initialValue`.
  - Max length constraint (default: 16,000 characters).
  - Validation error handling for character limits.
  - Autosizing dynamic textarea height (min: 44px, max: 160px).
  - Enter / Shift+Enter handling and Escape for streaming cancellation.
  - Action buttons: Stop Generation (when submitting) / Send Prompt (when ready).
  - Toolbar integration with `FileText` "Templates" modal trigger from Step 77.
  - Footer bar displays character counts and `contextIndicator` (Step 76 Context Preflight).
- **Session Architecture** (`src/features/chat/useChatStudio.ts` & `src/features/chat/components/ChatStudio.tsx`):
  - `activeSessionId` manages the currently selected conversation.
  - `composerSeed` string passes prompt templates or suggestions into Composer.
  - Active messages evaluated dynamically via `evaluateContextPreflight(...)`.
  - Clearing prompt happens upon successful prompt submission (`setComposerSeed("")` + `setText("")`).
- **Absence in Current Baseline**:
  - If a user types an intricate prompt and switches sessions, the draft text in memory was either retained globally or lost depending on lifecycle.
  - If the application restarts or crashes, unsent work is lost.
  - No visual save status indicator (`Saved`, `Saving...`, `Unsaved changes`, `Recovered`).
  - No explicit "Clear Draft" button or undo/redo stack beyond basic browser textarea defaults.

## 2. Target Architecture (Step 78)
1. **Durable Local-First Storage**:
   - SQLite migration `008_composer_drafts.sql` supporting `session_id`, `content`, `revision`, `created_at`, `updated_at`, `template_id`, `preset_id`, `is_recovered`.
   - In-memory store + IPC bridge for synchronous responsiveness and durable persistence.
2. **Debounced Autosave Pipeline**:
   - Changes trigger dirty state -> debounced save (default: 500ms).
   - Non-blocking persistence.
   - Status indicators: `SAVED`, `SAVING`, `DIRTY`, `RECOVERED`, `ERROR`.
3. **Multi-Level Undo/Redo**:
   - Clean, bounded in-memory undo/redo history (up to 50 operations) with standard shortcuts (`Ctrl+Z`, `Ctrl+Y`, `Ctrl+Shift+Z`).
4. **Crash Recovery & Session Continuity**:
   - Checks on session load or mount for existing recoverable drafts.
   - Displays unobtrusive recovery indicator with optional Discard or Restore.
5. **Strict Non-Goals & Invariants**:
   - No auto-submission.
   - No SLM inference during typing or autosaving.
   - No cloud synchronization or remote draft exfiltration.
   - No provider network calls.
   - Step 76 preflight and Step 75 budget controls remain strictly downstream upon submission.

