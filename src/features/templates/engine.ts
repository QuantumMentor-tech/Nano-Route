/**
 * Nano Route — Prompt Templates & Request Presets Engine
 * File: src/features/templates/engine.ts
 *
 * Implements Step 77:
 * - Persistent CRUD for prompt templates and request presets
 * - Built-in high-utility starter templates
 * - Deterministic filtering, search, and favorite toggling
 * - Data portability export and import with Step 71 conflict strategies
 * - Zero credential or secret storage in templates
 */

import type {
  PromptTemplate,
  RequestPreset,
  CreatePromptTemplateInput,
  UpdatePromptTemplateInput,
  CreateRequestPresetInput,
  UpdateRequestPresetInput,
  TemplateExportPackage,
  TemplateConflictStrategy,
  TemplateImportResult,
} from "./types.ts";
import { validateTemplate } from "./parser.ts";

// ============================================================================
// Built-in Starter Templates
// ============================================================================

export const BUILTIN_PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: "tpl_builtin_code_review",
    name: "Comprehensive Code Review",
    description: "Analyze code for correctness, edge cases, potential bugs, and performance improvements.",
    content: `Please perform a detailed code review of the following {{language}} code:\n\n\`\`\`{{language}}\n{{code}}\n\`\`\`\n\nFocus on:\n1. Functional correctness and edge-case handling\n2. Memory, latency, or concurrency bottlenecks\n3. Security vulnerabilities (input injection, bounds checking)\n4. Adherence to idiomatic conventions`,
    category: "Coding",
    tags: ["code", "review", "refactor", "security"],
    isFavorite: true,
    createdAt: 1_725_000_000_000,
    updatedAt: 1_725_000_000_000,
    schemaVersion: 1,
  },
  {
    id: "tpl_builtin_technical_summary",
    name: "Technical Executive Summary",
    description: "Summarize a complex technical topic or document for an executive or engineering audience.",
    content: `Provide a concise, high-impact executive summary of the following material:\n\nTopic / Content:\n{{content}}\n\nTarget Audience:\n{{audience}}\n\nKey Constraints:\n- Maximum 3-4 bullet points for key findings\n- Highlight architectural implications\n- Explicitly call out any risks or dependencies`,
    category: "Analysis",
    tags: ["summary", "executive", "technical", "brief"],
    isFavorite: true,
    createdAt: 1_725_000_000_000,
    updatedAt: 1_725_000_000_000,
    schemaVersion: 1,
  },
  {
    id: "tpl_builtin_bug_report",
    name: "Detailed Bug Report Generator",
    description: "Structure a reproducible, actionable software bug report from raw observations.",
    content: `Generate a structured, reproducible bug report based on these observations:\n\nFeature / Component: {{component}}\nObserved Behavior: {{observed_behavior}}\nExpected Behavior: {{expected_behavior}}\nEnvironment / OS: {{environment}}\n\nPlease format with:\n- Summary\n- Steps to Reproduce\n- Root Cause Hypothesis\n- Suggested Fix or Workaround`,
    category: "Productivity",
    tags: ["bug", "qa", "testing", "report"],
    isFavorite: false,
    createdAt: 1_725_000_000_000,
    updatedAt: 1_725_000_000_000,
    schemaVersion: 1,
  },
  {
    id: "tpl_builtin_translation",
    name: "Precision Technical Translation",
    description: "Translate technical text while preserving code blocks, identifiers, and domain terms.",
    content: `Translate the following text into {{target_language}}:\n\n{{text}}\n\nGuidelines:\n- Preserve all code blocks, Markdown formatting, and technical acronyms unchanged.\n- Maintain formal, precise documentation tone.\n- Do not translate variable names or API identifiers.`,
    category: "Writing",
    tags: ["translation", "language", "docs"],
    isFavorite: false,
    createdAt: 1_725_000_000_000,
    updatedAt: 1_725_000_000_000,
    schemaVersion: 1,
  },
];

export const BUILTIN_REQUEST_PRESETS: RequestPreset[] = [
  {
    id: "preset_builtin_deep_review",
    name: "Deep Code Review (Claude 3.5 Sonnet)",
    description: "Pairs Code Review template with Claude 3.5 Sonnet for intricate multi-file architectural analysis.",
    templateId: "tpl_builtin_code_review",
    preferredProvider: "anthropic",
    preferredModel: "claude-3-5-sonnet-20241022",
    temperature: 0.2,
    maxTokens: 4096,
    isFavorite: true,
    createdAt: 1_725_000_000_000,
    updatedAt: 1_725_000_000_000,
    schemaVersion: 1,
  },
];

