import clsx from "clsx";
import type { ProductInfoCard } from "../../types";
import { InfoIcon } from "../shared/Icons";

const infoToneClasses: Record<ProductInfoCard["tone"], string> = {
  mint: "bg-emerald-50",
  sky: "bg-sky-50",
  sun: "bg-amber-50",
  rose: "bg-rose-50",
};

const infoIconClasses: Record<ProductInfoCard["tone"], string> = {
  mint: "text-emerald-600",
  sky: "text-sky-600",
  sun: "text-amber-600",
  rose: "text-rose-600",
};

type InfoCardProps = {
  item: ProductInfoCard;
};

export function InfoCard({ item }: InfoCardProps) {
  return (
    <div
      className={clsx(
        "flex items-start gap-3 rounded-2xl p-4 text-xs text-slate-600 shadow-sm",
        infoToneClasses[item.tone],
      )}
    >
      <div
        className={clsx(
          "flex h-9 w-9 items-center justify-center rounded-full bg-white/80",
          infoIconClasses[item.tone],
        )}
      >
        <InfoIcon name={item.icon} />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
        <p>{item.description}</p>
      </div>
    </div>
  );
}
