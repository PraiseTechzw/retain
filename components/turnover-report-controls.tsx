"use client";

import { Download, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

type DetailRow = { quarter: string; department: string; cells: Array<string | number> };
type BaselineRow = { department: string; cells: Array<string | number> };

const pageSize = 8;

export function TurnoverReportControls({
  detailRows,
  baselineRows,
}: {
  detailRows: DetailRow[];
  baselineRows: BaselineRow[];
}) {
  const [department, setDepartment] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const filtered = useMemo(
    () =>
      detailRows.filter((row) =>
        (!department || row.department.toLowerCase().includes(department.toLowerCase())) &&
        (!from || row.quarter >= from) &&
        (!to || row.quarter <= to),
      ),
    [detailRows, department, from, to],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const filteredBaseline = baselineRows.filter((row) =>
    !department || row.department.toLowerCase().includes(department.toLowerCase()),
  );

  function update(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  return (
    <div>
      <div className="bg-muted/20 p-5 md:p-6">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-45 flex-1 text-sm font-medium">Department
            <input value={department} onChange={(event) => update(setDepartment, event.target.value)} placeholder="All departments" className="mt-1 h-10 w-full rounded-lg border border-input bg-card px-3 text-sm" />
          </label>
          <label className="text-sm font-medium">From
            <input value={from} onChange={(event) => update(setFrom, event.target.value)} type="date" className="mt-1 h-10 rounded-lg border border-input bg-card px-3 text-sm" />
          </label>
          <label className="text-sm font-medium">To
            <input value={to} onChange={(event) => update(setTo, event.target.value)} type="date" className="mt-1 h-10 rounded-lg border border-input bg-card px-3 text-sm" />
          </label>
          <a href={`/api/reports/turnover?department=${encodeURIComponent(department)}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:opacity-90"><Download className="size-4" /> Export</a>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{filtered.length} department-quarter rows match the current filters.</p>
      </div>
      <div className="p-0">
        <DataTable columns={["Quarter and department", "Exits", "Average headcount", "Turnover rate", "Leading reason"]} rows={visible.map((row) => row.cells)} />
      </div>
      <Pagination page={currentPage} pageCount={pageCount} onChange={setPage} />
      <div className="border-t border-border/70">
        <div className="bg-muted/20 p-5 md:p-6">
          <h2 className="font-semibold">Baseline records</h2>
          <p className="mt-1 text-sm text-muted-foreground">All-time grouped records; department filter applies here too.</p>
        </div>
        <DataTable columns={["School", "Department", "Reason", "Exits"]} rows={filteredBaseline.slice(0, pageSize).map((row) => row.cells)} />
      </div>
    </div>
  );
}

function Pagination({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (page: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-4 text-sm text-muted-foreground">
      <span>Page {page} of {pageCount}</span>
      <div className="flex gap-2">
        <button type="button" disabled={page === 1} onClick={() => onChange(page - 1)} className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-card disabled:cursor-not-allowed disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="size-4" /></button>
        <button type="button" disabled={page === pageCount} onClick={() => onChange(page + 1)} className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-card disabled:cursor-not-allowed disabled:opacity-40" aria-label="Next page"><ChevronRight className="size-4" /></button>
      </div>
    </div>
  );
}

function DataTable({ columns, rows }: { columns: string[]; rows: Array<Array<string | number>> }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-170 text-left text-sm"><thead><tr className="border-b border-border/70 text-xs uppercase tracking-wide text-muted-foreground">{columns.map((column) => <th key={column} className="px-5 py-3 font-semibold">{column}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={index} className="border-b border-border/50 last:border-0"><td className="px-5 py-4 font-medium">{row[0]}</td>{row.slice(1).map((cell, cellIndex) => <td key={cellIndex} className="px-5 py-4 text-muted-foreground">{cell}</td>)}</tr>) : <tr><td colSpan={columns.length} className="px-5 py-8 text-center text-sm text-muted-foreground">No records match these filters.</td></tr>}</tbody></table></div>;
}
