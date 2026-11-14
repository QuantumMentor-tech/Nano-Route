import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractTemplateVariables,
  resolveTemplateContent,
  validateTemplate,
} from "../parser.ts";
import {
  listPromptTemplates,
  getPromptTemplate,
  savePromptTemplate,
  updatePromptTemplate,
  deletePromptTemplate,
  duplicatePromptTemplate,
  toggleFavoritePromptTemplate,
  listRequestPresets,
  getRequestPreset,
  saveRequestPreset,
  deleteRequestPreset,
  exportTemplatesPackage,
  importTemplatesPackage,
  resetTemplateStore,
} from "../engine.ts";
import { evaluateContextPreflight } from "../../context/engine.ts";

describe("Step 77 — Prompt Templates & Request Presets Subsystem", () => {
  describe("Parser & Variable Extraction", () => {
    it("extracts unique variables in order of appearance", () => {
      const content = "Analyze the {{codebase}} against {{standard}}. Also check {{codebase}} formatting.";
      const vars = extractTemplateVariables(content);
      assert.equal(vars.length, 2);
      assert.equal(vars[0].name, "codebase");
      assert.equal(vars[0].rawPlaceholder, "{{codebase}}");
      assert.equal(vars[1].name, "standard");
      assert.equal(vars[1].rawPlaceholder, "{{standard}}");
    });

    it("resolves variable substitution correctly", () => {
      const template = "Translate the following {{source_lang}} text to {{target_lang}}: {{text}}";
      const values = {
        source_lang: "English",
        target_lang: "Rust",
        text: "Hello world",
      };
      const result = resolveTemplateContent(template, values);
      assert.equal(result.resolved, "Translate the following English text to Rust: Hello world");
      assert.equal(result.unresolved.length, 0);
    });

    it("leaves unfilled variables as placeholder tokens and reports them as unresolved", () => {
      const template = "Hello {{first_name}} {{last_name}}!";
      const values = { first_name: "Ada" };
      const result = resolveTemplateContent(template, values);
      assert.equal(result.resolved, "Hello Ada {{last_name}}!");
      assert.deepEqual(result.unresolved, ["last_name"]);
    });
  });

  describe("Template Validation", () => {
    it("passes valid template draft", () => {
      const valid = validateTemplate({
        name: "Code Review",
        content: "Please review: {{code}}",
        category: "coding",
      });
      assert.equal(valid.valid, true);
      assert.equal(valid.errors.length, 0);
      assert.equal(valid.detectedVariables.length, 1);
    });

    it("rejects empty name and oversized content", () => {
      const result = validateTemplate({
        name: "",
        content: "a".repeat(33000),
        category: "general",
      });
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("name")));
      assert.ok(result.errors.some((e) => e.includes("length")));
    });

    it("strictly rejects executable script tags", () => {
      const result = validateTemplate({
        name: "Malicious Template",
        content: "Hello <script>alert(1)</script> World",
        category: "general",
      });
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("script tags")));
    });

    it("flags malformed placeholder braces", () => {
      const result = validateTemplate({
        name: "Broken Braces",
        content: "Please check {{unclosed",
        category: "general",
      });
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes("malformed")));
    });
  });

  describe("Template Store CRUD Operations", () => {
    it("lists default starter templates", async () => {
      resetTemplateStore();
      const templates = await listPromptTemplates();
      assert.ok(templates.length >= 4);
      assert.ok(templates.some((t) => t.id === "tpl_builtin_code_review"));
    });

    it("creates, retrieves, duplicates, updates, and deletes a custom template", async () => {
      resetTemplateStore();
      const newTemplate = await savePromptTemplate({
        name: "Security Audit",
        description: "Audit smart contract for reentrancy",
        category: "coding",
        content: "Inspect this contract: {{contract_code}}",
        tags: ["security", "audit"],
      });

      assert.ok(newTemplate.id);
      const retrieved = await getPromptTemplate(newTemplate.id);
      assert.ok(retrieved);
      assert.equal(retrieved.name, "Security Audit");

      // Duplicate
      const duplicated = await duplicatePromptTemplate(newTemplate.id);
      assert.ok(duplicated);
      assert.equal(duplicated.name, "Security Audit (Copy)");

      // Update
      const updated = await updatePromptTemplate(newTemplate.id, { description: "Updated description" });
      assert.equal(updated.description, "Updated description");

      // Toggle favorite
      const favorited = await toggleFavoritePromptTemplate(newTemplate.id);
      assert.equal(favorited.isFavorite, true);

      // Delete
      const deleted = await deletePromptTemplate(newTemplate.id);
      assert.equal(deleted, true);
      assert.equal(await getPromptTemplate(newTemplate.id), null);
    });
  });

  describe("Request Preset Store CRUD Operations", () => {
    it("creates, retrieves, and deletes presets", async () => {
      resetTemplateStore();
      const preset = await saveRequestPreset({
        name: "Deep Reasoning Preset",
        description: "High temperature with reasoning provider",
        preferredProvider: "deepseek",
        preferredModel: "deepseek-reasoner",
        temperature: 0.7,
        maxTokens: 4096,
      });

      assert.ok(preset.id);
      assert.equal((await getRequestPreset(preset.id))?.name, "Deep Reasoning Preset");

      const presets = await listRequestPresets();
      assert.ok(presets.some((p) => p.id === preset.id));

      const deleted = await deleteRequestPreset(preset.id);
      assert.equal(deleted, true);
      assert.equal(await getRequestPreset(preset.id), null);
    });
  });

  describe("Export and Import with Conflict Resolution", () => {
    it("exports templates to a valid package", async () => {
      resetTemplateStore();
      const pkg = await exportTemplatesPackage();
      assert.equal(pkg.format, "nano-route-templates-v1");
      assert.equal(pkg.version, "1.0.0");
      assert.ok(pkg.templates.length >= 4);
      assert.ok(pkg.exportedAtMs > 0);
    });

    it("imports templates respecting SKIP conflict strategy", async () => {
      resetTemplateStore();
      const existing = await getPromptTemplate("tpl_builtin_code_review");
      assert.ok(existing);

      const pkg = {
        format: "nano-route-templates-v1" as const,
        version: "1.0.0",
        exportedAtMs: Date.now(),
        templates: [
          {
            ...existing,
            name: "Mutated Code Review",
          },
        ],
        presets: [],
      };

      const result = await importTemplatesPackage(pkg, "SKIP");
      assert.equal(result.skipped, 1);
      assert.equal(result.importedTemplates, 0);

      // Verify original name remained intact
      const after = await getPromptTemplate("tpl_builtin_code_review");
      assert.equal(after?.name, existing.name);
    });

    it("imports templates respecting OVERWRITE conflict strategy", async () => {
      resetTemplateStore();
      const existing = await getPromptTemplate("tpl_builtin_code_review");
      assert.ok(existing);

      const pkg = {
        format: "nano-route-templates-v1" as const,
        version: "1.0.0",
        exportedAtMs: Date.now(),
        templates: [
          {
            ...existing,
            name: "Overwritten Code Review",
          },
        ],
        presets: [],
      };

      const result = await importTemplatesPackage(pkg, "OVERWRITE");
      assert.equal(result.importedTemplates, 1);

      const after = await getPromptTemplate("tpl_builtin_code_review");
      assert.equal(after?.name, "Overwritten Code Review");
    });

    it("imports templates respecting KEEP_BOTH conflict strategy", async () => {
      resetTemplateStore();
      const existing = await getPromptTemplate("tpl_builtin_code_review");
      assert.ok(existing);

      const pkg = {
        format: "nano-route-templates-v1" as const,
        version: "1.0.0",
        exportedAtMs: Date.now(),
        templates: [
          {
            ...existing,
            name: "Imported Copy of Code Review",
          },
        ],
        presets: [],
      };

      const result = await importTemplatesPackage(pkg, "KEEP_BOTH");
      assert.equal(result.importedTemplates, 1);

      const all = await listPromptTemplates();
      assert.ok(all.some((t) => t.id === "tpl_builtin_code_review"));
      assert.ok(all.some((t) => t.id !== "tpl_builtin_code_review" && t.name.includes("Imported")));
    });
  });

  describe("Integration with Step 76 Context Preflight", () => {
    it("resolved template prompt evaluates cleanly through preflight", () => {
      const template = "Summarize the key architectural patterns in {{system_name}}: {{details}}";
      const { resolved } = resolveTemplateContent(template, {
        system_name: "Nano Route",
        details: "Tauri v2, Rust native core, DPAPI encryption, SQLite persistence.",
      });

      const preflight = evaluateContextPreflight({
        providerId: "deepseek",
        modelId: "deepseek-chat",
        prompt: resolved,
        history: [],
      });

      assert.equal(preflight.classification, "SAFE");
      assert.equal(preflight.allowed, true);
      assert.ok(preflight.estimatedInputTokens > 0);
    });
  });
});
