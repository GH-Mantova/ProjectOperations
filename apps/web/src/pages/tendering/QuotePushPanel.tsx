// QuotePushPanel.tsx -- QUOTE_PUSH_PANEL_V1 (scopecards-s4b)
//
// Mounted at the top of the Cost Summary tab only. Shows push state,
// four-count strip, and Re-push button which opens the diff modal.
// Never applies on its own.

import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { readApiErrorMessage } from "../../lib/api-errors";
import {
  pushPanelState,
  pushCounts,
  type PushPlan,
  type PushableLine,
  type CostLineWithGroup
} from "./quotePush.helpers";
import { QuotePushDiffModal } from "./QuotePushDiffModal";

function fmtCurrency(n: number | string | null | undefined): string {
  if (n === null || n === undefined) return "$0.00";
  const v = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(v)) return "$0.00";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(v);
}

type QuoteForPanel = {
  id: string;
  tenderId: string;
  status: string;
  pushedAt: string | null;
  pushedBy?: { firstName?: string; lastName?: string; name?: string } | null;
  sentAt: string | null;
  ratesLockedAt?: string | null;
};

type Props = {
  quote: QuoteForPanel;
  costLines: CostLineWithGroup[];
  onAfterApply: () => Promise<void>;
};

type PanelData = {
  plan: PushPlan;
  pushable: PushableLine[];
};

export function QuotePushPanel({ quote, costLines, onAfterApply }: Props) {
  const { authFetch } = useAuth();
  const [data, setData] = useState<PanelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [planRes, pushableRes] = await Promise.all([
        authFetch(`/tenders/${quote.tenderId}/quotes/${quote.id}/push-from-estimate/plan`, {
          method: "POST"
        }),
        authFetch(`/tenders/${quote.tenderId}/scope/pushable-lines`)
      ]);
      if (!planRes.ok) throw new Error(await readApiErrorMessage(planRes));
      const plan = (await planRes.json()) as PushPlan;
      const pushable = pushableRes.ok ? ((await pushableRes.json()) as PushableLine[]) : [];
      setData({ plan, pushable });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [quote.id]); // authFetch is stable; load is recreated every render intentionally

  const panelState = data
    ? pushPanelState(
        {
          status: quote.status,
          pushedAt: quote.pushedAt,
          pushedBy: quote.pushedBy,
          sentAt: quote.sentAt,
          ratesLockedAt: quote.ratesLockedAt
        },
        data.plan
      )
    : null;

  const counts = data ? pushCounts(data.pushable, costLines) : null;

  const pillStyle = (): React.CSSProperties => {
    if (!panelState) return {};
    switch (panelState.state) {
      case "up-to-date":
        return {
          background: "var(--status-success-bg)",
          color: "var(--status-success)",
          border: "1px solid var(--status-success-border)"
        };
      case "changed":
        return {
          background: "var(--status-warn-bg)",
          color: "var(--status-warn)",
          border: "1px solid var(--status-warn-border)"
        };
      case "frozen":
      case "never-pushed":
      default:
        return {
          background: "var(--surface-muted)",
          color: "var(--text-muted)",
          border: "1px solid var(--border)"
        };
    }
  };

  const pillLabel = (): string => {
    if (!panelState) return "";
    switch (panelState.state) {
      case "up-to-date": return "Up to date";
      case "changed": return "Estimate changed since push";
      case "frozen": return "Frozen at send";
      case "never-pushed": return "Never pushed";
    }
  };

  return (
    <div
      style={{
        marginBottom: 16,
        padding: "10px 12px",
        border: "1px solid var(--border)",
        borderRadius: 6,
        background: "var(--surface-subtle)"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>From the estimate</span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "1px 5px",
            borderRadius: 4,
            background: "var(--brand-accent)",
            color: "var(--brand-accent-contrast)",
            textTransform: "uppercase",
            letterSpacing: "0.05em"
          }}
        >
          new
        </span>
        {panelState ? (
          <span
            style={{
              marginLeft: "auto",
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 999,
              fontWeight: 600,
              ...pillStyle()
            }}
          >
            {pillLabel()}
          </span>
        ) : null}
      </div>

      {loading ? (
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0" }}>Loading plan&#8230;</p>
      ) : error ? (
        <p style={{ fontSize: 12, color: "var(--status-danger)", margin: "4px 0" }}>{error}</p>
      ) : (
        <>
          {panelState ? (
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 8px" }}>
              {panelState.sentence}
            </p>
          ) : null}

          {counts ? (
            <div
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                marginBottom: 10,
                display: "flex",
                flexWrap: "wrap",
                gap: "4px 16px"
              }}
            >
              <span>
                <strong style={{ color: "var(--text)" }}>In the price</strong>{" "}
                {counts.price.lines} {counts.price.lines === 1 ? "line" : "lines"} &#183;{" "}
                {fmtCurrency(counts.price.amount)} &#183; {counts.price.ticked} ticked
              </span>
              <span>
                <strong style={{ color: "var(--text)" }}>Provisional</strong>{" "}
                {counts.provisional.lines} {counts.provisional.lines === 1 ? "line" : "lines"} &#183;{" "}
                {fmtCurrency(counts.provisional.amount)}
              </span>
              <span>
                <strong style={{ color: "var(--text)" }}>Cost option</strong>{" "}
                {counts.option.lines} {counts.option.lines === 1 ? "option" : "options"} &#183;{" "}
                {fmtCurrency(counts.option.amount)}
              </span>
              <span>
                <strong style={{ color: "var(--text)" }}>Internal only</strong>{" "}
                {counts.internal.lines} left off &#183; {fmtCurrency(counts.internal.amount)}
              </span>
            </div>
          ) : null}

          <div>
            <button
              type="button"
              className="s7-btn s7-btn--primary"
              disabled={quote.status !== "DRAFT"}
              onClick={() => setDiffOpen(true)}
            >
              Re-push from estimate
            </button>

            {quote.status !== "DRAFT" ? (
              <p
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: "var(--text-muted)",
                  padding: "8px 10px",
                  background: "var(--surface-muted)",
                  borderRadius: 4,
                  border: "1px solid var(--border)"
                }}
              >
                This quote was sent on{" "}
                {quote.sentAt
                  ? new Date(quote.sentAt).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "long",
                      year: "numeric"
                    })
                  : "unknown date"}{" "}
                and cannot be changed by a push. Create a new revision and push into that
                &#8212; the current one becomes SUPERSEDED, exactly as it does when you edit it by hand.
              </p>
            ) : null}
          </div>
        </>
      )}

      {diffOpen && data ? (
        <QuotePushDiffModal
          tenderId={quote.tenderId}
          quoteId={quote.id}
          plan={data.plan}
          onClose={() => setDiffOpen(false)}
          onApplied={async () => {
            setDiffOpen(false);
            await onAfterApply();
            await load();
          }}
        />
      ) : null}
    </div>
  );
}
