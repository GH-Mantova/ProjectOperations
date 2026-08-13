import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../auth/AuthContext";
import { can } from "../auth/permissions";
import { NoAccess } from "../components/NoAccess";

// ─── API types (subset mirrors of API DTOs used here) ───────────────────────

type Client = { id: string; name: string; code: string | null };

type JobItem = {
  id: string;
  jobNumber: string;
  name: string;
  status: string;
  client: { id: string; name: string };
};

type TenderItem = {
  id: string;
  tenderNumber: string;
  title: string;
  status: string;
  tenderClients: Array<{ client: { id: string; name: string } }>;
};

type SorPeriodSummary = {
  id: string;
  year: number;
  half: "H1" | "H2";
  label: string;
  status: string;
};

type TargetKind = "job" | "tender";

// ─── Wizard ─────────────────────────────────────────────────────────────────

/**
 * SoR S4 — Attach-to-job wizard.
 *
 * Cascade flow mirroring the new-tender wizard:
 *   1. Pick a client.
 *   2. Choose target kind (live Job or Tender).
 *   3. Pick the specific job/tender belonging to that client.
 *   4. Confirm the SoR period and lock the snapshot.
 *
 * On submit calls POST /schedule-of-rates/job-sor-snapshot/attach and
 * navigates the user back to the target's detail page. Idempotent per
 * (target, sorVersion) so re-running the wizard for an already-attached
 * target simply returns the existing snapshot — no duplicate is created.
 */
