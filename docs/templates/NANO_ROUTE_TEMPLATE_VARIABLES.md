# Nano Route — Prompt Template Variables & Placeholders Specification
**Step 77 — Authoritative Variable Parsing Reference**

## 1. Placeholder Syntax Specification
Nano Route template placeholders use double curly braces with strict identifier constraints:

$$\text{Syntax: } \{\{\text{identifier}\}\}$$

Where `identifier` satisfies the regular expression:
```
^[a-zA-Z0-9_-]{1,64}$
```

- Allowed characters: ASCII uppercase, lowercase, numeric digits, hyphens (`-`), underscores (`_`).
- Length: 1 to 64 characters.
- Non-case-sensitive lookup: `{{code}}` matches variable value key `"code"` or `"CODE"`.

## 2. Parsing & Extraction Invariants
1. **Extraction Order**: Placeholders are extracted in the exact order they first appear in the template body.
2. **Deduplication**: Repeated occurrences of the same identifier (e.g. `{{code}}` appearing twice) are deduplicated into a single required variable input.
3. **Unresolved Tokens**: If the user submits values without populating all variables, unresolved tokens remain as literal `{{variable_name}}` strings in the text. No undefined or null text is ever emitted.
4. **Passive Substitution**: Variable substitution performs string-literal replacement only. Evaluated code, string interpolation (`${...}`), macros, or shell evaluation are strictly prohibited.

