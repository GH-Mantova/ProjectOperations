import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

type WorkerCompetency = {
  id: string;
  competencyId: string;
  achievedAt?: string | null;
  expiresAt?: string | null;
  competency: { id: string; name: string; code?: string | null };
};

type AvailabilityWindow = {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  notes?: string | null;
};

type Worker = {
  id: string;
  employeeCode?: string | null;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  status: string;
  resourceType?: { id: string; name: string } | null;
  competencies: WorkerCompetency[];
  availabilityWindows: AvailabilityWindow[];
};

type WorkersResponse = {
  items: Worker[];
  total: number;
  page: number;
  pageSize: number;
};

function initials(firstName?: string, lastName?: string): string {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "??";
}

function availabilityStatus(worker: Worker): "ok" | "leave" {
  const now = new Date();
  const onLeave = worker.availabilityWindows.some((w) => {
    const start = new Date(w.startAt);
    const end = new Date(w.endAt);
    return w.status === "UNAVAILABLE" && start <= now && now <= end;
  });
  if (worker.status === "ON_LEAVE" || onLeave) return "leave";
  return "ok";
}

export function WorkersListPage() {
  const { authFetch } = useAuth();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [availFilter, setAvailFilter] = useState<"" | "ok" | "leave">("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await authFetch("/resources/workers?page=1&pageSize=200");
        if (!response.ok) throw new Error("Could not load workers.");
        const data = (await response.json()) as WorkersResponse;
        if (!cancelled) setWorkers(data.items);
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

  const roles = useMemo(() => {
    const seen = new Map<string, string>();
    for (const worker of workers) {
      const name = worker.resourceType?.name;
      if (name && !seen.has(name)) seen.set(name, name);
    }
    return Array.from(seen.values()).sort();
  }, [workers]);

  const filtered = useMemo(() => {
    return workers.filter((worker) => {
      if (roleFilter && worker.resourceType?.name !== roleFilter) return false;
      if (availFilter) {
        const status = availabilityStatus(worker);
        if (status !== availFilter) return false;
      }
      if (search) {
        const needle = search.toLowerCase();
        const hay = [worker.firstName, worker.lastName, worker.employeeCode ?? "", worker.resourceType?.name ?? ""]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [workers, search, roleFilter, availFilter]);

  return (
    <div className="workers-page">
      <header className="workers-page__header">
        <div>
          <p className="s7-type-label">Resources</p>
          <h1 className="s7-type-page-title" style={{ margin: "4px 0 0" }}>Workers</h1>
        </div>
      </header>

      {error ? <div className="tender-page__error" role="alert">{error}</div> : null}

      <div className="workers-page__filters">
        <input
          className="s7-input"
          placeholder="Search name, code, role"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select className="s7-select" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
          <option value="">All roles</option>
          {roles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <select
          className="s7-select"
          value={availFilter}
          onChange={(event) => setAvailFilter(event.target.value as "" | "ok" | "leave")}
        >
          <option value="">All availability</option>
          <option value="ok">Available</option>
          <option value="leave">On leave</option>
        </select>
      </div>

      <section className="workers-grid">
        {loading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <div key={`worker-skel-${index}`} className="s7-card workers-card">
              <Skeleton width={48} height={48} radius={999} />
              <Skeleton width="60%" height={14} style={{ marginTop: 8 }} />
              <Skeleton width="40%" height={12} style={{ marginTop: 8 }} />
              <Skeleton width="100%" height={22} style={{ marginTop: 12 }} />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <EmptyState heading="No workers match your filters" subtext="Adjust the filters above or seed more workers." />
        ) : (
          filtered.map((worker) => {
            const avail = availabilityStatus(worker);
            return (
              <Link key={worker.id} to={`/resources/${worker.id}`} className="workers-card">
                <div className="workers-card__head">
                  <span className="workers-card__avatar">{initials(worker.firstName, worker.lastName)}</span>
                  <span
                    className={`sched-resource__dot sched-resource__dot--${avail}`}
                    title={avail === "leave" ? "On leave" : "Available"}
                    aria-hidden
                  />
                </div>
                <h3 className="workers-card__name">{worker.firstName} {worker.lastName}</h3>
                <p className="workers-card__role">
                  {worker.resourceType?.name ?? "Unassigned role"}
                  {worker.employeeCode ? ` · ${worker.employeeCode}` : ""}
                </p>
                <div className="workers-card__pills">
                  {worker.competencies.slice(0, 4).map((wc) => (
                    <span key={wc.id} className="s7-badge s7-badge--neutral">
                      {wc.competency.code ?? wc.competency.name}
                    </span>
                  ))}
                  {worker.competencies.length > 4 ? (
                    <span className="workers-card__more">+{worker.competencies.length - 4}</span>
                  ) : null}
                </div>
              </Link>
            );
          })
        )}
      </section>
    </div>
  );
}
