import { clsx } from "clsx";

type AlertVariant = "success" | "warning" | "error";

const variantClasses: Record<AlertVariant, string> = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100",
  warning:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100",
  error:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100",
};

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  description?: string;
}

export function Alert({
  variant = "success",
  title,
  description,
  className,
  children,
  ...props
}: AlertProps) {
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={clsx(
        "flex items-start gap-3 rounded-lg border px-3 py-2 text-sm",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      <div className="flex-1 space-y-1">
        {title ? <p className="font-medium">{title}</p> : null}
        {description ? <p>{description}</p> : null}
        {children}
      </div>
    </div>
  );
}
