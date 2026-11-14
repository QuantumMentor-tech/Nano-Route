# Nano Route — Prompt Templates & Request Presets Schema Specification
**Step 77 — Authoritative Schema Reference**

## 1. Relational Database Migration (SQLite)
Migration: `src-tauri/src/storage/migrations/007_prompt_templates.sql`

```sql
CREATE TABLE IF NOT EXISTS prompt_templates (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'general',
    content TEXT NOT NULL,
    system_instructions TEXT,
    tags TEXT, -- JSON array of string tags
    is_builtin INTEGER NOT NULL DEFAULT 0,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prompt_templates_category ON prompt_templates(category);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_is_favorite ON prompt_templates(is_favorite);

CREATE TABLE IF NOT EXISTS request_presets (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    template_id TEXT,
    preferred_provider TEXT,
    preferred_model TEXT,
    temperature REAL,
    max_tokens INTEGER,
    system_instructions TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(template_id) REFERENCES prompt_templates(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_request_presets_template_id ON request_presets(template_id);
```

## 2. TypeScript Data Structures
Defined in `src/features/templates/types.ts`:

- `PromptTemplate`: Unique ID, name, description, category, content, systemInstructions, tags, isBuiltin, isFavorite, createdAt, updatedAt.
- `RequestPreset`: Unique ID, name, description, templateId, preferredProvider, preferredModel, temperature, maxTokens, systemInstructions, createdAt, updatedAt.
- `TemplateVariable`: key, name, description, defaultValue, isRequired.
- `TemplateValidationResult`: isValid, errors (`field`, `message`, `code`), warnings (`field`, `message`, `code`).
- `TemplateExportPackage`: formatVersion ("1.0.0"), exportedAt, templates array, presets array.

