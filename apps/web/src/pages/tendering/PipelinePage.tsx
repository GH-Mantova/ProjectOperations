// PipelinePage — /tenders/pipeline
// Two tabs: Board (the kanban from TenderingPage) and Insights (the four
// panels from PipelineDashboardPage). Tab state lives in the URL (?tab=board
// | ?tab=insights) so tabs are linkable and survive a refresh.
//
// PIPELINE_FOLDED — proof-of-landing marker for the pipeline-fold cluster.

import { useSearchParams } from "react-router-dom";
import { TenderingPage } from "./TenderingPage";
import { PipelineInsightsContent } from "../crm/PipelineDashboardPage";

type Tab = "board" | "insights";

function isValidTab(value: string | null): value is Tab {
  return value === "board" || value === "insights";
}

export function PipelinePage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const rawTab = searchParams.get("tab");
  const activeTab: Tab = isValidTab(rawTab) ? rawTab : "board";

  function switchTab(tab: Tab) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      return next;
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Tab strip */}
      <div
        role="tablist"
        aria-label="Pipeline view"
        style={{
          display: "flex",
          gap: 0,
          borderBottom: "1px solid #e5e7eb",
          padding: "0 24px",
          background: "var(--surface, #fff)"
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "board"}
          onClick={() => switchTab("board")}
          style={{
            padding: "12px 20px",
            border: "none",
            borderBottom: activeTab === "board" ? "2px solid var(--color-teal, #005B61)" : "2px solid transparent",
            background: "transparent",
            cursor: "pointer",
            fontWeight: activeTab === "board" ? 600 : 400,
            fontSize: 14,
            color: activeTab === "board" ? "var(--color-teal, #005B61)" : "var(--text-muted, #666)"
          }}
          data-testid="pipeline-tab-board"
        >
          Board
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "insights"}
          onClick={() => switchTab("insights")}
          style={{
            padding: "12px 20px",
            border: "none",
            borderBottom: activeTab === "insights" ? "2px solid var(--color-teal, #005B61)" : "2px solid transparent",
            background: "transparent",
            cursor: "pointer",
            fontWeight: activeTab === "insights" ? 600 : 400,
            fontSize: 14,
            color: activeTab === "insights" ? "var(--color-teal, #005B61)" : "var(--text-muted, #666)"
          }}
          data-testid="pipeline-tab-insights"
        >
          Insights
        </button>
      </div>

      {/* Tab panels */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {activeTab === "board" ? (
          // Board tab: the full TenderingPage (kanban + Pipeline/Register toggle).
          // Rendered in-place so /tenders and /tenders/pipeline both show the
          // same board — one component, zero duplication.
          <div data-testid="pipeline-board-tab">
            <TenderingPage />
          </div>
        ) : (
          // Insights tab: the four panels from PipelineDashboardPage extracted
          // into PipelineInsightsContent. Data fetch kept identical.
          <div style={{ padding: "24px 32px" }} data-testid="pipeline-insights-tab">
            <h1 style={{ fontFamily: "var(--font-heading, Syne)", fontSize: 24, margin: "0 0 16px" }}>
              Pipeline insights
            </h1>
            <PipelineInsightsContent />
          </div>
        )}
      </div>
    </div>
  );
}
