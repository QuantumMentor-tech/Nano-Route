/**
 * Nano Route — Command Palette Search & Ranking Engine
 * File: src/features/commands/search.ts
 *
 * Fast, local, deterministic search over registered commands.
 * Zero network dependencies, zero remote indexing, zero AI-hallucinated results.
 */

import { COMMAND_REGISTRY } from "./registry.ts";
import type { CommandDefinition, CommandMatch, CommandCategory } from "./types.ts";

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/**
 * Searches the command catalog using weighted deterministic lexical scoring.
 *
 * Ranking criteria:
 * 1. Exact title match (+100)
 * 2. Title prefix match (+50)
 * 3. Title token match (+25 per token)
 * 4. Keyword exact match (+30 per keyword)
 * 5. Keyword token match (+15 per token)
 * 6. Category match (+10)
 * 7. Description token match (+5 per token)
 */
export function searchCommands(
  query: string,
  categoryFilter?: CommandCategory
): CommandMatch[] {
  const trimmed = query.trim();
  const queryLower = trimmed.toLowerCase();
  const queryTokens = tokenize(trimmed);

  const pool = categoryFilter
    ? COMMAND_REGISTRY.filter((c) => c.category === categoryFilter)
    : COMMAND_REGISTRY;

  if (!trimmed) {
    // Return all available commands in default category order when query is empty
    return pool.map((command) => ({
      command,
      score: 1,
      matchedFields: [],
    }));
  }

  const matches: CommandMatch[] = [];

  for (const command of pool) {
    let score = 0;
    const matchedFields: Array<"title" | "keyword" | "description" | "category"> = [];

    const titleLower = command.title.toLowerCase();
    const descLower = command.description.toLowerCase();
    const catLower = command.category.toLowerCase();

    // 1. Exact title match
    if (titleLower === queryLower) {
      score += 100;
      matchedFields.push("title");
    } else if (titleLower.startsWith(queryLower)) {
      score += 50;
      matchedFields.push("title");
    } else if (titleLower.includes(queryLower)) {
      score += 30;
      matchedFields.push("title");
    }

    // 2. Title token matches
    for (const token of queryTokens) {
      if (titleLower.includes(token)) {
        score += 25;
        if (!matchedFields.includes("title")) matchedFields.push("title");
      }
    }

    // 3. Keyword matches
    for (const kw of command.keywords) {
      const kwLower = kw.toLowerCase();
      if (kwLower === queryLower) {
        score += 35;
        if (!matchedFields.includes("keyword")) matchedFields.push("keyword");
      } else if (kwLower.startsWith(queryLower)) {
        score += 20;
        if (!matchedFields.includes("keyword")) matchedFields.push("keyword");
      } else {
        for (const token of queryTokens) {
          if (kwLower.includes(token)) {
            score += 15;
            if (!matchedFields.includes("keyword")) matchedFields.push("keyword");
          }
        }
      }
    }

    // 4. Category match
    if (catLower === queryLower || catLower.startsWith(queryLower)) {
      score += 15;
      if (!matchedFields.includes("category")) matchedFields.push("category");
    }

    // 5. Description token matches
    for (const token of queryTokens) {
      if (descLower.includes(token)) {
        score += 5;
        if (!matchedFields.includes("description")) matchedFields.push("description");
      }
    }

    if (score > 0) {
      matches.push({
        command,
        score,
        matchedFields,
      });
    }
  }

  // Sort descending by score; tie-break alphabetically by title
  return matches.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.command.title.localeCompare(b.command.title);
  });
}

/**
 * Retrieves a command by its unique ID.
 */
export function getCommandById(id: string): CommandDefinition | undefined {
  return COMMAND_REGISTRY.find((c) => c.id === id);
}

