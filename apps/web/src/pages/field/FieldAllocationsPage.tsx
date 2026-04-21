import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

type SiteAddress = {
  line1: string;
  line2: string | null;
  suburb: string;
  state: string;
  postcode: string;
};

type Allocation = {
  id: string;
  projectId: string;
  projectNumber: string;
  projectName: string;
  projectStatus: string;
  siteAddress: SiteAddress;
  roleOnProject: string | null;
  startDate: string;
  endDate: string | null;
  scopeCodes: string[];
  projectManager: { id: string; name: string; phone: string | null } | null;
};

const STATUS_COLOUR: Record<string, { bg: string; fg: string; label: string }> = {
  MOBILISING: { bg: "#F1EFE8", fg: "#444441", label: "Mobilising" },
  ACTIVE: { bg: "color-mix(in srgb, #005B61 15%, transparent)", fg: "#005B61", label: "Active" }
};

function formatAddress(a: SiteAddress): string {
  return [a.line1, a.line2, `${a.suburb} ${a.state} ${a.postcode}`.trim()]
    .filter(Boolean)
    .join(", ");
}

function formatDate(iso: string | null): string {
  if (!iso) return "Ongoing";
  return new Date(iso).toLocaleDateString();
}

export function FieldAllocationsPage() {
  const { authFetch } = useAuth();
  const [allocations, setAllocations] = useState<Allocation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await authFetch("/field/my-allocations");
        if (!response.ok) throw new Error(await response.text());
        const data = (await response.json()) as Allocation[];
        if (!cancelled) setAllocations(data);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  if (error) {
    return (
      <div className="field-card" role="alert" style={{ color: "#A32D2D" }}>
        {error}
      </div>
    );
  }

  if (!allocations) {
    return (
      <div>
        <Skeleton width="100%" height={120} />
        <Skeleton width="100%" height={120} style={{ marginTop: 12 }} />
      </div>
    );
  }

  if (allocations.length === 0) {
    return (
      <div className="field-card">
        <EmptyState
          heading="No active job allocations"
          subtext="You have no active job allocations. Contact your office if this is incorrect."
        />
      </div>
    );
  }

  return (
    <div>
      {allocations.map((a) => {
        const stage = STATUS_COLOUR[a.projectStatus] ?? STATUS_COLOUR.ACTIVE;
        const fullAddress = formatAddress(a.siteAddress);
        const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`;
        return (
          <article key={a.id} className="field-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ margin: 0, fontSize: 12, color: "#6B7280" }}>{a.projectNumber}</p>
                <h2 style={{ margin: "2px 0 0", fontSize: 20, fontFamily: "Syne, Outfit, sans-serif", fontWeight: 700 }}>
                  {a.projectName}
                </h2>
              </div>
              <span className="field-pill" style={{ background: stage.bg, color: stage.fg }}>
                {stage.label}
              </span>
            </div>

            <p style={{ margin: "8px 0 4px", fontSize: 13 }}>
              <a href={mapsUrl} target="_blank" rel="noreferrer" style={{ color: "#005B61" }}>
                📍 {fullAddress}
              </a>
            </p>

            {a.roleOnProject ? (
              <p style={{ margin: "4px 0", fontSize: 13, color: "#374151" }}>
                Role: <strong>{a.roleOnProject}</strong>
              </p>
            ) : null}
            <p style={{ margin: "4px 0", fontSize: 13, color: "#374151" }}>
              {formatDate(a.startDate)} – {formatDate(a.endDate)}
            </p>

            {a.scopeCodes.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {a.scopeCodes.map((code) => (
                  <span
                    key={code}
                    className="field-pill"
                    style={{ background: "color-mix(in srgb, #005B61 15%, transparent)", color: "#005B61" }}
                  >
                    {code}
                  </span>
                ))}
              </div>
            ) : null}

            {a.projectManager ? (
              <div style={{ marginTop: 12, padding: "8px 12px", background: "#F1EFE8", borderRadius: 6 }}>
                <p style={{ margin: 0, fontSize: 12, color: "#6B7280" }}>Project Manager</p>
                <p style={{ margin: "2px 0 0", fontSize: 14 }}>
                  <strong>{a.projectManager.name}</strong>
                  {a.projectManager.phone ? (
                    <>
                      {" · "}
                      <a href={`tel:${a.projectManager.phone}`} style={{ color: "#005B61" }}>
                        {a.projectManager.phone}
                      </a>
                    </>
                  ) : null}
                </p>
              </div>
            ) : null}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
              <Link
                to={`/field/pre-start?allocationId=${a.id}`}
                className="field-btn"
                style={{ textAlign: "center", textDecoration: "none", display: "inline-block", lineHeight: "20px" }}
              >
                Pre-Start
              </Link>
              <Link
                to={`/field/timesheet?allocationId=${a.id}`}
                className="field-btn"
                style={{ textAlign: "center", textDecoration: "none", display: "inline-block", lineHeight: "20px" }}
              >
                Timesheet
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
