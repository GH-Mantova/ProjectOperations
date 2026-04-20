import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type BarPoint = { label: string; value: number };

type BarChartWidgetProps = {
  title: string;
  data: BarPoint[];
  color?: string;
  unit?: string;
  yAxisFormatter?: (value: number) => string;
  tooltipFormatter?: (value: number) => string;
};

export function BarChartWidget({ title, data, color, unit, yAxisFormatter, tooltipFormatter }: BarChartWidgetProps) {
  const fill = color ?? "var(--brand-primary, #1f4bff)";
  const chartData = data.map((point) => ({ label: point.label, value: point.value }));

  return (
    <div
      className="chart-widget chart-widget--bar"
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
            <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border, #e5e7eb)" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--text-muted, #6b7280)" }} />
              <YAxis
                tick={{ fontSize: 12, fill: "var(--text-muted, #6b7280)" }}
                tickFormatter={yAxisFormatter ? (value: number) => yAxisFormatter(Number(value)) : undefined}
                width={yAxisFormatter ? 60 : 40}
                allowDecimals={false}
              />
              <Tooltip
                formatter={(value) =>
                  tooltipFormatter
                    ? tooltipFormatter(Number(value))
                    : unit
                      ? `${value} ${unit}`
                      : String(value)
                }
                contentStyle={{
                  background: "var(--surface-tooltip, #111827)",
                  color: "var(--text-on-dark, #ffffff)",
                  borderRadius: 6,
                  border: "none",
                  fontSize: 12
                }}
              />
              <Bar dataKey="value" fill={fill} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
