/**
 * PushBackDialog — S6b push-back UI for the SoR admin page.
 *
 * Fetches GET rates/:id/push-back/preview, shows impact sections, then
 * posts { ordinary, oneAndHalf, double } to POST rates/:id/push-back.
 *
 * Error flows:
 *   403 — period not ACTIVE: danger refusal dialog
 *   409 — stale/nothing: short dialog with Reopen preview
 *   400/404 — short dialog with server message
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { CenteredModal } from "@project-ops/ui";
import { readApiErrorMessage } from "../../lib/api-errors";

// ── API shapes (mirrors sor-push-back.service.ts) ─────────────────────────────

type FigureField = "ordinary" | "oneAndHalf" | "double";

type FigurePreview = {
  field: FigureField;
  current: number | null;
  proposed: number | null;
  lands: boolean;
  hubColumnName?: string;
  cellsKey?: string;
  reason?: string;
};

type FutureLock = {
  tenderId: string;
  tenderNumber: string | null;
  title: string | null;
  status: string;
  wouldLockToday: number | null;
  willLockAfter: number | null;
};

type FrozenRecord =
  | {
      mechanism: "TenderRateEntry";
      tenderRateSetId: string;
      tenderId: string;
      key: string;
      value: number | null;
      lockedAt: string; // serialised Date
      lockedBy: string | null;
    }
  | {
      mechanism: "JobSorSnapshotRate";
      snapshotId: string;
      jobId: string | null;
      tenderId: string | null;
      ordinary: number | null;
      oneAndHalf: number | null;
      double: number | null;
    }
  | {
      mechanism: "SorClientRateEntry";
      entryId: string;
      cardId: string;
      position: string;
      ordinary: number | null;
      oneAndHalf: number | null;
      double: number | null;
    };

type PushBackPreview = {
  line: {
    id: string;
    name: string;
    class: string | null;
    unit: string | null;
    category: string;
    periodId: string;
    periodStatus: string;
    sourceType: string;
    ordinary: number | null;
    oneAndHalf: number | null;
    double: number | null;
  };
  target:
    | {
        model: "RateRow";
        rateTableId: string;
        rateTableSlug: string;
        rateRowId: string;
      }
    | {
        model: "SubcontractorRate";
        subRateId: string;
        vendorName: string;
        discipline: string;
        unit: string;
      };
  figures: FigurePreview[];
  landingCount: number;
  nothingToPush: boolean;
  futureLocks: FutureLock[];
  futureLocksReason?: string;
  frozen: FrozenRecord[];
};

type PushBackResult = {
  landed: string[];
  futureLockCount: number;
  frozenCount: number;
  targetModel: "RateRow" | "SubcontractorRate";
  targetId: string;
};

// ── Props ─────────────────────────────────────────────────────────────────────

export type PushBackDialogProps = {
  rateId: string;
  /** Displayed in the header */
  rateName: string;
  /** For "Confirm — N figures, M future locks" POST body */
  rateOrdinary: number | null;
  rateOneAndHalf: number | null;
  rateDouble: number | null;
  /** Period selector context for 403 "Switch to active period" action */
  periods: Array<{ id: string; label: string; status: string }>;
  onSwitchPeriod: (periodId: string) => void;
  onClose: () => void;
  onSuccess: (result: PushBackResult) => void;
  authFetch: (path: string, init?: RequestInit) => Promise<Response>;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNum(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDelta(delta: number): string {
  const sign = delta >= 0 ? "+" : "";
  return (
    sign +
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 2,
    }).format(delta)
  );
}

function fmtDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const FIELD_LABEL: Record<FigureField, string> = {
  ordinary: "Ordinary",
  oneAndHalf: "1.5×",
  double: "2×",
};

function frozenWhy(rec: FrozenRecord): string {
  switch (rec.mechanism) {
    case "TenderRateEntry":
      return "Copied into rate-set at lock (originalValue/overrideValue); key still names this row — the locked value is immutable.";
    case "JobSorSnapshotRate":
      return "All three figures copied at the moment the job snapshot was taken — never reads live hub.";
    case "SorClientRateEntry":
      return "Override recorded against the SoR line, not the hub — client rate cards are not affected by hub pushes.";
  }
}

function frozenRecord(rec: FrozenRecord): string {
  switch (rec.mechanism) {
    case "TenderRateEntry":
      return rec.tenderRateSetId.slice(0, 8);
    case "JobSorSnapshotRate":
      return rec.snapshotId.slice(0, 8);
    case "SorClientRateEntry":
      return rec.entryId.slice(0, 8);
  }
}

