import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

// D365-parity relevance search box in the shell header. Renders as a visible
// input (not just an icon) with a dropdown of typed, permission-filtered
// results from live entity tables. Focus shortcut: "/" — Ctrl/Cmd+K is left
// to the existing CommandPalette modal so both surfaces stay reachable.

type RelevanceResult = {
  entityType: "Job" | "Tender" | "Client" | "Contact" | "Contract" | "Asset";
  entityId: string;
  title: string;
  subtitle?: string | null;
  url: string;
};

const TYPE_ORDER: RelevanceResult["entityType"][] = [
  "Tender",
  "Job",
  "Contract",
  "Client",
  "Contact",
  "Asset"
];

const TYPE_LABEL: Record<RelevanceResult["entityType"], string> = {
  Tender: "Tenders",
  Job: "Jobs",
  Contract: "Contracts",
  Client: "Clients",
  Contact: "Contacts",
  Asset: "Assets"
};

const TYPE_ICON: Record<RelevanceResult["entityType"], ReactElement> = {
  Tender: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" />
    </svg>
  ),
  Job: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  Contract: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 3h8l4 4v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M9 9h6M9 13h6M9 17h4" />
    </svg>
  ),
  Client: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="7" width="18" height="14" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  Contact: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  ),
  Asset: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2l9 5v10l-9 5-9-5V7z" />
    </svg>
  )
};

const DEBOUNCE_MS = 200;
const MIN_QUERY = 2;

export function GlobalSearch() {
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RelevanceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      // "/" focuses the box, but not while the user is typing in an input.
      const target = event.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (event.key === "/" && !inField) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await authFetch(`/search/relevance?q=${encodeURIComponent(q)}`);
        if (!response.ok) {
          setResults([]);
          return;
        }
        const data = (await response.json()) as RelevanceResult[];
        setResults(data);
        setActiveIndex(0);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [authFetch, query]);

  const grouped = useMemo(() => {
    const groups = new Map<RelevanceResult["entityType"], RelevanceResult[]>();
    for (const r of results) {
      const existing = groups.get(r.entityType) ?? [];
      existing.push(r);
      groups.set(r.entityType, existing);
    }
    const ordered: Array<{ type: RelevanceResult["entityType"]; items: RelevanceResult[] }> = [];
    for (const type of TYPE_ORDER) {
      const items = groups.get(type);
      if (items && items.length) ordered.push({ type, items });
    }
    return ordered;
  }, [results]);

  const flat = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  const go = (result: RelevanceResult) => {
    navigate(result.url);
    setOpen(false);
    setQuery("");
    setResults([]);
    inputRef.current?.blur();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(Math.max(flat.length - 1, 0), current + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(0, current - 1));
      return;
    }
    if (event.key === "Enter") {
      const pick = flat[activeIndex];
      if (pick) {
        event.preventDefault();
        go(pick);
      }
    }
  };

  const showDropdown = open && query.trim().length >= MIN_QUERY;

  return (
    <div
      ref={containerRef}
      data-testid="global-search"
      onKeyDown={onKeyDown}
      style={{ position: "relative", flex: "0 1 360px", minWidth: 200 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 36,
          padding: "0 10px",
          background: "var(--border-subtle, #F3F4F6)",
          border: "1px solid transparent",
          borderRadius: "var(--radius-md, 8px)",
          transition: "background 120ms, border-color 120ms"
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ color: "var(--text-secondary, #6B7280)" }}>
          <circle cx="11" cy="11" r="7" />
          <path d="M16 16l5 5" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search tenders, jobs, clients, contacts…"
          aria-label="Global search"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          style={{
            flex: 1,
            border: 0,
            outline: "none",
            background: "transparent",
            fontSize: 13,
            color: "var(--text-primary, #0F1117)"
          }}
        />
        <kbd
          aria-hidden
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 10,
            padding: "1px 5px",
            border: "1px solid var(--border-default, #E5E7EB)",
            borderRadius: 4,
            color: "var(--text-muted, #9CA3AF)",
            background: "var(--surface-card, #FFFFFF)"
          }}
        >
          /
        </kbd>
      </div>
      {showDropdown ? (
        <div
          role="listbox"
          aria-label="Search results"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            maxHeight: 420,
            overflowY: "auto",
            background: "var(--surface-card, #FFFFFF)",
            border: "1px solid var(--border-default, #E5E7EB)",
            borderRadius: "var(--radius-lg, 12px)",
            boxShadow: "var(--shadow-dropdown, 0 4px 16px rgba(0, 0, 0, 0.10))",
            padding: 6,
            zIndex: 40
          }}
        >
          {loading && results.length === 0 ? (
            <p style={{ margin: 0, padding: "12px 10px", fontSize: 13, color: "var(--text-muted, #9CA3AF)" }}>Searching…</p>
          ) : grouped.length === 0 ? (
            <p style={{ margin: 0, padding: "12px 10px", fontSize: 13, color: "var(--text-muted, #9CA3AF)" }}>No matches.</p>
          ) : (
            grouped.map((group) => (
              <div key={group.type} style={{ padding: "4px 0" }}>
                <p
                  style={{
                    margin: 0,
                    padding: "4px 10px",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 0.4,
                    textTransform: "uppercase",
                    color: "var(--text-muted, #9CA3AF)"
                  }}
                >
                  {TYPE_LABEL[group.type]}
                </p>
                {group.items.map((result) => {
                  const index = flat.indexOf(result);
                  const active = index === activeIndex;
                  return (
                    <button
                      key={`${result.entityType}:${result.entityId}`}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => go(result)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        width: "100%",
                        padding: "8px 10px",
                        border: 0,
                        borderRadius: "var(--radius-sm, 6px)",
                        background: active ? "var(--border-subtle, #F3F4F6)" : "transparent",
                        color: "var(--text-primary, #0F1117)",
                        cursor: "pointer",
                        textAlign: "left"
                      }}
                    >
                      <span aria-hidden style={{ color: "var(--text-secondary, #6B7280)" }}>{TYPE_ICON[result.entityType]}</span>
                      <span style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{result.title}</span>
                        {result.subtitle ? (
                          <span style={{ fontSize: 11, color: "var(--text-muted, #9CA3AF)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{result.subtitle}</span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
