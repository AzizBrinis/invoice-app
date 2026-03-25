import clsx from "clsx";
import { StarIcon } from "./Icons";

type RatingStarsProps = {
  rating: number;
  className?: string;
  starClassName?: string;
};

export function RatingStars({
  rating,
  className,
  starClassName = "h-4 w-4",
}: RatingStarsProps) {
  const percentage = Math.min(100, Math.max(0, (rating / 5) * 100));
  return (
    <div className={clsx("relative inline-flex", className)} aria-hidden="true">
      <div className="flex text-slate-200">
        {Array.from({ length: 5 }).map((_, index) => (
          <StarIcon key={`empty-${index}`} className={starClassName} />
        ))}
      </div>
      <div
        className="absolute inset-0 flex overflow-hidden text-amber-500"
        style={{ width: `${percentage}%` }}
      >
        {Array.from({ length: 5 }).map((_, index) => (
          <StarIcon key={`fill-${index}`} className={starClassName} />
        ))}
      </div>
    </div>
  );
}
