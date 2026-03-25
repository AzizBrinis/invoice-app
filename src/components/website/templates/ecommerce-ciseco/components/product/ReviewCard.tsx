import type { ProductReviewCard } from "../../types";
import { RatingStars } from "../shared/RatingStars";

type ReviewCardProps = {
  review: ProductReviewCard;
};

export function ReviewCard({ review }: ReviewCardProps) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4 text-xs text-slate-600 shadow-sm">
      <div className="flex items-start gap-3">
        <img
          src={review.avatar}
          alt={review.name}
          className="h-10 w-10 rounded-full object-cover"
          loading="lazy"
        />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-900">{review.name}</p>
          <p className="text-[11px] text-slate-500">{review.date}</p>
        </div>
        <div className="ml-auto">
          <RatingStars rating={review.rating} starClassName="h-3 w-3" />
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-600">{review.body}</p>
    </div>
  );
}
