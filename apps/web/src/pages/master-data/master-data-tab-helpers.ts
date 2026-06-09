export type MasterDataTab = "clients" | "sites";

export type MasterDataTabResolution =
  | { kind: "tab"; tab: MasterDataTab }
  | { kind: "redirect"; to: string };

const WORKERS_REDIRECT_PATH = "/resources";

// `?tab=workers` is a legacy deep-link — workers actually live at /resources
// (the master-data tab strip already links there). Redirect rather than silently
// rewrite the URL, so external links remain meaningful.
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
  return { kind: "tab", tab: "clients" };
}
