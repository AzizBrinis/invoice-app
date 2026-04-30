import clsx from "clsx";
import { CatalogImage } from "../shared/CatalogImage";

export type OrderSuccessListItem = {
  id: string;
  name: string;
  detail?: string | null;
  price: string;
  quantity: number;
  image: string;
};

type OrderItemsListProps = {
  items: OrderSuccessListItem[];
};

const priceBadgeClassName =
  "inline-flex items-center rounded-full border border-[var(--site-accent)] bg-white px-3 py-1 text-xs font-semibold text-[var(--site-accent)] shadow-sm";

export function OrderItemsList({ items }: OrderItemsListProps) {
  return (
    <div className="divide-y divide-black/5 border-b border-black/5">
      {items.map((item) => (
        <OrderItemRow key={item.id} item={item} />
      ))}
    </div>
  );
}

function OrderItemRow({ item }: { item: OrderSuccessListItem }) {
  return (
    <div className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:gap-6">
      <div className="flex flex-1 items-start gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 p-3 shadow-sm sm:h-24 sm:w-24">
          <CatalogImage
            src={item.image}
            alt={item.name}
            className="h-full w-full object-cover"
            width={192}
            height={192}
            sizes="96px"
          />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900 sm:text-base">
                {item.name}
              </p>
              {item.detail ? (
                <p className="text-xs text-slate-500">{item.detail}</p>
              ) : null}
            </div>
            <PriceBadge className="hidden sm:inline-flex" price={item.price} />
          </div>
          <PriceBadge className="sm:hidden" price={item.price} />
          <p className="text-xs text-slate-500">Qté {item.quantity}</p>
        </div>
      </div>
    </div>
  );
}

function PriceBadge({ price, className }: { price: string; className?: string }) {
  return <span className={clsx(priceBadgeClassName, className)}>{price}</span>;
}
