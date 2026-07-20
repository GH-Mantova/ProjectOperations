import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

// KB search modal — shown from the Case detail page to help users find a
// relevant SOP or how-to article. Calls GET /kb/articles?q=... and lets
// the user select an article to navigate to. No join table — navigate-only.

type KbArticleSummary = {
  id: string;
  title: string;
  category: string;
  tags: string[];
  status: "DRAFT" | "PUBLISHED";
  updatedAt: string;
};

type ListResponse = {
  items: KbArticleSummary[];
  total: number;
};

type Props = {
  onClose: () => void;
  onSelect: (articleId: string) => void;
};

export function KbSearchModal({ onClose, onSelect }: Props) {
  const { authFetch } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KbArticleSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(
    async (q: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ limit: "20" });
        if (q) params.set("q", q);
        const res = await authFetch(`/kb/articles?${params.toString()}`);
        if (!res.ok) {
          const msg = await res.text().catch(() => res.statusText);
          throw new Error(`Failed to search KB: ${msg}`);
        }
        const data = (await res.json()) as ListResponse;
        setResults(data.items);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [authFetch]
  );

  // Initial load (show all PUBLISHED articles)
  useEffect(() => {
    void search("");
  }, [search]);

  // Debounce input
  useEffect(() => {
    const timer = setTimeout(() => {
      void search(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1100
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 8,
          padding: 24,
          width: 560,
          maxWidth: "92vw",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          gap: 12
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <h2
            style={{
              margin: 0,
              fontFamily: "var(--font-heading, Syne)",
              fontSize: 18
            }}
          >
            Search Knowledge Base
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 20,
              lineHeight: 1,
              color: "var(--text-muted, #888)"
            }}
          >
            &times;
          </button>
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search articles by title or content..."
          autoFocus
          style={{
            padding: "10px 12px",
            borderRadius: 6,
            border: "1px solid #ccc",
            fontSize: 15,
            width: "100%",
            boxSizing: "border-box"
          }}
        />

        <div style={{ overflowY: "auto", flex: 1, minHeight: 120 }}>
          {loading && (
            <p style={{ color: "var(--text-muted, #888)", fontSize: 13, padding: 8 }}>
              Searching...
            </p>
          )}
          {error && (
            <div
              role="alert"
              style={{ color: "#dc2626", padding: 8, background: "#fef2f2", borderRadius: 4 }}
            >
              {error}
            </div>
          )}
          {!loading && !error && results.length === 0 && (
            <p style={{ color: "var(--text-muted, #888)", fontSize: 13, padding: 8 }}>
              No articles found.
            </p>
          )}
          {!loading &&
            results.map((article) => (
              <button
                key={article.id}
                onClick={() => onSelect(article.id)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  borderBottom: "1px solid #f3f4f6",
                  padding: "10px 8px",
                  cursor: "pointer",
                  borderRadius: 4
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "#f9fafb";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "none";
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
                  {article.title}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted, #888)",
                    display: "flex",
                    gap: 6,
                    flexWrap: "wrap"
                  }}
                >
                  <span
                    style={{
                      background: "#f3f4f6",
                      borderRadius: 3,
                      padding: "1px 5px"
                    }}
                  >
                    {article.category}
                  </span>
                  {article.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        background: "#e0f2fe",
                        borderRadius: 3,
                        padding: "1px 5px",
                        color: "#0369a1"
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </button>
            ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 18px",
              borderRadius: 6,
              border: "1px solid #ccc",
              background: "#fff",
              cursor: "pointer",
              minHeight: 40
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
