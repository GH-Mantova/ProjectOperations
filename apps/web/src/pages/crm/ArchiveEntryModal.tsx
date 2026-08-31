import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { archiveEntry, listDropReasons, type DropReason } from "./crm-api";

type Props = {
  entryId: string;
  entryTitle?: string;
  onClose: () => void;
  onSaved: () => void;
};

export function ArchiveEntryModal({ entryId, entryTitle, onClose, onSaved }: Props) {
  const { authFetch } = useAuth();
  const [reasons, setReasons] = useState<DropReason[]>([]);
  const [reasonId, setReasonId] = useState("");
  const [detail, setDetail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listDropReasons(authFetch);
        if (cancelled) return;
        const active = rows.filter((r) => r.isActive);
        setReasons(active);
        if (active.length > 0) setReasonId(active[0].id);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  async function handleSubmit() {
    if (!reasonId) {
      setError("Choose a reason.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await archiveEntry(authFetch, entryId, {
        archiveReasonId: reasonId,
        detail: detail.trim() || undefined
      });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
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
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-label="Archive entry"
        style={{
          background: "#fff",
          borderRadius: 8,
          padding: 28,
          width: 520,
          maxWidth: "90vw"
        }}
      >
        <h2 style={{ margin: "0 0 8px", fontFamily: "var(--font-heading, Syne)" }}>
          Archive entry
        </h2>
        {entryTitle && (
          <p style={{ marginTop: 0, marginBottom: 16, fontSize: 13, color: "var(--text-muted, #666)" }}>
            <em>{entryTitle}</em>
          </p>
        )}
        <p style={{ marginTop: 0, marginBottom: 16, fontSize: 13, color: "var(--text-muted, #666)" }}>
          Archive is reversible. The entry and all its history are preserved.
        </p>

        {error && (
          <div role="alert" style={{ color: "#dc2626", marginBottom: 12, padding: 8, background: "#fef2f2", borderRadius: 4 }}>
            {error}
          </div>
        )}

        {loading ? (
          <p style={{ color: "var(--text-muted, #666)" }}>Loading reasons...</p>
        ) : reasons.length === 0 ? (
          <p style={{ color: "#dc2626" }}>
            No drop reasons configured. An admin needs to create them under Settings first.
          </p>
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
              <label
                htmlFor="archive-reason"
                style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}
              >
                Reason *
              </label>
              <select
                id="archive-reason"
                value={reasonId}
                onChange={(e) => setReasonId(e.target.value)}
                style={inputStyle}
              >
                {reasons.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label
                htmlFor="archive-detail"
                style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}
              >
                Detail (optional)
              </label>
              <textarea
                id="archive-detail"
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Any context worth capturing"
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </div>
          </>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
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
            onClick={() => void handleSubmit()}
            disabled={saving || loading || reasons.length === 0}
            style={{
              padding: "10px 20px",
              borderRadius: 6,
              border: "none",
              background: "var(--color-teal, #005B61)",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 600,
              minHeight: 44,
              opacity: saving || loading || reasons.length === 0 ? 0.6 : 1
            }}
          >
            {saving ? "Archiving..." : "Archive"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 4,
  border: "1px solid #ccc",
  boxSizing: "border-box"
};
