import type { ChangeEventHandler } from "react";
import type { Route } from "next";
import Link from "next/link";

type AuthFieldProps = {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  actionLabel?: string;
  actionHref?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  defaultValue?: string;
  value?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  ariaInvalid?: boolean;
};

const inputClassName =
  "w-full rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm transition duration-200 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/10";

const labelClassName = "text-xs font-semibold text-slate-700";

export function AuthField({
  id,
  label,
  type = "text",
  placeholder,
  actionLabel,
  actionHref,
  name,
  required,
  disabled,
  autoComplete,
  defaultValue,
  value,
  onChange,
  ariaInvalid,
}: AuthFieldProps) {
  const valueProps =
    value !== undefined
      ? { value }
      : defaultValue !== undefined
        ? { defaultValue }
        : {};
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className={labelClassName}>
          {label}
        </label>
        {actionLabel && actionHref ? (
          <Link
            href={actionHref as Route}
            className="text-xs font-semibold text-sky-600 transition-colors hover:text-sky-700"
          >
            {actionLabel}
          </Link>
        ) : null}
      </div>
      <input
        id={id}
        name={name ?? id}
        type={type}
        placeholder={placeholder}
        className={inputClassName}
        required={required}
        disabled={disabled}
        autoComplete={autoComplete}
        onChange={onChange}
        aria-invalid={ariaInvalid}
        {...valueProps}
      />
    </div>
  );
}
