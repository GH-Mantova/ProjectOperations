import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useAuth } from "../../auth/AuthContext";

type Entry = { id: string; text: string; sortOrder: number };

type Props = {
  tenderId: string;
  onClose: () => void;
  readOnly?: boolean;
};

const LS_KEY = "tendering.assumptionsExclusionsEditor.size";
const DEFAULT_WIDTH = 520;
const DEFAULT_HEIGHT = 460;
const MIN_WIDTH = 360;
const MIN_HEIGHT = 300;

function loadSize(): { width: number; height: number } {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { width?: number; height?: number };
      return {
        width: Math.max(MIN_WIDTH, parsed.width ?? DEFAULT_WIDTH),
        height: Math.max(MIN_HEIGHT, parsed.height ?? DEFAULT_HEIGHT)
      };
    }
  } catch { /* ignore */ }
  return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
}

export function AssumptionsExclusionsFloatingEditor({ tenderId, onClose, readOnly }: Props) {
  const { authFetch } = useAuth();
  const [assumptions, setAssumptions] = useState<Entry[]>([]);
  const [exclusions, setExclusions] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [size, setSize] = useState(loadSize);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [aRes, eRes] = await Promise.all([
          authFetch(`/tenders/${tenderId}/assumptions`),
          authFetch(`/tenders/${tenderId}/exclusions`)
        ]);
        if (cancelled) return;
        if (aRes.ok) setAssumptions(await aRes.json() as Entry[]);
        if (eRes.ok) setExclusions(await eRes.json() as Entry[]);
      } catch { /* non-fatal */ }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [authFetch, tenderId]);

  const refetchOnFocus = useCallback(() => {
    (async () => {
      try {
        const [aRes, eRes] = await Promise.all([
          authFetch(`/tenders/${tenderId}/assumptions`),
          authFetch(`/tenders/${tenderId}/exclusions`)
        ]);
        if (aRes.ok) setAssumptions(await aRes.json() as Entry[]);
        if (eRes.ok) setExclusions(await eRes.json() as Entry[]);
      } catch { /* non-fatal */ }
    })();
  }, [authFetch, tenderId]);

  useEffect(() => {
    window.addEventListener("focus", refetchOnFocus);
    return () => window.removeEventListener("focus", refetchOnFocus);
  }, [refetchOnFocus]);

  // Persist size changes
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(size));
  }, [size]);

  // Bottom-left resize drag handle
  const dragRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

  const onResizePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, startW: size.width, startH: size.height };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onResizePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = dragRef.current.startX - e.clientX;
    const dy = e.clientY - dragRef.current.startY;
    setSize({
      width: Math.max(MIN_WIDTH, dragRef.current.startW + dx),
      height: Math.max(MIN_HEIGHT, dragRef.current.startH + dy)
    });
  };

  const onResizePointerUp = () => { dragRef.current = null; };

  const panelStyle: CSSProperties = {
    position: "fixed",
    top: 16,
    right: 16,
    width: size.width,
    height: size.height,
    zIndex: 70,
    background: "var(--surface-card, #fff)",
    border: "1px solid var(--border-default, #e5e7eb)",
    borderRadius: "var(--radius-lg, 12px)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden"
  };

  return (
    <div ref={panelRef} style={panelStyle} data-testid="assumptions-exclusions-editor">
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", borderBottom: "1px solid var(--border-default, #e5e7eb)",
        background: "var(--surface-subtle, #f9fafb)", flexShrink: 0
      }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>Assumptions &amp; Exclusions</span>
        <button
          onClick={onClose}
          aria-label="Close editor"
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 18, lineHeight: 1, color: "var(--text-muted, #6b7280)",
            padding: 4
          }}
        >×</button>
      </div>

      {/* Body — two columns */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr",
        flex: 1, overflow: "hidden", minHeight: 0
      }}>
        <EntryColumn
          kind="assumptions"
          title="Assumptions"
          tenderId={tenderId}
          entries={assumptions}
          setEntries={setAssumptions}
          loading={loading}
          authFetch={authFetch}
          readOnly={readOnly}
        />
        <EntryColumn
          kind="exclusions"
          title="Exclusions"
          tenderId={tenderId}
          entries={exclusions}
          setEntries={setExclusions}
          loading={loading}
          authFetch={authFetch}
          borderLeft
          readOnly={readOnly}
        />
      </div>

      {/* Bottom-left resize handle */}
      <div
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        style={{
          position: "absolute", bottom: 0, left: 0,
          width: 16, height: 16, cursor: "nesw-resize",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--text-muted, #9ca3af)", fontSize: 10, userSelect: "none"
        }}
        aria-hidden
      >⟋</div>
    </div>
  );
}

// ── Column ─────────────────────────────────────────────────────────────

type ColumnProps = {
  kind: "assumptions" | "exclusions";
  title: string;
  tenderId: string;
  entries: Entry[];
  setEntries: React.Dispatch<React.SetStateAction<Entry[]>>;
  loading: boolean;
  authFetch: ReturnType<typeof useAuth>["authFetch"];
  borderLeft?: boolean;
  readOnly?: boolean;
};

