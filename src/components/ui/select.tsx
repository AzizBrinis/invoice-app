import { clsx } from "clsx";
import { forwardRef } from "react";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={clsx("input", className)}
      {...props}
    >
      {children}
    </select>
  ),
);

Select.displayName = "Select";
