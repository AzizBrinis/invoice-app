import type {
  OrderSuccessAddress,
  OrderSuccessPayment,
} from "../../types";

type InfoBlocksProps = {
  shipping: OrderSuccessAddress;
  payment: OrderSuccessPayment;
};

export function InfoBlocks({ shipping, payment }: InfoBlocksProps) {
  return (
    <div className="mt-8 grid gap-8 sm:grid-cols-2">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Shipping address
        </p>
        <div className="space-y-1 text-sm text-slate-600">
          <p className="font-semibold uppercase text-slate-900">
            {shipping.name}
          </p>
          {shipping.lines.map((line) => (
            <p key={line} className="uppercase">
              {line}
            </p>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Payment information
        </p>
        <div className="space-y-2 text-sm text-slate-600">
          <span className="inline-flex w-fit items-center rounded-md bg-blue-600 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
            {payment.brand}
          </span>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Ending with {payment.last4}
          </p>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Expires {payment.expires}
          </p>
        </div>
      </div>
    </div>
  );
}
