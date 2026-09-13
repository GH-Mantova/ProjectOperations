// BP-2 — "Worth chasing" ranked view for bid prioritisation.
// ADVISORY ONLY — rankings must never feed pricing or acceptance decisions.
//
// Default sort: expectedValueScore desc; insufficientData rows always at bottom.
// Tenders with insufficientData: true show "Insufficient data" in win-likelihood
// and priority score cells — never a fake 0 or blank.

import { useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useBidPriorityRanking, type BidPriorityItem } from "../../hooks/useBidPriorityRanking";

// ---- formatting helpers ----

function formatCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0
  }).format(n);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-AU");
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value * 100)}%`;
}

// ---- confidence badge ----

const CONFIDENCE_COLOR: Record<string, { bg: string; text: string }> = {
  LOW: { bg: "#FEF9C3", text: "#854D0E" },
  MEDIUM: { bg: "#DBEAFE", text: "#1E40AF" },
  HIGH: { bg: "#DCFCE7", text: "#166534" }
};

function ConfidenceBadge({ value }: { value: "LOW" | "MEDIUM" | "HIGH" | null }) {
  if (!value) return <span>—</span>;
  const colors = CONFIDENCE_COLOR[value] ?? { bg: "#F3F4F6", text: "#374151" };
  return (
    <span
      className="s7-badge"
      style={{ background: colors.bg, color: colors.text }}
    >
      {value}
    </span>
  );
}

// ---- why-factors tooltip (top 2 factors) ----

function WhyFactors({ factors }: { factors: string[] }) {
  const [open, setOpen] = useState(false);
  const top2 = factors.slice(0, 2);
  if (top2.length === 0) return <span>—</span>;

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "var(--color-teal, #005B61)",
          textDecoration: "underline",
          font: "inherit",
          padding: 0
        }}
        aria-expanded={open}
        aria-label="Show why factors"
      >
        {top2[0]}{top2.length > 1 ? ` +${top2.length - 1}` : ""}
      </button>
      {open ? (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            zIndex: 50,
            top: "100%",
            left: 0,
            marginTop: 4,
            background: "#1F2937",
            color: "#F9FAFB",
            borderRadius: 6,
            padding: "8px 12px",
            minWidth: 220,
            maxWidth: 320,
            fontSize: 13,
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)"
          }}
        >
          <ul style={{ margin: 0, padding: "0 0 0 16px" }}>
            {top2.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{
              display: "block",
              marginTop: 6,
              fontSize: 11,
              background: "transparent",
              border: "none",
              color: "#9CA3AF",
              cursor: "pointer",
              padding: 0
            }}
          >
            Close
          </button>
        </div>
      ) : null}
    </span>
  );
}

// ---- sort types ----

type SortKey =
  | "title"
  | "client"
  | "estimatedValue"
  | "dueDate"
  | "pointEstimate"
  | "confidence"
  | "expectedValueScore";

type SortDir = "asc" | "desc";

const CONFIDENCE_ORDER: Record<string, number> = { HIGH: 2, MEDIUM: 1, LOW: 0 };

function sortRows(
  rows: BidPriorityItem[],
  sortKey: SortKey,
  sortDir: SortDir
): BidPriorityItem[] {
  // Partition: scored rows first, insufficientData rows always at bottom.
  const scored = rows.filter((r) => !r.insufficientData);
  const insufficient = rows.filter((r) => r.insufficientData);

  const compare = (a: BidPriorityItem, b: BidPriorityItem): number => {
    let result = 0;
    switch (sortKey) {
      case "title":
        result = a.title.localeCompare(b.title);
        break;
      case "client":
        result = a.client.localeCompare(b.client);
        break;
      case "estimatedValue": {
        const av = a.estimatedValue ? Number(a.estimatedValue) : -Infinity;
        const bv = b.estimatedValue ? Number(b.estimatedValue) : -Infinity;
        result = av - bv;
        break;
      }
      case "dueDate": {
        const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        result = ad - bd;
        break;
      }
      case "pointEstimate": {
        const ap = a.pointEstimate ?? -Infinity;
        const bp = b.pointEstimate ?? -Infinity;
        result = ap - bp;
        break;
      }
      case "confidence": {
        const ac = CONFIDENCE_ORDER[a.confidence ?? ""] ?? -1;
        const bc = CONFIDENCE_ORDER[b.confidence ?? ""] ?? -1;
        result = ac - bc;
        break;
      }
      case "expectedValueScore": {
        const as_ = a.expectedValueScore ?? -Infinity;
        const bs_ = b.expectedValueScore ?? -Infinity;
        result = as_ - bs_;
        break;
      }
    }
    return sortDir === "asc" ? result : -result;
  };

  scored.sort(compare);
  // insufficientData rows keep stable order (or can be sorted among themselves).
  insufficient.sort(compare);

  return [...scored, ...insufficient];
}

// ---- main component ----

export function BidPriorityRankingPage() {
  const { data, isLoading, error, reload } = useBidPriorityRanking();
  const [sortKey, setSortKey] = useState<SortKey>("expectedValueScore");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return null;
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  const sorted = sortRows(data, sortKey, sortDir);

  return (
    <div style={{ padding: "24px 32px" }}>
      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            fontFamily: "var(--font-heading, Syne)",
            fontSize: 24,
            margin: "0 0 8px"
          }}
        >
          Bid priority ranking
        </h1>
        {/* ADVISORY LABEL — non-removable, required by BP plan guardrail D4 */}
        <div
          role="note"
          aria-label="Advisory notice"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "#FEF9C3",
            border: "1px solid #FDE047",
            borderRadius: 6,
            padding: "6px 12px",
            fontSize: 13,
            color: "#713F12",
            fontWeight: 500
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          Rankings are advisory only and do not feed pricing or acceptance decisions.
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          style={{
            background: "#FEF2F2",
            border: "1px solid #FCA5A5",
            borderRadius: 8,
            padding: "16px 20px",
            color: "#991B1B",
            marginBottom: 16
          }}
        >
          <strong>Could not load rankings.</strong> {error}
          <button
            type="button"
            className="s7-btn s7-btn--ghost s7-btn--sm"
            onClick={() => void reload()}
            style={{ marginLeft: 12 }}
          >
            Retry
          </button>
        </div>
      ) : null}

      <div className="s7-table-scroll">
        <table className="s7-table">
          <thead>
            <tr>
              {(
                [
                  { key: "title" as SortKey, label: "Tender" },
                  { key: "client" as SortKey, label: "Client" },
                  { key: "estimatedValue" as SortKey, label: "Est. Value" },
                  { key: "dueDate" as SortKey, label: "Due Date" },
                  { key: "pointEstimate" as SortKey, label: "Win-likelihood" },
                  { key: "confidence" as SortKey, label: "Confidence" },
                  { key: "expectedValueScore" as SortKey, label: "Priority Score" },
                ] as const
              ).map(({ key, label }) => (
                <th key={key}>
                  <button
                    type="button"
                    className="tender-register__th-btn"
                    onClick={() => handleSort(key)}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: "inherit",
                      font: "inherit"
                    }}
                  >
                    {label}{sortIndicator(key)}
                  </button>
                </th>
              ))}
              <th>Why</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={`skel-${i}`}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j}><Skeleton height={14} /></td>
                  ))}
                </tr>
              ))
            ) : sorted.length === 0 && !error ? (
              <tr>
                <td colSpan={8}>
                  <EmptyState
                    heading="No open tenders to rank"
                    subtext="Open tenders with win-likelihood data will appear here once available."
                  />
                </td>
              </tr>
            ) : (
              sorted.map((item) => (
                <tr key={item.tenderId} className="s7-table__row--clickable">
                  <td>
                    <Link
                      to={`/tenders/${item.tenderId}`}
                      style={{ color: "var(--color-teal, #005B61)", fontWeight: 500 }}
                    >
                      {item.title}
                    </Link>
                  </td>
                  <td>{item.client || "—"}</td>
                  <td>{formatCurrency(item.estimatedValue)}</td>
                  <td>{formatDate(item.dueDate)}</td>
                  <td>
                    {item.insufficientData ? (
                      <span style={{ color: "var(--text-muted, #6B7280)", fontStyle: "italic" }}>
                        Insufficient data
                      </span>
                    ) : (
                      formatPercent(item.pointEstimate)
                    )}
                  </td>
                  <td>
                    {item.insufficientData ? (
                      <span>—</span>
                    ) : (
                      <ConfidenceBadge value={item.confidence} />
                    )}
                  </td>
                  <td>
                    {item.insufficientData ? (
                      <span style={{ color: "var(--text-muted, #6B7280)", fontStyle: "italic" }}>
                        Insufficient data
                      </span>
                    ) : (
                      <strong>{formatCurrency(item.expectedValueScore)}</strong>
                    )}
                  </td>
                  <td>
                    <WhyFactors factors={item.whyFactors} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