// In-memory stores (persisted to SQLite / IPC in production)
const templateStore = new Map<string, PromptTemplate>();
const presetStore = new Map<string, RequestPreset>();

/**
 * Initializes the default templates in store if empty.
 */
function initializeStoreIfEmpty(): void {
  if (templateStore.size === 0) {
    for (const t of BUILTIN_PROMPT_TEMPLATES) {
      templateStore.set(t.id, { ...t });
    }
  }
  if (presetStore.size === 0) {
    for (const p of BUILTIN_REQUEST_PRESETS) {
      presetStore.set(p.id, { ...p });
    }
  }
}

/**
 * Resets the in-memory engine state to default built-ins (used in automated tests).
 */
export function resetTemplatesEngineState(): void {
  templateStore.clear();
  presetStore.clear();
  initializeStoreIfEmpty();
}

// Initial setup
initializeStoreIfEmpty();

// ============================================================================
// Template CRUD Operations
// ============================================================================

export interface ListTemplatesFilter {
  category?: string;
  search?: string;
  favoriteOnly?: boolean;
}

/**
 * Lists templates matching optional category, search, and favorite filters.
 */
export async function listPromptTemplates(
  filter?: ListTemplatesFilter
): Promise<PromptTemplate[]> {
  initializeStoreIfEmpty();
  let list = Array.from(templateStore.values());

  if (filter?.category && filter.category !== "All") {
    const cleanCat = filter.category.toLowerCase();
    list = list.filter((t) => t.category.toLowerCase() === cleanCat);
  }

  if (filter?.favoriteOnly) {
    list = list.filter((t) => t.isFavorite);
  }

  if (filter?.search) {
    const q = filter.search.toLowerCase().trim();
    list = list.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  }

  // Sort: favorites first, then newest updated first
  return list.sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) {
      return a.isFavorite ? -1 : 1;
    }
    return b.updatedAt - a.updatedAt;
  });
}

/**
 * Retrieves a single template by ID.
 */
export async function getPromptTemplate(
  id: string
): Promise<PromptTemplate | null> {
  initializeStoreIfEmpty();
  const found = templateStore.get(id);
  return found ? { ...found } : null;
}

/**
 * Saves a new prompt template after strict validation.
 */
export async function savePromptTemplate(
  input: CreatePromptTemplateInput
): Promise<PromptTemplate> {
  initializeStoreIfEmpty();
  const validation = validateTemplate({
    name: input.name,
    content: input.content,
    category: input.category,
  });

  if (!validation.valid) {
    throw new Error(`Template validation failed: ${validation.errors.join("; ")}`);
  }

  const now = Date.now();
  const id = `tpl_${now}_${Math.random().toString(36).substring(2, 8)}`;

  const template: PromptTemplate = {
    id,
    name: input.name.trim(),
    description: (input.description || "").trim(),
    content: input.content,
    category: (input.category || "General").trim(),
    tags: Array.isArray(input.tags) ? input.tags.map((t) => t.trim()).filter(Boolean) : [],
    isFavorite: !!input.isFavorite,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  };

  templateStore.set(id, template);
  return { ...template };
}

/**
 * Updates an existing prompt template.
 */
export async function updatePromptTemplate(
  id: string,
  input: UpdatePromptTemplateInput
): Promise<PromptTemplate> {
  initializeStoreIfEmpty();
  const existing = templateStore.get(id);
  if (!existing) {
    throw new Error(`Template not found with ID: ${id}`);
  }

  const updatedName = input.name !== undefined ? input.name : existing.name;
  const updatedContent = input.content !== undefined ? input.content : existing.content;

  const validation = validateTemplate({
    name: updatedName,
    content: updatedContent,
  });

  if (!validation.valid) {
    throw new Error(`Template validation failed: ${validation.errors.join("; ")}`);
  }

  const now = Date.now();
  const updated: PromptTemplate = {
    ...existing,
    name: updatedName.trim(),
    description: input.description !== undefined ? input.description.trim() : existing.description,
    content: updatedContent,
    category: input.category !== undefined ? input.category.trim() : existing.category,
    tags: input.tags !== undefined ? input.tags.map((t) => t.trim()).filter(Boolean) : existing.tags,
    isFavorite: input.isFavorite !== undefined ? input.isFavorite : existing.isFavorite,
    updatedAt: now,
  };

  templateStore.set(id, updated);
  return { ...updated };
}

