/**
 * Nano Route — In-App Help Center & Knowledge Base Types
 * File: src/features/help/types.ts
 *
 * Authoritative types for local-first documentation, contextual help,
 * search indexing, troubleshooting flows, and navigation bridges.
 */

export type HelpCategoryId =
  | "getting-started"
  | "routing"
  | "local-slm"
  | "providers"
  | "chat"
  | "analytics"
  | "settings"
  | "diagnostics"
  | "updates"
  | "recovery"
  | "privacy-security"
  | "accessibility";

export interface HelpCategoryDescriptor {
  id: HelpCategoryId;
  title: string;
  description: string;
  iconName: string;
  order: number;
}

export type HelpActionTarget =
  | { type: "route"; path: string; label: string }
  | { type: "diagnostic"; testId?: string; label: string }
  | { type: "external"; url: string; label: string };

export interface TroubleshootingStep {
  check: string;
  expected: string;
  remediation: string;
}

export interface HelpArticle {
  id: string;
  categoryId: HelpCategoryId;
  title: string;
  summary: string;
  keywords: string[];
  content: string[]; // Structured paragraphs/sections
  whatItDoes?: string;
  howItWorks?: string;
  whatYouNeed?: string;
  troubleshooting?: TroubleshootingStep[];
  relatedArticles?: string[]; // Array of article IDs
  relatedActions?: HelpActionTarget[];
  version: string;
  lastReviewedVersion: string;
}

export interface SearchMatch {
  article: HelpArticle;
  score: number;
  matchedFields: Array<"title" | "keyword" | "summary" | "body">;
}

