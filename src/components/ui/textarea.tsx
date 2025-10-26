import { clsx } from "clsx";
import { forwardRef } from "react";

export type TextareaProps =
  React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, rows = 4, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      className={clsx("input", "resize-y", className)}
      {...props}
    />
  ),
);

Textarea.displayName = "Textarea";
