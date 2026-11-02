"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

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
  const [page, setPage] = useState(1);
  const [baselinePage, setBaselinePage] = useState(1);
  const filtered = detailRows;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const filteredBaseline = baselineRows;
  const baselinePageCount = Math.max(1, Math.ceil(filteredBaseline.length / pageSize));
  const currentBaselinePage = Math.min(baselinePage, baselinePageCount);
  const visibleBaseline = filteredBaseline.slice((currentBaselinePage - 1) * pageSize, currentBaselinePage * pageSize);

  return (
    <div>
      <div className="p-0">
        <DataTable columns={["Quarter and department", "Exits", "Average headcount", "Turnover rate", "Leading reason"]} rows={visible.map((row) => row.cells)} />
      </div>
      <Pagination page={currentPage} pageCount={pageCount} onChange={setPage} />
      <div className="mt-4 bg-muted/20">
        <div className="p-5 md:p-6">
          <h2 className="font-semibold">Baseline records</h2>
          <p className="mt-1 text-sm text-muted-foreground">All-time grouped records; department filter applies here too.</p>
        </div>
        <DataTable columns={["School", "Department", "Reason", "Exits"]} rows={visibleBaseline.map((row) => row.cells)} />
        <Pagination page={currentBaselinePage} pageCount={baselinePageCount} onChange={setBaselinePage} />
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
  return <div className="overflow-x-auto" data-ui><table className="w-full min-w-170 text-left text-sm"><thead><tr>{columns.map((column) => <th key={column} className="border-b border-border/70 px-5 py-3 text-left text-xs font-semibold text-muted-foreground">{column}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={index} className="border-b border-border/50 last:border-0"><td className="px-5 py-4 font-medium">{row[0]}</td>{row.slice(1).map((cell, cellIndex) => <td key={cellIndex} className="px-5 py-4 text-muted-foreground">{cell}</td>)}</tr>) : <tr><td colSpan={columns.length} className="px-5 py-8 text-center text-sm text-muted-foreground">No records match these filters.</td></tr>}</tbody></table></div>;
}