function frozenName(rec: FrozenRecord): string {
  switch (rec.mechanism) {
    case "TenderRateEntry":
      return `TenderRateSet — tender ${rec.tenderId.slice(0, 8)}`;
    case "JobSorSnapshotRate":
      return `Job snapshot${rec.jobId ? ` — job ${rec.jobId.slice(0, 8)}` : ""}${rec.tenderId ? ` / tender ${rec.tenderId.slice(0, 8)}` : ""}`;
    case "SorClientRateEntry":
      return `Client rate entry — card ${rec.cardId.slice(0, 8)} · ${rec.position}`;
  }
}

function frozenLockedByAt(rec: FrozenRecord): string {
  if (rec.mechanism === "TenderRateEntry") {
    const by = rec.lockedBy ? rec.lockedBy.slice(0, 8) : "system";
    const at = fmtDate(typeof rec.lockedAt === "string" ? rec.lockedAt : new Date(rec.lockedAt).toISOString());
    return `${by} · ${at}`;
  }
  return "—";
}

function frozenWhatHolds(rec: FrozenRecord): string {
  switch (rec.mechanism) {
    case "TenderRateEntry":
      return `key: ${rec.key} · value: ${fmtNum(rec.value)}`;
    case "JobSorSnapshotRate":
      return `ord ${fmtNum(rec.ordinary)} / 1.5× ${fmtNum(rec.oneAndHalf)} / 2× ${fmtNum(rec.double)}`;
    case "SorClientRateEntry":
      return `ord ${fmtNum(rec.ordinary)} / 1.5× ${fmtNum(rec.oneAndHalf)} / 2× ${fmtNum(rec.double)}`;
  }
}

// ── Section heading ───────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h4
      style={{
        margin: "20px 0 8px",
        fontSize: 12,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: "var(--text-muted)",
      }}
    >
      {children}
    </h4>
  );
}

// ── Mini badge ────────────────────────────────────────────────────────────────

function MiniBadge({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: "default" | "success" | "warning" | "muted";
}) {
  const bg =
    variant === "success"
      ? "var(--status-success, #22c55e)"
      : variant === "warning"
        ? "var(--status-warning, #f59e0b)"
        : variant === "muted"
          ? "var(--surface-2, #f3f4f6)"
          : "var(--surface-2, #f3f4f6)";
  const color =
    variant === "success" || variant === "warning"
      ? "#fff"
      : "var(--text-secondary, #374151)";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 7px",
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 600,
        background: bg,
        color,
      }}
    >
      {children}
    </span>
  );
}

// ── Scrollable table wrapper ───────────────────────────────────────────────────

function SmallTable({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 12,
        }}
      >
        {children}
      </table>
    </div>
  );
}

