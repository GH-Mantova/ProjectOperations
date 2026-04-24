import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

type Tab = "clients" | "sites" | "workers";

type Client = {
  id: string;
  name: string;
  code?: string | null;
  status: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  contacts?: Array<{ id: string; firstName: string; lastName: string; isPrimary: boolean }>;
};

type Site = {
  id: string;
  name: string;
  code?: string | null;
  clientId?: string | null;
  addressLine1?: string | null;
  suburb?: string | null;
  state?: string | null;
  postcode?: string | null;
  notes?: string | null;
  client?: { id: string; name: string } | null;
};

type ListResponse<T> = { items: T[]; total: number };

const STATUS_CLASS: Record<string, string> = {
  ACTIVE: "s7-badge s7-badge--active",
  INACTIVE: "s7-badge s7-badge--neutral",
  ARCHIVED: "s7-badge s7-badge--warning"
};

export function MasterDataWorkspacePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { authFetch } = useAuth();
  const initialTab = (searchParams.get("tab") as Tab | null) ?? "clients";
  const [tab, setTab] = useState<Tab>(initialTab === "workers" ? "clients" : initialTab);

  useEffect(() => {
    if (tab !== searchParams.get("tab")) {
      const next = new URLSearchParams(searchParams);
      next.set("tab", tab);
      setSearchParams(next, { replace: true });
    }
  }, [tab, searchParams, setSearchParams]);

  return (
    <div className="mdata-page">
      <header className="workers-page__header">
        <div>
          <p className="s7-type-label">Data</p>
          <h1 className="s7-type-page-title" style={{ margin: "4px 0 0" }}>Master data</h1>
        </div>
        <div className="tender-page__view-toggle" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "clients"}
            className={tab === "clients" ? "tender-page__view-btn tender-page__view-btn--active" : "tender-page__view-btn"}
            onClick={() => setTab("clients")}
          >
            Clients
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "sites"}
            className={tab === "sites" ? "tender-page__view-btn tender-page__view-btn--active" : "tender-page__view-btn"}
            onClick={() => setTab("sites")}
          >
            Sites
          </button>
          <Link
            to="/resources"
            className="tender-page__view-btn"
            role="tab"
            aria-selected={false}
            title="Workers live in the Resources workspace"
          >
            Workers →
          </Link>
        </div>
      </header>

      {tab === "clients" ? <ClientsTab authFetch={authFetch} /> : null}
      {tab === "sites" ? <SitesTab authFetch={authFetch} /> : null}
    </div>
  );
}

type View = "cards" | "table";

type AuthFetch = ReturnType<typeof useAuth>["authFetch"];

