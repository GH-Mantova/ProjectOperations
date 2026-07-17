import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";

// D365-parity per-record change history ("who changed what, when"). Any
// detail page can drop this in as a tab or panel; it reads the platform
// AuditLog via GET /audit-logs/entity/:entityType/:entityId. Permission
// gating (only viewers of the underlying record see entries) is enforced
// server-side by AuditController.listForRecord — this component simply
// surfaces the result.
//
// Named data-history-tab so the QA sweep for a "history tab" surfacing
// AuditLog can locate the component; also exported as a stable id.

export type RecordHistoryEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: string;
  actor?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
};

type Props = {
  entityType: string;
  entityId: string;
};

function formatActor(actor: RecordHistoryEntry["actor"]): string {
  if (!actor) return "System";
  const name = `${actor.firstName ?? ""} ${actor.lastName ?? ""}`.trim();
  return name || actor.email;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

// Best-effort field-change extractor. Different services write different
// metadata shapes — a `changed` map of {from,to}, an array of field
// names, or a bare object. We render whatever we can recognise, and fall
// back to a JSON dump so nothing is silently swallowed.
function renderMetadata(metadata: unknown): ReactElement | null {
  if (!metadata || typeof metadata !== "object") return null;
  const md = metadata as Record<string, unknown>;

  if (md.changed && typeof md.changed === "object" && !Array.isArray(md.changed)) {
    const changed = md.changed as Record<string, { from?: unknown; to?: unknown } | unknown>;
    const rows = Object.entries(changed).map(([field, val]) => {
      if (val && typeof val === "object" && ("from" in (val as object) || "to" in (val as object))) {
        const pair = val as { from?: unknown; to?: unknown };
        return (
          <li key={field}>
            <strong>{field}:</strong>{" "}
            <span style={{ color: "var(--text-muted, #6b7280)" }}>
              {String(pair.from ?? "—")}
            </span>
            <span style={{ margin: "0 6px" }}>→</span>
            <span>{String(pair.to ?? "—")}</span>
          </li>
        );
      }
      return (
        <li key={field}>
          <strong>{field}</strong>
        </li>
      );
    });
    return <ul style={{ margin: "4px 0 0 18px", padding: 0, fontSize: 12 }}>{rows}</ul>;
  }

  if (Array.isArray(md.changed)) {
    return (
      <div style={{ fontSize: 12, color: "var(--text-muted, #6b7280)", marginTop: 4 }}>
        Changed: {md.changed.join(", ")}
      </div>
    );
  }

  const keys = Object.keys(md);
  if (!keys.length) return null;
  return (
    <div style={{ fontSize: 12, color: "var(--text-muted, #6b7280)", marginTop: 4 }}>
      {keys.map((k) => (
        <span key={k} style={{ marginRight: 12 }}>
          <strong>{k}:</strong> {String(md[k])}
        </span>
      ))}
    </div>
  );
}

export function RecordHistory({ entityType, entityId }: Props) {
  const { authFetch } = useAuth();
  const [entries, setEntries] = useState<RecordHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    authFetch(`/audit-logs/entity/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`)
      .then(async (response) => {
        if (!response.ok) {
          if (response.status === 403) {
            throw new Error("You do not have permission to view this record's history.");
          }
          throw new Error("Could not load history.");
        }
        const body = (await response.json()) as { items: RecordHistoryEntry[] };
        if (!cancelled) setEntries(body.items);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authFetch, entityType, entityId]);

  return (
    <section
      data-history-tab
      data-entity-type={entityType}
      data-entity-id={entityId}
      className="s7-card"
      style={{ padding: 16 }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <h3 className="s7-type-section-heading" style={{ margin: 0 }}>Change history</h3>
        <span style={{ fontSize: 12, color: "var(--text-muted, #6b7280)" }}>
          Newest first — sourced from the platform audit log.
        </span>
      </header>

      {loading ? (
        <p style={{ color: "var(--text-muted, #6b7280)", fontSize: 13 }}>Loading history…</p>
      ) : error ? (
        <p style={{ color: "var(--danger, #b91c1c)", fontSize: 13 }}>{error}</p>
      ) : !entries || entries.length === 0 ? (
        <p style={{ color: "var(--text-muted, #6b7280)", fontSize: 13 }}>
          No change history recorded for this record yet.
        </p>
      ) : (
        <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {entries.map((entry) => (
            <li
              key={entry.id}
              style={{
                padding: "10px 0",
                borderBottom: "1px solid var(--border, #e5e7eb)",
                fontSize: 13
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <strong>{entry.action}</strong>
                  <span style={{ color: "var(--text-muted, #6b7280)", marginLeft: 8 }}>
                    by {formatActor(entry.actor)}
                  </span>
                </div>
                <time style={{ color: "var(--text-muted, #6b7280)", whiteSpace: "nowrap" }}>
                  {formatWhen(entry.createdAt)}
                </time>
              </div>
              {renderMetadata(entry.metadata)}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
