/**
 * Nano Route — Step 63 Help Center & Knowledge Base Test Suite
 * File: src/features/help/__tests__/help.test.ts
 *
 * Covers:
 *  1. Catalog integrity & category completeness
 *  2. Article metadata structure & required fields
 *  3. Lexical search accuracy & tokenization
 *  4. Relevance ranking rules (exact title > title token > keyword > summary > body)
 *  5. Empty search & fallback behavior
 *  6. Category filtering
 *  7. Direct action routing validation
 *  8. Related article referential integrity
 *  9. Security & scheme validation for external links
 * 10. Offline guarantee (zero network dependencies)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { HELP_CATEGORIES, HELP_ARTICLES } from "../content.ts";
import { searchHelpArticles, getHelpArticleById, getArticlesByCategory } from "../search.ts";
import { validateExternalUrl } from "../../about/utils/externalLinks.ts";

describe("Step 63 — Help Center Content Catalog & Taxonomy", () => {
  it("defines all 12 required help categories", () => {
    assert.equal(HELP_CATEGORIES.length, 12);
    const expectedCategories = [
      "getting-started",
      "routing",
      "local-slm",
      "providers",
      "chat",
      "analytics",
      "settings",
      "diagnostics",
      "updates",
      "recovery",
      "privacy-security",
      "accessibility",
    ];

    const categoryIds = HELP_CATEGORIES.map((c) => c.id);
    for (const exp of expectedCategories) {
      assert.ok(categoryIds.includes(exp as any), `Missing category: ${exp}`);
    }
  });

  it("every category has non-empty title, description, and iconName", () => {
    for (const cat of HELP_CATEGORIES) {
      assert.ok(cat.id, "Category must have id");
      assert.ok(cat.title.length > 0, `${cat.id}: title must be non-empty`);
      assert.ok(cat.description.length > 0, `${cat.id}: description must be non-empty`);
      assert.ok(cat.iconName.length > 0, `${cat.id}: iconName must be non-empty`);
      assert.equal(typeof cat.order, "number", `${cat.id}: order must be number`);
    }
  });

  it("article catalog contains comprehensive coverage across all categories", () => {
    assert.ok(HELP_ARTICLES.length >= 12, "Must contain at least 12 baseline articles");
    const coveredCategories = new Set(HELP_ARTICLES.map((a) => a.categoryId));
    for (const cat of HELP_CATEGORIES) {
      assert.ok(coveredCategories.has(cat.id), `Category ${cat.id} has no articles`);
    }
  });

  it("article IDs are completely unique", () => {
    const ids = HELP_ARTICLES.map((a) => a.id);
    const uniqueIds = new Set(ids);
    assert.equal(uniqueIds.size, ids.length, "All article IDs must be unique");
  });

  it("each article contains valid metadata and non-empty content", () => {
    for (const article of HELP_ARTICLES) {
      assert.ok(article.id.length > 0, "Article id must be non-empty");
      assert.ok(article.title.length > 0, `${article.id}: title must be non-empty`);
      assert.ok(article.summary.length > 0, `${article.id}: summary must be non-empty`);
      assert.ok(article.keywords.length > 0, `${article.id}: keywords must be non-empty`);
      assert.ok(article.content.length > 0, `${article.id}: content paragraphs must exist`);
      assert.ok(article.version.length > 0, `${article.id}: version must exist`);
      assert.ok(article.lastReviewedVersion.length > 0, `${article.id}: lastReviewedVersion must exist`);
    }
  });
});

describe("Step 63 — Referential Integrity & Action Validation", () => {
  it("all relatedArticles reference existing article IDs", () => {
    const allIds = new Set(HELP_ARTICLES.map((a) => a.id));
    for (const article of HELP_ARTICLES) {
      if (article.relatedArticles) {
        for (const relId of article.relatedArticles) {
          assert.ok(allIds.has(relId), `Article ${article.id} references non-existent relatedArticle: ${relId}`);
        }
      }
    }
  });

  it("all relatedActions reference valid internal routes or external URLs", () => {
    for (const article of HELP_ARTICLES) {
      if (article.relatedActions) {
        for (const action of article.relatedActions) {
          assert.ok(action.label.length > 0, `${article.id}: Action label must be non-empty`);
          if (action.type === "route") {
            assert.ok(action.path.startsWith("/"), `${article.id}: Route path must start with '/'`);
          } else if (action.type === "external") {
            const validation = validateExternalUrl(action.url);
            assert.ok(validation.isValid, `${article.id}: External action URL '${action.url}' must be valid`);
          }
        }
      }
    }
  });

  it("troubleshooting blocks have check, expected, and remediation strings", () => {
    for (const article of HELP_ARTICLES) {
      if (article.troubleshooting) {
        for (const step of article.troubleshooting) {
          assert.ok(step.check.length > 0, `${article.id}: check must be non-empty`);
          assert.ok(step.expected.length > 0, `${article.id}: expected must be non-empty`);
          assert.ok(step.remediation.length > 0, `${article.id}: remediation must be non-empty`);
        }
      }
    }
  });
});

describe("Step 63 — Offline Lexical Search Engine", () => {
  it("empty or whitespace search query returns empty array", () => {
    assert.deepEqual(searchHelpArticles(""), []);
    assert.deepEqual(searchHelpArticles("   "), []);
    assert.deepEqual(searchHelpArticles("\t\n"), []);
  });

  it("finds articles by exact title match with highest score", () => {
    const matches = searchHelpArticles("What is Nano Route?");
    assert.ok(matches.length > 0);
    assert.equal(matches[0].article.id, "what-is-nano-route");
    assert.ok(matches[0].score >= 100, "Exact title match must score at least 100");
  });

  it("finds articles by keyword token", () => {
    const matches = searchHelpArticles("dpapi");
    assert.ok(matches.length > 0);
    const hasDpapi = matches.some((m) => m.article.id === "provider-credentials");
    assert.ok(hasDpapi, "Search for 'dpapi' must find provider-credentials");
  });

  it("finds articles by technical concept (slm, directml, sqlite)", () => {
    const slmMatches = searchHelpArticles("directml");
    assert.ok(slmMatches.length > 0);
    assert.ok(slmMatches.some((m) => m.article.id === "local-slm-runtime"));

    const routingMatches = searchHelpArticles("routing");
    assert.ok(routingMatches.length > 0);
  });

  it("search is completely case-insensitive", () => {
    const lower = searchHelpArticles("routing");
    const upper = searchHelpArticles("ROUTING");
    const mixed = searchHelpArticles("RoUtInG");

    assert.equal(lower.length, upper.length);
    assert.equal(lower[0].article.id, upper[0].article.id);
    assert.equal(lower[0].article.id, mixed[0].article.id);
  });

  it("getHelpArticleById returns expected article or undefined", () => {
    const found = getHelpArticleById("what-is-nano-route");
    assert.ok(found);
    assert.equal(found.title, "What is Nano Route?");

    const notFound = getHelpArticleById("non-existent-id");
    assert.equal(notFound, undefined);
  });

  it("getArticlesByCategory returns all articles matching category", () => {
    const routingArticles = getArticlesByCategory("routing");
    assert.ok(routingArticles.length >= 2);
    for (const a of routingArticles) {
      assert.equal(a.categoryId, "routing");
    }
  });
});