/**
 * Deletes a prompt template by ID.
 */
export async function deletePromptTemplate(id: string): Promise<boolean> {
  initializeStoreIfEmpty();
  const deleted = templateStore.delete(id);

  // Clear templateId reference on any linked presets
  for (const preset of presetStore.values()) {
    if (preset.templateId === id) {
      preset.templateId = null;
      preset.updatedAt = Date.now();
    }
  }

  return deleted;
}

/**
 * Duplicates an existing template with a "(Copy)" suffix.
 */
export async function duplicatePromptTemplate(id: string): Promise<PromptTemplate> {
  initializeStoreIfEmpty();
  const existing = templateStore.get(id);
  if (!existing) {
    throw new Error(`Template not found with ID: ${id}`);
  }

  return savePromptTemplate({
    name: `${existing.name} (Copy)`,
    description: existing.description,
    content: existing.content,
    category: existing.category,
    tags: [...existing.tags],
    isFavorite: false,
  });
}

/**
 * Toggles the favorite status of a prompt template.
 */
export async function toggleFavoritePromptTemplate(
  id: string
): Promise<PromptTemplate> {
  initializeStoreIfEmpty();
  const existing = templateStore.get(id);
  if (!existing) {
    throw new Error(`Template not found with ID: ${id}`);
  }

  return updatePromptTemplate(id, { isFavorite: !existing.isFavorite });
}

// ============================================================================
// Request Presets CRUD Operations
// ============================================================================

export interface ListPresetsFilter {
  search?: string;
  favoriteOnly?: boolean;
}

/**
 * Lists request presets matching optional search and favorite filters.
 */
export async function listRequestPresets(
  filter?: ListPresetsFilter
): Promise<RequestPreset[]> {
  initializeStoreIfEmpty();
  let list = Array.from(presetStore.values());

  if (filter?.favoriteOnly) {
    list = list.filter((p) => p.isFavorite);
  }

  if (filter?.search) {
    const q = filter.search.toLowerCase().trim();
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.preferredProvider && p.preferredProvider.toLowerCase().includes(q))
    );
  }

  return list.sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Retrieves a single request preset by ID.
 */
export async function getRequestPreset(id: string): Promise<RequestPreset | null> {
  initializeStoreIfEmpty();
  const found = presetStore.get(id);
  return found ? { ...found } : null;
}

/**
 * Saves a new request preset.
 */
export async function saveRequestPreset(
  input: CreateRequestPresetInput
): Promise<RequestPreset> {
  initializeStoreIfEmpty();
  const name = (input.name || "").trim();
  if (name.length === 0) {
    throw new Error("Preset name cannot be empty.");
  }

  const now = Date.now();
  const id = `preset_${now}_${Math.random().toString(36).substring(2, 8)}`;

  const preset: RequestPreset = {
    id,
    name,
    description: (input.description || "").trim(),
    templateId: input.templateId || null,
    preferredProvider: input.preferredProvider || null,
    preferredModel: input.preferredModel || null,
    temperature: input.temperature ?? null,
    maxTokens: input.maxTokens ?? null,
    isFavorite: !!input.isFavorite,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  };

  presetStore.set(id, preset);
  return { ...preset };
}

/**
 * Updates an existing request preset.
 */
export async function updateRequestPreset(
  id: string,
  input: UpdateRequestPresetInput
): Promise<RequestPreset> {
  initializeStoreIfEmpty();
  const existing = presetStore.get(id);
  if (!existing) {
    throw new Error(`Preset not found with ID: ${id}`);
  }

  const updated: RequestPreset = {
    ...existing,
    name: input.name !== undefined ? input.name.trim() : existing.name,
    description: input.description !== undefined ? input.description.trim() : existing.description,
    templateId: input.templateId !== undefined ? input.templateId : existing.templateId,
    preferredProvider: input.preferredProvider !== undefined ? input.preferredProvider : existing.preferredProvider,
    preferredModel: input.preferredModel !== undefined ? input.preferredModel : existing.preferredModel,
    temperature: input.temperature !== undefined ? input.temperature : existing.temperature,
    maxTokens: input.maxTokens !== undefined ? input.maxTokens : existing.maxTokens,
    isFavorite: input.isFavorite !== undefined ? input.isFavorite : existing.isFavorite,
    updatedAt: Date.now(),
  };

  presetStore.set(id, updated);
  return { ...updated };
}