function EntryColumn({ kind, title, tenderId, entries, setEntries, loading, authFetch, borderLeft, readOnly }: ColumnProps) {
  const [addingText, setAddingText] = useState("");
  const [addingVisible, setAddingVisible] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);
  const lastRowRef = useRef<HTMLInputElement>(null);

  const endpoint = `/tenders/${tenderId}/${kind}`;

  const handleUpdate = async (entry: Entry, newText: string) => {
    if (newText === entry.text) return;
    if (!newText.trim()) {
      await handleDelete(entry.id);
      return;
    }
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, text: newText } : e)));
    try {
      await authFetch(`${endpoint}/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newText })
      });
    } catch {
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, text: entry.text } : e)));
    }
  };

  const handleDelete = async (id: string) => {
    const prev = entries;
    setEntries((cur) => cur.filter((e) => e.id !== id));
    try {
      const res = await authFetch(`${endpoint}/${id}`, { method: "DELETE" });
      if (!res.ok) setEntries(prev);
    } catch {
      setEntries(prev);
    }
  };

  const handleAdd = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) { setAddingText(""); return; }
    const maxSort = entries.reduce((m, e) => Math.max(m, e.sortOrder), 0);
    try {
      const res = await authFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, sortOrder: maxSort + 1 })
      });
      if (res.ok) {
        const created = await res.json() as Entry;
        setEntries((prev) => [...prev, created]);
      }
    } catch { /* non-fatal */ }
    setAddingText("");
    setAddingVisible(false);
  };

  const showAddRow = () => {
    setAddingVisible(true);
    requestAnimationFrame(() => addInputRef.current?.focus());
  };

  const colStyle: CSSProperties = {
    display: "flex", flexDirection: "column", overflow: "hidden",
    ...(borderLeft ? { borderLeft: "1px solid var(--border-default, #e5e7eb)" } : {})
  };

  return (
    <div style={colStyle}>
      <div style={{
        padding: "8px 12px", fontWeight: 600, fontSize: 13,
        color: "var(--text-secondary, #374151)", borderBottom: "1px solid var(--border-default, #e5e7eb)"
      }}>
        {title} ({entries.length})
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
        {loading ? (
          <div style={{ padding: 12, color: "var(--text-muted, #9ca3af)", fontSize: 13 }}>Loading…</div>
        ) : (
          <>
            {entries.map((entry, i) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                onUpdate={handleUpdate}
                onDelete={() => void handleDelete(entry.id)}
                inputRef={i === entries.length - 1 ? lastRowRef : undefined}
                onEnterOnLast={i === entries.length - 1 && !readOnly ? showAddRow : undefined}
                readOnly={readOnly}
              />
            ))}
            {!readOnly && addingVisible ? (
              <div style={{ display: "flex", alignItems: "center", padding: "2px 8px", gap: 4 }}>
                <input
                  ref={addInputRef}
                  className="s7-input"
                  value={addingText}
                  onChange={(e) => setAddingText(e.target.value)}
                  onBlur={() => void handleAdd(addingText)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleAdd(addingText); } }}
                  placeholder={`New ${kind.slice(0, -1)}…`}
                  style={{ flex: 1, height: 28, fontSize: 13 }}
                  autoFocus
                />
              </div>
            ) : !readOnly ? (
              <button
                onClick={showAddRow}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--brand-primary, #2563eb)", fontSize: 13,
                  padding: "6px 12px", textAlign: "left", width: "100%"
                }}
              >+ Add row</button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

// ── Row ────────────────────────────────────────────────────────────────

type RowProps = {
  entry: Entry;
  onUpdate: (entry: Entry, newText: string) => Promise<void>;
  onDelete: () => void;
  inputRef?: React.Ref<HTMLInputElement>;
  onEnterOnLast?: () => void;
  readOnly?: boolean;
};

function EntryRow({ entry, onUpdate, onDelete, inputRef, onEnterOnLast, readOnly }: RowProps) {
  const [text, setText] = useState(entry.text);

  useEffect(() => { setText(entry.text); }, [entry.text]);

  return (
    <div
      style={{
        display: "flex", alignItems: "center", padding: "2px 8px", gap: 4,
        minHeight: 32
      }}
      data-testid="entry-row"
    >
      <input
        ref={inputRef}
        className="s7-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => void onUpdate(entry, text)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
            onEnterOnLast?.();
          }
        }}
        disabled={readOnly}
        style={{ flex: 1, height: 28, fontSize: 13 }}
      />
      {!readOnly && (
        <button
          onClick={onDelete}
          aria-label="Delete entry"
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-muted, #9ca3af)", fontSize: 16, padding: "0 4px",
            lineHeight: 1, flexShrink: 0
          }}
        >×</button>
      )}
    </div>
  );
}
