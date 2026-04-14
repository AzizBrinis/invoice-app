import type { ProductReviewCard } from "../../types";
import { useCisecoI18n } from "../../i18n";
import { RatingStars } from "../shared/RatingStars";

type ReviewCardProps = {
  review: ProductReviewCard;
};

export function ReviewCard({ review }: ReviewCardProps) {
  const { t } = useCisecoI18n();
  const initial = t(review.name).trim().slice(0, 1).toUpperCase() || "A";
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4 text-xs text-slate-600 shadow-sm">
      <div className="flex items-start gap-3">
        {review.avatar ? (
          <img
            src={review.avatar}
            alt={t(review.name)}
            className="h-10 w-10 rounded-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
            {initial}
          </div>
        )}
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-900">{t(review.name)}</p>
          <p className="text-[11px] text-slate-500">{t(review.date)}</p>
        </div>
        <div className="ml-auto">
          <RatingStars rating={review.rating} starClassName="h-3 w-3" />
        </div>
      </div>
      {review.title ? (
        <p className="mt-3 text-sm font-semibold text-slate-900">{t(review.title)}</p>
      ) : null}
      <p className="mt-3 text-xs text-slate-600">{t(review.body)}</p>
    </div>
  );
}
