/**
 * Nano Route — Prompt Templates & Request Presets Types
 * File: src/features/templates/types.ts
 *
 * Implements Step 77:
 * - Authoritative prompt template model with bounded placeholders
 * - Request presets model associating templates with safe overrides
 * - Variable resolution schemas and validation contracts
 * - Data portability export/import schemas
 */

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  content: string;
  category: string;
  tags: string[];
  isFavorite: boolean;
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
}

export interface RequestPreset {
  id: string;
  name: string;
  description: string;
  templateId?: string | null;
  preferredProvider?: string | null;
  preferredModel?: string | null;
  temperature?: number | null;
  maxTokens?: number | null;
  isFavorite: boolean;
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
}

export interface TemplateVariable {
  name: string;
  rawPlaceholder: string; // e.g. "{{topic}}"
  defaultValue?: string;
  description?: string;
  required: boolean;
}

export interface TemplateVariableResolution {
  name: string;
  value: string;
}

export interface CreatePromptTemplateInput {
  name: string;
  description?: string;
  content: string;
  category?: string;
  tags?: string[];
  isFavorite?: boolean;
}

export interface UpdatePromptTemplateInput {
  name?: string;
  description?: string;
  content?: string;
  category?: string;
  tags?: string[];
  isFavorite?: boolean;
}

export interface CreateRequestPresetInput {
  name: string;
  description?: string;
  templateId?: string | null;
  preferredProvider?: string | null;
  preferredModel?: string | null;
  temperature?: number | null;
  maxTokens?: number | null;
  isFavorite?: boolean;
}

export interface UpdateRequestPresetInput {
  name?: string;
  description?: string;
  templateId?: string | null;
  preferredProvider?: string | null;
  preferredModel?: string | null;
  temperature?: number | null;
  maxTokens?: number | null;
  isFavorite?: boolean;
}

export interface TemplateValidationResult {
  valid: boolean;
  errors: string[];
  detectedVariables: TemplateVariable[];
}

export interface TemplateExportPackage {
  format: "nano-route-templates-v1";
  version: string;
  exportedAtMs: number;
  templates: PromptTemplate[];
  presets: RequestPreset[];
  checksum?: string;
}

export type TemplateConflictStrategy = "SKIP" | "OVERWRITE" | "KEEP_BOTH";

export interface TemplateImportResult {
  importedTemplates: number;
  importedPresets: number;
  skipped: number;
  errors: string[];
}