function Th({ children, align = "left" }: { children?: ReactNode; align?: "left" | "right" | "center" }) {
  return (
    <th
      style={{
        textAlign: align,
        padding: "4px 8px",
        borderBottom: "1px solid var(--border-subtle, rgba(0,0,0,0.08))",
        fontWeight: 600,
        color: "var(--text-muted)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, align = "left", muted = false, colSpan }: { children?: ReactNode; align?: "left" | "right" | "center"; muted?: boolean; colSpan?: number }) {
  return (
    <td
      colSpan={colSpan}
      style={{
        textAlign: align,
        padding: "4px 8px",
        borderBottom: "1px solid var(--border-subtle, rgba(0,0,0,0.06))",
        color: muted ? "var(--text-muted)" : undefined,
        verticalAlign: "top",
      }}
    >
      {children}
    </td>
  );
}

// ── Main dialog ───────────────────────────────────────────────────────────────

type DialogState =
  | { phase: "loading" }
  | { phase: "preview"; data: PushBackPreview }
  | { phase: "saving"; data: PushBackPreview }
  | { phase: "error-403"; message: string }
  | { phase: "error-409"; message: string }
  | { phase: "error-other"; message: string };

export function PushBackDialog({
  rateId,
  rateName,
  rateOrdinary,
  rateOneAndHalf,
  rateDouble,
  periods,
  onSwitchPeriod,
  onClose,
  onSuccess,
  authFetch,
}: PushBackDialogProps) {
  const [state, setState] = useState<DialogState>({ phase: "loading" });

  const fetchPreview = useCallback(async () => {
    setState({ phase: "loading" });
    const res = await authFetch(`/schedule-of-rates/rates/${rateId}/push-back/preview`);
    if (!res.ok) {
      const msg = await readApiErrorMessage(res);
      if (res.status === 403) {
        setState({ phase: "error-403", message: msg });
      } else if (res.status === 409) {
        setState({ phase: "error-409", message: msg });
      } else {
        setState({ phase: "error-other", message: msg });
      }
      return;
    }
    const data = (await res.json()) as PushBackPreview;
    setState({ phase: "preview", data });
  }, [authFetch, rateId]);

  useEffect(() => {
    void fetchPreview();
  }, [fetchPreview]);

  const handleConfirm = async (currentData: PushBackPreview) => {
    setState({ phase: "saving", data: currentData });
    const res = await authFetch(`/schedule-of-rates/rates/${rateId}/push-back`, {
      method: "POST",
      body: JSON.stringify({
        ordinary: rateOrdinary,
        oneAndHalf: rateOneAndHalf,
        double: rateDouble,
      }),
    });
    if (!res.ok) {
      const msg = await readApiErrorMessage(res);
      if (res.status === 409) {
        setState({ phase: "error-409", message: msg });
      } else if (res.status === 403) {
        setState({ phase: "error-403", message: msg });
      } else {
        setState({ phase: "error-other", message: msg });
      }
      return;
    }
    const result = (await res.json()) as PushBackResult;
    onSuccess(result);
  };

  // ── 403 refusal ────────────────────────────────────────────────────────────
  if (state.phase === "error-403") {
    const activeP = periods.find((p) => p.status === "ACTIVE");
    return (
      <CenteredModal
        title="Push-back refused"
        onClose={onClose}
        maxWidth={520}
        footer={
          <>
            <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose}>
              Close
            </button>
            {activeP && (
              <button
                type="button"
                className="s7-btn s7-btn--primary"
                onClick={() => {
                  onSwitchPeriod(activeP.id);
                  onClose();
                }}
              >
                Switch to {activeP.label}
              </button>
            )}
          </>
        }
      >
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 8,
            background: "var(--status-danger-bg, #fef2f2)",
            border: "1px solid var(--status-danger, #ef4444)",
            marginBottom: 16,
          }}
        >
          <p style={{ margin: 0, fontWeight: 600, color: "var(--status-danger, #b91c1c)" }}>
            {state.message}
          </p>
        </div>
        <p style={{ margin: "0 0 8px", fontSize: 13 }}>
          <strong>Why:</strong> Push-back is only permitted while the SoR period is ACTIVE.
          Expired or future-dated periods are locked — their rates are used as historical reference.
        </p>
        <p style={{ margin: "0 0 8px", fontSize: 13 }}>
          <strong>Nothing was written.</strong> The hub figures have not changed.
        </p>
        <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: 13 }}>What to do instead:</p>
        <ol style={{ margin: "0 0 8px", paddingLeft: 18, fontSize: 13 }}>
          <li>Switch to the ACTIVE period using the button below (or the period selector at the top of the page).</li>
          <li>Locate the equivalent line in the active period.</li>
          <li>Open its push-back dialog and confirm the figures you want to land.</li>
        </ol>
      </CenteredModal>
    );
  }

  // ── 409 stale/nothing ──────────────────────────────────────────────────────
  if (state.phase === "error-409") {
    return (
      <CenteredModal
        title="Push-back conflict"
        onClose={onClose}
        maxWidth={420}
        footer={
          <>
            <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="s7-btn s7-btn--primary"
              onClick={() => void fetchPreview()}
            >
              Reopen preview
            </button>
          </>
        }
      >
        <p style={{ margin: 0, fontSize: 14 }}>{state.message}</p>
      </CenteredModal>
    );
  }

  // ── 400/404 ────────────────────────────────────────────────────────────────
  if (state.phase === "error-other") {
    return (
      <CenteredModal
        title="Cannot push back"
        onClose={onClose}
        maxWidth={420}
        footer={
          <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose}>
            Close
          </button>
        }
      >
        <p style={{ margin: 0, fontSize: 14 }}>{state.message}</p>
      </CenteredModal>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (state.phase === "loading") {
    return (
      <CenteredModal title="Push back to hub" onClose={onClose} maxWidth={680}>
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading preview…</p>
      </CenteredModal>
    );
  }

  // ── Preview / Saving ───────────────────────────────────────────────────────
  const isSaving = state.phase === "saving";
  const data = state.phase === "preview" || state.phase === "saving" ? state.data : null;

  if (!data) return null;

  const { line, target, figures, landingCount, futureLocks, frozen } = data;

  const lineLabel = [line.name, line.class].filter(Boolean).join(" · ");

  const targetBadge =
    target.model === "RateRow"
      ? "in-place cells update · row id preserved"
      : "supersede · line re-anchored";

  const changeLogRows = figures
    .filter((f) => f.lands)
    .map((f) => ({ field: `hub.${f.field}`, old: f.current, proposed: f.proposed }));

  return (
    <CenteredModal
      title={`Push back to hub — ${rateName}`}
      onClose={isSaving ? () => {} : onClose}
      busy={isSaving}
      maxWidth={760}
      footer={
        <>
          {isSaving && (
            <span style={{ flex: 1, fontSize: 12, color: "var(--text-muted)" }}>
              Pushing figures to hub…
            </span>
          )}
          {!isSaving && (
            <p
              style={{
                flex: 1,
                margin: 0,
                fontSize: 11,
                color: "var(--text-muted)",
                textAlign: "left",
              }}
            >
              This changes the master price every tender locks from here on. It cannot be undone from
              here — correcting it means another push.
            </p>
          )}
          <button
            type="button"
            className="s7-btn s7-btn--ghost"
            disabled={isSaving}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            disabled={isSaving || data.nothingToPush || landingCount === 0}
            title={
              data.nothingToPush
                ? "Nothing to push — all figures match the hub"
                : undefined
            }
            onClick={() => void handleConfirm(data)}
          >
            Confirm — {landingCount} figure{landingCount !== 1 ? "s" : ""},{" "}
            {futureLocks.length} future lock{futureLocks.length !== 1 ? "s" : ""}
          </button>
        </>
      }
    >
      <div style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: 4 }}>
        {/* 1. Header sub-line */}
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
          Period {line.periodId.slice(0, 8)} · {line.category} · {lineLabel} · id{" "}
          {line.id.slice(0, 8)} · {landingCount} figure{landingCount !== 1 ? "s" : ""}
        </p>

        {/* 2. Target chain */}
        <SectionHeading>Target</SectionHeading>
        <div
          style={{
            padding: "8px 12px",
            background: "var(--surface-2, #f9fafb)",
            borderRadius: 6,
            fontSize: 12,
          }}
        >
          {target.model === "RateRow" ? (
            <span>
              SorRate → RateTable{" "}
              <code
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 11,
                }}
              >
                {target.rateTableSlug}
              </code>{" "}
              → RateRow{" "}
              <code
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 11,
                }}
              >
                {target.rateRowId.slice(0, 8)}
              </code>{" "}
              (same id, new cells)
            </span>
          ) : (
            <span>
              SorRate → SubcontractorRate{" "}
              <code
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 11,
                }}
              >
                {target.subRateId.slice(0, 8)}
              </code>{" "}
              ({target.vendorName})
            </span>
          )}
          <span style={{ marginLeft: 8 }}>
            <MiniBadge variant={target.model === "RateRow" ? "success" : "warning"}>
              {targetBadge}
            </MiniBadge>
          </span>
        </div>

        {/* 3. What is being pushed */}
        <SectionHeading>What is being pushed</SectionHeading>
        <SmallTable>
          <thead>
            <tr>
              <Th>SoR field</Th>
              <Th>Hub column</Th>
              <Th>Cells key</Th>
              <Th align="right">Hub now</Th>
              <Th align="right">Becomes</Th>
              <Th align="right">&Delta;</Th>
              <Th align="center">Lands?</Th>
            </tr>
          </thead>
          <tbody>
            {figures.map((fig) => {
              const delta =
                fig.lands && fig.proposed != null && fig.current != null
                  ? fig.proposed - fig.current
                  : null;
              return (
                <tr key={fig.field}>
                  <Td>{FIELD_LABEL[fig.field]}</Td>
                  <Td muted={!fig.hubColumnName}>{fig.hubColumnName ?? "—"}</Td>
                  <Td muted={!fig.cellsKey}>
                    {fig.cellsKey ? (
                      <code
                        style={{
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                          fontSize: 11,
                        }}
                      >
                        {fig.cellsKey.slice(0, 16)}
                      </code>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td align="right">{fmtNum(fig.current)}</Td>
                  <Td align="right" muted={!fig.lands}>
                    {fig.lands ? fmtNum(fig.proposed) : "—"}
                  </Td>
                  <Td align="right" muted={delta == null}>
                    {delta != null ? fmtDelta(delta) : "—"}
                  </Td>
                  <Td align="center">
                    {fig.lands ? (
                      <MiniBadge variant="success">yes</MiniBadge>
                    ) : (
                      <MiniBadge variant="muted">
                        no — {fig.reason ?? "stays on the SoR line"}
                      </MiniBadge>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </SmallTable>

        {/* 4. Future locks */}
        <SectionHeading>
          Affected — tenders that have not locked yet ({futureLocks.length})
        </SectionHeading>
        {data.futureLocksReason && (
          <p
            style={{
              margin: "0 0 8px",
              fontSize: 12,
              color: "var(--text-muted)",
              fontStyle: "italic",
            }}
          >
            {data.futureLocksReason}
          </p>
        )}
        {futureLocks.length === 0 ? (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 6,
              border: "1px solid var(--border-subtle, rgba(0,0,0,0.08))",
              fontSize: 12,
              color: "var(--text-secondary)",
            }}
          >
            <em>No tender is currently waiting to lock on this rate.</em>
            <p style={{ margin: "6px 0 0", color: "var(--text-muted)" }}>
              Either all open tenders have already locked their rates, or this line is in a
              reference table / vendor keyspace that the rate-set lock does not enumerate.
            </p>
          </div>
        ) : (
          <SmallTable>
            <thead>
              <tr>
                <Th>Tender</Th>
                <Th>Name</Th>
                <Th>Stage</Th>
                <Th align="right">Would lock today</Th>
                <Th align="right">Will lock after</Th>
                <Th align="right">&Delta; at lock</Th>
              </tr>
            </thead>
            <tbody>
              {futureLocks.map((fl) => {
                const delta =
                  fl.willLockAfter != null && fl.wouldLockToday != null
                    ? fl.willLockAfter - fl.wouldLockToday
                    : null;
                return (
                  <tr key={fl.tenderId}>
                    <Td muted>
                      <code
                        style={{
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                          fontSize: 11,
                        }}
                      >
                        {fl.tenderNumber ?? fl.tenderId.slice(0, 8)}
                      </code>
                    </Td>
                    <Td>{fl.title ?? "—"}</Td>
                    <Td muted>{fl.status}</Td>
                    <Td align="right">{fmtNum(fl.wouldLockToday)}</Td>
                    <Td align="right">{fmtNum(fl.willLockAfter)}</Td>
                    <Td align="right" muted={delta == null}>
                      {delta != null ? fmtDelta(delta) : "—"}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </SmallTable>
        )}

        {/* 5. Proof — frozen */}
        <SectionHeading>Proof — untouched records already locked</SectionHeading>
        <div
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            background: "var(--surface-2, #f9fafb)",
            fontSize: 12,
            marginBottom: 8,
            border: "1px solid var(--border-subtle, rgba(0,0,0,0.08))",
          }}
        >
          Locked snapshots, rate-set entries, and client rate cards are immutable — this push
          will not change any of the records listed below.
        </div>
        {frozen.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            No locked records reference this line.
          </p>
        ) : (
          <SmallTable>
            <thead>
              <tr>
                <Th>Record</Th>
                <Th>Name</Th>
                <Th>Locked by, at</Th>
                <Th>What holds it</Th>
                <Th>Why it cannot move</Th>
              </tr>
            </thead>
            <tbody>
              {frozen.map((rec, i) => (
                <tr key={i}>
                  <Td muted>
                    <code
                      style={{
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                        fontSize: 11,
                      }}
                    >
                      {frozenRecord(rec)}
                    </code>
                  </Td>
                  <Td>{frozenName(rec)}</Td>
                  <Td muted>{frozenLockedByAt(rec)}</Td>
                  <Td muted>{frozenWhatHolds(rec)}</Td>
                  <Td muted>{frozenWhy(rec)}</Td>
                </tr>
              ))}
            </tbody>
          </SmallTable>
        )}

        {/* 6. Will be written */}
        <SectionHeading>Will be written</SectionHeading>
        {changeLogRows.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No figures will land.</p>
        ) : (
          <SmallTable>
            <thead>
              <tr>
                <Th>Field</Th>
                <Th align="right">Old</Th>
                <Th align="right">New</Th>
              </tr>
            </thead>
            <tbody>
              {changeLogRows.map((r) => (
                <tr key={r.field}>
                  <Td>
                    <code
                      style={{
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                        fontSize: 11,
                      }}
                    >
                      {r.field}
                    </code>
                  </Td>
                  <Td align="right" muted>
                    {fmtNum(r.old)}
                  </Td>
                  <Td align="right">{fmtNum(r.proposed)}</Td>
                </tr>
              ))}
              <tr>
                <Td>
                  <code
                    style={{
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      fontSize: 11,
                    }}
                  >
                    sor.rate.push-back
                  </code>
                </Td>
                <Td muted colSpan={2} align="right">
                  audit action
                </Td>
              </tr>
            </tbody>
          </SmallTable>
        )}
      </div>
    </CenteredModal>
  );
}
