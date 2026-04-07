type TotalsRow = {
  label: string;
  value: string;
};

type TotalsTableProps = {
  rows: TotalsRow[];
  total: string;
};

export function TotalsTable({ rows, total }: TotalsTableProps) {
  return (
    <div className="space-y-3 pt-6">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500"
        >
          <span>{row.label}</span>
          <span className="text-sm font-semibold text-slate-900">{row.value}</span>
        </div>
      ))}
      <div className="pt-4">
        <div className="flex items-center justify-between border-t border-black/5 pt-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Total
          </span>
          <span className="text-base font-semibold text-slate-900">{total}</span>
        </div>
      </div>
    </div>
  );
}
