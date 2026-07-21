import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { useOffline } from "../../offline/OfflineContext";

type FetchError = { status: number; message: string };

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
  const navigate = useNavigate();
  const [allocations, setAllocations] = useState<Allocation[] | null>(null);
  const [error, setError] = useState<FetchError | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await authFetch("/field/my-allocations");
        if (!response.ok) {
          let message = response.statusText;
          try {
            const body = (await response.json()) as { message?: string };
            if (body && typeof body.message === "string") message = body.message;
          } catch {
            // body was not JSON — keep the statusText
          }
          if (!cancelled) setError({ status: response.status, message });
          return;
        }
        const data = (await response.json()) as Allocation[];
        if (!cancelled) setAllocations(data);
      } catch (err) {
        if (!cancelled) setError({ status: 0, message: (err as Error).message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  if (error) {
    if (error.status === 403) {
      return (
        <div className="field-card" role="alert">
          <EmptyState
            icon="🔒"
            heading="Mobile access not provisioned"
            subtext={
              error.message ||
              "Your account isn't linked to a worker profile yet. Contact your office administrator to enable mobile access."
            }
            action={
              <button
                type="button"
                className="field-btn"
                onClick={() => navigate("/")}
              >
                Back to web view
              </button>
            }
          />
        </div>
      );
    }
    return (
      <div className="field-card" role="alert">
        <EmptyState
          icon="⚠️"
          heading="Couldn't load allocations"
          subtext={error.message || "Something went wrong loading your allocations. Pull down to refresh or try again later."}
        />
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
      <SiteSignInCard />
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

// Site sign-in / sign-out. Sits above the allocations list because it is the
// WHS spine: knowing who is on site drives the muster/evacuation view. Uses
// the shared offline outbox so a worker on a site with no signal can still
// sign in — the mutation syncs when connectivity returns.
type AvailableSite = { id: string; name: string; addressLine1: string | null; suburb: string | null; state: string | null };
type CurrentAttendance = { id: string; siteId: string; signedInAt: string; site: { id: string; name: string } };

// Local optimistic-state shape captured while offline so the button reflects
// the intended state before the mutation reaches the server.
type PendingState =
  | { kind: "signed-in"; siteId: string; siteName: string; at: string }
  | { kind: "signed-out" };

function SiteSignInCard() {
  const { authFetch } = useAuth();
  const { offlineFetch, online, flush } = useOffline();
  const [current, setCurrent] = useState<CurrentAttendance | null | undefined>(undefined);
  const [sites, setSites] = useState<AvailableSite[]>([]);
  const [chosenSiteId, setChosenSiteId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingState | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [mineRes, sitesRes] = await Promise.all([
        authFetch("/sites/attendance/mine"),
        authFetch("/sites/attendance/available-sites")
      ]);
      if (mineRes.ok) {
        const body = (await mineRes.json()) as CurrentAttendance | null;
        setCurrent(body);
      }
      if (sitesRes.ok) {
        const list = (await sitesRes.json()) as AvailableSite[];
        setSites(list);
        setChosenSiteId((prev) => prev || list[0]?.id || "");
      }
      // Server round-trip succeeded → the local optimistic marker can go.
      setPending(null);
    } catch {
      // Offline / network hiccup — keep whatever we last knew. The
      // optimistic `pending` marker (if any) covers the UI state.
    }
  }, [authFetch]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // When the browser comes back online the OfflineProvider flushes the
  // outbox automatically; re-pull our own view so state re-syncs.
  useEffect(() => {
    if (online) void refresh();
  }, [online, refresh]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const doSignIn = async () => {
    if (!chosenSiteId || busy) return;
    setBusy(true);
    const site = sites.find((s) => s.id === chosenSiteId);
    try {
      const result = await offlineFetch(
        "/sites/attendance/sign-in",
        { method: "POST", body: { siteId: chosenSiteId } },
        "site-signin"
      );
      if (result.queued) {
        setPending({ kind: "signed-in", siteId: chosenSiteId, siteName: site?.name ?? "site", at: new Date().toISOString() });
        setToast("Signed in offline — will sync when back online.");
      } else if (result.response && result.response.ok) {
        setToast(`Signed in at ${site?.name ?? "site"}.`);
        await refresh();
      } else {
        setToast("Sign-in failed. Try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  const doSignOut = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await offlineFetch(
        "/sites/attendance/sign-out",
        { method: "POST", body: {} },
        "site-signout"
      );
      if (result.queued) {
        setPending({ kind: "signed-out" });
        setToast("Signed out offline — will sync when back online.");
      } else if (result.response && result.response.ok) {
        setToast("Signed out.");
        await refresh();
        void flush();
      } else {
        setToast("Sign-out failed. Try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  // Effective state: server truth, overridden by any pending offline mutation.
  const effectiveSignedIn =
    pending?.kind === "signed-in"
      ? { siteId: pending.siteId, siteName: pending.siteName, at: pending.at, pending: true }
      : pending?.kind === "signed-out"
      ? null
      : current
      ? { siteId: current.siteId, siteName: current.site.name, at: current.signedInAt, pending: false }
      : null;

  if (current === undefined) {
    return (
      <div className="field-card" aria-busy="true">
        <Skeleton width="60%" height={16} />
      </div>
    );
  }

  return (
    <article
      className="field-card"
      style={{
        background: effectiveSignedIn ? "color-mix(in srgb, #005B61 12%, #fff)" : "#fff",
        borderLeft: effectiveSignedIn ? "4px solid #005B61" : "4px solid #FEAA6D"
      }}
    >
      <p style={{ margin: 0, fontSize: 12, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5 }}>
        Site attendance
      </p>
      {effectiveSignedIn ? (
        <>
          <h2 style={{ margin: "4px 0 2px", fontSize: 18, fontFamily: "Syne, Outfit, sans-serif" }}>
            Signed in at <strong>{effectiveSignedIn.siteName}</strong>
          </h2>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "#374151" }}>
            Since {new Date(effectiveSignedIn.at).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
            {effectiveSignedIn.pending ? " · pending sync" : ""}
          </p>
          <button
            type="button"
            className="field-btn field-btn--teal"
            onClick={doSignOut}
            disabled={busy}
            style={{ width: "100%" }}
          >
            {busy ? "Signing out…" : "Sign out of site"}
          </button>
        </>
      ) : (
        <>
          <h2 style={{ margin: "4px 0 8px", fontSize: 18, fontFamily: "Syne, Outfit, sans-serif" }}>
            Not signed in
          </h2>
          {sites.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>
              No sites available. Your allocations decide which sites you can sign in to.
            </p>
          ) : (
            <>
              <label className="field-label" htmlFor="site-signin-picker">Site</label>
              <select
                id="site-signin-picker"
                className="field-input"
                value={chosenSiteId}
                onChange={(e) => setChosenSiteId(e.target.value)}
                style={{ marginBottom: 10 }}
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.suburb ? ` — ${s.suburb}` : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="field-btn"
                onClick={doSignIn}
                disabled={busy || !chosenSiteId}
                style={{ width: "100%" }}
              >
                {busy ? "Signing in…" : "Sign in to site"}
              </button>
            </>
          )}
        </>
      )}
      {toast ? (
        <p role="status" style={{ marginTop: 8, marginBottom: 0, fontSize: 12, color: "#005B61" }}>
          {toast}
        </p>
      ) : null}
    </article>
  );
}
