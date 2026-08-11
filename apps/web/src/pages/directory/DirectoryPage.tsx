import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { ClientsTab } from "../master-data/MasterDataWorkspacePage";
import { SubcontractorsPage } from "./SubcontractorsPage";
import { ContactsPage } from "./ContactsPage";
import {
  DIRECTORY_TABS,
  type DirectoryTab,
  resolveDirectoryTab,
  withDirectoryTab
} from "./directory-tab-helpers";

/**
 * Unified Directory surface — one page, three tabs (Clients, Subcontractors &
 * Suppliers, Contacts). The URL `?tab=` is the single source of truth for the
 * active tab, so deep-links and browser back/forward stay in sync and the
 * button click never loses to a competing effect.
 */
export function DirectoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { authFetch } = useAuth();
  const tab = resolveDirectoryTab(searchParams.get("tab"));

  const selectTab = (next: DirectoryTab) => {
    if (next === tab) return;
    setSearchParams(withDirectoryTab(searchParams, next), { replace: true });
  };

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
          {DIRECTORY_TABS.map((entry) => (
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
              onClick={() => selectTab(entry.id)}
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
