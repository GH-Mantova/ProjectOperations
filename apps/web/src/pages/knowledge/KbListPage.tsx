import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { can } from "../../auth/permissions";

// Knowledge Base / SOP library — browse and search page (internal only).
// Viewers (knowledge.view) see PUBLISHED articles.
// Managers (knowledge.manage) see DRAFT + PUBLISHED, and can create new articles.

type UserSummary = { id: string; firstName: string; lastName: string; email: string };

type KbArticle = {
  id: string;
  title: string;
  body: string;
  category: string;
  tags: string[];
  status: "DRAFT" | "PUBLISHED";
  author: UserSummary;
  createdAt: string;
  updatedAt: string;
};

type ListResponse = {
  items: KbArticle[];
  total: number;
  page: number;
  limit: number;
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published"
};

const STATUS_COLOUR: Record<string, string> = {
  DRAFT: "#eab308",
  PUBLISHED: "#16a34a"
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  } catch {
    return iso;
  }
}

// Truncate body for preview (strip markdown, first ~120 chars)
function bodyPreview(body: string): string {
  const stripped = body.replace(/#+\s*/g, "").replace(/\n/g, " ").trim();
  return stripped.length > 120 ? stripped.slice(0, 117) + "..." : stripped;
}

export function KbListPage() {
  const { authFetch, user } = useAuth();
  const navigate = useNavigate();

  const isManager = can(user, "knowledge.manage");

  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newTags, setNewTags] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (filterCategory) params.set("category", filterCategory);
      if (filterStatus) params.set("status", filterStatus);
      params.set("limit", "50");

      const res = await authFetch(`/kb/articles?${params.toString()}`);
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        throw new Error(`Failed to load articles: ${msg}`);
      }
      const data = (await res.json()) as ListResponse;
      setArticles(data.items);
      setTotal(data.total);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, search, filterCategory, filterStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  // Derive category list from loaded articles
  const categories = Array.from(new Set(articles.map((a) => a.category))).sort();

  async function handleCreate() {
    if (!newTitle.trim()) {
      setCreateError("Title is required.");
      return;
    }
    if (!newCategory.trim()) {
      setCreateError("Category is required.");
      return;
    }
    if (!newBody.trim()) {
      setCreateError("Body is required.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const tags = newTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await authFetch("/kb/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          category: newCategory.trim(),
          body: newBody.trim(),
          tags
        })
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        throw new Error(msg);
      }
      const created = (await res.json()) as KbArticle;
      setShowCreate(false);
      setNewTitle("");
      setNewCategory("");
      setNewBody("");
      setNewTags("");
      navigate(`/knowledge/${created.id}`);
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ padding: "24px 32px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20
        }}
      >
        <h1 style={{ fontFamily: "var(--font-heading, Syne)", fontSize: 24, margin: 0 }}>
          Knowledge Base
        </h1>
        {isManager && (
          <button
            onClick={() => setShowCreate(true)}
            style={{
              background: "var(--color-orange, #FEAA6D)",
              color: "#000",
              border: "none",
              borderRadius: 6,
              padding: "10px 20px",
              cursor: "pointer",
              fontWeight: 600,
              minHeight: 44
            }}
          >
            + New Article
          </button>
        )}
      </div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 16,
          alignItems: "center"
        }}
      >
        <input
          type="text"
          placeholder="Search articles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: 4,
            border: "1px solid #ccc",
            minWidth: 220,
            minHeight: 40
          }}
        />

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 4, border: "1px solid #ccc", minHeight: 40 }}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {isManager && (
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 4, border: "1px solid #ccc", minHeight: 40 }}
          >
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
          </select>
        )}
      </div>

      {/* Results */}
      {loading && (
        <p style={{ color: "var(--text-muted, #666)" }}>Loading articles...</p>
      )}
      {error && (
        <div
          role="alert"
          style={{
            color: "#dc2626",
            padding: 12,
            background: "#fef2f2",
            borderRadius: 6,
            marginBottom: 16
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && articles.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted, #888)" }}>
          No articles found.
          {isManager && (
            <>
              {" "}
              <button
                onClick={() => setShowCreate(true)}
                style={{
                  color: "var(--color-orange, #FEAA6D)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textDecoration: "underline"
                }}
              >
                Create the first one.
              </button>
            </>
          )}
        </div>
      )}

      {!loading && articles.length > 0 && (
        <>
          <p style={{ color: "var(--text-muted, #666)", fontSize: 13, marginBottom: 8 }}>
            Showing {articles.length} of {total} articles
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {articles.map((article) => (
              <div
                key={article.id}
                onClick={() => navigate(`/knowledge/${article.id}`)}
                style={{
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderLeft: "4px solid var(--color-teal, #005B61)",
                  borderRadius: 6,
                  padding: "14px 18px",
                  cursor: "pointer"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    flexWrap: "wrap",
                    marginBottom: 4
                  }}
                >
                  <span
                    style={{
                      background: "#f3f4f6",
                      borderRadius: 4,
                      padding: "2px 7px",
                      fontSize: 12
                    }}
                  >
                    {article.category}
                  </span>
                  {isManager && (
                    <span
                      style={{
                        borderRadius: 4,
                        padding: "2px 7px",
                        fontSize: 12,
                        fontWeight: 600,
                        color: STATUS_COLOUR[article.status] ?? "#888",
                        background: "#f9f9f9",
                        border: `1px solid ${STATUS_COLOUR[article.status] ?? "#ccc"}`
                      }}
                    >
                      {STATUS_LABEL[article.status] ?? article.status}
                    </span>
                  )}
                  {article.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        background: "#e0f2fe",
                        borderRadius: 4,
                        padding: "2px 7px",
                        fontSize: 11,
                        color: "#0369a1"
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{article.title}</div>
                <div style={{ fontSize: 13, color: "var(--text-muted, #666)", marginBottom: 4 }}>
                  {bodyPreview(article.body)}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted, #999)" }}>
                  {article.author.firstName} {article.author.lastName} &middot;{" "}
                  {fmtDate(article.updatedAt)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Create article modal */}
      {showCreate && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreate(false);
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 8,
              padding: 28,
              width: 560,
              maxWidth: "92vw",
              maxHeight: "90vh",
              overflowY: "auto"
            }}
          >
            <h2
              style={{
                margin: "0 0 16px",
                fontFamily: "var(--font-heading, Syne)"
              }}
            >
              New KB Article
            </h2>
            {createError && (
              <div
                role="alert"
                style={{
                  color: "#dc2626",
                  marginBottom: 12,
                  padding: 8,
                  background: "#fef2f2",
                  borderRadius: 4
                }}
              >
                {createError}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    display: "block",
                    marginBottom: 4
                  }}
                >
                  Title *
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Class A Asbestos Removal — Safe Work Method Statement"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 4,
                    border: "1px solid #ccc",
                    boxSizing: "border-box"
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    display: "block",
                    marginBottom: 4
                  }}
                >
                  Category *
                </label>
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="e.g. Asbestos, Civil, Demolition, Safety, Admin"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 4,
                    border: "1px solid #ccc",
                    boxSizing: "border-box"
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    display: "block",
                    marginBottom: 4
                  }}
                >
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder="e.g. swms, ppe, class-a"
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 4,
                    border: "1px solid #ccc",
                    boxSizing: "border-box"
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    display: "block",
                    marginBottom: 4
                  }}
                >
                  Body (Markdown) *
                </label>
                <textarea
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  placeholder="## Overview&#10;&#10;Describe the procedure..."
                  rows={8}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 4,
                    border: "1px solid #ccc",
                    boxSizing: "border-box",
                    resize: "vertical",
                    fontFamily: "monospace",
                    fontSize: 13
                  }}
                />
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: 10,
                marginTop: 20,
                justifyContent: "flex-end"
              }}
            >
              <button
                onClick={() => setShowCreate(false)}
                disabled={creating}
                style={{
                  padding: "10px 20px",
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  background: "#fff",
                  cursor: "pointer",
                  minHeight: 44
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleCreate()}
                disabled={creating}
                style={{
                  padding: "10px 20px",
                  borderRadius: 6,
                  border: "none",
                  background: "var(--color-orange, #FEAA6D)",
                  cursor: "pointer",
                  fontWeight: 600,
                  minHeight: 44,
                  opacity: creating ? 0.6 : 1
                }}
              >
                {creating ? "Creating..." : "Create Draft"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
