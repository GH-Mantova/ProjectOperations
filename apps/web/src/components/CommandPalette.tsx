import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

type SearchResult = {
  id: string;
  entityType: string;
  entityId: string;
  title: string;
  subtitle?: string | null;
  body?: string | null;
  module: string;
  url?: string | null;
};

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
};

const TYPE_ORDER = [
  "Job",
  "Tender",
  "Client",
  "Worker",
  "Asset",
  "FormTemplate",
  "DocumentLink",
  "Dashboard"
];

const TYPE_LABEL: Record<string, string> = {
  Job: "Jobs",
  Tender: "Tenders",
  Client: "Clients",
  Worker: "Workers",
  Asset: "Assets",
  FormTemplate: "Forms",
  DocumentLink: "Documents",
  Dashboard: "Dashboards"
};

const TYPE_ICON: Record<string, ReactElement> = {
  Job: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  Tender: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" />
    </svg>
  ),
  Client: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="7" width="18" height="14" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  Worker: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  ),
  Asset: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2l9 5v10l-9 5-9-5V7z" />
    </svg>
  ),
  FormTemplate: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
    </svg>
  ),
  DocumentLink: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    </svg>
  ),
  Dashboard: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  )
};

function urlFor(entityType: string, entityId: string, fallback?: string | null): string {
  if (fallback) return fallback;
  switch (entityType) {
    case "Job": return `/jobs?highlight=${encodeURIComponent(entityId)}`;
    case "Tender": return `/tenders?highlight=${encodeURIComponent(entityId)}`;
    case "Client": return `/master-data?tab=clients&highlight=${encodeURIComponent(entityId)}`;
    case "Worker": return `/resources?highlight=${encodeURIComponent(entityId)}`;
    case "Asset": return `/assets?highlight=${encodeURIComponent(entityId)}`;
    case "FormTemplate": return `/forms?highlight=${encodeURIComponent(entityId)}`;
    case "DocumentLink": return `/documents?highlight=${encodeURIComponent(entityId)}`;
    case "Dashboard": return `/dashboards?highlight=${encodeURIComponent(entityId)}`;
    default: return "/";
  }
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults([]);
    setActiveIndex(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        const response = await authFetch(`/search${params.toString() ? `?${params.toString()}` : ""}`);
        if (!response.ok) {
          setResults([]);
          return;
        }
        const data = (await response.json()) as SearchResult[];
        setResults(data);
        setActiveIndex(0);
      } finally {
        setLoading(false);
      }
    }, 160);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [authFetch, open, query]);

  const grouped = useMemo(() => {
    const groups = new Map<string, SearchResult[]>();
    for (const result of results) {
      const key = TYPE_LABEL[result.entityType] ? result.entityType : "Other";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(result);
    }
    const ordered: Array<{ type: string; items: SearchResult[] }> = [];
    for (const type of TYPE_ORDER) {
      if (groups.has(type)) ordered.push({ type, items: groups.get(type)! });
    }
    for (const [type, items] of groups) {
      if (!TYPE_ORDER.includes(type)) ordered.push({ type, items });
    }
    return ordered;
  }, [results]);

  const flat = useMemo(() => grouped.flatMap((group) => group.items), [grouped]);

  const go = (result: SearchResult) => {
    const destination = urlFor(result.entityType, result.entityId, result.url);
    navigate(destination);
    onClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(flat.length - 1, current + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(0, current - 1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const pick = flat[activeIndex];
      if (pick) go(pick);
    }
  };

  if (!open) return null;

  return (
    <div className="cmdk-overlay" role="dialog" aria-label="Global search" aria-modal="true" onClick={onClose}>
      <div className="cmdk-panel" onClick={(event) => event.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="cmdk-panel__search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="M16 16l5 5" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search jobs, tenders, clients, workers, assets, forms…"
            className="cmdk-panel__input"
            aria-label="Search"
          />
          <kbd className="cmdk-panel__hint">ESC</kbd>
        </div>
        <div className="cmdk-panel__results">
          {loading && results.length === 0 ? (
            <p className="cmdk-panel__empty">Searching…</p>
          ) : grouped.length === 0 ? (
            <p className="cmdk-panel__empty">{query ? "No matches." : "Start typing to search."}</p>
          ) : (
            grouped.map((group) => (
              <div key={group.type} className="cmdk-group">
                <p className="cmdk-group__label">{TYPE_LABEL[group.type] ?? group.type}</p>
                {group.items.map((result) => {
                  const index = flat.indexOf(result);
                  const active = index === activeIndex;
                  return (
                    <button
                      key={result.id}
                      type="button"
                      className={active ? "cmdk-item cmdk-item--active" : "cmdk-item"}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => go(result)}
                    >
                      <span className="cmdk-item__icon" aria-hidden>
                        {TYPE_ICON[result.entityType] ?? TYPE_ICON.Dashboard}
                      </span>
                      <span className="cmdk-item__body">
                        <span className="cmdk-item__title">{result.title}</span>
                        {result.subtitle ? (
                          <span className="cmdk-item__context">{result.subtitle}</span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="cmdk-panel__footer">
          <span className="cmdk-panel__hint-row">
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            navigate
          </span>
          <span className="cmdk-panel__hint-row">
            <kbd>↵</kbd>
            select
          </span>
          <span className="cmdk-panel__hint-row">
            <kbd>ESC</kbd>
            close
          </span>
        </div>
      </div>
    </div>
  );
}
