import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type DonutSlice = { label: string; value: number; color?: string };

type DonutChartWidgetProps = {
  title: string;
  data: DonutSlice[];
};

const DEFAULT_PALETTE = [
  "#1f4bff",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#0ea5e9",
  "#ec4899",
  "#64748b"
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
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
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
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
