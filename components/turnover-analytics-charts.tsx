"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type QuarterPoint = {
  label: string;
  exits: number;
  headcount: number;
  rate: number | null;
};

type ChartProps = {
  quarters: QuarterPoint[];
  reasons: Array<[string, number]>;
  departments: Array<[string, number]>;
  embedded?: boolean;
  showTrend?: boolean;
};

const colors = ["#2563eb", "#0f766e", "#d97706", "#be123c", "#0891b2", "#475569"];

function chartData(entries: Array<[string, number]>) {
  return entries.map(([name, value]) => ({ name: readableLabel(name), value }));
}

function readableLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function percent(value: number) {
  return `${value.toFixed(1)}%`;
}

export function TurnoverAnalyticsCharts({
  quarters,
  reasons,
  departments,
  embedded = false,
  showTrend = true,
}: ChartProps) {
  const reasonData = chartData(reasons.slice(0, 6));
  const departmentData = chartData(departments.slice(0, 6));
  const chartClass = embedded ? "rounded-xl bg-muted/20 p-4" : "rounded-xl border border-border/70 bg-card p-5";

  return (
    <section className={embedded ? "space-y-5" : "space-y-6"} aria-label="Turnover visual analysis">
      {showTrend && <div className={chartClass}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Turnover rate and exits</h2>
            <p className="mt-1 text-sm text-muted-foreground">Completed quarters only, with the exit volume behind each rate.</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" /> Rate</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-primary/30" /> Exits</span>
          </div>
        </div>
        {quarters.length ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={quarters} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 5" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="rate" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={percent} width={44} />
                <YAxis yAxisId="exits" orientation="right" hide />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                  formatter={(value, name) => [name === "rate" ? percent(Number(value)) : value, name === "rate" ? "Turnover rate" : "Exits"]}
                />
                <Bar yAxisId="exits" dataKey="exits" fill="hsl(var(--primary) / 0.18)" radius={[4, 4, 0, 0]} barSize={24} />
                <Line yAxisId="rate" type="monotone" dataKey="rate" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: "hsl(var(--card))", strokeWidth: 3 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="py-12 text-sm text-muted-foreground">No completed quarters match this range.</p>}
      </div>}

      {!embedded && <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border/70 bg-card p-5">
          <h2 className="font-semibold">Exit reason mix</h2>
          <p className="mt-1 text-sm text-muted-foreground">Share of reportable completed exits.</p>
          {reasonData.length ? (
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={reasonData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3}>
                    {reasonData.map((entry, index) => <Cell key={entry.name} fill={colors[index % colors.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => [value, "Exits"]} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="py-12 text-sm text-muted-foreground">No reason data is available.</p>}
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-5">
          <h2 className="font-semibold">Exits by department</h2>
          <p className="mt-1 text-sm text-muted-foreground">Departments with the highest recorded exit volume.</p>
          {departmentData.length ? (
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentData} layout="vertical" margin={{ top: 4, right: 12, left: 12, bottom: 4 }}>
                  <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 5" />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" width={120} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => [value, "Exits"]} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="py-12 text-sm text-muted-foreground">No department data is available.</p>}
        </div>
      </div>}
    </section>
  );
}