/**
 * Deletes a request preset by ID.
 */
export async function deleteRequestPreset(id: string): Promise<boolean> {
  initializeStoreIfEmpty();
  return presetStore.delete(id);
}

// ============================================================================
// Data Portability (Export & Import)
// ============================================================================

/**
 * Generates an export package containing all local templates and request presets.
 * Invariant: ZERO secrets or credentials are ever included!
 */
export async function exportTemplatesPackage(): Promise<TemplateExportPackage> {
  initializeStoreIfEmpty();
  return {
    format: "nano-route-templates-v1",
    version: "1.0.0",
    exportedAtMs: Date.now(),
    templates: Array.from(templateStore.values()).map((t) => ({ ...t })),
    presets: Array.from(presetStore.values()).map((p) => ({ ...p })),
  };
}

/**
 * Imports templates and presets from an export package adhering to conflict strategy.
 */
export async function importTemplatesPackage(
  pkg: TemplateExportPackage,
  conflictStrategy: TemplateConflictStrategy = "KEEP_BOTH"
): Promise<TemplateImportResult> {
  initializeStoreIfEmpty();
  const errors: string[] = [];
  let importedTemplates = 0;
  let importedPresets = 0;
  let skipped = 0;

  if (pkg.format !== "nano-route-templates-v1" || !Array.isArray(pkg.templates)) {
    throw new Error("Invalid template package: unrecognized format or missing templates array.");
  }

  // 1. Import Templates
  for (const t of pkg.templates) {
    try {
      const validation = validateTemplate(t);
      if (!validation.valid) {
        errors.push(`Template '${t.name}': ${validation.errors.join("; ")}`);
        skipped++;
        continue;
      }

      const existing = templateStore.get(t.id);
      if (existing) {
        if (conflictStrategy === "SKIP") {
          skipped++;
          continue;
        }
        if (conflictStrategy === "OVERWRITE") {
          templateStore.set(t.id, {
            ...t,
            updatedAt: Date.now(),
          });
          importedTemplates++;
          continue;
        }
        // KEEP_BOTH: assign new ID
        const newId = `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        templateStore.set(newId, {
          ...t,
          id: newId,
          name: `${t.name} (Imported)`,
          updatedAt: Date.now(),
        });
        importedTemplates++;
      } else {
        templateStore.set(t.id, { ...t });
        importedTemplates++;
      }
    } catch (err: unknown) {
      errors.push(`Error importing template: ${err instanceof Error ? err.message : String(err)}`);
      skipped++;
    }
  }

  // 2. Import Presets
  if (Array.isArray(pkg.presets)) {
    for (const p of pkg.presets) {
      try {
        if (!p.name || p.name.trim().length === 0) {
          skipped++;
          continue;
        }

        const existing = presetStore.get(p.id);
        if (existing) {
          if (conflictStrategy === "SKIP") {
            skipped++;
            continue;
          }
          if (conflictStrategy === "OVERWRITE") {
            presetStore.set(p.id, { ...p, updatedAt: Date.now() });
            importedPresets++;
            continue;
          }
          const newId = `preset_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
          presetStore.set(newId, {
            ...p,
            id: newId,
            name: `${p.name} (Imported)`,
            updatedAt: Date.now(),
          });
          importedPresets++;
        } else {
          presetStore.set(p.id, { ...p });
          importedPresets++;
        }
      } catch (err: unknown) {
        errors.push(`Error importing preset: ${err instanceof Error ? err.message : String(err)}`);
        skipped++;
      }
    }
  }

  return {
    importedTemplates,
    importedPresets,
    skipped,
    errors,
  };
}

/**
 * Resets the in-memory store back to initial default starter state (primarily for test isolation).
 */
export function resetTemplateStore(): void {
  templateStore.clear();
  presetStore.clear();
  initializeStoreIfEmpty();
}
