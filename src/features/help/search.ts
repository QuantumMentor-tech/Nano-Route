/**
 * Nano Route — Local Help Search Engine
 * File: src/features/help/search.ts
 *
 * Deterministic, fast, offline lexical search across help articles.
 * Zero external calls, zero remote indexing, zero AI-hallucinated results.
 */

import { HELP_ARTICLES } from "./content.ts";
import type { HelpArticle, SearchMatch } from "./types.ts";

/**
 * Normalizes input string for case-insensitive, whitespace-trimmed token matching.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/**
 * Searches local knowledge base using deterministic lexical relevance scoring.
 *
 * Scoring factors:
 * 1. Exact title match (+100)
 * 2. Title token match (+20 per token)
 * 3. Keyword exact match (+15 per keyword)
 * 4. Summary token match (+8 per token)
 * 5. Body text match (+3 per token)
 */
export function searchHelpArticles(query: string): SearchMatch[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const queryLower = trimmed.toLowerCase();
  const queryTokens = tokenize(trimmed);
  if (queryTokens.length === 0) {
    return [];
  }

  const matches: SearchMatch[] = [];

  for (const article of HELP_ARTICLES) {
    let score = 0;
    const matchedFields: Array<"title" | "keyword" | "summary" | "body"> = [];

    const titleLower = article.title.toLowerCase();
    const summaryLower = article.summary.toLowerCase();
    const bodyText = article.content.join(" ").toLowerCase();

    // 1. Exact title match
    if (titleLower === queryLower) {
      score += 100;
      matchedFields.push("title");
    } else if (titleLower.includes(queryLower)) {
      score += 40;
      matchedFields.push("title");
    }

    // 2. Title token matches
    for (const token of queryTokens) {
      if (titleLower.includes(token)) {
        score += 20;
        if (!matchedFields.includes("title")) matchedFields.push("title");
      }
    }

    // 3. Keyword matches
    for (const kw of article.keywords) {
      const kwLower = kw.toLowerCase();
      if (kwLower === queryLower || kwLower.includes(queryLower)) {
        score += 25;
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

    // 4. Summary token matches
    for (const token of queryTokens) {
      if (summaryLower.includes(token)) {
        score += 8;
        if (!matchedFields.includes("summary")) matchedFields.push("summary");
      }
    }

    // 5. Body text token matches
    for (const token of queryTokens) {
      if (bodyText.includes(token)) {
        score += 3;
        if (!matchedFields.includes("body")) matchedFields.push("body");
      }
    }

    if (score > 0) {
      matches.push({
        article,
        score,
        matchedFields,
      });
    }
  }

  // Sort descending by score, tie-break alphabetically by title
  return matches.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.article.title.localeCompare(b.article.title);
  });
}

/**
 * Retrieves an article by its unique ID.
 */
export function getHelpArticleById(id: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.id === id);
}

/**
 * Retrieves all articles belonging to a specific category.
 */
export function getArticlesByCategory(categoryId: string): HelpArticle[] {
  return HELP_ARTICLES.filter((a) => a.categoryId === categoryId);
}

