"use client";

type QuarterPoint = {
  label: string;
  exits: number;
  headcount: number;
  rate: number | null;
};

type ChartProps = {
  quarters: QuarterPoint[];
  reasons: Array<[string, number]>;
  embedded?: boolean;
};

const chartWidth = 720;
const chartHeight = 250;
const padding = { top: 24, right: 24, bottom: 42, left: 44 };

function formatReason(value: string) {
  return value.replaceAll("_", " ");
}

function linePath(points: Array<{ x: number; y: number }>) {
  return points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
}

export function TurnoverAnalyticsCharts({ quarters, reasons, embedded = false }: ChartProps) {
  const visibleQuarters = quarters.slice(-8);
  const rates = visibleQuarters.filter((quarter) => quarter.rate != null);
  const maxRate = Math.max(...rates.map((quarter) => quarter.rate ?? 0), 1);
  const maxExits = Math.max(...visibleQuarters.map((quarter) => quarter.exits), 1);
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const points = visibleQuarters.map((quarter, index) => ({
    x: padding.left + (visibleQuarters.length === 1 ? plotWidth / 2 : (index / (visibleQuarters.length - 1)) * plotWidth),
    y: padding.top + plotHeight - ((quarter.rate ?? 0) / maxRate) * plotHeight,
  }));
  const maxReason = Math.max(...reasons.map(([, count]) => count), 1);
  const totalReasons = reasons.reduce((total, [, count]) => total + count, 0);

  return (
    <section className={embedded ? "space-y-5" : "grid gap-6 lg:grid-cols-[1.4fr_0.6fr]"} aria-label="Turnover visual analysis">
      <div className={embedded ? "" : "rounded-2xl border border-border/70 bg-card p-5 md:p-6"}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold">Turnover rate over time</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The line shows the aggregated quarterly rate; bars show the exits behind each point.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-primary" /> Rate
            <span className="ml-2 size-2 rounded-sm bg-primary/20" /> Exits
          </span>
        </div>
        {visibleQuarters.length ? (
          <div className="mt-5 overflow-x-auto">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-auto min-w-150 w-full" role="img" aria-label="Quarterly turnover rate line chart with exit bars">
              {[0, 0.5, 1].map((step) => {
                const y = padding.top + plotHeight * step;
                return <line key={step} x1={padding.left} x2={chartWidth - padding.right} y1={y} y2={y} className="stroke-border" strokeDasharray="3 5" />;
              })}
              {visibleQuarters.map((quarter, index) => {
                const point = points[index];
                const barHeight = (quarter.exits / maxExits) * plotHeight;
                return (
                  <g key={quarter.label}>
                    <rect x={point.x - 16} y={padding.top + plotHeight - barHeight} width="32" height={barHeight} rx="4" className="fill-primary/15" />
                    <text x={point.x} y={chartHeight - 15} textAnchor="middle" className="fill-muted-foreground text-[11px]">{quarter.label}</text>
                    <text x={point.x} y={Math.max(point.y - 10, 14)} textAnchor="middle" className="fill-foreground text-[11px] font-semibold">{quarter.rate == null ? "—" : `${quarter.rate.toFixed(1)}%`}</text>
                  </g>
                );
              })}
              <path d={linePath(points)} fill="none" className="stroke-primary" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {points.map((point, index) => <circle key={visibleQuarters[index].label} cx={point.x} cy={point.y} r="5" className="fill-card stroke-primary" strokeWidth="3" />)}
            </svg>
          </div>
        ) : (
          <p className="py-12 text-sm text-muted-foreground">No quarterly records are available in this period.</p>
        )}
      </div>

      {!embedded && <div className="rounded-2xl border border-border/70 bg-card p-5 md:p-6">
        <h2 className="font-semibold">Reason mix</h2>
        <p className="mt-1 text-sm text-muted-foreground">Reportable exits grouped by their recorded reason.</p>
        <div className="mt-6 space-y-4">
          {reasons.length ? reasons.slice(0, 5).map(([reason, count]) => (
            <div key={reason}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                <span className="truncate capitalize">{formatReason(reason)}</span>
                <strong className="tabular-nums">{count} <span className="font-normal text-muted-foreground">({totalReasons ? ((count / totalReasons) * 100).toFixed(1) : "0.0"}%)</span></strong>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${(count / maxReason) * 100}%` }} />
              </div>
            </div>
          )) : <p className="text-sm text-muted-foreground">No reportable reasons are available.</p>}
        </div>
      </div>}
    </section>
  );
}
