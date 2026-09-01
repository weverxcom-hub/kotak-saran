"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const PALETTE = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--success))",
  "#f59e0b", // amber-500
  "#e11d48", // rose-600
  "hsl(var(--muted-foreground))",
];

/**
 * Donut chart + legend — prop shape sengaja sama dengan BreakdownList
 * ({title, items, total}) supaya bisa dipasang berdampingan tanpa ubah cara
 * data diambil di kedua dashboard.
 */
export function BreakdownChart({
  title,
  items,
  total,
  emptyMessage = "Belum ada data.",
}: {
  title: string;
  items: Array<[string, number]>;
  total: number;
  emptyMessage?: string;
}) {
  const sorted = [...items].sort((a, b) => b[1] - a[1]);
  const chartData = sorted.map(([name, value]) => ({ name, value }));

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {sorted.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row">
          <div className="h-40 w-40 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="60%"
                  outerRadius="100%"
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {chartData.map((entry, idx) => (
                    <Cell key={entry.name} fill={PALETTE[idx % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: number, name: string) => [
                    `${value} (${total > 0 ? Math.round((value / total) * 100) : 0}%)`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="w-full min-w-0 space-y-1.5 text-sm">
            {sorted.map(([label, count], idx) => {
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <li key={label} className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: PALETTE[idx % PALETTE.length] }}
                  />
                  <span className="min-w-0 flex-1 truncate text-foreground" title={label}>
                    {label}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {count} <span className="text-xs">({pct}%)</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
