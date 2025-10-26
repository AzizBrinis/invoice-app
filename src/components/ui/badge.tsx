import { clsx } from "clsx";

type BadgeVariant =
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "neutral";

const variants: Record<BadgeVariant, string> = {
  info:
    "border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/50 dark:bg-blue-500/20 dark:text-blue-200",
  success:
    "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/20 dark:text-emerald-200",
  warning:
    "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/20 dark:text-amber-200",
  danger:
    "border border-red-200 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-500/20 dark:text-red-200",
  neutral:
    "border border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
};

export interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "neutral", children, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex min-w-[2.5rem] items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
