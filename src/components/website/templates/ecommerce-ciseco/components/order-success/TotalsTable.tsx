import type { OrderSuccessTotals } from "../../types";

type TotalsTableProps = {
  totals: OrderSuccessTotals;
};

export function TotalsTable({ totals }: TotalsTableProps) {
  return (
    <div className="space-y-3 pt-6">
      <TotalsRow label="Subtotal" value={totals.subtotal} />
      <TotalsRow label="Shipping" value={totals.shipping} />
      <TotalsRow label="Taxes" value={totals.taxes} />
      <div className="pt-4">
        <div className="flex items-center justify-between border-t border-black/5 pt-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Total
          </span>
          <span className="text-base font-semibold text-slate-900">
            {totals.total}
          </span>
        </div>
      </div>
    </div>
  );
}

type TotalsRowProps = {
  label: string;
  value: string;
};

function TotalsRow({ label, value }: TotalsRowProps) {
  return (
    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
      <span>{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}
