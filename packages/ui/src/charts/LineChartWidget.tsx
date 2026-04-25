import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type LinePoint = { label: string; value: number };

type LineChartWidgetProps = {
  title: string;
  data: LinePoint[];
  color?: string;
  unit?: string;
  yAxisFormatter?: (value: number) => string;
  tooltipFormatter?: (value: number) => string;
};

export function LineChartWidget({ title, data, color, unit, yAxisFormatter, tooltipFormatter }: LineChartWidgetProps) {
  // Initial Services brand teal — see BarChartWidget for context.
  const stroke = color ?? "#005B61";
  const chartData = data.map((point) => ({ label: point.label, value: point.value }));

  return (
    <div
      className="chart-widget chart-widget--line"
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
            <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border, #e5e7eb)" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--text-muted, #6b7280)" }} />
              <YAxis
                tick={{ fontSize: 12, fill: "var(--text-muted, #6b7280)" }}
                tickFormatter={yAxisFormatter ? (value: number) => yAxisFormatter(Number(value)) : undefined}
                width={yAxisFormatter ? 60 : 40}
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
              <Line type="monotone" dataKey="value" stroke={stroke} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
