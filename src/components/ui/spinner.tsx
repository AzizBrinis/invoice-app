import { clsx } from "clsx";

type SpinnerSize = "sm" | "md" | "lg";

const sizeClasses: Record<SpinnerSize, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-5 w-5 border-2",
  lg: "h-8 w-8 border-4",
};

interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
  label?: string;
}

export function Spinner({ size = "md", className, label }: SpinnerProps) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
      <span
        className={clsx(
          "inline-flex animate-spin rounded-full border-current border-t-transparent",
          sizeClasses[size],
          className,
        )}
        role="status"
        aria-label={label ?? "Chargement"}
      />
      {label ? <span className="font-medium">{label}</span> : null}
    </span>
  );
}
