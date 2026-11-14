/**
 * Nano Route — Prompt Template Variable Parser & Validator
 * File: src/features/templates/parser.ts
 *
 * Implements Step 77:
 * - Deterministic, non-executable template placeholder extraction
 * - Strict identifier syntax: `{{variable_name}}` matching `^[a-zA-Z0-9_-]{1,64}$`
 * - Safe variable substitution and unresolved placeholder detection
 * - Malformed placeholder rejection and security sanitization
 */

import type { TemplateVariable, TemplateValidationResult } from "./types.ts";

// Standard placeholder regex: {{identifier}}
const PLACEHOLDER_REGEX = /\{\{([a-zA-Z0-9_-]{1,64})\}\}/g;

// Unclosed or malformed placeholder pattern
const MALFORMED_OPEN_REGEX = /\{\{(?![a-zA-Z0-9_-]{1,64}\}\})/g;

const MAX_NAME_LENGTH = 100;
const MAX_CONTENT_LENGTH = 32_768; // ~8.6k tokens bound

/**
 * Extracts all unique placeholder variables from template text.
 */
export function extractTemplateVariables(content: string): TemplateVariable[] {
  if (!content) return [];

  const variables: TemplateVariable[] = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;
  PLACEHOLDER_REGEX.lastIndex = 0;

  while ((match = PLACEHOLDER_REGEX.exec(content)) !== null) {
    const rawPlaceholder = match[0];
    const name = match[1];
    const cleanKey = name.toLowerCase();

    if (!seen.has(cleanKey)) {
      seen.add(cleanKey);
      variables.push({
        name,
        rawPlaceholder,
        required: true,
      });
    }
  }

  return variables;
}

/**
 * Safely resolves placeholders in template content with provided variable values.
 * Returns the resolved prompt and a list of any variables that remain unresolved.
 */
export function resolveTemplateContent(
  content: string,
  variables: Record<string, string>
): { resolved: string; unresolved: string[] } {
  if (!content) {
    return { resolved: "", unresolved: [] };
  }

  const normalizedVars: Record<string, string> = {};
  for (const [key, val] of Object.entries(variables)) {
    normalizedVars[key.toLowerCase()] = val;
  }

  const unresolvedSet = new Set<string>();

  const resolved = content.replace(PLACEHOLDER_REGEX, (match, varName: string) => {
    const cleanKey = varName.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(normalizedVars, cleanKey)) {
      const val = normalizedVars[cleanKey];
      return val !== undefined && val !== null ? val : match;
    }
    unresolvedSet.add(varName);
    return match;
  });

  return {
    resolved,
    unresolved: Array.from(unresolvedSet),
  };
}

/**
 * Validates template name, content length, variable syntax, and security boundaries.
 */
export function validateTemplate(template: {
  name: string;
  content: string;
  category?: string;
}): TemplateValidationResult {
  const errors: string[] = [];

  const name = (template.name || "").trim();
  if (name.length === 0) {
    errors.push("Template name cannot be empty.");
  } else if (name.length > MAX_NAME_LENGTH) {
    errors.push(`Template name exceeds maximum allowed length of ${MAX_NAME_LENGTH} characters.`);
  }

  const content = template.content || "";
  if (content.trim().length === 0) {
    errors.push("Template content cannot be empty.");
  } else if (content.length > MAX_CONTENT_LENGTH) {
    errors.push(
      `Template content exceeds maximum allowed length of ${MAX_CONTENT_LENGTH.toLocaleString()} characters.`
    );
  }

  // Security check: reject executable script tags
  if (/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(content)) {
    errors.push("Template content must not contain executable script tags.");
  }

  // Check for malformed placeholders (e.g. unclosed '{{', empty '{{}}', or invalid chars)
  MALFORMED_OPEN_REGEX.lastIndex = 0;
  if (MALFORMED_OPEN_REGEX.test(content)) {
    errors.push(
      "Template contains malformed variable placeholders. Use format: {{variable_name}} with alphanumeric characters, dashes, or underscores."
    );
  }

  const detectedVariables = extractTemplateVariables(content);

  return {
    valid: errors.length === 0,
    errors,
    detectedVariables,
  };
}