export function JobSorAttachWizardPage() {
  const { authFetch, user } = useAuth();
  const canManage = useMemo(() => can(user, "rates.manage"), [user]);
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [targetKind, setTargetKind] = useState<TargetKind>("job");
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [tenders, setTenders] = useState<TenderItem[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");
  const [periods, setPeriods] = useState<SorPeriodSummary[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Step 1: load clients + periods up-front ──────────────────────────────

  useEffect(() => {
    if (!canManage) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [clientsRes, periodsRes] = await Promise.all([
          authFetch("/master-data/clients?page=1&pageSize=200"),
          authFetch("/schedule-of-rates/periods"),
        ]);
        if (!clientsRes.ok) throw new Error("Could not load clients.");
        if (!periodsRes.ok) throw new Error("Could not load SoR periods.");
        const clientsData = await clientsRes.json();
        const periodsData = (await periodsRes.json()) as SorPeriodSummary[];
        if (cancelled) return;
        setClients(
          (clientsData.items ?? []).map((c: Client) => ({
            id: c.id,
            name: c.name,
            code: c.code ?? null,
          })),
        );
        setPeriods(periodsData);
        // Auto-pick the first ACTIVE period so step 4 always has a default.
        const firstActive = periodsData.find((p) => p.status === "ACTIVE");
        if (firstActive) setSelectedPeriodId(firstActive.id);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, canManage]);

  // ── Step 3: load jobs/tenders for the selected client ────────────────────

  const loadTargets = useCallback(async () => {
    if (!selectedClientId) return;
    setLoading(true);
    setError(null);
    try {
      if (targetKind === "job") {
        const res = await authFetch("/jobs?page=1&pageSize=100");
        if (!res.ok) throw new Error("Could not load jobs.");
        const data = await res.json();
        const filtered = ((data.items ?? []) as JobItem[]).filter(
          (j) => j.client?.id === selectedClientId,
        );
        setJobs(filtered);
      } else {
        const res = await authFetch(
          `/tenders?clientId=${selectedClientId}&page=1&pageSize=100`,
        );
        if (!res.ok) throw new Error("Could not load tenders.");
        const data = await res.json();
        setTenders((data.items ?? []) as TenderItem[]);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, selectedClientId, targetKind]);

  useEffect(() => {
    if (step === 3) void loadTargets();
  }, [step, loadTargets]);

  // ── Submit ────────────────────────────────────────────────────────────────

  const submit = useCallback(async () => {
    if (!selectedTargetId || !selectedPeriodId) return;
    setSubmitting(true);
    setError(null);
    try {
      const body =
        targetKind === "job"
          ? { jobId: selectedTargetId, sorPeriodId: selectedPeriodId }
          : { tenderId: selectedTargetId, sorPeriodId: selectedPeriodId };
      const res = await authFetch("/schedule-of-rates/job-sor-snapshot/attach", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      // Route the user back to the target so they can start using it.
      const path =
        targetKind === "job" ? `/jobs/${selectedTargetId}` : `/tenders`;
      navigate(path);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }, [authFetch, navigate, selectedPeriodId, selectedTargetId, targetKind]);

  // ── Guard ────────────────────────────────────────────────────────────────

  if (!canManage) return <NoAccess required="rates.manage" />;

  // ── Render ───────────────────────────────────────────────────────────────

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId);
  const selectedTargetLabel = (() => {
    if (targetKind === "job") {
      const j = jobs.find((x) => x.id === selectedTargetId);
      return j ? `${j.jobNumber} — ${j.name}` : null;
    }
    const t = tenders.find((x) => x.id === selectedTargetId);
    return t ? `${t.tenderNumber} — ${t.title}` : null;
  })();

  return (
    <div className="s7-page">
      <header className="s7-page__header">
        <h1>Attach Schedule of Rates</h1>
        <p className="s7-page__subtitle">
          Lock a rate-book snapshot to a job or tender. The snapshot freezes
          the merged (master + client card) rate book at this moment — future
          variations and progress claims price from the snapshot, not the live
          catalog.
        </p>
      </header>

      <ol className="s7-wizard-steps">
        <li className={step === 1 ? "s7-wizard-steps__item s7-wizard-steps__item--active" : "s7-wizard-steps__item"}>1. Client</li>
        <li className={step === 2 ? "s7-wizard-steps__item s7-wizard-steps__item--active" : "s7-wizard-steps__item"}>2. Target type</li>
        <li className={step === 3 ? "s7-wizard-steps__item s7-wizard-steps__item--active" : "s7-wizard-steps__item"}>3. Job or tender</li>
        <li className={step === 4 ? "s7-wizard-steps__item s7-wizard-steps__item--active" : "s7-wizard-steps__item"}>4. Confirm</li>
      </ol>

      {error && <div className="s7-alert s7-alert--error">{error}</div>}
      {loading && <Skeleton height={120} />}

      {step === 1 && !loading && (
        <section className="s7-panel">
          <h2>Select a client</h2>
          {clients.length === 0 ? (
            <EmptyState heading="No clients" subtext="Create a client first." />
          ) : (
            <select
              className="s7-select"
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
            >
              <option value="">— pick a client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.code ? ` (${c.code})` : ""}
                </option>
              ))}
            </select>
          )}
          <div className="s7-wizard-actions">
            <button
              type="button"
              className="s7-btn s7-btn--primary"
              disabled={!selectedClientId}
              onClick={() => setStep(2)}
            >
              Next
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="s7-panel">
          <h2>Target type</h2>
          <p>Attach the SoR snapshot to a live job or a tender.</p>
          <label className="s7-radio">
            <input
              type="radio"
              name="target-kind"
              checked={targetKind === "job"}
              onChange={() => setTargetKind("job")}
            />
            Live job
          </label>
          <label className="s7-radio">
            <input
              type="radio"
              name="target-kind"
              checked={targetKind === "tender"}
              onChange={() => setTargetKind("tender")}
            />
            Tender
          </label>
          <div className="s7-wizard-actions">
            <button type="button" className="s7-btn" onClick={() => setStep(1)}>
              Back
            </button>
            <button
              type="button"
              className="s7-btn s7-btn--primary"
              onClick={() => {
                setSelectedTargetId("");
                setStep(3);
              }}
            >
              Next
            </button>
          </div>
        </section>
      )}

      {step === 3 && !loading && (
        <section className="s7-panel">
          <h2>Pick the {targetKind === "job" ? "job" : "tender"}</h2>
          {targetKind === "job" ? (
            jobs.length === 0 ? (
              <EmptyState
                heading="No jobs for this client"
                subtext={`No jobs found for ${selectedClient?.name ?? "the selected client"}.`}
              />
            ) : (
              <select
                className="s7-select"
                value={selectedTargetId}
                onChange={(e) => setSelectedTargetId(e.target.value)}
              >
                <option value="">— pick a job —</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.jobNumber} — {j.name} ({j.status})
                  </option>
                ))}
              </select>
            )
          ) : tenders.length === 0 ? (
            <EmptyState
              heading="No tenders for this client"
              subtext={`No tenders found for ${selectedClient?.name ?? "the selected client"}.`}
            />
          ) : (
            <select
              className="s7-select"
              value={selectedTargetId}
              onChange={(e) => setSelectedTargetId(e.target.value)}
            >
              <option value="">— pick a tender —</option>
              {tenders.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.tenderNumber} — {t.title} ({t.status})
                </option>
              ))}
            </select>
          )}
          <div className="s7-wizard-actions">
            <button type="button" className="s7-btn" onClick={() => setStep(2)}>
              Back
            </button>
            <button
              type="button"
              className="s7-btn s7-btn--primary"
              disabled={!selectedTargetId}
              onClick={() => setStep(4)}
            >
              Next
            </button>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="s7-panel">
          <h2>Confirm and lock</h2>
          <dl className="s7-defs">
            <dt>Client</dt>
            <dd>{selectedClient?.name ?? "—"}</dd>
            <dt>Target</dt>
            <dd>{selectedTargetLabel ?? "—"}</dd>
            <dt>SoR period</dt>
            <dd>
              <select
                className="s7-select"
                value={selectedPeriodId}
                onChange={(e) => setSelectedPeriodId(e.target.value)}
              >
                <option value="">— pick a period —</option>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} ({p.status})
                  </option>
                ))}
              </select>
            </dd>
          </dl>
          <p className="s7-note">
            The snapshot copies the merged rate book (master + client card)
            for {selectedClient?.name ?? "the selected client"} in{" "}
            {selectedPeriod?.label ?? "the selected period"}. Once locked,
            variations and progress claims read from the snapshot, not the
            live catalog.
          </p>
          <div className="s7-wizard-actions">
            <button type="button" className="s7-btn" onClick={() => setStep(3)}>
              Back
            </button>
            <button
              type="button"
              className="s7-btn s7-btn--primary"
              disabled={!selectedPeriodId || submitting}
              onClick={submit}
            >
              {submitting ? "Locking…" : "Lock snapshot"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
