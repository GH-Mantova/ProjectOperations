import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { ContactFormModal, type ContactRecord } from "../../components/contacts/ContactsTab";

type OrgLookup = Map<string, { name: string }>;

const TYPE_COLOURS: Record<string, string> = {
  CLIENT: "#0D9488",       // teal
  SUBCONTRACTOR: "#3B82F6", // blue
  SUPPLIER: "#F97316"       // orange
};

const PAGE_SIZE = 20;

function csvEscape(value: string | null | undefined): string {
  const v = value ?? "";
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function downloadCsv(filename: string, rows: string[][]) {
  const body = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function orgHref(type: string, id: string): string | null {
  if (type === "CLIENT") return `/master-data?tab=clients`;
  if (type === "SUBCONTRACTOR" || type === "SUPPLIER") return `/directory/subcontractors`;
  return null;
}

export function ContactsPage() {
  const { authFetch, user } = useAuth();
  const isAdmin = useMemo(
    () => Boolean(user?.isSuperUser) || Boolean(user?.roles?.some((r) => r.name === "Admin")),
    [user]
  );

  const [items, setItems] = useState<ContactRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgType, setOrgType] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<ContactRecord | null>(null);

  const [clientLookup, setClientLookup] = useState<OrgLookup>(new Map());
  const [subLookup, setSubLookup] = useState<OrgLookup>(new Map());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (orgType) params.set("organisationType", orgType);
      if (search.trim()) params.set("search", search.trim());
      if (activeOnly) params.set("isActive", "true");
      params.set("page", String(page));
      params.set("limit", String(PAGE_SIZE));
      const response = await authFetch(`/contacts?${params.toString()}`);
      if (!response.ok) throw new Error(await response.text());
      const body = (await response.json()) as { items: ContactRecord[]; total: number };
      setItems(body.items);
      setTotal(body.total);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, orgType, search, activeOnly, page]);

  useEffect(() => {
    void load();
  }, [load]);

  // Build org name lookups for CLIENT/SUBCONTRACTOR so we can show linked names.
  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      authFetch("/master-data/clients?page=1&pageSize=200").then((r) => (r.ok ? r.json() : null)),
      authFetch("/directory?status=").then((r) => (r.ok ? r.json() : null))
    ]).then(([cResp, sResp]) => {
      if (cancelled) return;
      const c: OrgLookup = new Map();
      const s: OrgLookup = new Map();
      if (cResp && Array.isArray(cResp.items)) {
        for (const row of cResp.items as Array<{ id: string; name: string }>) {
          c.set(row.id, { name: row.name });
        }
      }
      if (Array.isArray(sResp)) {
        for (const row of sResp as Array<{ id: string; name: string }>) {
          s.set(row.id, { name: row.name });
        }
      }
      setClientLookup(c);
      setSubLookup(s);
    });
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  const lookupOrgName = (type: string, id: string): string => {
    if (type === "CLIENT") return clientLookup.get(id)?.name ?? id;
    return subLookup.get(id)?.name ?? id;
  };

  const exportCsv = () => {
    const header = ["Name", "Organisation", "Type", "Role", "Phone", "Mobile", "Email"];
    const rows = items.map((c) => [
      `${c.firstName} ${c.lastName}`,
      lookupOrgName(c.organisationType, c.organisationId),
      c.organisationType,
      c.role ?? "",
      c.phone ?? "",
      c.mobile ?? "",
      c.email ?? ""
    ]);
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`IS_Contacts_${date}.csv`, [header, ...rows]);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div style={{ padding: 20 }}>
      <header style={{ marginBottom: 16, display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 className="s7-type-page-heading" style={{ margin: 0 }}>Contacts</h1>
          <p style={{ color: "var(--text-muted)", margin: "4px 0 0", fontSize: 13 }}>
            All external contacts across clients, subcontractors and suppliers.
          </p>
        </div>
        <div style={{ marginLeft: "auto" }}>
          {isAdmin ? (
            <button
              type="button"
              className="s7-btn s7-btn--secondary"
              onClick={exportCsv}
              disabled={items.length === 0}
            >
              Export CSV
            </button>
          ) : null}
        </div>
      </header>

      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 12,
          flexWrap: "wrap",
          padding: 10,
          background: "var(--surface-subtle, rgba(0,0,0,0.02))",
          borderRadius: 6,
          alignItems: "center"
        }}
      >
        <input
          className="s7-input s7-input--sm"
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          style={{ minWidth: 240 }}
        />
        <div role="tablist" style={{ display: "flex", gap: 4 }}>
          {[
            { value: "", label: "All" },
            { value: "CLIENT", label: "Clients" },
            { value: "SUBCONTRACTOR", label: "Subcontractors" },
            { value: "SUPPLIER", label: "Suppliers" }
          ].map((opt) => (
            <button
              key={opt.value || "all"}
              type="button"
              className={
                orgType === opt.value
                  ? "s7-btn s7-btn--secondary s7-btn--sm"
                  : "s7-btn s7-btn--ghost s7-btn--sm"
              }
              onClick={() => {
                setOrgType(opt.value);
                setPage(1);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <label style={{ display: "inline-flex", gap: 4, alignItems: "center", fontSize: 13 }}>
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => {
              setActiveOnly(e.target.checked);
              setPage(1);
            }}
          />
          Active only
        </label>
      </div>

      {error ? <p style={{ color: "var(--status-danger)" }}>{error}</p> : null}

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : items.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>
          No contacts found — add contacts from the client or subcontractor detail pages.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "var(--surface-muted, #f6f6f6)" }}>
              <tr>
                {["Name", "Organisation", "Type", "Role", "Phone", "Mobile", "Email", "Primary", ""].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        padding: "6px 8px",
                        textAlign: "left",
                        fontSize: 10,
                        textTransform: "uppercase",
                        color: "var(--text-muted)"
                      }}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((c) => {
                const href = orgHref(c.organisationType, c.organisationId);
                return (
                  <tr
                    key={c.id}
                    onClick={() => setEditing(c)}
                    style={{
                      borderTop: "1px solid var(--border, #e5e7eb)",
                      opacity: c.isActive ? 1 : 0.5,
                      cursor: "pointer"
                    }}
                  >
                    <td style={{ padding: "6px 8px" }}>
                      <strong>{c.firstName} {c.lastName}</strong>
                    </td>
                    <td
                      style={{ padding: "6px 8px", fontSize: 12 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {href ? (
                        <Link to={href}>{lookupOrgName(c.organisationType, c.organisationId)}</Link>
                      ) : (
                        lookupOrgName(c.organisationType, c.organisationId)
                      )}
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <span
                        style={{
                          fontSize: 10,
                          padding: "1px 6px",
                          background: TYPE_COLOURS[c.organisationType] ?? "#6b7280",
                          color: "#fff",
                          borderRadius: 999,
                          textTransform: "uppercase"
                        }}
                      >
                        {c.organisationType}
                      </span>
                    </td>
                    <td style={{ padding: "6px 8px", fontSize: 12 }}>{c.role ?? "—"}</td>
                    <td style={{ padding: "6px 8px", fontSize: 12 }}>{c.phone ?? "—"}</td>
                    <td style={{ padding: "6px 8px", fontSize: 12 }}>{c.mobile ?? "—"}</td>
                    <td style={{ padding: "6px 8px", fontSize: 12 }}>{c.email ?? "—"}</td>
                    <td style={{ padding: "6px 8px", fontSize: 12 }}>
                      {c.isPrimary ? (
                        <span
                          style={{
                            display: "inline-block",
                            width: 8,
                            height: 8,
                            borderRadius: 999,
                            background: "#16a34a"
                          }}
                          aria-label="Primary"
                        />
                      ) : null}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right", fontSize: 11, color: "var(--text-muted)" }}>
                      ✎
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 10,
              fontSize: 12,
              color: "var(--text-muted)"
            }}
          >
            <span>
              Page {page} of {totalPages} · {total} total
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                className="s7-btn s7-btn--ghost s7-btn--sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Prev
              </button>
              <button
                type="button"
                className="s7-btn s7-btn--ghost s7-btn--sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {editing ? (
        <ContactFormModal
          organisationType={editing.organisationType as "CLIENT" | "SUBCONTRACTOR" | "SUPPLIER"}
          organisationId={editing.organisationId}
          existing={editing}
          existingPrimary={null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}
