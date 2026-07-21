import { useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { SchedulerWorkspacePage } from "./SchedulerWorkspacePage";
import { SchedulerGridPage } from "./SchedulerGridPage";
import { AvailabilityReportPage } from "./AvailabilityReportPage";

type SchedulerView = "board" | "grid" | "availability";

const VIEWS: Array<{ id: SchedulerView; label: string }> = [
  { id: "board", label: "Board" },
  { id: "grid", label: "Grid" },
  { id: "availability", label: "Availability" }
];

const LEGACY_SEGMENT_TO_VIEW: Record<string, SchedulerView> = {
  grid: "grid",
  "availability-report": "availability"
};

function resolveView(raw: string | null): SchedulerView {
  if (raw === "grid" || raw === "availability") return raw;
  return "board";
}

export function SchedulerHomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useParams<{ legacyView?: string }>();
  const navigate = useNavigate();

  const legacyView = params.legacyView ? LEGACY_SEGMENT_TO_VIEW[params.legacyView] : undefined;

  useEffect(() => {
    if (legacyView) {
      const search = legacyView === "board" ? "" : `?view=${legacyView}`;
      navigate(`/scheduler${search}`, { replace: true });
    }
  }, [legacyView, navigate]);

  if (legacyView) return null;

  const view = resolveView(searchParams.get("view"));

  const selectView = (next: SchedulerView) => {
    const nextParams = new URLSearchParams(searchParams);
    if (next === "board") {
      nextParams.delete("view");
    } else {
      nextParams.set("view", next);
    }
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <div className="sched-home">
      <div
        className="tender-page__view-toggle"
        role="tablist"
        aria-label="Scheduler view"
        style={{ margin: "16px 24px 0" }}
      >
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={view === v.id}
            className={
              view === v.id
                ? "tender-page__view-btn tender-page__view-btn--active"
                : "tender-page__view-btn"
            }
            onClick={() => selectView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>
      {view === "board" ? <SchedulerWorkspacePage /> : null}
      {view === "grid" ? <SchedulerGridPage /> : null}
      {view === "availability" ? <AvailabilityReportPage /> : null}
    </div>
  );
}
