# Nano Route — Attachment Lifecycle Specification
**Step 79 — Authoritative Lifecycle Reference**

## 1. State Transitions

```text
[User selects file]
       |
       v
   SELECTED
       |
       v
  VALIDATING (Size, extension, dangerous check)
    /        \
   v          v
READY      UNSUPPORTED / TOO_LARGE
   |          |
   |          +--> [User clicks Remove] -> REMOVED
   v
[User types prompt & clicks Send]
   |
   v
[Appended to Prompt -> Cleared from Composer]
```

## 2. Invariants
- **Independent Validation**: In multi-file selections, an invalid file does not block valid files from being prepared.
- **Immediate Discard**: Removing an attachment immediately frees in-memory buffers and prepared context strings.

