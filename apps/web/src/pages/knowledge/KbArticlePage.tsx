import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { can } from "../../auth/permissions";

// Knowledge Base article detail/view page (internal only).
// Managers see DRAFT articles and have publish / edit controls.
// Viewers only see PUBLISHED articles.

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

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return iso;
  }
}

// Body is rendered as plain preformatted text (the markdown source).
// A proper sanitised HTML renderer (e.g. DOMPurify + marked) is a
// follow-up improvement tracked in the backlog — do NOT add
// dangerouslySetInnerHTML here without first adding DOMPurify.

export function KbArticlePage() {
  const { authFetch, user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const isManager = can(user, "knowledge.manage");

  const [article, setArticle] = useState<KbArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Publish state
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/kb/articles/${id}`);
      if (res.status === 404) {
        setError("Article not found.");
        return;
      }
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        throw new Error(`Failed to load article: ${msg}`);
      }
      const data = (await res.json()) as KbArticle;
      setArticle(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, id]);

  useEffect(() => {
    void load();
  }, [load]);

  function startEdit() {
    if (!article) return;
    setEditTitle(article.title);
    setEditCategory(article.category);
    setEditTags(article.tags.join(", "));
    setEditBody(article.body);
    setSaveError(null);
    setEditing(true);
  }

  async function handleSave() {
    if (!id || !editTitle.trim() || !editCategory.trim() || !editBody.trim()) {
      setSaveError("Title, category, and body are required.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const tags = editTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await authFetch(`/kb/articles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          category: editCategory.trim(),
          body: editBody.trim(),
          tags
        })
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        throw new Error(msg);
      }
      const updated = (await res.json()) as KbArticle;
      setArticle(updated);
      setEditing(false);
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!id) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const res = await authFetch(`/kb/articles/${id}/publish`, { method: "POST" });
      if (!res.ok) {
        const msg = await res.text().catch(() => res.statusText);
        throw new Error(msg);
      }
      const updated = (await res.json()) as KbArticle;
      setArticle(updated);
    } catch (err) {
      setPublishError((err as Error).message);
    } finally {
      setPublishing(false);
    }
  }

  async function handleDelete() {
    if (!id) return;
    if (!window.confirm("Delete this article? This cannot be undone.")) return;
    try {
      const res = await authFetch(`/kb/articles/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const msg = await res.text().catch(() => res.statusText);
        throw new Error(msg);
      }
      navigate("/knowledge");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (loading) {
    return <div style={{ padding: 40, color: "var(--text-muted, #666)" }}>Loading article...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: 40 }}>
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
        <button
          onClick={() => navigate("/knowledge")}
          style={{
            color: "var(--color-orange, #FEAA6D)",
            background: "none",
            border: "none",
            cursor: "pointer",
            textDecoration: "underline"
          }}
        >
          Back to Knowledge Base
        </button>
      </div>
    );
  }

  if (!article) return null;

  return (
    <div style={{ padding: "24px 32px", maxWidth: 860 }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: 13, color: "var(--text-muted, #888)", marginBottom: 16 }}>
        <button
          onClick={() => navigate("/knowledge")}
          style={{
            color: "var(--color-orange, #FEAA6D)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            textDecoration: "underline",
            fontSize: 13
          }}
        >
          Knowledge Base
        </button>
        {" / "}
        {article.category}
      </div>

      {/* Header */}
      {!editing ? (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16,
              marginBottom: 12
            }}
          >
            <h1
              style={{
                fontFamily: "var(--font-heading, Syne)",
                fontSize: 26,
                margin: 0,
                flex: 1
              }}
            >
              {article.title}
            </h1>
            {isManager && (
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                {article.status === "DRAFT" && (
                  <button
                    onClick={() => void handlePublish()}
                    disabled={publishing}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 6,
                      border: "none",
                      background: "#16a34a",
                      color: "#fff",
                      cursor: "pointer",
                      fontWeight: 600,
                      minHeight: 40,
                      opacity: publishing ? 0.6 : 1
                    }}
                  >
                    {publishing ? "Publishing..." : "Publish"}
                  </button>
                )}
                <button
                  onClick={startEdit}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 6,
                    border: "1px solid #ccc",
                    background: "#fff",
                    cursor: "pointer",
                    minHeight: 40
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => void handleDelete()}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 6,
                    border: "1px solid #dc2626",
                    background: "#fff",
                    color: "#dc2626",
                    cursor: "pointer",
                    minHeight: 40
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>

          {publishError && (
            <div
              role="alert"
              style={{
                color: "#dc2626",
                padding: 8,
                background: "#fef2f2",
                borderRadius: 4,
                marginBottom: 12
              }}
            >
              {publishError}
            </div>
          )}

          {/* Meta row */}
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
              marginBottom: 16,
              fontSize: 13,
              color: "var(--text-muted, #666)"
            }}
          >
            <span
              style={{
                background: "#f3f4f6",
                borderRadius: 4,
                padding: "2px 7px"
              }}
            >
              {article.category}
            </span>
            {isManager && (
              <span
                style={{
                  borderRadius: 4,
                  padding: "2px 7px",
                  fontWeight: 600,
                  color: article.status === "PUBLISHED" ? "#16a34a" : "#eab308",
                  border: `1px solid ${article.status === "PUBLISHED" ? "#16a34a" : "#eab308"}`,
                  background: "#f9f9f9"
                }}
              >
                {article.status === "PUBLISHED" ? "Published" : "Draft"}
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
            <span>
              By {article.author.firstName} {article.author.lastName}
            </span>
            <span>Updated {fmtDate(article.updatedAt)}</span>
          </div>

          {/* Body — plain preformatted markdown source.
               A sanitised HTML renderer is a follow-up improvement. */}
          <pre
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 6,
              padding: "24px 28px",
              lineHeight: 1.7,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontFamily: "var(--font-body, Outfit), sans-serif",
              fontSize: 15,
              margin: 0
            }}
          >
            {article.body}
          </pre>
        </>
      ) : (
        /* Edit form */
        <div>
          <h2
            style={{
              fontFamily: "var(--font-heading, Syne)",
              fontSize: 20,
              margin: "0 0 16px"
            }}
          >
            Edit Article
          </h2>
          {saveError && (
            <div
              role="alert"
              style={{
                color: "#dc2626",
                padding: 8,
                background: "#fef2f2",
                borderRadius: 4,
                marginBottom: 12
              }}
            >
              {saveError}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label
                style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}
              >
                Title *
              </label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
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
                style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}
              >
                Category *
              </label>
              <input
                type="text"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
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
                style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}
              >
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
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
                style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}
              >
                Body (Markdown) *
              </label>
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={12}
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
              onClick={() => setEditing(false)}
              disabled={saving}
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
              onClick={() => void handleSave()}
              disabled={saving}
              style={{
                padding: "10px 20px",
                borderRadius: 6,
                border: "none",
                background: "var(--color-orange, #FEAA6D)",
                cursor: "pointer",
                fontWeight: 600,
                minHeight: 44,
                opacity: saving ? 0.6 : 1
              }}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
