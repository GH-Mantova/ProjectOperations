import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

type Asset = {
  id: string;
  name: string;
  assetCode: string;
  status: string;
  homeBase?: string | null;
  currentLocation?: string | null;
  category?: { id: string; name: string } | null;
  maintenanceEvents?: Array<{ id: string; status: string; completedAt?: string | null; scheduledAt?: string | null }>;
  maintenancePlans?: Array<{ id: string; nextDueAt?: string | null; lastCompletedAt?: string | null }>;
};

type AssetsResponse = {
  items: Asset[];
  total: number;
  page: number;
  pageSize: number;
};

const STATUS_CLASS: Record<string, string> = {
  AVAILABLE: "s7-badge s7-badge--active",
  IN_USE: "s7-badge s7-badge--info",
  MAINTENANCE: "s7-badge s7-badge--warning",
  OUT_OF_SERVICE: "s7-badge s7-badge--danger"
};

function lastMaintenance(asset: Asset): string {
  const completed = (asset.maintenanceEvents ?? [])
    .filter((event) => event.status === "COMPLETED" && event.completedAt)
    .map((event) => new Date(event.completedAt!).getTime());
  const lastFromPlan = (asset.maintenancePlans ?? [])
    .map((plan) => (plan.lastCompletedAt ? new Date(plan.lastCompletedAt).getTime() : 0))
    .filter((t) => t > 0);
  const all = [...completed, ...lastFromPlan];
  if (all.length === 0) return "—";
  const latest = Math.max(...all);
  return new Date(latest).toLocaleDateString();
}

export function AssetsListPage() {
  const { authFetch } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await authFetch("/assets?page=1&pageSize=200");
        if (!response.ok) throw new Error("Could not load assets.");
        const data = (await response.json()) as AssetsResponse;
        if (!cancelled) setAssets(data.items);
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

  const categories = useMemo(() => {
    const set = new Map<string, string>();
    for (const asset of assets) {
      if (asset.category) set.set(asset.category.id, asset.category.name);
    }
    return Array.from(set.entries()).map(([id, name]) => ({ id, name }));
  }, [assets]);

  const locations = useMemo(() => {
    const set = new Set<string>();
    for (const asset of assets) {
      if (asset.homeBase) set.add(asset.homeBase);
    }
    return Array.from(set).sort();
  }, [assets]);

  const filtered = useMemo(() => {
    return assets.filter((asset) => {
      if (categoryFilter && asset.category?.id !== categoryFilter) return false;
      if (statusFilter && asset.status !== statusFilter) return false;
      if (locationFilter && asset.homeBase !== locationFilter) return false;
      if (search) {
        const needle = search.toLowerCase();
        const hay = [asset.name, asset.assetCode, asset.homeBase ?? "", asset.category?.name ?? ""]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [assets, search, categoryFilter, statusFilter, locationFilter]);

  return (
    <div className="assets-page">
      <header className="workers-page__header">
        <div>
          <p className="s7-type-label">Resources</p>
          <h1 className="s7-type-page-title" style={{ margin: "4px 0 0" }}>Assets</h1>
        </div>
      </header>

      {error ? <div className="tender-page__error" role="alert">{error}</div> : null}

      <div className="jobs-page__filters assets-page__filters">
        <input
          className="s7-input"
          placeholder="Search name, code, or home base"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select className="s7-select" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select className="s7-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">All statuses</option>
          {Object.keys(STATUS_CLASS).map((status) => (
            <option key={status} value={status}>{status.replace(/_/g, " ")}</option>
          ))}
        </select>
        <select className="s7-select" value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}>
          <option value="">All locations</option>
          {locations.map((location) => (
            <option key={location} value={location}>{location}</option>
          ))}
        </select>
      </div>

      <section className="assets-grid">
        {loading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <div key={`asset-skel-${index}`} className="s7-card">
              <Skeleton width="100%" height={120} />
              <Skeleton width="60%" height={14} style={{ marginTop: 10 }} />
              <Skeleton width="40%" height={12} style={{ marginTop: 8 }} />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <EmptyState heading="No assets match your filters" subtext="Adjust the filters above to see the register." />
        ) : (
          filtered.map((asset) => (
            <Link key={asset.id} to={`/assets/${asset.id}`} className="assets-card">
              <div className="assets-card__photo" aria-hidden>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l9 5v10l-9 5-9-5V7z" />
                </svg>
              </div>
              <div className="assets-card__body">
                <h3 className="assets-card__name">{asset.name}</h3>
                <p className="assets-card__meta">{asset.assetCode}</p>
                <div className="assets-card__pills">
                  {asset.category ? (
                    <span className="s7-badge s7-badge--neutral">{asset.category.name}</span>
                  ) : null}
                  <span className={STATUS_CLASS[asset.status] ?? "s7-badge s7-badge--neutral"}>
                    {asset.status.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="assets-card__foot">
                  {asset.homeBase ?? "No home base"} · Last service {lastMaintenance(asset)}
                </p>
              </div>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