function ClientsTab({ authFetch }: { authFetch: AuthFetch }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("cards");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch("/master-data/clients?page=1&pageSize=100");
      if (!response.ok) throw new Error("Could not load clients.");
      const data = (await response.json()) as ListResponse<Client>;
      setClients(data.items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [authFetch]);

  const filtered = useMemo(() => {
    return clients.filter((client) => {
      if (statusFilter && client.status !== statusFilter) return false;
      if (search) {
        const needle = search.toLowerCase();
        const hay = [client.name, client.code ?? "", client.email ?? "", client.phone ?? "", client.notes ?? ""]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [clients, search, statusFilter]);

  return (
    <section className="mdata-section">
      {error ? <div className="tender-page__error" role="alert">{error}</div> : null}

      <div className="mdata-toolbar">
        <div className="mdata-toolbar__filters">
          <input
            className="s7-input"
            placeholder="Search name, code, email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select className="s7-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
        <div className="mdata-toolbar__actions">
          <div className="tender-page__view-toggle" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={view === "cards"}
              className={view === "cards" ? "tender-page__view-btn tender-page__view-btn--active" : "tender-page__view-btn"}
              onClick={() => setView("cards")}
            >
              Cards
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "table"}
              className={view === "table" ? "tender-page__view-btn tender-page__view-btn--active" : "tender-page__view-btn"}
              onClick={() => setView("table")}
            >
              Table
            </button>
          </div>
          <button type="button" className="s7-btn s7-btn--primary" onClick={() => setNewOpen(true)}>
            + New client
          </button>
        </div>
      </div>

      {loading ? (
        <div className="assets-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={`c-skel-${i}`} className="s7-card">
              <Skeleton width="60%" height={16} />
              <Skeleton width="40%" height={12} style={{ marginTop: 8 }} />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          heading="No clients match your filters"
          subtext="Adjust filters or add a new client."
          action={<button type="button" className="s7-btn s7-btn--primary" onClick={() => setNewOpen(true)}>+ New client</button>}
        />
      ) : view === "cards" ? (
        <div className="assets-grid">
          {filtered.map((client) => (
            <button key={client.id} type="button" className="mdata-card" onClick={() => setEditing(client)}>
              <div className="jobs-card__head">
                <span className="jobs-card__number">{client.code ?? "—"}</span>
                <span className={STATUS_CLASS[client.status] ?? "s7-badge s7-badge--neutral"}>{client.status}</span>
              </div>
              <h3 className="jobs-card__title">{client.name}</h3>
              <p className="jobs-card__meta">
                {client.email ?? "No email"}{client.phone ? ` · ${client.phone}` : ""}
              </p>
              {client.notes ? <p className="mdata-card__notes">{client.notes}</p> : null}
            </button>
          ))}
        </div>
      ) : (
        <div className="s7-table-scroll">
          <table className="s7-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((client) => (
                <tr
                  key={client.id}
                  className="s7-table__row--clickable"
                  onClick={() => setEditing(client)}
                >
                  <td>{client.code ?? "—"}</td>
                  <td><strong>{client.name}</strong></td>
                  <td>{client.email ?? "—"}</td>
                  <td>{client.phone ?? "—"}</td>
                  <td><span className={STATUS_CLASS[client.status] ?? "s7-badge s7-badge--neutral"}>{client.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {newOpen || editing ? (
        <ClientSlideOver
          existing={editing}
          onClose={() => {
            setNewOpen(false);
            setEditing(null);
          }}
          onSaved={() => {
            setNewOpen(false);
            setEditing(null);
            void reload();
          }}
        />
      ) : null}
    </section>
  );
}

function SitesTab({ authFetch }: { authFetch: AuthFetch }) {
  const [sites, setSites] = useState<Site[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("cards");
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [editing, setEditing] = useState<Site | null>(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sitesRes, clientsRes] = await Promise.all([
        authFetch("/master-data/sites?page=1&pageSize=100"),
        authFetch("/master-data/clients?page=1&pageSize=100")
      ]);
      if (!sitesRes.ok) throw new Error("Could not load sites.");
      const data = (await sitesRes.json()) as ListResponse<Site>;
      setSites(data.items);
      if (clientsRes.ok) {
        const cd = (await clientsRes.json()) as ListResponse<Client>;
        setClients(cd.items);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [authFetch]);

  const states = useMemo(() => Array.from(new Set(sites.map((s) => s.state).filter(Boolean) as string[])).sort(), [sites]);

  const filtered = useMemo(() => {
    return sites.filter((site) => {
      if (clientFilter && site.clientId !== clientFilter) return false;
      if (stateFilter && site.state !== stateFilter) return false;
      if (search) {
        const needle = search.toLowerCase();
        const hay = [site.name, site.code ?? "", site.addressLine1 ?? "", site.suburb ?? "", site.postcode ?? "", site.client?.name ?? ""]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [sites, search, clientFilter, stateFilter]);

  return (
    <section className="mdata-section">
      {error ? <div className="tender-page__error" role="alert">{error}</div> : null}

      <div className="mdata-toolbar">
        <div className="mdata-toolbar__filters">
          <input
            className="s7-input"
            placeholder="Search name, code, address, suburb"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select className="s7-select" value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}>
            <option value="">All clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="s7-select" value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
            <option value="">All states</option>
            {states.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="mdata-toolbar__actions">
          <div className="tender-page__view-toggle" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={view === "cards"}
              className={view === "cards" ? "tender-page__view-btn tender-page__view-btn--active" : "tender-page__view-btn"}
              onClick={() => setView("cards")}
            >
              Cards
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "table"}
              className={view === "table" ? "tender-page__view-btn tender-page__view-btn--active" : "tender-page__view-btn"}
              onClick={() => setView("table")}
            >
              Table
            </button>
          </div>
          <button type="button" className="s7-btn s7-btn--primary" onClick={() => setNewOpen(true)}>
            + New site
          </button>
        </div>
      </div>

      {loading ? (
        <div className="assets-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={`s-skel-${i}`} className="s7-card">
              <Skeleton width="60%" height={16} />
              <Skeleton width="40%" height={12} style={{ marginTop: 8 }} />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          heading="No sites match your filters"
          subtext="Adjust filters or add a new site."
          action={<button type="button" className="s7-btn s7-btn--primary" onClick={() => setNewOpen(true)}>+ New site</button>}
        />
      ) : view === "cards" ? (
        <div className="assets-grid">
          {filtered.map((site) => (
            <button key={site.id} type="button" className="mdata-card" onClick={() => setEditing(site)}>
              <div className="jobs-card__head">
                <span className="jobs-card__number">{site.code ?? "—"}</span>
                {site.state ? <span className="s7-badge s7-badge--neutral">{site.state}</span> : null}
              </div>
              <h3 className="jobs-card__title">{site.name}</h3>
              <p className="jobs-card__meta">
                {site.addressLine1 ?? ""}
                {site.suburb ? `${site.addressLine1 ? ", " : ""}${site.suburb}` : ""}
                {site.postcode ? ` ${site.postcode}` : ""}
              </p>
              <p className="jobs-card__meta">{site.client?.name ?? "Unassigned client"}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="s7-table-scroll">
          <table className="s7-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Client</th>
                <th>Address</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((site) => (
                <tr key={site.id} className="s7-table__row--clickable" onClick={() => setEditing(site)}>
                  <td>{site.code ?? "—"}</td>
                  <td><strong>{site.name}</strong></td>
                  <td>{site.client?.name ?? "—"}</td>
                  <td>{site.addressLine1 ?? "—"}{site.suburb ? `, ${site.suburb}` : ""}</td>
                  <td>{site.state ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {newOpen || editing ? (
        <SiteSlideOver
          existing={editing}
          clients={clients}
          onClose={() => {
            setNewOpen(false);
            setEditing(null);
          }}
          onSaved={() => {
            setNewOpen(false);
            setEditing(null);
            void reload();
          }}
        />
      ) : null}
    </section>
  );
}

type ClientFormState = {
  name: string;
  code: string;
  status: string;
  email: string;
  phone: string;
  notes: string;
  claimCutoffDay: string;
  claimCutoffContactId: string;
};

type ClientContactOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  position: string | null;
};

function ordinalSuffix(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

type ClientSlideOverProps = {
  existing: Client | null;
  onClose: () => void;
  onSaved: () => void;
};

function ClientSlideOver({ existing, onClose, onSaved }: ClientSlideOverProps) {
  const { authFetch } = useAuth();
  const [form, setForm] = useState<ClientFormState>({
    name: existing?.name ?? "",
    code: existing?.code ?? "",
    status: existing?.status ?? "ACTIVE",
    email: existing?.email ?? "",
    phone: existing?.phone ?? "",
    notes: existing?.notes ?? "",
    claimCutoffDay:
      (existing as unknown as { claimCutoffDay?: number | null } | null)?.claimCutoffDay?.toString() ?? "",
    claimCutoffContactId:
      (existing as unknown as { claimCutoffContactId?: string | null } | null)?.claimCutoffContactId ?? ""
  });
  const [contactOptions, setContactOptions] = useState<ClientContactOption[]>([]);
  useEffect(() => {
    if (!existing?.id) return;
    let cancelled = false;
    void authFetch(`/master-data/contacts?clientId=${existing.id}&pageSize=50`).then(async (r) => {
      if (!r.ok || cancelled) return;
      const body = (await r.json()) as { items?: ClientContactOption[] };
      if (!cancelled) setContactOptions(body.items ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [authFetch, existing?.id]);
  const [errors, setErrors] = useState<Partial<Record<keyof ClientFormState | "form", string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = "Required";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Invalid email";
    if (form.claimCutoffDay.trim() !== "") {
      const raw = form.claimCutoffDay.trim();
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1 || n > 28) {
        next.claimCutoffDay = "Enter a day between 1 and 28";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const cutoffDay = form.claimCutoffDay.trim() === "" ? null : parseInt(form.claimCutoffDay, 10);
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        status: form.status,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        notes: form.notes.trim() || undefined,
        claimCutoffDay: Number.isNaN(cutoffDay as number) ? null : cutoffDay,
        claimCutoffContactId: form.claimCutoffContactId || null
      };
      const response = await authFetch(existing ? `/master-data/clients/${existing.id}` : "/master-data/clients", {
        method: existing ? "PATCH" : "POST",
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message ?? "Save failed.");
      }
      onSaved();
    } catch (err) {
      setErrors({ form: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="slide-over-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div ref={panelRef} className="slide-over" onClick={(event) => event.stopPropagation()}>
        <header className="slide-over__header">
          <div>
            <h2 className="s7-type-section-heading" style={{ margin: 0 }}>
              {existing ? `Edit · ${existing.name}` : "New client"}
            </h2>
            <p className="slide-over__subtitle">Client details, contacts, and commercial notes.</p>
          </div>
          <button type="button" className="slide-over__close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </header>
        <form onSubmit={submit} className="slide-over__body mdata-form">
          {errors.form ? <div className="login-card__error" role="alert">{errors.form}</div> : null}

          <fieldset className="mdata-fieldset">
            <legend>Identification</legend>
            <label className="tender-form__field">
              <span className="s7-type-label">Name *</span>
              <input className="s7-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              {errors.name ? <span className="mdata-field-error">{errors.name}</span> : null}
            </label>
            <label className="tender-form__field">
              <span className="s7-type-label">Code</span>
              <input className="s7-input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. QTI" />
            </label>
            <label className="tender-form__field">
              <span className="s7-type-label">Status</span>
              <select className="s7-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </label>
          </fieldset>

          <fieldset className="mdata-fieldset">
            <legend>Contact</legend>
            <label className="tender-form__field">
              <span className="s7-type-label">Email</span>
              <input className="s7-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              {errors.email ? <span className="mdata-field-error">{errors.email}</span> : null}
            </label>
            <label className="tender-form__field">
              <span className="s7-type-label">Phone</span>
              <input className="s7-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
          </fieldset>

          <fieldset className="mdata-fieldset">
            <legend>Notes</legend>
            <label className="tender-form__field">
              <span className="s7-type-label">Commercial notes</span>
              <textarea className="s7-textarea" rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
          </fieldset>

          <fieldset className="mdata-fieldset">
            <legend>Progress claims</legend>
            <label className="tender-form__field">
              <span className="s7-type-label">Monthly claim cut-off</span>
              <input
                className="s7-input"
                type="number"
                min={1}
                max={28}
                step={1}
                placeholder="Not set"
                value={form.claimCutoffDay}
                onChange={(e) => setForm({ ...form, claimCutoffDay: e.target.value })}
                style={{ maxWidth: 120 }}
              />
              {errors.claimCutoffDay ? (
                <span className="mdata-field-error">{errors.claimCutoffDay}</span>
              ) : null}
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {form.claimCutoffDay &&
                Number.isInteger(Number(form.claimCutoffDay)) &&
                Number(form.claimCutoffDay) >= 1 &&
                Number(form.claimCutoffDay) <= 28
                  ? `Progress claims for this client are due by the ${ordinalSuffix(Number(form.claimCutoffDay))} of each month (enter day 1–28).`
                  : "Progress claims for this client are due by the Nth of each month (enter day 1–28)."}
              </span>
            </label>
            <label className="tender-form__field">
              <span className="s7-type-label">Reminder contact</span>
              <select
                className="s7-input"
                value={form.claimCutoffContactId}
                onChange={(e) => setForm({ ...form, claimCutoffContactId: e.target.value })}
                disabled={contactOptions.length === 0}
              >
                <option value="">— none —</option>
                {contactOptions.map((c) => {
                  const suffix = c.position ? ` · ${c.position}` : c.email ? ` · ${c.email}` : "";
                  return (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}{suffix}
                    </option>
                  );
                })}
              </select>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Receives a 7-day advance email reminder before each cut-off date.
                {contactOptions.length === 0 && existing
                  ? " Add a contact under the Contacts tab first."
                  : ""}
              </span>
            </label>
          </fieldset>

          <footer className="slide-over__footer mdata-footer">
            <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="s7-btn s7-btn--primary" disabled={submitting}>
              {submitting ? "Saving…" : existing ? "Save changes" : "Create client"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

type SiteFormState = {
  name: string;
  code: string;
  clientId: string;
  addressLine1: string;
  suburb: string;
  state: string;
  postcode: string;
  notes: string;
};

type SiteSlideOverProps = {
  existing: Site | null;
  clients: Client[];
  onClose: () => void;
  onSaved: () => void;
};

function SiteSlideOver({ existing, clients, onClose, onSaved }: SiteSlideOverProps) {
  const { authFetch } = useAuth();
  const [form, setForm] = useState<SiteFormState>({
    name: existing?.name ?? "",
    code: existing?.code ?? "",
    clientId: existing?.clientId ?? "",
    addressLine1: existing?.addressLine1 ?? "",
    suburb: existing?.suburb ?? "",
    state: existing?.state ?? "QLD",
    postcode: existing?.postcode ?? "",
    notes: existing?.notes ?? ""
  });
  const [errors, setErrors] = useState<Partial<Record<keyof SiteFormState | "form", string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = "Required";
    if (form.postcode && !/^\d{4}$/.test(form.postcode)) next.postcode = "4-digit AU postcode";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        clientId: form.clientId || undefined,
        addressLine1: form.addressLine1.trim() || undefined,
        suburb: form.suburb.trim() || undefined,
        state: form.state.trim() || undefined,
        postcode: form.postcode.trim() || undefined,
        notes: form.notes.trim() || undefined
      };
      const response = await authFetch(existing ? `/master-data/sites/${existing.id}` : "/master-data/sites", {
        method: existing ? "PATCH" : "POST",
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message ?? "Save failed.");
      }
      onSaved();
    } catch (err) {
      setErrors({ form: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="slide-over-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div ref={panelRef} className="slide-over" onClick={(event) => event.stopPropagation()}>
        <header className="slide-over__header">
          <div>
            <h2 className="s7-type-section-heading" style={{ margin: 0 }}>
              {existing ? `Edit · ${existing.name}` : "New site"}
            </h2>
            <p className="slide-over__subtitle">Site identification and address.</p>
          </div>
          <button type="button" className="slide-over__close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </header>
        <form onSubmit={submit} className="slide-over__body mdata-form">
          {errors.form ? <div className="login-card__error" role="alert">{errors.form}</div> : null}

          <fieldset className="mdata-fieldset">
            <legend>Identification</legend>
            <label className="tender-form__field">
              <span className="s7-type-label">Name *</span>
              <input className="s7-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              {errors.name ? <span className="mdata-field-error">{errors.name}</span> : null}
            </label>
            <label className="tender-form__field">
              <span className="s7-type-label">Code</span>
              <input className="s7-input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </label>
            <label className="tender-form__field">
              <span className="s7-type-label">Client</span>
              <select className="s7-select" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
                <option value="">Unassigned</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          </fieldset>

          <fieldset className="mdata-fieldset">
            <legend>Address</legend>
            <label className="tender-form__field">
              <span className="s7-type-label">Street</span>
              <input className="s7-input" value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} />
            </label>
            <div className="mdata-grid-three">
              <label className="tender-form__field">
                <span className="s7-type-label">Suburb</span>
                <input className="s7-input" value={form.suburb} onChange={(e) => setForm({ ...form, suburb: e.target.value })} />
              </label>
              <label className="tender-form__field">
                <span className="s7-type-label">State</span>
                <input className="s7-input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
              </label>
              <label className="tender-form__field">
                <span className="s7-type-label">Postcode</span>
                <input className="s7-input" value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} />
                {errors.postcode ? <span className="mdata-field-error">{errors.postcode}</span> : null}
              </label>
            </div>
          </fieldset>

          <fieldset className="mdata-fieldset">
            <legend>Notes</legend>
            <label className="tender-form__field">
              <span className="s7-type-label">Notes</span>
              <textarea className="s7-textarea" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
          </fieldset>

          <footer className="slide-over__footer mdata-footer">
            <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="s7-btn s7-btn--primary" disabled={submitting}>
              {submitting ? "Saving…" : existing ? "Save changes" : "Create site"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
