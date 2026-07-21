import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { ClientsTab } from "../master-data/MasterDataWorkspacePage";
import { SubcontractorsPage } from "./SubcontractorsPage";
import { ContactsPage } from "./ContactsPage";

type Tab = "clients" | "subcontractors" | "contacts";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "clients", label: "Clients" },
  { id: "subcontractors", label: "Subcontractors & Suppliers" },
  { id: "contacts", label: "Contacts" }
];

const VALID: ReadonlySet<Tab> = new Set(TABS.map((t) => t.id));

function resolveTab(raw: string | null): Tab {
  return raw && (VALID as Set<string>).has(raw) ? (raw as Tab) : "clients";
}

/**
 * Unified Directory surface — one page, three tabs (Clients, Subcontractors &
 * Suppliers, Contacts). Replaces the five scattered people/company screens.
 * Each tab reuses the existing component so no data-model or API changes are
 * required. Deep-link via `?tab=clients|subcontractors|contacts`.
 */
export function DirectoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { authFetch } = useAuth();
  const [tab, setTab] = useState<Tab>(resolveTab(searchParams.get("tab")));

  useEffect(() => {
    const current = searchParams.get("tab");
    if (current !== tab) {
      const next = new URLSearchParams(searchParams);
      next.set("tab", tab);
      setSearchParams(next, { replace: true });
    }
  }, [tab, searchParams, setSearchParams]);

  useEffect(() => {
    const fromUrl = resolveTab(searchParams.get("tab"));
    if (fromUrl !== tab) setTab(fromUrl);
  }, [searchParams, tab]);

  const body = useMemo(() => {
    if (tab === "clients") return <ClientsTab authFetch={authFetch} />;
    if (tab === "subcontractors") return <SubcontractorsPage />;
    return <ContactsPage />;
  }, [tab, authFetch]);

  return (
    <div className="mdata-page">
      <header className="workers-page__header">
        <div>
          <p className="s7-type-label">Directory</p>
          <h1 className="s7-type-page-title" style={{ margin: "4px 0 0" }}>Directory</h1>
        </div>
        <div className="tender-page__view-toggle" role="tablist" aria-label="Directory tabs">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              className={
                tab === entry.id
                  ? "tender-page__view-btn tender-page__view-btn--active"
                  : "tender-page__view-btn"
              }
              onClick={() => setTab(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </header>

      {body}
    </div>
  );
}
