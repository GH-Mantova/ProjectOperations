import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type DonutSlice = { label: string; value: number; color?: string };

type DonutChartWidgetProps = {
  title: string;
  data: DonutSlice[];
};

// Initial Services brand palette: teal, orange, dark-grey, light-grey, black,
// and two muted complements for series with > 5 slices. Recharts can't read
// CSS variables directly, so the brand hexes live here.
const DEFAULT_PALETTE = [
  "#005B61", // teal — primary
  "#FEAA6D", // orange — secondary
  "#242424", // dark grey — tertiary
  "#F6F6F6", // light grey — background tone
  "#94A3B8", // slate — neutral fill
  "#FED7AA", // soft orange — secondary tint
  "#22C55E", // accent green
  "#000000"  // black — final fallback
];

export function DonutChartWidget({ title, data }: DonutChartWidgetProps) {
  const chartData = data.map((slice, index) => ({
    label: slice.label,
    value: slice.value,
    color: slice.color ?? DEFAULT_PALETTE[index % DEFAULT_PALETTE.length]
  }));

  return (
    <div
      className="chart-widget chart-widget--donut"
      style={{
        background: "var(--surface-card, #ffffff)",
        border: "1px solid var(--surface-border, #e5e7eb)",
        borderRadius: "var(--radius-lg, 12px)",
        padding: "16px 18px"
      }}
    >
      <h3
        className="chart-widget__title"
        style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary, #111827)", marginBottom: 12 }}
      >
        {title}
      </h3>
      {chartData.length === 0 ? (
        <p style={{ color: "var(--text-muted, #6b7280)", fontSize: 13 }}>No data available.</p>
      ) : (
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 8, right: 8, bottom: 32, left: 8 }}>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="45%"
                innerRadius={50}
                outerRadius={82}
                paddingAngle={2}
              >
                {chartData.map((slice) => (
                  <Cell key={slice.label} fill={slice.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => String(value)}
                contentStyle={{
                  background: "var(--surface-tooltip, #111827)",
                  color: "var(--text-on-dark, #ffffff)",
                  borderRadius: 6,
                  border: "none",
                  fontSize: 12
                }}
              />
              <Legend
                verticalAlign="bottom"
                align="center"
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
