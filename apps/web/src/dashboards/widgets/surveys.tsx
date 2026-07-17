import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import type { WidgetProps } from "../types";
import { KpiTile } from "./shared";

// ── Client Satisfaction KPI tile ────────────────────────────────────────────
// Shows mean survey score across all responses in the last 30 days,
// plus total response count. Navigates to /surveys/satisfaction.

type SatisfactionSummary = {
  clientId: string;
  count: number;
  meanScore: number | null;
  lastSubmittedAt: string | null;
  latestComments: string[];
};

type SurveyResponse = {
  id: string;
  overallScore: number;
  submittedAt: string;
  clientId: string;
};

export function ClientSatisfactionKpi(_props: WidgetProps) {
  const { authFetch } = useAuth();

  const { data, isLoading } = useQuery<{ meanScore: number | null; count: number }>({
    queryKey: ["dashboard", "client-satisfaction-kpi"],
    queryFn: async () => {
      // Fetch recent survey responses to compute 30-day aggregate.
      // Uses GET /clients/:clientId/satisfaction per client — instead
      // we query responses endpoint if available, otherwise fall back.
      // MVP: fetch all clients then all satisfactions (small data set).
      const res = await authFetch("/master-data/clients?page=1&pageSize=200");
      if (!res.ok) return { meanScore: null, count: 0 };
      const body = await res.json();
      const clients: { id: string }[] = body.items ?? [];

      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const summaries: SatisfactionSummary[] = await Promise.all(
        clients.map(async (c) => {
          const r = await authFetch(`/clients/${c.id}/satisfaction`);
          if (!r.ok) return { clientId: c.id, count: 0, meanScore: null, lastSubmittedAt: null, latestComments: [] };
          return (await r.json()) as SatisfactionSummary;
        })
      );

      // Filter to responses with at least one response and count recent ones.
      const withData = summaries.filter(
        (s) => s.count > 0 && s.lastSubmittedAt && s.lastSubmittedAt >= cutoff
      );
      if (withData.length === 0) return { meanScore: null, count: 0 };

      const scores = withData.flatMap((s) => (s.meanScore !== null ? [s.meanScore] : []));
      const mean = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
      const totalCount = withData.reduce((sum, s) => sum + s.count, 0);

      return { meanScore: mean !== null ? Math.round(mean * 100) / 100 : null, count: totalCount };
    },
    staleTime: 5 * 60_000
  });

  const value = isLoading ? "—" : data?.meanScore !== null && data?.meanScore !== undefined
    ? `${data.meanScore.toFixed(1)} / 5`
    : "—";
  const subtitle = isLoading ? "" : data?.count ? `${data.count} response${data.count === 1 ? "" : "s"} (30d)` : "No responses yet";
  const accent = data?.meanScore !== null && data?.meanScore !== undefined
    ? data.meanScore >= 4 ? "#22C55E" : data.meanScore >= 3 ? "#FEAA6D" : "#EF4444"
    : "#94A3B8";

  return (
    <Link to="/surveys/satisfaction" style={{ textDecoration: "none", color: "inherit", height: "100%", display: "block" }}>
      <KpiTile label="Client satisfaction" value={value} subtitle={subtitle} accent={accent} />
    </Link>
  );
}
