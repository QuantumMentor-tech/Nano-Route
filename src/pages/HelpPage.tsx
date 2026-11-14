/**
 * Nano Route — In-App Help Center & Knowledge Base
 * File: src/pages/HelpPage.tsx
 *
 * Step 63: Local-first documentation browser with deterministic lexical search,
 * category navigation, structured troubleshooting workflows, and safe in-app
 * routing to Settings and Diagnostics.
 */

import React, { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  HelpCircle,
  Search,
  BookOpen,
  ArrowLeft,
  ChevronRight,
  Activity,
  Settings,
  ShieldCheck,
  Cpu,
  Server,
  MessageSquare,
  BarChart3,
  RefreshCw,
  ShieldAlert,
  Eye,
  GitFork,
  Compass,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

import {
  HELP_CATEGORIES,
  searchHelpArticles,
  getHelpArticleById,
  getArticlesByCategory,
} from "../features/help/index.ts";
import type { HelpCategoryId, HelpActionTarget } from "../features/help/index.ts";
import { openExternalLink } from "../features/about/utils/externalLinks.ts";

function getCategoryIcon(iconName: string, size = 18) {
  const props = { size, ariaHidden: "true", className: "flex-shrink-0" };
  switch (iconName) {
    case "Compass":
      return <Compass {...props} style={{ color: "#a78bfa" }} />;
    case "GitFork":
      return <GitFork {...props} style={{ color: "#60a5fa" }} />;
    case "Cpu":
      return <Cpu {...props} style={{ color: "#34d399" }} />;
    case "Server":
      return <Server {...props} style={{ color: "#facc15" }} />;
    case "MessageSquare":
      return <MessageSquare {...props} style={{ color: "#38bdf8" }} />;
    case "BarChart3":
      return <BarChart3 {...props} style={{ color: "#c084fc" }} />;
    case "Settings":
      return <Settings {...props} style={{ color: "#94a3b8" }} />;
    case "Activity":
      return <Activity {...props} style={{ color: "#f472b6" }} />;
    case "RefreshCw":
      return <RefreshCw {...props} style={{ color: "#4ade80" }} />;
    case "ShieldAlert":
      return <ShieldAlert {...props} style={{ color: "#fb923c" }} />;
    case "Lock":
      return <ShieldCheck {...props} style={{ color: "#818cf8" }} />;
    case "Eye":
      return <Eye {...props} style={{ color: "#2dd4bf" }} />;
    default:
      return <BookOpen {...props} style={{ color: "#94a3b8" }} />;
  }
}

export const HelpPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const articleIdParam = searchParams.get("article");
  const categoryIdParam = searchParams.get("category") as HelpCategoryId | null;
  const initialQuery = searchParams.get("q") || "";

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [activeArticleId, setActiveArticleId] = useState<string | null>(articleIdParam);
  const [activeCategoryId, setActiveCategoryId] = useState<HelpCategoryId | null>(categoryIdParam);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const articleContentRef = useRef<HTMLDivElement>(null);

  // Sync state with URL params
  useEffect(() => {
    if (articleIdParam) {
      setActiveArticleId(articleIdParam);
    } else {
      setActiveArticleId(null);
    }

    if (categoryIdParam) {
      setActiveCategoryId(categoryIdParam);
    }
  }, [articleIdParam, categoryIdParam]);

  // Focus management: when opening an article, scroll & focus it
  useEffect(() => {
    if (activeArticleId && articleContentRef.current) {
      articleContentRef.current.focus();
    }
  }, [activeArticleId]);

  // Compute search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchHelpArticles(searchQuery);
  }, [searchQuery]);

  // Current active article object
  const activeArticle = useMemo(() => {
    if (!activeArticleId) return null;
    return getHelpArticleById(activeArticleId) || null;
  }, [activeArticleId]);

  // Navigation handlers
  const handleSelectArticle = (articleId: string) => {
    setActiveArticleId(articleId);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("article", articleId);
      return next;
    });
  };

  const handleSelectCategory = (catId: HelpCategoryId) => {
    setActiveCategoryId(catId);
    setActiveArticleId(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("article");
      next.set("category", catId);
      return next;
    });
  };

  const handleBackToHome = () => {
    setActiveArticleId(null);
    setActiveCategoryId(null);
    setSearchQuery("");
    setSearchParams({});
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleActionClick = (action: HelpActionTarget) => {
    if (action.type === "route") {
      navigate(action.path);
    } else if (action.type === "diagnostic") {
      navigate("/diagnostics");
    } else if (action.type === "external") {
      openExternalLink(action.url);
    }
  };

  return (
    <main
      id="main-content"
      aria-labelledby="help-page-title"
      style={{
        maxWidth: "960px",
        margin: "0 auto",
        padding: "2rem 1.5rem 4rem",
        color: "#e2e8f0",
      }}
    >
      {/* ── Page Header ── */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
          <HelpCircle size={24} aria-hidden="true" style={{ color: "#a78bfa" }} />
          <h1
            id="help-page-title"
            style={{ margin: 0, fontSize: "24px", fontWeight: 700, color: "#f1f5f9" }}
          >
            Help & Documentation Center
          </h1>
        </div>
        <p style={{ margin: 0, fontSize: "14px", color: "#94a3b8" }}>
          Search guides, explore feature architecture, and follow step-by-step troubleshooting workflows.
          Documentation is local, offline, and privacy-preserving.
        </p>
      </div>

      {/* ── Search Bar ── */}
      <div style={{ marginBottom: "2rem" }}>
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
          }}
        >
          <Search
            size={18}
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "14px",
              color: "#64748b",
              pointerEvents: "none",
            }}
          />
          <input
            ref={searchInputRef}
            type="search"
            aria-label="Search help articles and troubleshooting guides"
            placeholder="Search help by keyword (e.g. 'routing', 'API key', 'SLM error', 'backup')..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 14px 12px 42px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "8px",
              color: "#f8fafc",
              fontSize: "14px",
              outline: "none",
            }}
            onFocus={(e) => (e.target.style.borderColor = "rgba(167,139,250,0.6)")}
            onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
          />
        </div>
      </div>

      {/* ── View: Search Results ── */}
      {searchQuery.trim().length > 0 && !activeArticle && (
        <section aria-label="Search results" style={{ marginBottom: "2.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#e2e8f0", margin: 0 }}>
              Search Results ({searchResults.length})
            </h2>
            <button
              onClick={() => setSearchQuery("")}
              style={{
                background: "none",
                border: "none",
                color: "#a78bfa",
                fontSize: "12px",
                cursor: "pointer",
                padding: "4px 8px",
              }}
            >
              Clear Search
            </button>
          </div>

          {searchResults.length === 0 ? (
            <div
              style={{
                padding: "2rem",
                textAlign: "center",
                background: "rgba(255,255,255,0.02)",
                border: "1px dashed rgba(255,255,255,0.08)",
                borderRadius: "8px",
                color: "#64748b",
              }}
            >
              <AlertTriangle size={32} aria-hidden="true" style={{ marginBottom: "12px", opacity: 0.5 }} />
              <p style={{ margin: "0 0 8px", fontSize: "14px", color: "#94a3b8" }}>
                No help articles found matching "{searchQuery}".
              </p>
              <p style={{ margin: "0 0 16px", fontSize: "12px" }}>
                Try searching for broader keywords like <strong>routing</strong>, <strong>provider</strong>, <strong>credentials</strong>, or <strong>SLM</strong>.
              </p>
              <button
                onClick={() => navigate("/diagnostics")}
                style={{
                  padding: "8px 16px",
                  background: "rgba(167,139,250,0.15)",
                  border: "1px solid rgba(167,139,250,0.3)",
                  borderRadius: "6px",
                  color: "#a78bfa",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Run Diagnostics Center →
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {searchResults.map(({ article, matchedFields }) => (
                <div
                  key={article.id}
                  onClick={() => handleSelectArticle(article.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelectArticle(article.id);
                    }
                  }}
                  style={{
                    padding: "14px 18px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "8px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 600, color: "#f1f5f9" }}>
                        {article.title}
                      </span>
                      {matchedFields.includes("keyword") && (
                        <span
                          style={{
                            fontSize: "10px",
                            padding: "1px 6px",
                            borderRadius: "4px",
                            background: "rgba(167,139,250,0.12)",
                            color: "#a78bfa",
                            border: "1px solid rgba(167,139,250,0.25)",
                          }}
                        >
                          keyword
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "12px", color: "#94a3b8" }}>{article.summary}</div>
                  </div>
                  <ChevronRight size={16} aria-hidden="true" style={{ color: "#64748b" }} />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── View: Single Article View ── */}
      {activeArticle && (
        <article
          ref={articleContentRef}
          tabIndex={-1}
          aria-labelledby="article-title"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "12px",
            padding: "24px 28px",
            outline: "none",
          }}
        >
          {/* Back button */}
          <button
            onClick={() => {
              setActiveArticleId(null);
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.delete("article");
                return next;
              });
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "none",
              border: "none",
              color: "#a78bfa",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
              padding: 0,
              marginBottom: "1.25rem",
            }}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Back to Articles
          </button>

          <header style={{ marginBottom: "1.5rem" }}>
            <h2 id="article-title" style={{ fontSize: "20px", fontWeight: 700, color: "#f8fafc", margin: "0 0 8px" }}>
              {activeArticle.title}
            </h2>
            <p style={{ fontSize: "14px", color: "#94a3b8", margin: 0, lineHeight: 1.5 }}>
              {activeArticle.summary}
            </p>
          </header>

          {/* Structured: What it does & How it works */}
          {(activeArticle.whatItDoes || activeArticle.howItWorks) && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: "12px",
                padding: "16px",
                background: "rgba(167,139,250,0.05)",
                border: "1px solid rgba(167,139,250,0.15)",
                borderRadius: "8px",
                marginBottom: "1.5rem",
              }}
            >
              {activeArticle.whatItDoes && (
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>
                    What it Does
                  </div>
                  <div style={{ fontSize: "13px", color: "#e2e8f0" }}>{activeArticle.whatItDoes}</div>
                </div>
              )}
              {activeArticle.howItWorks && (
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>
                    How it Works
                  </div>
                  <div style={{ fontSize: "13px", color: "#cbd5e1" }}>{activeArticle.howItWorks}</div>
                </div>
              )}
            </div>
          )}

          {/* Main content paragraphs */}
          <div style={{ fontSize: "14px", color: "#cbd5e1", lineHeight: 1.7, marginBottom: "2rem" }}>
            {activeArticle.content.map((paragraph, idx) => (
              <p key={idx} style={{ margin: "0 0 1rem" }}>
                {paragraph}
              </p>
            ))}
          </div>

          {/* Troubleshooting Section */}
          {activeArticle.troubleshooting && activeArticle.troubleshooting.length > 0 && (
            <section style={{ marginBottom: "2rem" }} aria-label="Troubleshooting steps">
              <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#fb923c", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                <AlertTriangle size={16} aria-hidden="true" />
                Troubleshooting & Safe Checks
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {activeArticle.troubleshooting.map((step, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "12px 16px",
                      background: "rgba(0,0,0,0.25)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: "6px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "4px" }}>
                      <CheckCircle2 size={14} aria-hidden="true" style={{ color: "#4ade80", marginTop: "3px", flexShrink: 0 }} />
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "#f1f5f9" }}>{step.check}</div>
                    </div>
                    <div style={{ paddingLeft: "22px", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>
                      <strong>Expected:</strong> {step.expected}
                    </div>
                    <div style={{ paddingLeft: "22px", fontSize: "12px", color: "#e2e8f0" }}>
                      <strong>Action:</strong> {step.remediation}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Related In-App Actions */}
          {activeArticle.relatedActions && activeArticle.relatedActions.length > 0 && (
            <section style={{ marginBottom: "1.5rem" }} aria-label="Related actions">
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>
                Direct Actions
              </div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {activeArticle.relatedActions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleActionClick(action)}
                    style={{
                      padding: "8px 16px",
                      background: "rgba(139,92,246,0.15)",
                      border: "1px solid rgba(139,92,246,0.35)",
                      borderRadius: "6px",
                      color: "#a78bfa",
                      fontSize: "13px",
                      fontWeight: 500,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    {action.label} →
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Related Articles */}
          {activeArticle.relatedArticles && activeArticle.relatedArticles.length > 0 && (
            <footer style={{ paddingTop: "1.25rem", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>
                Related Guides
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {activeArticle.relatedArticles.map((relId) => {
                  const relArticle = getHelpArticleById(relId);
                  if (!relArticle) return null;
                  return (
                    <button
                      key={relId}
                      onClick={() => handleSelectArticle(relId)}
                      style={{
                        padding: "5px 12px",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "6px",
                        color: "#cbd5e1",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      {relArticle.title}
                    </button>
                  );
                })}
              </div>
            </footer>
          )}
        </article>
      )}

      {/* ── View: Category Explorer (When no search & no active article) ── */}
      {!searchQuery.trim() && !activeArticle && (
        <>
          {activeCategoryId ? (
            /* Selected category view */
            <section aria-label="Category articles">
              <button
                onClick={handleBackToHome}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "none",
                  border: "none",
                  color: "#a78bfa",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: "pointer",
                  padding: 0,
                  marginBottom: "1.25rem",
                }}
              >
                <ArrowLeft size={16} aria-hidden="true" />
                All Categories
              </button>

              <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#f8fafc", marginBottom: "1rem" }}>
                {HELP_CATEGORIES.find((c) => c.id === activeCategoryId)?.title}
              </h2>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {getArticlesByCategory(activeCategoryId).map((article) => (
                  <div
                    key={article.id}
                    onClick={() => handleSelectArticle(article.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelectArticle(article.id);
                      }
                    }}
                    style={{
                      padding: "14px 18px",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "8px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "#f1f5f9", marginBottom: "4px" }}>
                        {article.title}
                      </div>
                      <div style={{ fontSize: "12px", color: "#94a3b8" }}>{article.summary}</div>
                    </div>
                    <ChevronRight size={16} aria-hidden="true" style={{ color: "#64748b" }} />
                  </div>
                ))}
              </div>
            </section>
          ) : (
            /* All categories grid */
            <section aria-label="Documentation categories">
              <h2 style={{ fontSize: "14px", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "1rem" }}>
                Knowledge Base Categories
              </h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: "12px",
                }}
              >
                {HELP_CATEGORIES.map((cat) => {
                  const articleCount = getArticlesByCategory(cat.id).length;
                  return (
                    <div
                      key={cat.id}
                      onClick={() => handleSelectCategory(cat.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleSelectCategory(cat.id);
                        }
                      }}
                      style={{
                        padding: "16px",
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: "10px",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          {getCategoryIcon(cat.iconName)}
                          <span style={{ fontSize: "14px", fontWeight: 600, color: "#f1f5f9" }}>
                            {cat.title}
                          </span>
                        </div>
                        <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 500 }}>
                          {articleCount} {articleCount === 1 ? "guide" : "guides"}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8", lineHeight: 1.4 }}>
                        {cat.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      {/* ── Quick Assistance Footer ── */}
      <footer
        style={{
          marginTop: "3rem",
          padding: "18px 24px",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "#e2e8f0" }}>Need immediate troubleshooting?</div>
          <div style={{ fontSize: "12px", color: "#64748b" }}>
            Run the in-app Diagnostics Center to test SQLite, SLM, and provider connectivity.
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => navigate("/diagnostics")}
            style={{
              padding: "7px 14px",
              background: "rgba(167,139,250,0.15)",
              border: "1px solid rgba(167,139,250,0.3)",
              borderRadius: "6px",
              color: "#a78bfa",
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Diagnostics Center →
          </button>
          <button
            onClick={() => navigate("/contact")}
            style={{
              padding: "7px 14px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "6px",
              color: "#cbd5e1",
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Contact Channels
          </button>
        </div>
      </footer>
    </main>
  );
};

export default HelpPage;
