# NANO ROUTE — HELP CONTENT MODEL
## Step 63 Knowledge Base Taxonomy & Metadata Specification

---

## 1. DATA MODEL DEFINITIONS

Every help article in Nano Route conforms to the strict `HelpArticle` interface:

```typescript
export interface HelpArticle {
  id: string;                     // Unique kebab-case slug (e.g. "what-is-nano-route")
  categoryId: HelpCategoryId;     // Foreign key to one of 12 standard categories
  title: string;                  // User-facing canonical title
  summary: string;                // Concise summary sentence
  keywords: string[];             // Lexical tokens for search index matching
  content: string[];              // Structured paragraphs of narrative documentation
  whatItDoes?: string;            // Functional summary
  howItWorks?: string;            // Technical architecture description
  whatYouNeed?: string;           // Preconditions and prerequisites
  troubleshooting?: TroubleshootingStep[]; // Structured problem runbook
  relatedArticles?: string[];     // Array of related article IDs
  relatedActions?: HelpActionTarget[];    // Deep links to Settings or Diagnostics
  version: string;                // Content schema version (e.g. "1.0.0")
  lastReviewedVersion: string;    // Product application version (e.g. "0.1.0")
}
```

---

## 2. STANDARD CATEGORY TAXONOMY

The knowledge base organizes articles across 12 functional domains:

1. **`getting-started`**: Product orientation, first-run onboarding, workspace basics.
2. **`routing`**: Intelligent routing, preference profiles, scoring, manual overrides.
3. **`local-slm`**: On-device Small Language Model, ONNX Runtime, DirectML, synthetic self-tests.
4. **`providers`**: Cloud provider registration, Windows DPAPI key vault, rate limits.
5. **`chat`**: Chat Studio, SSE token streaming, cooperative cancellation.
6. **`analytics`**: Operational telemetry, token tracking, cost savings baselines.
7. **`settings`**: Configuration tabs, routing profiles, data wipe controls.
8. **`diagnostics`**: Diagnostics Center, Quick Check, Full Check, support report export.
9. **`updates`**: Update lifecycle, SHA-256 cryptographic verification, rollbacks.
10. **`recovery`**: Disaster recovery, backup creation, manifest verification, restore safeguards.
11. **`privacy-security`**: Local data storage boundaries, network disclosures.
12. **`accessibility`**: Keyboard shortcuts, screen reader semantics, high-DPI scaling.

