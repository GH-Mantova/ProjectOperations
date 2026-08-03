export type MasterDataTab = "sites";

export type MasterDataTabResolution =
  | { kind: "tab"; tab: MasterDataTab }
  | { kind: "redirect"; to: string };

const WORKERS_REDIRECT_PATH = "/workers";
const DIRECTORY_CLIENTS_PATH = "/directory";

// The unified Directory (/directory) is canonical for Clients (Marco 2026-08-03).
// Only ?tab=sites still renders the master-data workspace — the Sites
// slide-over enforces AU-postcode validation the /sites SiteFormModal lacks
// (follow-up: port validation, then delete this shim). Everything else — no
// tab, ?tab=clients, unknown values — redirects to /directory?tab=clients.
// Legacy ?tab=workers redirects to /workers (the standalone /resources page was
// retired in PR #844/#845; workers now live at /workers with tabbed sub-views).
export function resolveMasterDataTab(
  searchParams: URLSearchParams
): MasterDataTabResolution {
  const rawTab = searchParams.get("tab");

  if (rawTab === "workers") {
    const next = new URLSearchParams(searchParams);
    next.delete("tab");
    const query = next.toString();
    return {
      kind: "redirect",
      to: query ? `${WORKERS_REDIRECT_PATH}?${query}` : WORKERS_REDIRECT_PATH
    };
  }

  if (rawTab === "sites") return { kind: "tab", tab: "sites" };

  const next = new URLSearchParams();
  next.set("tab", "clients");
  for (const [key, value] of searchParams) {
    if (key !== "tab") next.append(key, value);
  }
  return { kind: "redirect", to: `${DIRECTORY_CLIENTS_PATH}?${next.toString()}` };
}
